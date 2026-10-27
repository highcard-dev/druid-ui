use serde_json::{json, Value};

wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "openui-client" });
use druid::openui::{host, state};

fn set_preview(value: &str) {
    state::set_value("$previewText", &json!(value).to_string());
}

struct SettingsClient;
impl exports::druid::openui::client::Guest for SettingsClient {
    async fn init() {
        host::log("Rust settings client initialized");
    }

    async fn handle_action(action: String, params: String) {
        if action != "PreviewSettings" {
            return;
        }
        set_preview("Loading preview…");
        let result = host::call("preview_settings".to_owned(), params)
            .await
            .and_then(|json| {
                let value: Value =
                    serde_json::from_str(&json).map_err(|error| error.to_string())?;
                value["message"]
                    .as_str()
                    .map(str::to_owned)
                    .ok_or_else(|| "Preview result must contain a string message".to_owned())
            });
        match result {
            Ok(message) => {
                set_preview(&message);
                host::log(&format!(
                    "Preview state: {}",
                    state::get_value("$previewText").unwrap_or_default()
                ));
            }
            Err(error) => set_preview(&error),
        }
    }
}
export!(SettingsClient);
