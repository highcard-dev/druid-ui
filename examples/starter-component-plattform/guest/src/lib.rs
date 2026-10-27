use serde_json::{json, Value};

wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "openui-client" });
use druid::openui::{host, state};

fn set(name: &str, value: Value) {
    state::set_value(name, &value.to_string());
}

struct ToolsClient;
impl exports::druid::openui::client::Guest for ToolsClient {
    async fn init() {}

    async fn handle_action(action: String, params: String) {
        let (operation, args) = match action.as_str() {
            "ReadFile" => ("file_read", json!({ "path": "server.properties" })),
            "WriteFile" => {
                let params: Value = match serde_json::from_str(&params) {
                    Ok(value) => value,
                    Err(error) => {
                        set("$output", json!(error.to_string()));
                        return;
                    }
                };
                (
                    "file_write",
                    json!({ "path": "server.properties", "content": params["content"] }),
                )
            }
            "FetchStatus" => ("http_get", json!({ "path": "status.json" })),
            _ => return,
        };
        set("$output", json!("Working…"));
        let result = host::call(operation.to_owned(), args.to_string())
            .await
            .and_then(|json| {
                serde_json::from_str::<Value>(&json).map_err(|error| error.to_string())
            });
        match result {
            Ok(value) => {
                if action == "ReadFile" {
                    set("$content", value.clone());
                }
                let output = value
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| serde_json::to_string_pretty(&value).expect("JSON value"));
                set("$output", json!(output));
            }
            Err(error) => set("$output", json!(error)),
        }
    }
}
export!(ToolsClient);
