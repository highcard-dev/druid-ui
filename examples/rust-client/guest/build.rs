fn main() {
    println!("cargo:rerun-if-env-changed=DRUID_WIT_PATH");
    let path = std::env::var("DRUID_WIT_PATH")
        .expect("Run the npm build:guest script to resolve @druid-ui/client/wit");
    for entry in std::fs::read_dir(path).expect("Read canonical SDK WIT") {
        let file = entry.expect("Read WIT entry").path();
        if file.extension().is_some_and(|extension| extension == "wit") {
            println!("cargo:rerun-if-changed={}", file.display());
        }
    }
}
