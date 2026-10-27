use serde_json::{json, Value};

wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "openui-client" });
use druid::openui::{host, state};

struct MessageClient;
impl exports::druid::openui::client::Guest for MessageClient {
    async fn init() {}

    async fn handle_action(action: String, params: String) {
        if action != "LoadMessage" {
            return;
        }
        let result = host::call("load_message".to_owned(), params)
            .await
            .and_then(|json| {
                serde_json::from_str::<Value>(&json).map_err(|error| error.to_string())
            });
        let value = result.unwrap_or_else(|error| json!(error));
        state::set_value("$message", &value.to_string());
    }
}
export!(MessageClient);
