use crate::core::models::{ActivityLog, DatabaseNamespace, Instance, TokenRecord};
use crate::storage::encryption::Cipher;
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone)]
pub struct Storage {
    conn: Arc<Mutex<Connection>>,
    cipher: Arc<Cipher>,
}

impl Storage {
    pub fn new(db_path: &Path, cipher: Arc<Cipher>) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(db_path)
            .with_context(|| format!("Failed to open sqlite database at {:?}", db_path))?;

        // Enable foreign keys
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS instances (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                http_listen_addr TEXT NOT NULL DEFAULT '0.0.0.0',
                http_port INTEGER NOT NULL DEFAULT 8080,
                admin_listen_addr TEXT NOT NULL DEFAULT '0.0.0.0',
                admin_port INTEGER NOT NULL DEFAULT 8082,
                data_dir TEXT NOT NULL,
                admin_auth_key TEXT,
                auto_start INTEGER NOT NULL DEFAULT 0,
                auto_restart INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS databases (
                id TEXT PRIMARY KEY,
                instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                jwt_public_key TEXT,
                jwt_private_key TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(instance_id, name)
            );

            CREATE TABLE IF NOT EXISTS token_history (
                id TEXT PRIMARY KEY,
                database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
                label TEXT,
                permission TEXT NOT NULL CHECK(permission IN ('rw', 'ro')),
                issued_at TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                instance_id TEXT REFERENCES instances(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            cipher,
        })
    }

    pub fn list_instances(&self) -> Result<Vec<Instance>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, http_listen_addr, http_port, admin_listen_addr, admin_port,
                    data_dir, admin_auth_key, auto_start, auto_restart, created_at, updated_at
             FROM instances ORDER BY name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let enc_auth: Option<String> = row.get(7)?;
            let auth = enc_auth.and_then(|e| self.cipher.decrypt(&e).ok());

            Ok(Instance {
                id: row.get(0)?,
                name: row.get(1)?,
                http_listen_addr: row.get(2)?,
                http_port: row.get(3)?,
                admin_listen_addr: row.get(4)?,
                admin_port: row.get(5)?,
                data_dir: row.get(6)?,
                admin_auth_key: auth,
                auto_start: row.get::<_, i32>(8)? == 1,
                auto_restart: row.get::<_, i32>(9)? == 1,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut instances = Vec::new();
        for r in rows {
            instances.push(r?);
        }
        Ok(instances)
    }

    pub fn get_instance(&self, id: &str) -> Result<Instance> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, http_listen_addr, http_port, admin_listen_addr, admin_port,
                    data_dir, admin_auth_key, auto_start, auto_restart, created_at, updated_at
             FROM instances WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map([id], |row| {
            let enc_auth: Option<String> = row.get(7)?;
            let auth = enc_auth.and_then(|e| self.cipher.decrypt(&e).ok());

            Ok(Instance {
                id: row.get(0)?,
                name: row.get(1)?,
                http_listen_addr: row.get(2)?,
                http_port: row.get(3)?,
                admin_listen_addr: row.get(4)?,
                admin_port: row.get(5)?,
                data_dir: row.get(6)?,
                admin_auth_key: auth,
                auto_start: row.get::<_, i32>(8)? == 1,
                auto_restart: row.get::<_, i32>(9)? == 1,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        match rows.next() {
            Some(res) => Ok(res?),
            None => Err(anyhow::anyhow!("Instance not found: {id}")),
        }
    }

    pub fn create_instance(&self, instance: &Instance) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let enc_auth = match &instance.admin_auth_key {
            Some(k) => Some(self.cipher.encrypt(k)?),
            None => None,
        };

        conn.execute(
            "INSERT INTO instances (
                id, name, http_listen_addr, http_port, admin_listen_addr, admin_port,
                data_dir, admin_auth_key, auto_start, auto_restart, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                instance.id,
                instance.name,
                instance.http_listen_addr,
                instance.http_port,
                instance.admin_listen_addr,
                instance.admin_port,
                instance.data_dir,
                enc_auth,
                if instance.auto_start { 1 } else { 0 },
                if instance.auto_restart { 1 } else { 0 },
                instance.created_at,
                instance.updated_at,
            ],
        )?;

        Ok(())
    }

    pub fn update_instance(&self, instance: &Instance) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let enc_auth = match &instance.admin_auth_key {
            Some(k) => Some(self.cipher.encrypt(k)?),
            None => None,
        };

        conn.execute(
            "UPDATE instances SET
                name = ?2,
                http_listen_addr = ?3,
                http_port = ?4,
                admin_listen_addr = ?5,
                admin_port = ?6,
                data_dir = ?7,
                admin_auth_key = ?8,
                auto_start = ?9,
                auto_restart = ?10,
                updated_at = ?11
             WHERE id = ?1",
            params![
                instance.id,
                instance.name,
                instance.http_listen_addr,
                instance.http_port,
                instance.admin_listen_addr,
                instance.admin_port,
                instance.data_dir,
                enc_auth,
                if instance.auto_start { 1 } else { 0 },
                if instance.auto_restart { 1 } else { 0 },
                instance.updated_at,
            ],
        )?;

        Ok(())
    }

    pub fn delete_instance(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM instances WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn list_databases(&self, instance_id: &str) -> Result<Vec<DatabaseNamespace>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, instance_id, name, jwt_public_key, created_at
             FROM databases WHERE instance_id = ?1 ORDER BY name ASC",
        )?;

        let rows = stmt.query_map([instance_id], |row| {
            Ok(DatabaseNamespace {
                id: row.get(0)?,
                instance_id: row.get(1)?,
                name: row.get(2)?,
                jwt_public_key: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut dbs = Vec::new();
        for r in rows {
            dbs.push(r?);
        }
        Ok(dbs)
    }

    pub fn get_database(&self, id: &str) -> Result<DatabaseNamespace> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, instance_id, name, jwt_public_key, created_at
             FROM databases WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map([id], |row| {
            Ok(DatabaseNamespace {
                id: row.get(0)?,
                instance_id: row.get(1)?,
                name: row.get(2)?,
                jwt_public_key: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        match rows.next() {
            Some(res) => Ok(res?),
            None => Err(anyhow::anyhow!("Database not found: {id}")),
        }
    }

    pub fn create_database(
        &self,
        db: &DatabaseNamespace,
        raw_private_key: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let enc_private = match raw_private_key {
            Some(pk) => Some(self.cipher.encrypt(pk)?),
            None => None,
        };

        conn.execute(
            "INSERT INTO databases (id, instance_id, name, jwt_public_key, jwt_private_key, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                db.id,
                db.instance_id,
                db.name,
                db.jwt_public_key,
                enc_private,
                db.created_at
            ],
        )?;

        Ok(())
    }

    pub fn get_database_private_key(&self, db_id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT jwt_private_key FROM databases WHERE id = ?1")?;
        let mut rows = stmt.query_map([db_id], |row| {
            let enc: Option<String> = row.get(0)?;
            Ok(enc)
        })?;

        if let Some(enc_res) = rows.next() {
            if let Some(enc) = enc_res? {
                let decrypted = self.cipher.decrypt(&enc)?;
                return Ok(Some(decrypted));
            }
        }
        Ok(None)
    }

    pub fn update_database_keys(
        &self,
        db_id: &str,
        public_key: &str,
        raw_private_key: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let enc_private = self.cipher.encrypt(raw_private_key)?;

        conn.execute(
            "UPDATE databases SET jwt_public_key = ?2, jwt_private_key = ?3 WHERE id = ?1",
            params![db_id, public_key, enc_private],
        )?;

        Ok(())
    }

    pub fn delete_database(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM databases WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn record_token(&self, record: &TokenRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO token_history (id, database_id, label, permission, issued_at, expires_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                record.id,
                record.database_id,
                record.label,
                record.permission,
                record.issued_at,
                record.expires_at,
                record.created_at
            ],
        )?;
        Ok(())
    }

    pub fn list_token_history(&self, database_id: &str) -> Result<Vec<TokenRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, database_id, label, permission, issued_at, expires_at, created_at
             FROM token_history WHERE database_id = ?1 ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([database_id], |row| {
            Ok(TokenRecord {
                id: row.get(0)?,
                database_id: row.get(1)?,
                label: row.get(2)?,
                permission: row.get(3)?,
                issued_at: row.get(4)?,
                expires_at: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut tokens = Vec::new();
        for r in rows {
            tokens.push(r?);
        }
        Ok(tokens)
    }

    pub fn log_activity(&self, instance_id: Option<&str>, action: &str, description: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO activity_log (id, instance_id, action, description, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, instance_id, action, description, now],
        )?;
        Ok(())
    }

    pub fn list_activities(&self, limit: usize) -> Result<Vec<ActivityLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, instance_id, action, description, created_at
             FROM activity_log ORDER BY created_at DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit], |row| {
            Ok(ActivityLog {
                id: row.get(0)?,
                instance_id: row.get(1)?,
                action: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut acts = Vec::new();
        for r in rows {
            acts.push(r?);
        }
        Ok(acts)
    }

    pub fn get_config(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM app_config WHERE key = ?1")?;
        let mut rows = stmt.query_map([key], |row| row.get(0))?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO app_config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            [key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_crud() {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let cipher = Arc::new(Cipher::new(&[7u8; 32]));

        let storage = Storage::new(&db_path, cipher).unwrap();

        let inst = Instance {
            id: "inst-1".into(),
            name: "Local Dev".into(),
            http_listen_addr: "127.0.0.1".into(),
            http_port: 8080,
            admin_listen_addr: "127.0.0.1".into(),
            admin_port: 8082,
            data_dir: temp_dir.path().join("data").to_str().unwrap().into(),
            admin_auth_key: Some("secret123".into()),
            auto_start: false,
            auto_restart: true,
            created_at: "2026-11-15T00:00:00Z".into(),
            updated_at: "2026-11-15T00:00:00Z".into(),
        };

        storage.create_instance(&inst).unwrap();
        let list = storage.list_instances().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Local Dev");
        assert_eq!(list[0].admin_auth_key.as_deref(), Some("secret123"));

        let db = DatabaseNamespace {
            id: "db-1".into(),
            instance_id: "inst-1".into(),
            name: "users_db".into(),
            jwt_public_key: Some("pubkey".into()),
            created_at: "2026-11-15T00:00:00Z".into(),
        };

        storage.create_database(&db, Some("privkey_raw")).unwrap();
        let dbs = storage.list_databases("inst-1").unwrap();
        assert_eq!(dbs.len(), 1);
        assert_eq!(dbs[0].name, "users_db");

        let privkey = storage.get_database_private_key("db-1").unwrap();
        assert_eq!(privkey.as_deref(), Some("privkey_raw"));
    }
}
