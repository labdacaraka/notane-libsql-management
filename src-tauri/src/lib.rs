pub mod api;
pub mod commands;
pub mod core;
pub mod crypto;
pub mod process;
pub mod state;
pub mod storage;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt::try_init();

    let app_state = match AppState::init() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to initialize Notane LibSQL AppState: {e}");
            panic!("Critical init failure: {e}");
        }
    };

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::instance::list_instances,
            commands::instance::create_instance,
            commands::instance::update_instance,
            commands::instance::delete_instance,
            commands::instance::start_instance,
            commands::instance::stop_instance,
            commands::instance::restart_instance,
            commands::instance::get_instance_logs,
            commands::instance::clear_instance_logs,
            commands::database::list_databases,
            commands::database::create_database,
            commands::database::delete_database,
            commands::database::fork_database,
            commands::database::checkpoint_database,
            commands::token::generate_keypair_for_database,
            commands::token::generate_token,
            commands::token::list_token_history,
            commands::settings::get_system_status,
            commands::settings::get_network_info,
            commands::settings::list_activities,
            commands::settings::get_config,
            commands::settings::set_config,
        ]);

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<AppState>();
                let pm = state.process_manager.clone();
                tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(async {
                        pm.stop_all().await;
                    });
                });
            }
        });
}
