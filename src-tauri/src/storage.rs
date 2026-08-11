use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use base64::Engine;
use crate::models::WorldProject;

/// Returns the base directory for storing world deck data
pub fn get_storage_dir<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let worlds_dir = app_dir.join("worlds");
    if !worlds_dir.exists() {
        fs::create_dir_all(&worlds_dir)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;
    }
    
    Ok(worlds_dir)
}

/// Returns the base directory for storing local asset files (images/media)
pub fn get_assets_dir<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let assets_dir = app_dir.join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)
            .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    }
    
    Ok(assets_dir)
}

/// Save Base64 image data or raw image bytes to disk in app assets directory and return local file path
pub fn save_image_asset_to_disk<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    image_data: &str,
    filename_hint: Option<&str>,
) -> Result<String, String> {
    let assets_dir = get_assets_dir(app_handle)?;
    
    let (extension, raw_bytes) = if image_data.starts_with("data:") {
        let parts: Vec<&str> = image_data.split(";base64,").collect();
        if parts.len() != 2 {
            return Err("Invalid data URL format".to_string());
        }
        let ext = if parts[0].contains("image/png") {
            "png"
        } else if parts[0].contains("image/jpeg") || parts[0].contains("image/jpg") {
            "jpg"
        } else if parts[0].contains("image/webp") {
            "webp"
        } else if parts[0].contains("image/gif") {
            "gif"
        } else {
            "png"
        };
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(parts[1])
            .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
        (ext, decoded)
    } else {
        // Assume raw base64 or copy from existing file path
        if Path::new(image_data).exists() {
            let ext = Path::new(image_data)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("png");
            let bytes = fs::read(image_data).map_err(|e| format!("Failed to read source image file: {}", e))?;
            (ext, bytes)
        } else {
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(image_data)
                .map_err(|e| format!("Failed to decode base64 string: {}", e))?;
            ("png", decoded)
        }
    };

    let raw_hint = filename_hint.unwrap_or("asset");
    let safe_hint: String = raw_hint
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    let safe_hint_trimmed = if safe_hint.trim_matches('_').is_empty() {
        "asset".to_string()
    } else {
        safe_hint.chars().take(30).collect()
    };

    let filename = format!(
        "img_{}_{}.{}",
        safe_hint_trimmed,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        extension
    );

    let file_path = assets_dir.join(filename);
    fs::write(&file_path, raw_bytes)
        .map_err(|e| format!("Failed to write asset file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Save a WorldProject to disk
pub fn save_project_to_disk<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    project: &WorldProject,
) -> Result<String, String> {
    let storage_dir = get_storage_dir(app_handle)?;
    let file_path = storage_dir.join(format!("{}.json", project.id));
    
    let sanitized = crate::processor::sanitize_project(project.clone());
    let json_data = serde_json::to_string_pretty(&sanitized)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    // Create a temporary file first for atomic write safety
    let temp_path = storage_dir.join(format!("{}.tmp", project.id));
    fs::write(&temp_path, json_data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    fs::rename(&temp_path, &file_path)
        .map_err(|e| format!("Failed to save project file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Load a WorldProject from disk by ID
pub fn load_project_from_disk<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    id: &str,
) -> Result<WorldProject, String> {
    let storage_dir = get_storage_dir(app_handle)?;
    let file_path = storage_dir.join(format!("{}.json", id));
    
    if !file_path.exists() {
        return Err(format!("Project file not found: {}", id));
    }

    let json_data = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    let project: WorldProject = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))?;

    Ok(project)
}

/// List all WorldProjects saved in local storage
pub fn list_projects_from_disk<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<Vec<WorldProject>, String> {
    let storage_dir = get_storage_dir(app_handle)?;
    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(storage_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(json_data) = fs::read_to_string(&path) {
                    if let Ok(project) = serde_json::from_str::<WorldProject>(&json_data) {
                        projects.push(project);
                    }
                }
            }
        }
    }

    // Sort by updatedAt descending
    projects.sort_by(|a, b| b.updated_at.partial_cmp(&a.updated_at).unwrap_or(std::cmp::Ordering::Equal));

    Ok(projects)
}

/// Delete a WorldProject from disk by ID
pub fn delete_project_from_disk<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    id: &str,
) -> Result<(), String> {
    let storage_dir = get_storage_dir(app_handle)?;
    let file_path = storage_dir.join(format!("{}.json", id));
    
    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|e| format!("Failed to delete project file: {}", e))?;
    }

    Ok(())
}

/// Export a WorldProject to a custom file path
pub fn export_project_to_path(file_path: &str, project: &WorldProject) -> Result<(), String> {
    let json_data = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize project for export: {}", e))?;

    fs::write(Path::new(file_path), json_data)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

/// Import a WorldProject from a custom file path
pub fn import_project_from_path(file_path: &str) -> Result<WorldProject, String> {
    let json_data = fs::read_to_string(Path::new(file_path))
        .map_err(|e| format!("Failed to read import file: {}", e))?;

    let project: WorldProject = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import project JSON: {}", e))?;

    Ok(project)
}

/// Save a WorldProject directly inside a user-selected folder path on disk
pub fn save_project_to_folder_path(folder_path: &str, project: &WorldProject) -> Result<String, String> {
    let dir = Path::new(folder_path);
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create folder: {}", e))?;
    }
    let file_path = dir.join(format!("project_{}.json", project.id));
    
    let sanitized = crate::processor::sanitize_project(project.clone());
    let json_data = serde_json::to_string_pretty(&sanitized)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    let temp_path = dir.join(format!("project_{}.tmp", project.id));
    fs::write(&temp_path, &json_data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    if file_path.exists() {
        let _ = fs::remove_file(&file_path);
    }

    fs::rename(&temp_path, &file_path)
        .map_err(|e| format!("Failed to save project file in folder: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// List all WorldProjects inside a user-selected folder path on disk
pub fn list_projects_in_folder_path(folder_path: &str) -> Result<Vec<WorldProject>, String> {
    let dir = Path::new(folder_path);
    let mut projects = Vec::new();

    if !dir.exists() {
        return Ok(projects);
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(json_data) = fs::read_to_string(&path) {
                    if let Ok(project) = serde_json::from_str::<WorldProject>(&json_data) {
                        projects.push(project);
                    }
                }
            }
        }
    }

    projects.sort_by(|a, b| b.updated_at.partial_cmp(&a.updated_at).unwrap_or(std::cmp::Ordering::Equal));

    Ok(projects)
}

/// Delete a WorldProject file inside a user-selected folder path by ID
pub fn delete_project_from_folder_path(folder_path: &str, id: &str) -> Result<(), String> {
    let dir = Path::new(folder_path);
    let file_path = dir.join(format!("project_{}.json", id));
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }
    Ok(())
}

/// High performance search across WorldCards in a project using Rust
pub fn search_cards(cards: &[crate::models::WorldCard], query: &str, category: Option<&str>) -> Vec<crate::models::WorldCard> {
    let q = query.trim().to_lowercase();
    cards
        .iter()
        .filter(|card| {
            if let Some(cat) = category {
                if cat != "all" && card.category != cat {
                    return false;
                }
            }
            if q.is_empty() {
                return true;
            }
            card.title.to_lowercase().contains(&q)
                || card.subtitle.as_ref().map_or(false, |s| s.to_lowercase().contains(&q))
                || card.summary.to_lowercase().contains(&q)
                || card.content.to_lowercase().contains(&q)
                || card.tags.iter().any(|t| t.to_lowercase().contains(&q))
        })
        .cloned()
        .collect()
}
