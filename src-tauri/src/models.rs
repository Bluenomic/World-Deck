use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAttribute {
    pub id: String,
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldCanvas {
    pub id: String,
    pub name: String,
    pub created_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldDeck {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub card_ids: Vec<String>,
    pub created_at: f64,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub associated_card_ids: Vec<String>,
    pub created_at: f64,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldCard {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub subtitle: Option<String>,
    pub category: String,
    pub summary: String,
    pub content: String,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub image_height: Option<f64>,
    #[serde(default)]
    pub image_focal_x: Option<f64>,
    #[serde(default)]
    pub image_focal_y: Option<f64>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub attributes: Vec<CustomAttribute>,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub width: Option<f64>,
    #[serde(default)]
    pub height: Option<f64>,
    #[serde(default)]
    pub pinned: Option<bool>,
    #[serde(default)]
    pub canvas_id: Option<String>,
    #[serde(default)]
    pub canvas_ids: Vec<String>,
    #[serde(default)]
    pub canvas_positions: Option<std::collections::HashMap<String, CardPosition>>,
    #[serde(default)]
    pub deck_id: Option<String>,
    pub created_at: f64,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardConnection {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub label: String,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineTrack {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineNode {
    pub id: String,
    pub track_id: String,
    pub x: f64,
    pub title: String,
    #[serde(default)]
    pub date_label: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub card_id: Option<String>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub image_focal_x: Option<f64>,
    #[serde(default)]
    pub image_focal_y: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineBranch {
    pub id: String,
    pub source_track_id: String,
    pub source_x: f64,
    #[serde(default)]
    pub source_node_id: Option<String>,
    pub target_track_id: String,
    pub target_x: f64,
    #[serde(default)]
    pub target_node_id: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldProject {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub author: Option<String>,
    pub version: String,
    #[serde(default)]
    pub cards: Vec<WorldCard>,
    #[serde(default)]
    pub connections: Vec<CardConnection>,
    #[serde(default)]
    pub canvases: Option<Vec<WorldCanvas>>,
    #[serde(default)]
    pub decks: Option<Vec<WorldDeck>>,
    #[serde(default)]
    pub documents: Option<Vec<WorldDocument>>,
    #[serde(default)]
    pub timeline_tracks: Option<Vec<TimelineTrack>>,
    #[serde(default)]
    pub timeline_nodes: Option<Vec<TimelineNode>>,
    #[serde(default)]
    pub timeline_branches: Option<Vec<TimelineBranch>>,
    pub created_at: f64,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextSegment {
    pub text: String,
    #[serde(default)]
    pub card_id: Option<String>,
    #[serde(default)]
    pub card_title: Option<String>,
    pub is_mention: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BezierResult {
    pub path: String,
    pub mid_x: f64,
    pub mid_y: f64,
}



#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStat {
    pub category: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagStat {
    pub tag: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardConnectionStat {
    pub card_id: String,
    pub card_title: String,
    pub connection_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub total_cards: usize,
    pub total_connections: usize,
    pub total_documents: usize,
    pub total_canvases: usize,
    pub category_counts: Vec<CategoryStat>,
    pub top_tags: Vec<TagStat>,
    pub most_connected_cards: Vec<CardConnectionStat>,
    pub orphan_card_ids: Vec<String>,
}
