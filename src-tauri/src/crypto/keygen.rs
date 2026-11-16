use anyhow::Result;
use ed25519_dalek::pkcs8::spki::der::pem::LineEnding;
use ed25519_dalek::pkcs8::{EncodePrivateKey, EncodePublicKey};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

pub struct KeyPairPem {
    pub private_key_pem: String,
    pub public_key_pem: String,
}

pub fn generate_ed25519_keypair() -> Result<KeyPairPem> {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    let private_key_pem = signing_key.to_pkcs8_pem(LineEnding::LF)?.to_string();
    let public_key_pem = verifying_key.to_public_key_pem(LineEnding::LF)?;

    Ok(KeyPairPem {
        private_key_pem,
        public_key_pem,
    })
}
