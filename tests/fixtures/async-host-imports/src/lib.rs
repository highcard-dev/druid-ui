//! Canonical async lowering must start imports without suspending its caller.
//! Regression shape: bytecodealliance/jco commit 1fc1c0d (Apache-2.0 WITH LLVM-exception).
wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "async-host-imports", generate_all });

struct Client;
export!(Client);

// Canonical result<list<u8>, string>: discriminant, payload pointer, byte count.
static mut RESULTS: [[u32; 3]; 2] = [[0; 3]; 2];

#[link(wasm_import_module = "druid:openui/webgpu")]
extern "C" {
    #[link_name = "[async-lower]read-buffer"]
    fn start_read(buffer: u32, offset: u32, size: u32, result: *mut u32) -> u32;
}

impl Guest for Client {
    fn start_two() -> (u32, u32) {
        // Deliberately use the canonical nonblocking status interface, not an
        // async Rust wrapper that could conceal an erroneous JSPI suspension.
        unsafe {
            (
                start_read(10, 0, 4, std::ptr::addr_of_mut!(RESULTS[0]).cast()),
                start_read(20, 0, 4, std::ptr::addr_of_mut!(RESULTS[1]).cast()),
            )
        }
    }

    fn results() -> (u32, u32) {
        fn read(index: usize) -> u32 {
            unsafe {
                let [tag, pointer, length] = RESULTS[index];
                if tag != 0 || length != 4 {
                    return 0;
                }
                let bytes = std::slice::from_raw_parts(pointer as *const u8, 4);
                u32::from_le_bytes(bytes.try_into().unwrap())
            }
        }
        (read(0), read(1))
    }
}

impl exports::druid::openui::client::Guest for Client {
    async fn init() {}
    async fn handle_action(_: String, _: String) {}
}
