use anyhow::{Context, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub a: String,
    pub iat: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ns: Option<String>,
}

pub fn create_jwt_token(
    private_key_pem: &str,
    permission: &str,
    duration_days: Option<u32>,
    namespace: Option<&str>,
) -> Result<String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("System time is before Unix epoch")?
        .as_secs();

    let exp = duration_days.map(|days| now + (days as u64 * 86400));

    let claims = Claims {
        a: permission.to_string(),
        iat: now,
        exp,
        ns: namespace.map(|s| s.to_string()),
    };

    let header = Header::new(Algorithm::EdDSA);
    let encoding_key = EncodingKey::from_ed_pem(private_key_pem.as_bytes())
        .context("Invalid Ed25519 PKCS#8 PEM private key")?;

    let token = encode(&header, &claims, &encoding_key)
        .context("Failed to sign JWT with EdDSA")?;

    Ok(token)
}

pub fn extract_unverified_claims(token: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    use base64::engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD};
    use base64::Engine;

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .or_else(|_| URL_SAFE.decode(parts[1]))
        .ok()?;
    serde_json::from_slice(&payload_bytes).ok()
}
