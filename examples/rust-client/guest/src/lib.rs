use serde_json::{json, Value};
use std::cell::Cell;

// Resolve the WIT from the installed SDK, rather than keeping a Rust-specific copy.
wit_bindgen::generate!({
    path: env!("DRUID_WIT_PATH"),
    world: "openui-client",
});

use druid::openui::{host, state};

thread_local! {
    static PENDING: Cell<u32> = const { Cell::new(0) };
}

fn set(name: &str, value: Value) {
    state::set_value(name, &value.to_string());
}

fn update_status() {
    let pending = PENDING.get();
    set("$status", json!(format!("Pending requests: {pending}")));
}

struct RustClient;

impl exports::druid::openui::client::Guest for RustClient {
    async fn init() {
        PENDING.set(0);
        set("$count", json!(0));
        set("$first", json!("No greeting yet."));
        set("$second", json!("No greeting yet."));
        update_status();
        host::log("Rust client initialized");
    }

    async fn handle_action(action: String, params_json: String) {
        let params: Value = match serde_json::from_str(&params_json) {
            Ok(params) => params,
            Err(error) => {
                set("$status", json!(format!("Invalid action JSON: {error}")));
                return;
            }
        };
        match action.as_str() {
            "Increment" => {
                let count: u64 = state::get_value("$count")
                    .and_then(|value| serde_json::from_str(&value).ok())
                    .unwrap_or_default();
                set("$count", json!(count.saturating_add(1)));
            }
            "Greet" => {
                let (Some(name), Some(target)) =
                    (params["name"].as_str(), params["target"].as_str())
                else {
                    set(
                        "$status",
                        json!("Greet requires string name and target parameters"),
                    );
                    return;
                };
                if target != "$first" && target != "$second" {
                    set("$status", json!("Unknown greeting target"));
                    return;
                }
                PENDING.set(PENDING.get() + 1);
                set(target, json!("Loading…"));
                update_status();
                let result =
                    host::call("greet".to_owned(), json!({ "name": name }).to_string()).await;
                let message = result.and_then(|json| {
                    let value: Value =
                        serde_json::from_str(&json).map_err(|error| error.to_string())?;
                    value["message"]
                        .as_str()
                        .map(str::to_owned)
                        .ok_or_else(|| "Host result must contain a string message".to_owned())
                });
                match message {
                    Ok(message) => set(target, json!(message)),
                    Err(error) => set(target, json!(format!("Error: {error}"))),
                }
                PENDING.set(PENDING.get() - 1);
                update_status();
            }
            _ => {}
        }
    }
}

export!(RustClient);
