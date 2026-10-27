use serde_json::json;

wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "custom-client", generate_all });
use druid::openui::state;
use example::custom::extension;

fn greet(name: &str) {
    state::set_value("$greeting", &json!(extension::greet(name)).to_string());
}
struct CustomClient;
impl exports::druid::openui::client::Guest for CustomClient {
    async fn init() {
        greet("Druid");
    }
    async fn handle_action(action: String, _params: String) {
        if action == "Greet" {
            greet("custom world");
        }
    }
}
export!(CustomClient);
