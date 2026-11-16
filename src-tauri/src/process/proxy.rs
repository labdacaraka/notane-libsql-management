use crate::crypto::jwt::extract_unverified_claims;
use crate::storage::database::Storage;
use anyhow::{anyhow, Result};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;
use tracing::{debug, info, warn};

pub struct ProxyHandle {
    shutdown_tx: oneshot::Sender<()>,
}

impl ProxyHandle {
    pub fn stop(self) {
        let _ = self.shutdown_tx.send(());
    }
}

pub async fn start_proxy(
    listen_addr: &str,
    listen_port: u16,
    target_port: u16,
    storage: Storage,
    instance_id: String,
) -> Result<oneshot::Sender<()>> {
    let bind_addr = format!("{}:{}", listen_addr, listen_port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .map_err(|e| anyhow!("Failed to bind reverse proxy on {}: {e}", bind_addr))?;

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        info!(
            "Smart reverse proxy listening on {} -> internal sqld on 127.0.0.1:{}",
            bind_addr, target_port
        );
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    info!("Smart reverse proxy on {} received shutdown signal", bind_addr);
                    break;
                }
                accept_res = listener.accept() => {
                    match accept_res {
                        Ok((client_stream, client_addr)) => {
                            let storage_clone = storage.clone();
                            let instance_id_clone = instance_id.clone();
                            tokio::spawn(async move {
                                if let Err(e) = handle_connection(
                                    client_stream,
                                    client_addr,
                                    target_port,
                                    storage_clone,
                                    instance_id_clone,
                                ).await {
                                    debug!("Proxy connection closed or error from {}: {e}", client_addr);
                                }
                            });
                        }
                        Err(e) => {
                            warn!("Accept error on proxy {}: {e}", bind_addr);
                            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                        }
                    }
                }
            }
        }
    });

    Ok(shutdown_tx)
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    for i in 0..buf.len() {
        if i + 3 < buf.len() && &buf[i..i + 4] == b"\r\n\r\n" {
            return Some(i + 4);
        }
        if i + 1 < buf.len() && &buf[i..i + 2] == b"\n\n" {
            return Some(i + 2);
        }
    }
    None
}

async fn handle_connection(
    mut client: TcpStream,
    client_addr: SocketAddr,
    target_port: u16,
    storage: Storage,
    instance_id: String,
) -> Result<()> {
    let mut buf = Vec::with_capacity(4096);
    let mut temp = [0u8; 1024];
    let mut header_end_idx = None;

    while buf.len() < 65536 {
        let n = client.read(&mut temp).await?;
        if n == 0 {
            return Ok(());
        }
        buf.extend_from_slice(&temp[..n]);

        if let Some(pos) = find_header_end(&buf) {
            header_end_idx = Some(pos);
            break;
        }
    }

    let header_end = match header_end_idx {
        Some(pos) => pos,
        None => return Err(anyhow!("Request header too large or truncated")),
    };

    let header_bytes = &buf[..header_end];
    let remaining_body_bytes = &buf[header_end..];

    let header_str = String::from_utf8_lossy(header_bytes);

    let (rewritten_headers, is_websocket) =
        resolve_and_rewrite_request(&header_str, target_port, &storage, &instance_id).await?;

    let mut upstream = TcpStream::connect(("127.0.0.1", target_port))
        .await
        .map_err(|e| anyhow!("Failed to connect to internal sqld on 127.0.0.1:{}: {e}", target_port))?;

    upstream.write_all(rewritten_headers.as_bytes()).await?;

    if !remaining_body_bytes.is_empty() {
        upstream.write_all(remaining_body_bytes).await?;
    }

    let (mut client_read, mut client_write) = client.into_split();
    let (mut upstream_read, mut upstream_write) = upstream.into_split();

    let client_to_upstream = tokio::io::copy(&mut client_read, &mut upstream_write);
    let upstream_to_client = tokio::io::copy(&mut upstream_read, &mut client_write);

    tokio::select! {
        _ = client_to_upstream => {}
        _ = upstream_to_client => {}
    }

    debug!("Finished proxy stream for {}", client_addr);
    let _ = is_websocket;
    Ok(())
}

pub async fn resolve_and_rewrite_request(
    header_str: &str,
    target_port: u16,
    storage: &Storage,
    instance_id: &str,
) -> Result<(String, bool)> {
    let mut lines = header_str.split("\r\n");
    let mut first_line = lines.next().unwrap_or("").trim();
    if first_line.is_empty() {
        lines = header_str.split("\n");
        first_line = lines.next().unwrap_or("").trim();
    }

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 3 {
        return Err(anyhow!("Invalid HTTP request line: {}", first_line));
    }
    let method = parts[0];
    let path = parts[1];
    let version = parts[2];

    let mut target_ns: Option<String> = None;
    let mut rewritten_path = path.to_string();

    // Strategy 1: Path prefix
    // e.g. /v1/namespaces/Gggggg/v2/pipeline -> target_ns: Gggggg, rewritten_path: /v2/pipeline
    // e.g. /v1/namespaces/Gggggg -> target_ns: Gggggg, rewritten_path: /v2/pipeline
    // e.g. /dev/Gggggg/v2/pipeline -> target_ns: Gggggg, rewritten_path: /v2/pipeline
    if let Some(rest) = path.strip_prefix("/v1/namespaces/") {
        let segs: Vec<&str> = rest.splitn(2, '/').collect();
        if !segs[0].is_empty() {
            target_ns = Some(segs[0].to_string());
            if segs.len() > 1 && !segs[1].is_empty() {
                rewritten_path = format!("/{}", segs[1]);
            } else {
                rewritten_path = "/v2/pipeline".to_string();
            }
        }
    } else if let Some(rest) = path.strip_prefix("/dev/") {
        let segs: Vec<&str> = rest.splitn(2, '/').collect();
        if !segs[0].is_empty() {
            target_ns = Some(segs[0].to_string());
            if segs.len() > 1 && !segs[1].is_empty() {
                rewritten_path = format!("/{}", segs[1]);
            } else {
                rewritten_path = "/v2/pipeline".to_string();
            }
        }
    }

    let mut headers = Vec::new();
    let mut is_websocket = false;
    let mut auth_token: Option<String> = None;
    let mut original_host: Option<String> = None;

    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((key, val)) = line.split_once(':') {
            let key = key.trim();
            let val = val.trim();
            if key.eq_ignore_ascii_case("upgrade") && val.eq_ignore_ascii_case("websocket") {
                is_websocket = true;
            }
            if key.eq_ignore_ascii_case("host") {
                original_host = Some(val.to_string());
            }
            if key.eq_ignore_ascii_case("authorization") {
                if let Some(token) = val.strip_prefix("Bearer ").or_else(|| val.strip_prefix("bearer ")) {
                    auth_token = Some(token.trim().to_string());
                }
            }
            headers.push((key.to_string(), val.to_string()));
        }
    }

    // Strategy 2: JWT claims (ns or sub)
    if target_ns.is_none() {
        if let Some(token) = &auth_token {
            if let Some(claims) = extract_unverified_claims(token) {
                if let Some(ns) = claims.get("ns").and_then(|v| v.as_str()) {
                    if !ns.trim().is_empty() {
                        target_ns = Some(ns.to_string());
                    }
                } else if let Some(sub) = claims.get("sub").and_then(|v| v.as_str()) {
                    if !sub.trim().is_empty() {
                        target_ns = Some(sub.to_string());
                    }
                }
            }
        }
    }

    let dbs = storage.list_databases(instance_id).unwrap_or_default();

    // Strategy 3: Verify token against known databases in this instance
    if target_ns.is_none() {
        if let Some(token) = &auth_token {
            for db in &dbs {
                if let Some(pubkey) = &db.jwt_public_key {
                    if let Ok(dec_key) = DecodingKey::from_ed_pem(pubkey.as_bytes()) {
                        let mut val = Validation::new(Algorithm::EdDSA);
                        val.validate_exp = false;
                        val.required_spec_claims.clear();
                        if decode::<serde_json::Value>(token, &dec_key, &val).is_ok() {
                            target_ns = Some(db.name.clone());
                            break;
                        }
                    }
                }
            }
        }
    }

    // Strategy 4: Host header subdomain
    if target_ns.is_none() {
        if let Some(host) = &original_host {
            let host_without_port = host.split(':').next().unwrap_or(host);
            if host_without_port.parse::<std::net::IpAddr>().is_err() {
                if let Some(first_seg) = host_without_port.split('.').next() {
                    if !first_seg.is_empty() && first_seg != "localhost" {
                        target_ns = Some(first_seg.to_string());
                    }
                }
            }
        }
    }

    // Strategy 5: Single database fallback for this instance
    if target_ns.is_none() && dbs.len() == 1 {
        target_ns = Some(dbs[0].name.clone());
    }

    let target_host = match target_ns {
        Some(ns) => format!("{}.localhost:{}", ns, target_port),
        None => format!("localhost:{}", target_port),
    };

    let mut out = format!("{} {} {}\r\n", method, rewritten_path, version);
    let mut host_written = false;
    let mut connection_written = false;

    for (k, v) in headers {
        if k.eq_ignore_ascii_case("host") {
            out.push_str(&format!("Host: {}\r\n", target_host));
            host_written = true;
        } else if k.eq_ignore_ascii_case("connection") {
            if is_websocket {
                out.push_str(&format!("{}: {}\r\n", k, v));
            } else {
                out.push_str("Connection: close\r\n");
            }
            connection_written = true;
        } else {
            out.push_str(&format!("{}: {}\r\n", k, v));
        }
    }

    if !host_written {
        out.push_str(&format!("Host: {}\r\n", target_host));
    }
    if !connection_written && !is_websocket {
        out.push_str("Connection: close\r\n");
    }

    out.push_str("\r\n");

    Ok((out, is_websocket))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::jwt::create_jwt_token;
    use crate::crypto::keygen::generate_ed25519_keypair;
    use crate::storage::encryption::Cipher;
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    fn setup_test_storage() -> (Storage, String, String) {
        let temp = NamedTempFile::new().unwrap();
        let key = [42u8; 32];
        let cipher = Arc::new(Cipher::new(&key));
        let storage = Storage::new(temp.path(), cipher).unwrap();

        let inst = crate::core::models::Instance {
            id: "inst-1".into(),
            name: "test-instance".into(),
            http_listen_addr: "0.0.0.0".into(),
            http_port: 8080,
            admin_listen_addr: "127.0.0.1".into(),
            admin_port: 8081,
            data_dir: "/tmp/test".into(),
            admin_auth_key: None,
            auto_start: false,
            auto_restart: true,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        storage.create_instance(&inst).unwrap();

        let keypair = generate_ed25519_keypair().unwrap();
        let db = crate::core::models::DatabaseNamespace {
            id: "db-1".into(),
            instance_id: "inst-1".into(),
            name: "mydb".into(),
            jwt_public_key: Some(keypair.public_key_pem.clone()),
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        storage
            .create_database(&db, Some(&keypair.private_key_pem))
            .unwrap();

        (storage, keypair.private_key_pem, keypair.public_key_pem)
    }

    #[tokio::test]
    async fn test_path_based_rewrite() {
        let (storage, _, _) = setup_test_storage();
        let raw_req = "POST /v1/namespaces/mydb/v2/pipeline HTTP/1.1\r\nHost: 192.168.0.199:8080\r\n\r\n";
        let (rewritten, is_ws) = resolve_and_rewrite_request(raw_req, 18080, &storage, "inst-1")
            .await
            .unwrap();

        assert!(!is_ws);
        assert!(rewritten.contains("POST /v2/pipeline HTTP/1.1"));
        assert!(rewritten.contains("Host: mydb.localhost:18080"));
        assert!(rewritten.contains("Connection: close"));
    }

    #[tokio::test]
    async fn test_token_ns_claim_rewrite() {
        let (storage, privkey, _) = setup_test_storage();
        let token = create_jwt_token(&privkey, "rw", Some(1), Some("mydb")).unwrap();

        let raw_req = format!(
            "POST /v2/pipeline HTTP/1.1\r\nHost: 192.168.0.199:8080\r\nAuthorization: Bearer {}\r\n\r\n",
            token
        );
        let (rewritten, _) = resolve_and_rewrite_request(&raw_req, 18080, &storage, "inst-1")
            .await
            .unwrap();

        assert!(rewritten.contains("POST /v2/pipeline HTTP/1.1"));
        assert!(rewritten.contains("Host: mydb.localhost:18080"));
    }

    #[tokio::test]
    async fn test_single_database_fallback_rewrite() {
        let (storage, _, _) = setup_test_storage();
        let raw_req = "POST /v2/pipeline HTTP/1.1\r\nHost: 192.168.0.199:8080\r\n\r\n";
        let (rewritten, _) = resolve_and_rewrite_request(raw_req, 18080, &storage, "inst-1")
            .await
            .unwrap();

        assert!(rewritten.contains("Host: mydb.localhost:18080"));
    }

    #[tokio::test]
    async fn test_websocket_upgrade_preserved() {
        let (storage, _, _) = setup_test_storage();
        let raw_req = "GET /v2 HTTP/1.1\r\nHost: 192.168.0.199:8080\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n";
        let (rewritten, is_ws) = resolve_and_rewrite_request(raw_req, 18080, &storage, "inst-1")
            .await
            .unwrap();

        assert!(is_ws);
        assert!(rewritten.contains("Upgrade: websocket"));
        assert!(rewritten.contains("Connection: Upgrade"));
        assert!(!rewritten.contains("Connection: close"));
    }
}
