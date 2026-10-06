use crate::models::WorldProject;
use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

static FOLDER_WRITE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn validate_project_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid project ID".into());
    }
    Ok(())
}
fn backup_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.bak", path.to_string_lossy()))
}
fn atomic_project_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let temporary = path.with_extension("tmp");
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    // Never replace a healthy backup with a damaged primary file.
    if let Ok(old) = fs::read(path) {
        let valid = serde_json::from_slice::<serde_json::Value>(&old)
            .ok()
            .map_or(false, |mut value| {
                crate::validation::validate_and_normalize(&mut value).is_ok()
            });
        if valid {
            let backup = backup_path(path);
            let backup_temp = backup.with_extension("bak.tmp");
            fs::write(&backup_temp, old).map_err(|e| e.to_string())?;
            fs::rename(&backup_temp, &backup).map_err(|e| e.to_string())?;
        }
    }
    // rename replaces the destination atomically; never delete it first.
    fs::rename(&temporary, path).map_err(|e| format!("Could not replace project: {}", e))
}
fn externalize_assets(dir: &Path, value: &mut serde_json::Value) -> Result<(), String> {
    match value {
        serde_json::Value::String(url) if url.starts_with("data:image/") => {
            use std::hash::{Hash, Hasher};
            if let Some((header, encoded)) = url.split_once(";base64,") {
                let extension = match header {
                    "data:image/png" => "png",
                    "data:image/jpeg" => "jpg",
                    "data:image/webp" => "webp",
                    "data:image/gif" => "gif",
                    _ => return Ok(()),
                };
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|e| e.to_string())?;
                let mut hash = std::collections::hash_map::DefaultHasher::new();
                url.hash(&mut hash);
                let relative = format!("assets/wd_{:016x}.{}", hash.finish(), extension);
                fs::create_dir_all(dir.join("assets")).map_err(|e| e.to_string())?;
                let path = dir.join(&relative);
                if path.exists() {
                    if fs::read(&path).map_err(|e| e.to_string())? != bytes {
                        return Err("Asset identity collision".into());
                    }
                } else {
                    let temporary = path.with_extension("tmp");
                    fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
                    fs::rename(temporary, &path).map_err(|e| e.to_string())?;
                }
                *url = relative;
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                externalize_assets(dir, item)?;
            }
        }
        serde_json::Value::Object(object) => {
            for item in object.values_mut() {
                externalize_assets(dir, item)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn hydrate_assets(dir: &Path, value: &mut serde_json::Value) -> Result<(), String> {
    match value {
        serde_json::Value::String(url) if url.starts_with("assets/wd_") => {
            let filename = &url[7..];
            if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
                return Err("Unsafe asset path".into());
            }
            let mime = match Path::new(filename).extension().and_then(|s| s.to_str()) {
                Some("png") => "image/png",
                Some("jpg") => "image/jpeg",
                Some("webp") => "image/webp",
                Some("gif") => "image/gif",
                _ => return Err("Unsupported asset type".into()),
            };
            let bytes = match fs::read(dir.join(url.as_str())) {
                Ok(bytes) => bytes,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    log::warn!(
                        "Missing image asset {}; keeping project text available",
                        url
                    );
                    return Ok(());
                }
                Err(error) => return Err(error.to_string()),
            };
            *url = format!(
                "data:{};base64,{}",
                mime,
                base64::engine::general_purpose::STANDARD.encode(bytes)
            );
        }
        serde_json::Value::Array(items) => {
            for item in items {
                hydrate_assets(dir, item)?;
            }
        }
        serde_json::Value::Object(object) => {
            for item in object.values_mut() {
                hydrate_assets(dir, item)?;
            }
        }
        _ => {}
    }
    Ok(())
}
fn read_project_assets(dir: &Path, path: &Path) -> Result<WorldProject, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let mut value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    crate::validation::validate_and_normalize(&mut value)?;
    hydrate_assets(dir, &mut value)?;
    serde_json::from_value(value).map_err(|e| e.to_string())
}

#[cfg(test)]
mod persistence_tests {
    use super::*;
    fn project() -> WorldProject {
        serde_json::from_value(serde_json::json!({
            "id":"storage-test", "name":"Original", "description":"", "version":"1", "createdAt":1, "updatedAt":1,
            "cards":[], "connections":[], "worldMaps":[{"id":"map", "name":"Atlas", "imageUrl":"data:image/png;base64,aGVsbG8=", "pins":[{"id":"pin", "title":"Port", "x":10,"y":20,"layerId":"politics","positions":[{"eventId":"arrival","x":30,"y":40}]}],
            "layers":[{"id":"politics","name":"Politics","color":"#123456"}],"shapes":[{"id":"border","kind":"region","name":"Kingdom","points":[{"x":0,"y":0}],"color":"#123456"}],"createdAt":1,"updatedAt":1}]
        })).unwrap()
    }
    #[test]
    fn roundtrip_assets_backup_recovery_and_map_metadata() {
        let dir = std::env::temp_dir().join(format!(
            "worlddeck-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let first = project();
        save_project_to_folder_path(dir.to_str().unwrap(), &first).unwrap();
        let primary = dir.join("project_storage-test.json");
        let raw = fs::read_to_string(&primary).unwrap();
        assert!(raw.contains("assets/wd_"));
        assert!(!raw.contains("base64"));
        let loaded = list_projects_in_folder_path(dir.to_str().unwrap()).unwrap();
        assert_eq!(
            loaded[0].world_maps.as_ref().unwrap()[0].image_url,
            first.world_maps.as_ref().unwrap()[0].image_url
        );
        assert_eq!(
            loaded[0].world_maps.as_ref().unwrap()[0].pins[0]
                .positions
                .len(),
            1
        );
        assert_eq!(loaded[0].world_maps.as_ref().unwrap()[0].layers.len(), 1);
        assert_eq!(loaded[0].world_maps.as_ref().unwrap()[0].shapes.len(), 1);
        let mut second = first.clone();
        second.name = "Updated".into();
        save_project_to_folder_path(dir.to_str().unwrap(), &second).unwrap();
        assert!(backup_path(&primary).exists());
        fs::write(&primary, "damaged").unwrap();
        assert_eq!(
            list_projects_in_folder_path(dir.to_str().unwrap()).unwrap()[0].name,
            "Original"
        );
        fs::remove_file(&primary).unwrap();
        assert_eq!(
            list_projects_in_folder_path(dir.to_str().unwrap())
                .unwrap()
                .len(),
            1
        );
        delete_project_from_folder_path(dir.to_str().unwrap(), "storage-test").unwrap();
        assert!(list_projects_in_folder_path(dir.to_str().unwrap())
            .unwrap()
            .is_empty());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn report_rejects_future_primary_without_using_backup_or_rewriting() {
        let dir = std::env::temp_dir().join(format!(
            "worlddeck-future-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let primary = dir.join("project_storage-test.json");
        let mut value = serde_json::to_value(project()).unwrap();
        fs::write(backup_path(&primary), serde_json::to_vec(&value).unwrap()).unwrap();
        value["schemaVersion"] = serde_json::json!(99);
        let raw = serde_json::to_vec(&value).unwrap();
        fs::write(&primary, &raw).unwrap();
        let report = read_workspace_report(dir.to_str().unwrap()).unwrap();
        assert!(report.projects.is_empty());
        assert_eq!(report.issues[0].code, "unsupported_schema");
        assert_eq!(fs::read(&primary).unwrap(), raw);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn report_has_field_location_and_keeps_missing_assets_and_references() {
        let dir = std::env::temp_dir().join(format!(
            "worlddeck-report-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let primary = dir.join("project_storage-test.json");
        let mut value = serde_json::to_value(project()).unwrap();
        value["worldMaps"][0]["imageUrl"] = serde_json::json!("assets/wd_missing.png");
        value["worldMaps"][0]["pins"][0]["cardId"] = serde_json::json!("lost-card");
        fs::write(&primary, serde_json::to_vec(&value).unwrap()).unwrap();
        let report = read_workspace_report(dir.to_str().unwrap()).unwrap();
        assert_eq!(
            report.projects[0].world_maps.as_ref().unwrap()[0].pins[0]
                .card_id
                .as_deref(),
            Some("lost-card")
        );
        assert!(report
            .issues
            .iter()
            .any(|issue| issue.code == "missing_asset"));
        value["cards"] = serde_json::json!(false);
        fs::write(&primary, serde_json::to_vec(&value).unwrap()).unwrap();
        fs::write(backup_path(&primary), "broken backup").unwrap();
        let report = read_workspace_report(dir.to_str().unwrap()).unwrap();
        assert!(report.projects.is_empty());
        assert!(report
            .issues
            .iter()
            .any(|issue| issue.code == "invalid_field" && issue.path == "$.cards"));
        assert!(report
            .issues
            .iter()
            .any(|issue| issue.code == "unreadable_project"));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn reject_path_traversal() {
        assert!(validate_project_id("../../escape").is_err());
        assert!(hydrate_assets(
            Path::new("."),
            &mut serde_json::json!("assets/wd_../../private.png")
        )
        .is_err());
    }
}

/// Returns the base directory for storing world deck data
pub fn get_storage_dir<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
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
pub fn get_assets_dir<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
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
            let bytes = fs::read(image_data)
                .map_err(|e| format!("Failed to read source image file: {}", e))?;
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
    fs::write(&file_path, raw_bytes).map_err(|e| format!("Failed to write asset file: {}", e))?;

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
    fs::write(&temp_path, json_data).map_err(|e| format!("Failed to write temp file: {}", e))?;

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
    projects.sort_by(|a, b| {
        b.updated_at
            .partial_cmp(&a.updated_at)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

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
        fs::remove_file(file_path).map_err(|e| format!("Failed to delete project file: {}", e))?;
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
pub fn save_project_to_folder_path(
    folder_path: &str,
    project: &WorldProject,
) -> Result<String, String> {
    let dir = Path::new(folder_path);
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create folder: {}", e))?;
    }
    let file_path = dir.join(format!("project_{}.json", project.id));

    let _guard = FOLDER_WRITE_LOCK
        .lock()
        .map_err(|_| "Storage lock unavailable")?;
    validate_project_id(&project.id)?;
    let mut value = serde_json::to_value(project).map_err(|e| e.to_string())?;
    crate::validation::validate_and_normalize(&mut value)?;
    externalize_assets(dir, &mut value)?;
    let json_data = serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?;
    atomic_project_write(&file_path, &json_data)?;

    Ok(file_path.to_string_lossy().to_string())
}

/// List all WorldProjects inside a user-selected folder path on disk
pub fn list_projects_in_folder_path(folder_path: &str) -> Result<Vec<WorldProject>, String> {
    Ok(read_workspace_report(folder_path)?.projects)
}

pub fn read_workspace_report(
    folder_path: &str,
) -> Result<crate::models::WorkspaceLoadReport, String> {
    use crate::models::{ProjectIssue, ProjectSource, WorkspaceLoadReport};
    let dir = Path::new(folder_path);
    let mut report = WorkspaceLoadReport::default();
    if !dir.exists() {
        return Ok(report);
    }
    let mut paths = std::collections::BTreeSet::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            paths.insert(path);
        } else if path
            .file_name()
            .and_then(|s| s.to_str())
            .map_or(false, |n| n.ends_with(".json.bak"))
        {
            paths.insert(path.with_extension(""));
        }
    }
    for path in paths {
        let file_name = path.file_name().unwrap().to_string_lossy().to_string();
        let mut source = "primary";
        let primary = read_project_assets(dir, &path);
        if let Err(error) = &primary {
            if let Some((code, field)) = error.split_once(':').filter(|(code, _)| {
                ["invalid_field", "duplicate_id", "unsupported_schema"].contains(code)
            }) {
                report.issues.push(ProjectIssue {
                    code: code.into(),
                    path: field.into(),
                    file_name: Some(file_name.clone()),
                    project_id: None,
                    severity: "error".into(),
                });
                if code == "unsupported_schema" {
                    continue;
                }
            }
        }
        let result = primary.or_else(|_| {
            source = "backup";
            read_project_assets(dir, &backup_path(&path))
        });
        match result {
            Ok(project) => {
                if report.projects.iter().any(|p| p.id == project.id) {
                    report.issues.push(ProjectIssue {
                        code: "duplicate_id".into(),
                        path: file_name.clone(),
                        file_name: Some(file_name),
                        project_id: Some(project.id),
                        severity: "error".into(),
                    });
                    continue;
                }
                if source == "backup" {
                    report.issues.push(ProjectIssue {
                        code: "backup_recovered".into(),
                        path: file_name.clone(),
                        file_name: Some(file_name.clone()),
                        project_id: Some(project.id.clone()),
                        severity: "warning".into(),
                    });
                }
                let raw_path = if source == "backup" {
                    backup_path(&path)
                } else {
                    path.clone()
                };
                if let Ok(bytes) = fs::read(&raw_path) {
                    if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                        missing_assets(dir, &value, &file_name, &project.id, &mut report.issues);
                    }
                }
                report.sources.push(ProjectSource {
                    project_id: project.id.clone(),
                    file_name,
                    source: source.into(),
                });
                report.projects.push(project);
            }
            Err(_) => report.issues.push(ProjectIssue {
                code: "unreadable_project".into(),
                path: file_name.clone(),
                file_name: Some(file_name),
                project_id: None,
                severity: "error".into(),
            }),
        }
    }
    report.projects.sort_by(|a, b| {
        b.updated_at
            .partial_cmp(&a.updated_at)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(report)
}
fn missing_assets(
    dir: &Path,
    value: &serde_json::Value,
    file_name: &str,
    project_id: &str,
    issues: &mut Vec<crate::models::ProjectIssue>,
) {
    match value {
        serde_json::Value::String(url)
            if url.starts_with("assets/wd_") && !dir.join(url).exists() =>
        {
            issues.push(crate::models::ProjectIssue {
                code: "missing_asset".into(),
                path: url.clone(),
                file_name: Some(file_name.into()),
                project_id: Some(project_id.into()),
                severity: "warning".into(),
            })
        }
        serde_json::Value::Array(items) => {
            for item in items {
                missing_assets(dir, item, file_name, project_id, issues);
            }
        }
        serde_json::Value::Object(items) => {
            for item in items.values() {
                missing_assets(dir, item, file_name, project_id, issues);
            }
        }
        _ => {}
    }
}

/// Delete a WorldProject file inside a user-selected folder path by ID
pub fn delete_project_from_folder_path(folder_path: &str, id: &str) -> Result<(), String> {
    let dir = Path::new(folder_path);
    validate_project_id(id)?;
    let file_path = dir.join(format!("project_{}.json", id));
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    let backup = backup_path(&file_path);
    if backup.exists() {
        fs::remove_file(backup).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// High performance search across WorldCards in a project using Rust
pub fn search_cards(
    cards: &[crate::models::WorldCard],
    query: &str,
    category: Option<&str>,
) -> Vec<crate::models::WorldCard> {
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
                || card
                    .subtitle
                    .as_ref()
                    .map_or(false, |s| s.to_lowercase().contains(&q))
                || card.summary.to_lowercase().contains(&q)
                || card.content.to_lowercase().contains(&q)
                || card.tags.iter().any(|t| t.to_lowercase().contains(&q))
        })
        .cloned()
        .collect()
}
