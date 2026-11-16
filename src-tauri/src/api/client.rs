use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::json;
use std::time::Duration;

#[derive(Clone)]
pub struct SqldAdminClient {
    client: Client,
    base_url: String,
    admin_auth_key: Option<String>,
}

impl SqldAdminClient {
    pub fn new(admin_port: u16, admin_auth_key: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());

        let base_url = format!("http://127.0.0.1:{}", admin_port);

        Self {
            client,
            base_url,
            admin_auth_key,
        }
    }

    fn apply_auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(key) = &self.admin_auth_key {
            if !key.trim().is_empty() {
                return req.header("Authorization", format!("Basic {}", key));
            }
        }
        req
    }

    pub async fn create_namespace(&self, name: &str, jwt_key: Option<&str>) -> Result<()> {
        let url = format!("{}/v1/namespaces/{}/create", self.base_url, name);
        let mut req = self.client.post(&url);
        req = self.apply_auth(req);

        let body = if let Some(key) = jwt_key {
            json!({ "jwt_key": key })
        } else {
            json!({})
        };

        let resp = req
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to sqld Admin API at {}: {e}", self.base_url))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to create namespace: HTTP {} - {}", status, text));
        }

        Ok(())
    }

    pub async fn delete_namespace(&self, name: &str) -> Result<()> {
        let url = format!("{}/v1/namespaces/{}", self.base_url, name);
        let mut req = self.client.delete(&url);
        req = self.apply_auth(req);

        let resp = req
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to sqld Admin API at {}: {e}", self.base_url))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to delete namespace: HTTP {} - {}", status, text));
        }

        Ok(())
    }

    pub async fn fork_namespace(&self, source: &str, target: &str) -> Result<()> {
        let url = format!("{}/v1/namespaces/{}/fork/{}", self.base_url, source, target);
        let mut req = self.client.post(&url);
        req = self.apply_auth(req);

        let resp = req
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to sqld Admin API at {}: {e}", self.base_url))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to fork namespace: HTTP {} - {}", status, text));
        }

        Ok(())
    }

    pub async fn update_jwt_key(&self, name: &str, jwt_key: &str) -> Result<()> {
        let url = format!("{}/v1/namespaces/{}/config", self.base_url, name);
        let mut req = self.client.post(&url);
        req = self.apply_auth(req);

        let body = json!({ "jwt_key": jwt_key });

        let resp = req
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to sqld Admin API at {}: {e}", self.base_url))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to update config: HTTP {} - {}", status, text));
        }

        Ok(())
    }

    pub async fn checkpoint_namespace(&self, name: &str) -> Result<()> {
        let url = format!("{}/v1/namespaces/{}/checkpoint", self.base_url, name);
        let mut req = self.client.post(&url);
        req = self.apply_auth(req);

        let resp = req
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to sqld Admin API at {}: {e}", self.base_url))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to trigger checkpoint: HTTP {} - {}", status, text));
        }

        Ok(())
    }
}
