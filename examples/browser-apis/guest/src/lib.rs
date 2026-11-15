use serde_json::{json, Value};
wit_bindgen::generate!({ path: env!("DRUID_WIT_PATH"), world: "browser-client", generate_all });
use druid::openui::{animation, audio, canvas, state, video, webgl, webgpu};
mod gallery;
mod invaders;

struct BrowserClient;
fn rectangle(color: &str, x: f32) -> canvas::DrawCommand {
    canvas::DrawCommand::FillRect(canvas::PaintedRect {
        bounds: canvas::Rect {
            x,
            y: 0.0,
            width: 320.0,
            height: 180.0,
        },
        color: color.into(),
    })
}
fn canvas_test() -> Result<Value, String> {
    let c = canvas::open("canvas", 320, 180)?;
    canvas::draw(c, &[rectangle("#ff0000", 0.0)])?;
    let pixels = canvas::read_pixels(c, 0, 0, 1, 1)?;
    if pixels != [255, 0, 0, 255] {
        return Err(format!("Unexpected canvas pixels: {pixels:?}"));
    }
    canvas::write_pixels(c, &[0, 255, 0, 255], 1, 1, 1, 1)?;
    if canvas::read_pixels(c, 1, 1, 1, 1)? != [0, 255, 0, 255] {
        return Err("Binary pixel roundtrip failed".into());
    }
    let commands: Vec<_> = (0..1000)
        .map(|i| {
            canvas::DrawCommand::FillRect(canvas::PaintedRect {
                bounds: canvas::Rect {
                    x: (i % 160 * 2) as f32,
                    y: (i / 160 * 2) as f32,
                    width: 2.,
                    height: 2.,
                },
                color: "#19334d".into(),
            })
        })
        .collect();
    let packed: Vec<f32> = (0..1000)
        .flat_map(|i| [(i % 160 * 2) as f32, (i / 160 * 2) as f32, 2., 2.])
        .collect();
    // Warm up both paths, then drain deferred canvas work before timing each.
    for _ in 0..10 {
        canvas::draw(c, &commands)?;
        canvas::fill_rects(c, &packed, "#19334d")?;
    }
    canvas::read_pixels(c, 0, 0, 1, 1)?;
    let start = animation::now();
    for _ in 0..100 {
        canvas::draw(c, &commands)?;
    }
    let typed_ms = animation::now() - start;
    canvas::read_pixels(c, 0, 0, 1, 1)?;
    let start = animation::now();
    for _ in 0..100 {
        canvas::fill_rects(c, &packed, "#19334d")?;
    }
    Ok(
        json!({ "pass": true, "draws_per_path": 100000, "batches_per_path": 100, "typed_submission_ms": typed_ms, "packed_submission_ms": animation::now() - start }),
    )
}
fn gl_test() -> Result<Value, String> {
    let surface = canvas::open("gl", 320, 180)?;
    let gl = webgl::open(surface)?;
    let program = webgl::create_program(gl,
        "#version 300 es\nlayout(location=0) in vec2 position; void main(){gl_Position=vec4(position,0,1);}",
        "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0,1,0,1);}")?;
    let buffer = webgl::create_buffer(gl, &[-1., -1., 3., -1., -1., 3.], true)?;
    webgl::write_buffer(buffer, 0, &[-1., -1., 3., -1., -1., 3.])?;
    let attributes = [webgl::Attribute {
        buffer,
        location: 0,
        components: 2,
        stride: 0,
        offset: 0,
    }];
    webgl::draw(
        gl,
        program,
        &attributes,
        &[],
        4,
        0,
        3,
        Some(&[0., 0., 0., 1.]),
    )?;
    if webgl::read_pixels(gl, 100, 100, 1, 1)? != [0, 255, 0, 255] {
        return Err("WebGL triangle readback failed".into());
    }
    webgl::destroy(buffer)?;
    webgl::destroy(program)?;
    Ok(json!({ "pass": true }))
}
async fn gpu_test() -> Result<Value, String> {
    let device = webgpu::request_device(None).await?;
    let buffer = webgpu::create_buffer(device, 16, 128 | 8 | 4)?;
    webgpu::write_buffer(buffer, 0, &[1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0])?;
    let layout = webgpu::create_bind_group_layout(device, &[gallery::gpu_buffer_layout(0, 4, webgpu::BufferBindingType::Storage, 16)])?;
    let shader = webgpu::create_shader(device, "@group(0) @binding(0) var<storage,read_write> v:array<u32>; @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u){v[id.x]*=2u;}".into()).await?;
    let pipeline = webgpu::create_compute_pipeline(device, webgpu::ComputePipelineDescriptor { stage: webgpu::ShaderStage { shader, entry: "main".into() }, layouts: vec![layout] }).await?;
    let group = webgpu::create_bind_group(layout, &[gallery::gpu_buffer_binding(0, buffer, 16)])?;
    let render_shader = webgpu::create_shader(device, "@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);} @fragment fn fs()->@location(0) vec4f {return vec4f(0.2,0.5,1,1);}".into()).await?;
    let format = webgpu::get_device_info(device)?.preferred_format;
    let render = webgpu::create_render_pipeline(device, gallery::gpu_render_descriptor(render_shader, "vs", "fs", format, vec![])).await?;
    let surface = canvas::open("gpu", 320, 180)?;
    webgpu::configure_surface(device, surface, webgpu::SurfaceConfiguration { format, alpha: webgpu::AlphaMode::Opaque, width: 320, height: 180 })?;
    let frame = webgpu::begin_frame(device)?;
    webgpu::encode_compute_pass(frame, webgpu::ComputePassDescriptor { timestamps: None }, &[
        webgpu::ComputeCommand::Pipeline(pipeline), webgpu::ComputeCommand::Group(webgpu::GroupCommand { index: 0, group, dynamic_offsets: vec![] }), webgpu::ComputeCommand::Dispatch(webgpu::DispatchCommand { x: 4, y: 1, z: 1 }),
    ])?;
    webgpu::encode_render_pass(frame, &gallery::gpu_surface_pass(surface), &[webgpu::RenderCommand::Pipeline(render), webgpu::RenderCommand::Draw(webgpu::DrawCommand { vertices: 3, instances: 1, first_vertex: 0, first_instance: 0 })])?;
    webgpu::submit_frame(frame)?;
    // Explicit diagnostic readback, not part of the gallery's normal frame path.
    let bytes = webgpu::read_buffer(buffer, 0, 16).await?;
    let values: Vec<u32> = bytes
        .chunks_exact(4)
        .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    if values != [2, 4, 6, 8] {
        return Err(format!("Compute failed: {values:?}"));
    }
    webgpu::completed(device).await?;
    webgpu::destroy(group)?;
    webgpu::destroy(pipeline)?;
    webgpu::destroy(buffer)?;
    // Keep the rendered device alive until the UI instance is disposed.
    Ok(json!({ "pass": true, "compute": values }))
}
async fn audio_test() -> Result<Value, String> {
    let context = audio::open(Some(48000.))?;
    audio::resume(context).await?;
    let buffer = audio::create_buffer(context, 1, 4800, 48000.)?;
    let samples: Vec<f32> = (0..4800)
        .map(|i| ((i as f32 * 440. * std::f32::consts::TAU) / 48000.).sin() * 0.01)
        .collect();
    audio::write_channel(buffer, 0, &samples, 0)?;
    let voice = audio::play(context, buffer, 0., 0.1, true)?;
    audio::stop(voice)?;
    // Compiled fixtures/dsp.wat; a standalone DSP module, not a WIT component.
    let dsp = vec![
        0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 3, 127, 127, 125, 0, 3, 2, 1, 0, 5, 3, 1, 0, 1,
        7, 20, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 7, 112, 114, 111, 99, 101, 115, 115, 0, 0,
        10, 41, 1, 39, 1, 2, 127, 32, 0, 32, 1, 108, 65, 4, 108, 33, 4, 3, 64, 32, 3, 67, 10, 215,
        163, 60, 56, 2, 0, 32, 3, 65, 4, 106, 34, 3, 32, 4, 73, 13, 0, 11, 11,
    ];
    let processor = audio::start_processor(context, dsp, 1).await?;
    for _ in 0..3 {
        animation::next_frame().await?;
    }
    audio::stop(processor)?;
    audio::close(buffer)?;
    audio::suspend(context).await?;
    audio::close(context)?;
    Ok(json!({ "pass": true, "pcm_frames": 4800, "worklet": true }))
}
async fn video_test() -> Result<Value, String> {
    let surface = canvas::open("decoded", 32, 32)?;
    let decoder = video::create_decoder(surface, "vp8".into(), 32, 32, vec![]).await?;
    // A red 32x32 VP8 keyframe generated by the browser VideoEncoder.
    let frame = [
        208, 2, 0, 157, 1, 42, 32, 0, 32, 0, 1, 135, 8, 133, 133, 136, 153, 132, 136, 8, 2, 2, 117,
        170, 3, 248, 2, 8, 33, 41, 158, 112, 254, 249, 125, 191, 255, 22, 114, 49, 29, 158, 111,
        255, 83, 167, 245, 58, 127, 83, 167, 255, 82, 128,
    ];
    video::decode(decoder, true, 0., None, &frame)?;
    video::flush(decoder).await?;
    let pixels = canvas::read_pixels(surface, 0, 0, 1, 1)?;
    video::close(decoder)?;
    if pixels[0] < 240 || pixels[1] > 16 || pixels[2] > 16 {
        return Err(format!("Video decode pixel mismatch: {pixels:?}"));
    }
    Ok(json!({ "pass": true, "pixel": pixels }))
}
fn result(value: Result<Value, String>) -> Value {
    value.unwrap_or_else(|error| json!({ "pass": false, "error": error }))
}
async fn animate() -> Result<Value, String> {
    let surface = canvas::open("canvas", 320, 180)?;
    let mut rectangles: Vec<f32> = (0..1000)
        .flat_map(|i| [(i % 160 * 2) as f32, (i / 160 * 2) as f32, 2., 2.])
        .collect();
    let mut draw_ms = Vec::new();
    let start = animation::next_frame().await?;
    let mut last = start;
    for frame in 0..180 {
        last = animation::next_frame().await?;
        for rect in rectangles.chunks_exact_mut(4) {
            rect[1] = (rect[1] + 1.) % 180.;
        }
        let before = animation::now();
        canvas::fill_rects(
            surface,
            &rectangles,
            if frame % 2 == 0 { "#19334d" } else { "#336699" },
        )?;
        draw_ms.push(animation::now() - before);
    }
    draw_ms.sort_by(|a, b| a.total_cmp(b));
    Ok(
        json!({ "frames": 180, "rectangles_per_frame": 1000, "fps": 180000. / (last - start), "submission_p50_ms": draw_ms[90], "submission_p95_ms": draw_ms[171] }),
    )
}
impl exports::druid::openui::client::Guest for BrowserClient {
    async fn init() {
        if state::get_value("$mode").as_deref() == Some("\"invaders\"") {
            if let Err(error) = invaders::init() {
                invaders::report(error);
            }
            return;
        }
        if state::get_value("$mode").as_deref() == Some("\"gallery\"") {
            if let Err(error) = gallery::init().await {
                state::set_value("$report", &json!(error).to_string());
            }
            return;
        }
        state::set_value("$report", "\"Ready — Rust browser imports initialized\"");
    }
    async fn handle_action(action: String, params: String) {
        if state::get_value("$mode").as_deref() == Some("\"invaders\"") {
            if let Err(error) = invaders::action(&action, &params).await {
                invaders::report(error);
            }
            return;
        }
        let gallery_result = match action.as_str() {
            "StartGallery" => Some(gallery::start().await),
            "ToggleMotion" => Some(gallery::toggle_motion().await),
            "ToggleSound" => Some(gallery::toggle_sound().await),
            _ => None,
        };
        if let Some(result) = gallery_result {
            if let Err(error) = result {
                state::set_value("$report", &json!(error).to_string());
            }
            return;
        }
        if action == "Animate" {
            state::set_value("$report", "\"Measuring animation…\"");
            let report = result(animate().await);
            state::set_value("$report", &json!(report.to_string()).to_string());
            return;
        }
        if action != "CheckBrowser" {
            return;
        }
        state::set_value("$report", "\"Running browser checks…\"");
        // Start audio before the first await of another operation: preserve user activation.
        let audio = result(audio_test().await);
        let canvas = result(canvas_test());
        let webgl = result(gl_test());
        let webgpu = result(gpu_test().await);
        let video = result(video_test().await);
        let before = animation::now();
        let frame = animation::next_frame().await;
        let animation = json!({ "pass": frame.is_ok(), "wait_ms": animation::now() - before });
        let rejected = video::open("bad", "javascript:alert(1)", true, false).is_err();
        let report = json!({ "canvas": canvas, "webgl": webgl, "webgpu": webgpu, "audio": audio, "video": video, "animation": animation, "invalid_video_rejected": rejected });
        state::set_value("$report", &json!(report.to_string()).to_string());
    }
}
impl exports::druid::openui::keyboard::Guest for BrowserClient {
    async fn handle_event(event: exports::druid::openui::keyboard::KeyEvent) {
        if event.region == "invaders" {
            if let Err(error) = invaders::key(event).await {
                invaders::report(error);
            }
            return;
        }
        use exports::druid::openui::keyboard::EventKind;
        // Repeats and release/blur events are available for games, but these
        // toggles should fire only once per unmodified key press.
        if event.region != "gallery"
            || event.kind != EventKind::Down
            || event.repeat
            || event.control
            || event.alt
            || event.meta
        {
            return;
        }
        let result = match event.code.as_str() {
            "Space" => gallery::toggle_motion().await,
            "KeyM" => gallery::toggle_sound().await,
            _ => return,
        };
        if let Err(error) = result {
            state::set_value("$report", &json!(error).to_string());
        }
    }
}
impl exports::druid::openui::pointer::Guest for BrowserClient {
    async fn handle_event(event: exports::druid::openui::pointer::PointerEvent) {
        gallery::pointer(event);
    }
}
export!(BrowserClient);
