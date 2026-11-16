pub mod jwt;
pub mod keygen;

#[cfg(test)]
mod tests {
    use super::jwt::create_jwt_token;
    use super::keygen::generate_ed25519_keypair;
    use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

    #[test]
    fn test_keygen_and_jwt_flow() {
        let keypair = generate_ed25519_keypair().expect("Failed to generate keypair");
        assert!(keypair.private_key_pem.contains("BEGIN PRIVATE KEY"));
        assert!(keypair.public_key_pem.contains("BEGIN PUBLIC KEY"));

        let token = create_jwt_token(&keypair.private_key_pem, "rw", Some(30), Some("testdb"))
            .expect("Failed to create token");
        assert!(!token.is_empty());

        let decoding_key = DecodingKey::from_ed_pem(keypair.public_key_pem.as_bytes())
            .expect("Failed to parse public key");
        let mut validation = Validation::new(Algorithm::EdDSA);
        validation.validate_exp = true;

        let token_data = decode::<super::jwt::Claims>(&token, &decoding_key, &validation)
            .expect("Failed to verify token with public key");

        assert_eq!(token_data.claims.a, "rw");
        assert_eq!(token_data.claims.ns.as_deref(), Some("testdb"));
    }
}
