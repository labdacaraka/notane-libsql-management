use crate::process::log_capture::LogBuffer;
use crate::process::manager::ProcessManager;
use crate::storage::database::Storage;
use crate::storage::encryption::Cipher;
use anyhow::{Context, Result};
use rand::RngCore;
use std::fs::File;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::sync::Arc;

pub struct AppState {
    pub storage: Storage,
    pub process_manager: ProcessManager,
}

impl AppState {
    pub fn init() -> Result<Self> {
        let base_dir = dirs::data_local_dir()
            .or_else(dirs::data_dir)
            .context("Cannot find local data directory")?
            .join("notane-libsql");

        std::fs::create_dir_all(&base_dir)?;

        let key_path = base_dir.join(".key");
        let key_bytes = if key_path.exists() {
            let mut file = File::open(&key_path)?;
            let mut buf = [0u8; 32];
            file.read_exact(&mut buf)?;
            buf
        } else {
            let mut buf = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut buf);
            let mut file = File::create(&key_path)?;
            file.write_all(&buf)?;
            #[cfg(unix)]
            {
                let mut perms = file.metadata()?.permissions();
                perms.set_mode(0o600);
                std::fs::set_permissions(&key_path, perms)?;
            }
            buf
        };

        let cipher = Arc::new(Cipher::new(&key_bytes));
        let db_path = base_dir.join("notane.db");
        let storage = Storage::new(&db_path, cipher)?;

        let log_buffer = LogBuffer::new(5000);
        let process_manager = ProcessManager::new(log_buffer, storage.clone());

        Ok(Self {
            storage,
            process_manager,
        })
    }
}
