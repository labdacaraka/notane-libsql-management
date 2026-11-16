use std::time::Duration;

pub fn is_port_free(port: u16) -> bool {
    port_check::is_local_port_free(port)
}

pub async fn check_tcp_responding(addr: &str, port: u16, timeout_ms: u64) -> bool {
    let target = format!("{}:{}", addr, port);
    tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        tokio::net::TcpStream::connect(&target),
    )
    .await
    .map(|res| res.is_ok())
    .unwrap_or(false)
}
