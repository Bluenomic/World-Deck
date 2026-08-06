use crate::models::{
    BezierResult, CardConnectionStat, CategoryStat, ProjectStats, TagStat,
    TextSegment, WorldCard, WorldProject,
};
use std::collections::{HashMap, HashSet};

/// Calculates a smooth cubic bezier path string and midpoint for SVG connection lines
pub fn compute_bezier_path(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    direction: &str,
) -> BezierResult {
    let (control_x1, control_y1, control_x2, control_y2) = if direction == "vertical" {
        let dy = (y2 - y1).abs().max(30.0) * 0.45;
        let cy1 = if y1 < y2 { y1 + dy } else { y1 - dy };
        let cy2 = if y1 < y2 { y2 - dy } else { y2 + dy };
        (x1, cy1, x2, cy2)
    } else {
        let dx = (x2 - x1).abs().max(30.0) * 0.45;
        let cx1 = if x1 < x2 { x1 + dx } else { x1 - dx };
        let cx2 = if x1 < x2 { x2 - dx } else { x2 + dx };
        (cx1, y1, cx2, y2)
    };

    let path = format!(
        "M {} {} C {} {}, {} {}, {} {}",
        x1, y1, control_x1, control_y1, control_x2, control_y2, x2, y2
    );

    // Cubic Bezier midpoint calculation (t = 0.5)
    let t: f64 = 0.5;
    let t_inv: f64 = 1.0 - t;
    let mid_x = t_inv.powi(3) * x1
        + 3.0 * t_inv.powi(2) * t * control_x1
        + 3.0 * t_inv * t.powi(2) * control_x2
        + t.powi(3) * x2;
    let mid_y = t_inv.powi(3) * y1
        + 3.0 * t_inv.powi(2) * t * control_y1
        + 3.0 * t_inv * t.powi(2) * control_y2
        + t.powi(3) * y2;

    BezierResult { path, mid_x, mid_y }
}

/// Parses @mentions in card content text and maps them to actual cards
pub fn parse_mentions(content: &str, cards: &[WorldCard]) -> Vec<TextSegment> {
    if content.is_empty() {
        return Vec::new();
    }

    let mut segments = Vec::new();
    let card_map_by_id: HashMap<&str, &WorldCard> = cards.iter().map(|c| (c.id.as_str(), c)).collect();
    let card_map_by_title: HashMap<String, &WorldCard> = cards
        .iter()
        .map(|c| (c.title.to_lowercase(), c))
        .collect();

    let mut last_idx = 0;
    let bytes = content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'@' {
            // Push text segment before '@'
            if i > last_idx {
                segments.push(TextSegment {
                    text: content[last_idx..i].to_string(),
                    card_id: None,
                    card_title: None,
                    is_mention: false,
                });
            }

            let start_mention = i;
            i += 1; // skip '@'

            // Extract key: handle bracketed @[Title] or plain word @card-id / @Title
            let key = if i < len && bytes[i] == b'[' {
                i += 1; // skip '['
                let key_start = i;
                while i < len && bytes[i] != b']' {
                    i += 1;
                }
                let k = content[key_start..i].to_string();
                if i < len && bytes[i] == b']' {
                    i += 1;
                }
                k
            } else {
                let key_start = i;
                while i < len && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'-' || bytes[i] == b'_') {
                    i += 1;
                }
                content[key_start..i].to_string()
            };

            if key.is_empty() {
                segments.push(TextSegment {
                    text: "@".to_string(),
                    card_id: None,
                    card_title: None,
                    is_mention: false,
                });
                last_idx = i;
                continue;
            }

            let target_card = card_map_by_id
                .get(key.as_str())
                .copied()
                .or_else(|| card_map_by_title.get(&key.to_lowercase()).copied());

            if let Some(card) = target_card {
                segments.push(TextSegment {
                    text: format!("@{}", card.title),
                    card_id: Some(card.id.clone()),
                    card_title: Some(card.title.clone()),
                    is_mention: true,
                });
            } else {
                segments.push(TextSegment {
                    text: content[start_mention..i].to_string(),
                    card_id: None,
                    card_title: None,
                    is_mention: false,
                });
            }

            last_idx = i;
        } else {
            i += 1;
        }
    }

    if last_idx < len {
        segments.push(TextSegment {
            text: content[last_idx..].to_string(),
            card_id: None,
            card_title: None,
            is_mention: false,
        });
    }

    segments
}



/// Sanitizes a project: removes orphan connections, cleans up card IDs in decks, and updates timestamp
pub fn sanitize_project(mut project: WorldProject) -> WorldProject {
    let valid_card_ids: HashSet<String> = project.cards.iter().map(|c| c.id.clone()).collect();

    // 1. Filter out orphan connections (where source or target card no longer exists)
    project.connections.retain(|conn| {
        valid_card_ids.contains(&conn.source_id) && valid_card_ids.contains(&conn.target_id)
    });

    // 2. Clean up card_ids in decks
    if let Some(ref mut decks) = project.decks {
        for deck in decks {
            deck.card_ids.retain(|id| valid_card_ids.contains(id));
        }
    }

    // 3. Update project timestamp
    project.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as f64)
        .unwrap_or(project.updated_at);

    project
}

/// Computes comprehensive analytics/statistics for a WorldProject
pub fn compute_project_stats(project: &WorldProject) -> ProjectStats {
    let total_cards = project.cards.len();
    let total_connections = project.connections.len();
    let total_documents = project.documents.as_ref().map_or(0, |d| d.len());
    let total_canvases = project.canvases.as_ref().map_or(0, |c| c.len());

    // Category distribution
    let mut cat_map: HashMap<String, usize> = HashMap::new();
    for card in &project.cards {
        *cat_map.entry(card.category.clone()).or_insert(0) += 1;
    }
    let mut category_counts: Vec<CategoryStat> = cat_map
        .into_iter()
        .map(|(category, count)| CategoryStat { category, count })
        .collect();
    category_counts.sort_by(|a, b| b.count.cmp(&a.count));

    // Tag counts
    let mut tag_map: HashMap<String, usize> = HashMap::new();
    for card in &project.cards {
        for tag in &card.tags {
            *tag_map.entry(tag.clone()).or_insert(0) += 1;
        }
    }
    let mut top_tags: Vec<TagStat> = tag_map
        .into_iter()
        .map(|(tag, count)| TagStat { tag, count })
        .collect();
    top_tags.sort_by(|a, b| b.count.cmp(&a.count));
    top_tags.truncate(15);

    // Degree centrality (connection counts per card)
    let mut conn_count_map: HashMap<String, usize> = HashMap::new();
    for conn in &project.connections {
        *conn_count_map.entry(conn.source_id.clone()).or_insert(0) += 1;
        *conn_count_map.entry(conn.target_id.clone()).or_insert(0) += 1;
    }

    let card_title_map: HashMap<&str, &str> = project
        .cards
        .iter()
        .map(|c| (c.id.as_str(), c.title.as_str()))
        .collect();

    let mut most_connected: Vec<CardConnectionStat> = conn_count_map
        .iter()
        .filter_map(|(card_id, &connection_count)| {
            card_title_map.get(card_id.as_str()).map(|&title| CardConnectionStat {
                card_id: card_id.clone(),
                card_title: title.to_string(),
                connection_count,
            })
        })
        .collect();
    most_connected.sort_by(|a, b| b.connection_count.cmp(&a.connection_count));
    most_connected.truncate(10);

    // Orphan cards (cards with 0 connections)
    let orphan_card_ids: Vec<String> = project
        .cards
        .iter()
        .filter(|c| !conn_count_map.contains_key(&c.id))
        .map(|c| c.id.clone())
        .collect();

    ProjectStats {
        total_cards,
        total_connections,
        total_documents,
        total_canvases,
        category_counts,
        top_tags,
        most_connected_cards: most_connected,
        orphan_card_ids,
    }
}

/// Generates a complete Markdown representation of a WorldProject
pub fn export_project_to_markdown(project: &WorldProject) -> String {
    let mut md = String::new();
    md.push_str(&format!("# {}\n\n", project.name));
    if !project.description.is_empty() {
        md.push_str(&format!("{}\n\n", project.description));
    }
    md.push_str(&format!("**Author:** {} | **Version:** {}\n\n", project.author.as_deref().unwrap_or("Unknown"), project.version));
    md.push_str("---\n\n");

    md.push_str("## World Cards\n\n");
    for card in &project.cards {
        md.push_str(&format!("### {}\n", card.title));
        if let Some(ref sub) = card.subtitle {
            md.push_str(&format!("*{}*\n\n", sub));
        }
        md.push_str(&format!("- **Category:** {}\n", card.category));
        if !card.tags.is_empty() {
            md.push_str(&format!("- **Tags:** {}\n", card.tags.join(", ")));
        }
        if !card.summary.is_empty() {
            md.push_str(&format!("\n> {}\n\n", card.summary));
        }
        if !card.content.is_empty() {
            md.push_str(&format!("{}\n\n", card.content));
        }
        md.push_str("---\n\n");
    }

    if !project.connections.is_empty() {
        md.push_str("## Relations & Connections\n\n");
        let card_map: HashMap<&str, &str> = project.cards.iter().map(|c| (c.id.as_str(), c.title.as_str())).collect();
        for conn in &project.connections {
            let src = card_map.get(conn.source_id.as_str()).copied().unwrap_or(conn.source_id.as_str());
            let tgt = card_map.get(conn.target_id.as_str()).copied().unwrap_or(conn.target_id.as_str());
            md.push_str(&format!("- **{}** --[{}]--> **{}**", src, conn.label, tgt));
            if let Some(ref desc) = conn.description {
                md.push_str(&format!(": {}", desc));
            }
            md.push_str("\n");
        }
        md.push_str("\n");
    }

    if let Some(ref docs) = project.documents {
        if !docs.is_empty() {
            md.push_str("## World Documents & Lore\n\n");
            for doc in docs {
                md.push_str(&format!("### {}\n\n", doc.title));
                md.push_str(&format!("- **Category:** {}\n\n", doc.category));
                md.push_str(&format!("{}\n\n---\n\n", doc.content));
            }
        }
    }

    md
}
