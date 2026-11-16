use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct LogBuffer {
    buffers: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
    max_lines: usize,
}

impl LogBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            buffers: Arc::new(Mutex::new(HashMap::new())),
            max_lines,
        }
    }

    pub fn append(&self, instance_id: &str, line: String) {
        let mut map = self.buffers.lock().unwrap();
        let deque = map
            .entry(instance_id.to_string())
            .or_insert_with(VecDeque::new);

        deque.push_back(line);
        if deque.len() > self.max_lines {
            deque.pop_front();
        }
    }

    pub fn get_logs(&self, instance_id: &str, limit: Option<usize>) -> Vec<String> {
        let map = self.buffers.lock().unwrap();
        match map.get(instance_id) {
            Some(deque) => {
                let limit = limit.unwrap_or(deque.len());
                deque.iter().rev().take(limit).cloned().collect::<Vec<_>>().into_iter().rev().collect()
            }
            None => Vec::new(),
        }
    }

    pub fn clear(&self, instance_id: &str) {
        let mut map = self.buffers.lock().unwrap();
        if let Some(deque) = map.get_mut(instance_id) {
            deque.clear();
        }
    }
}
