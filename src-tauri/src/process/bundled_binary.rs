use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
pub static EMBEDDED_SQLD_BYTES: &[u8] = include_bytes!("../../../binaries/sqld-x86_64-apple-darwin");

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub static EMBEDDED_SQLD_BYTES: &[u8] = include_bytes!("../../../binaries/sqld-aarch64-apple-darwin");

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
pub static EMBEDDED_SQLD_BYTES: &[u8] = include_bytes!("../../../binaries/sqld-x86_64-unknown-linux-gnu");

#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
pub static EMBEDDED_SQLD_BYTES: &[u8] = include_bytes!("../../../binaries/sqld-aarch64-unknown-linux-gnu");

#[cfg(not(any(
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "linux", target_arch = "x86_64"),
    all(target_os = "linux", target_arch = "aarch64"),
)))]
pub static EMBEDDED_SQLD_BYTES: &[u8] = &[];

pub fn get_app_bin_dir() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .context("Could not determine local data directory for the current user")?;
    let bin_dir = base.join("notane-libsql").join("bin");
    std::fs::create_dir_all(&bin_dir)?;
    Ok(bin_dir)
}

fn compute_sha256(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn ensure_sqld_binary() -> Result<PathBuf> {
    let bin_dir = get_app_bin_dir()?;
    let binary_name = if cfg!(windows) { "sqld.exe" } else { "sqld" };
    let target_path = bin_dir.join(binary_name);

    if !EMBEDDED_SQLD_BYTES.is_empty() {
        let mut hasher = Sha256::new();
        hasher.update(EMBEDDED_SQLD_BYTES);
        let embedded_hash = format!("{:x}", hasher.finalize());

        let need_extract = if target_path.exists() {
            match compute_sha256(&target_path) {
                Ok(existing_hash) => existing_hash != embedded_hash,
                Err(_) => true,
            }
        } else {
            true
        };

        if need_extract {
            let mut file = File::create(&target_path)
                .with_context(|| format!("Failed to create sqld binary at {:?}", target_path))?;
            file.write_all(EMBEDDED_SQLD_BYTES)?;
            file.flush()?;

            #[cfg(unix)]
            {
                let mut perms = std::fs::metadata(&target_path)?.permissions();
                perms.set_mode(0o755);
                std::fs::set_permissions(&target_path, perms)?;
            }
        }

        return Ok(target_path);
    }

    // Fallback: check if sqld already exists on host system
    if target_path.exists() {
        return Ok(target_path);
    }

    // Check system PATH
    let path_var = std::env::var_os("PATH").unwrap_or_default();
    for p in std::env::split_paths(&path_var) {
        let candidate = p.join(binary_name);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(anyhow::anyhow!(
        "sqld binary is not embedded and not found on system PATH"
    ))
}

pub fn get_sqld_version(bin_path: &Path) -> Result<String> {
    let output = std::process::Command::new(bin_path)
        .arg("--version")
        .output()
        .with_context(|| format!("Failed to run {:?}", bin_path))?;

    if output.status.success() {
        let raw = String::from_utf8_lossy(&output.stdout);
        Ok(raw.trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("sqld --version failed: {err}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binary_extraction_and_version() {
        let path = ensure_sqld_binary().expect("Should extract bundled binary");
        assert!(path.exists());
        let version = get_sqld_version(&path).expect("Should execute sqld --version");
        assert!(version.contains("sqld"));
    }
}
