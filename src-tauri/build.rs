use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::Path;

fn main() {
    tauri_build::build();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    let filename = match (target_os.as_str(), target_arch.as_str()) {
        ("macos", "x86_64") => "sqld-x86_64-apple-darwin",
        ("macos", "aarch64") => "sqld-aarch64-apple-darwin",
        ("linux", "x86_64") => "sqld-x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "sqld-aarch64-unknown-linux-gnu",
        _ => "sqld-unknown",
    };

    let bin_path = Path::new("../binaries").join(filename);
    if bin_path.exists() {
        if let Ok(mut file) = File::open(&bin_path) {
            let mut hasher = Sha256::new();
            let mut buffer = [0u8; 8192];
            while let Ok(n) = file.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            let hash_hex = format!("{:x}", hasher.finalize());
            println!("cargo:rustc-env=SQLD_BINARY_HASH={}", hash_hex);
        }
    } else {
        println!("cargo:rustc-env=SQLD_BINARY_HASH=placeholder_no_binary");
    }
}
