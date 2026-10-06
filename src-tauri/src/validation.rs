use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
static SCHEMA: OnceLock<Value> = OnceLock::new();
fn schema() -> &'static Value {
    SCHEMA.get_or_init(|| {
        serde_json::from_str(include_str!("../../src/data/projectSchema.json"))
            .expect("Bundled project schema")
    })
}
fn walk(
    value: &Value,
    descriptor: &str,
    path: &str,
    entity_ids: &mut HashMap<String, HashSet<String>>,
) -> Result<(), String> {
    let invalid = || format!("invalid_field:{}", path);
    let descriptor = if let Some(d) = descriptor.strip_suffix('?') {
        if value.is_null() {
            return Ok(());
        }
        d
    } else {
        descriptor
    };
    if let Some(d) = descriptor.strip_suffix("[]") {
        let items = value.as_array().ok_or_else(invalid)?;
        for (i, item) in items.iter().enumerate() {
            walk(item, d, &format!("{}[{}]", path, i), entity_ids)?;
            if let Some(id) = item.get("id").and_then(Value::as_str) {
                if !entity_ids.entry(d.into()).or_default().insert(id.into()) {
                    return Err(format!("duplicate_id:{}[{}].id", path, i));
                }
            }
        }
        return Ok(());
    }
    if let Some(d) = descriptor.strip_suffix("{}") {
        for (key, item) in value.as_object().ok_or_else(invalid)? {
            walk(item, d, &format!("{}.{}", path, key), entity_ids)?;
        }
        return Ok(());
    }
    if let Some(fields) = schema()["objects"]
        .get(descriptor)
        .and_then(Value::as_object)
    {
        let object = value.as_object().ok_or_else(invalid)?;
        for (key, field) in fields {
            walk(
                object.get(key).unwrap_or(&Value::Null),
                field.as_str().unwrap(),
                &format!("{}.{}", path, key),
                entity_ids,
            )?;
        }
        return Ok(());
    }
    if let Some(allowed) = schema()["enums"].get(descriptor).and_then(Value::as_array) {
        return if allowed.contains(value) {
            Ok(())
        } else {
            Err(invalid())
        };
    }
    let valid = match descriptor {
        "schema" => {
            return if value.as_u64() == Some(1) {
                Ok(())
            } else {
                Err(format!("unsupported_schema:{}", path))
            }
        }
        "id" => value.as_str().map_or(false, |s| {
            !s.is_empty()
                && s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        }),
        "string" => value.is_string(),
        "boolean" => value.is_boolean(),
        "number" | "positive" | "percent" => value.as_f64().map_or(false, |n| {
            n.is_finite()
                && (descriptor != "positive" || n > 0.0)
                && (descriptor != "percent" || (0.0..=100.0).contains(&n))
        }),
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err(invalid())
    }
}
fn normalize(value: &mut Value, descriptor: &str) {
    let descriptor = descriptor.strip_suffix('?').unwrap_or(descriptor);
    if let Some(d) = descriptor.strip_suffix("[]") {
        if let Some(items) = value.as_array_mut() {
            for item in items {
                normalize(item, d);
            }
        }
        return;
    }
    if let Some(d) = descriptor.strip_suffix("{}") {
        if let Some(items) = value.as_object_mut() {
            for item in items.values_mut() {
                normalize(item, d);
            }
        }
        return;
    }
    if let Some(fields) = schema()["objects"]
        .get(descriptor)
        .and_then(Value::as_object)
    {
        if let Some(object) = value.as_object_mut() {
            for (key, field) in fields {
                let kind = field.as_str().unwrap();
                if kind.ends_with('?') && object.get(key).map_or(false, Value::is_null) {
                    object.remove(key);
                }
                if kind.ends_with("[]?") {
                    object
                        .entry(key.clone())
                        .or_insert_with(|| Value::Array(vec![]));
                }
                if let Some(item) = object.get_mut(key) {
                    normalize(item, kind);
                }
            }
        }
    }
}
pub fn validate_and_normalize(value: &mut Value) -> Result<(), String> {
    walk(value, "WorldProject", "$", &mut HashMap::new())?;
    normalize(value, "WorldProject");
    let object = value.as_object_mut().unwrap();
    object.insert("schemaVersion".into(), Value::from(1));
    object.entry("description").or_insert(Value::from(""));
    object.entry("version").or_insert(Value::from("1.0.0"));
    for key in [
        "connections",
        "canvases",
        "decks",
        "documents",
        "timelineTracks",
        "timelineNodes",
        "timelineBranches",
        "worldMaps",
    ] {
        object.entry(key).or_insert_with(|| Value::Array(vec![]));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_fixtures_validate_and_deserialize() {
        let fixtures: Value =
            serde_json::from_str(include_str!("../../tests/fixtures/project-validation.json"))
                .unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let mut project = fixture["project"].clone();
            let result = validate_and_normalize(&mut project);
            assert_eq!(
                result.is_ok(),
                fixture["valid"].as_bool().unwrap(),
                "{}: {:?}",
                fixture["name"],
                result
            );
            if result.is_ok() {
                let parsed: crate::models::WorldProject = serde_json::from_value(project).unwrap();
                assert_eq!(parsed.schema_version, 1);
            }
        }
    }
}
