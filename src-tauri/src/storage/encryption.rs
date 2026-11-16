use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{anyhow, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::RngCore;

pub struct Cipher {
    cipher: Aes256Gcm,
}

impl Cipher {
    pub fn new(key: &[u8; 32]) -> Self {
        Self {
            cipher: Aes256Gcm::new_from_slice(key).expect("32 bytes is valid AES-256 key"),
        }
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow!("Encryption error: {e}"))?;

        let mut combined = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(combined))
    }

    pub fn decrypt(&self, encoded: &str) -> Result<String> {
        let combined = BASE64.decode(encoded)?;
        if combined.len() < 12 {
            return Err(anyhow!("Ciphertext is too short to contain nonce"));
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let decrypted_bytes = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow!("Decryption error: {e}"))?;

        let text = String::from_utf8(decrypted_bytes)?;
        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_roundtrip() {
        let key = [42u8; 32];
        let cipher = Cipher::new(&key);
        let secret = "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----";

        let encrypted = cipher.encrypt(secret).expect("encrypt");
        assert_ne!(encrypted, secret);

        let decrypted = cipher.decrypt(&encrypted).expect("decrypt");
        assert_eq!(decrypted, secret);
    }
}
