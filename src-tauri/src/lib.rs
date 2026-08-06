pub mod models;
pub mod processor;
pub mod storage;

use models::{
    BezierResult, ProjectStats, TextSegment, WorldCard, WorldProject,
};
use tauri::AppHandle;

#[tauri::command]
fn save_world_project(app_handle: AppHandle, project: WorldProject) -> Result<String, String> {
    storage::save_project_to_disk(&app_handle, &project)
}

#[tauri::command]
fn load_world_project(app_handle: AppHandle, id: String) -> Result<WorldProject, String> {
    storage::load_project_from_disk(&app_handle, &id)
}

#[tauri::command]
fn list_world_projects(app_handle: AppHandle) -> Result<Vec<WorldProject>, String> {
    storage::list_projects_from_disk(&app_handle)
}

#[tauri::command]
fn delete_world_project(app_handle: AppHandle, id: String) -> Result<(), String> {
    storage::delete_project_from_disk(&app_handle, &id)
}

#[tauri::command]
fn export_world_project(file_path: String, project: WorldProject) -> Result<(), String> {
    storage::export_project_to_path(&file_path, &project)
}

#[tauri::command]
fn import_world_project(file_path: String) -> Result<WorldProject, String> {
    storage::import_project_from_path(&file_path)
}

#[tauri::command]
fn save_image_asset(
    app_handle: AppHandle,
    image_data: String,
    filename_hint: Option<String>,
) -> Result<String, String> {
    storage::save_image_asset_to_disk(&app_handle, &image_data, filename_hint.as_deref())
}

#[tauri::command]
fn search_world_cards(
    cards: Vec<WorldCard>,
    query: String,
    category: Option<String>,
) -> Vec<WorldCard> {
    storage::search_cards(&cards, &query, category.as_deref())
}

#[tauri::command]
fn compute_bezier_path(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    direction: String,
) -> BezierResult {
    processor::compute_bezier_path(x1, y1, x2, y2, &direction)
}

#[tauri::command]
fn parse_mentions(content: String, cards: Vec<WorldCard>) -> Vec<TextSegment> {
    processor::parse_mentions(&content, &cards)
}



#[tauri::command]
fn sanitize_project(project: WorldProject) -> WorldProject {
    processor::sanitize_project(project)
}

#[tauri::command]
fn compute_project_stats(project: WorldProject) -> ProjectStats {
    processor::compute_project_stats(&project)
}

#[tauri::command]
fn export_project_to_markdown(project: WorldProject) -> String {
    processor::export_project_to_markdown(&project)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_world_project,
            load_world_project,
            list_world_projects,
            delete_world_project,
            export_world_project,
            import_world_project,
            save_image_asset,
            search_world_cards,
            compute_bezier_path,
            parse_mentions,
            sanitize_project,
            compute_project_stats,
            export_project_to_markdown
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
