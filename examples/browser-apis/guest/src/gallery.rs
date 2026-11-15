use crate::druid::openui::{animation, audio, canvas, state, video, webgl, webgpu};
use serde_json::json;
use std::{
    cell::{Cell, RefCell},
    f32::consts::TAU,
};

fn text(key: &str, value: &str) {
    state::set_value(key, &json!(value).to_string());
}
fn point(x: f32, y: f32) -> canvas::Point {
    canvas::Point { x, y }
}
fn fill(color: &str, width: f32, height: f32) -> canvas::DrawCommand {
    canvas::DrawCommand::FillRect(canvas::PaintedRect {
        bounds: canvas::Rect {
            x: 0.,
            y: 0.,
            width,
            height,
        },
        color: color.into(),
    })
}
fn path(
    commands: &mut Vec<canvas::DrawCommand>,
    points: impl Iterator<Item = (f32, f32)>,
    color: &str,
) {
    commands.push(canvas::DrawCommand::BeginPath);
    for (i, (x, y)) in points.enumerate() {
        commands.push(if i == 0 {
            canvas::DrawCommand::MoveTo(point(x, y))
        } else {
            canvas::DrawCommand::LineTo(point(x, y))
        });
    }
    commands.push(canvas::DrawCommand::Stroke(color.into()));
}

struct Gl {
    context: u32,
    program: u32,
    buffer: u32,
}
impl Gl {
    fn new() -> Result<Self, String> {
        let context = webgl::open(canvas::open("gl", 640, 400)?)?;
        let program =
            webgl::create_program(context, include_str!("orb.vert"), include_str!("orb.frag"))?;
        let buffer = webgl::create_buffer(context, &[-1., -1., 3., -1., -1., 3.], false)?;
        Ok(Self {
            context,
            program,
            buffer,
        })
    }
    fn draw(&self, time: f32) -> Result<(), String> {
        webgl::draw(
            self.context,
            self.program,
            &[webgl::Attribute {
                buffer: self.buffer,
                location: 0,
                components: 2,
                stride: 0,
                offset: 0,
            }],
            &[webgl::Uniform {
                name: "time".into(),
                values: vec![time],
            }],
            4,
            0,
            3,
            None,
        )
    }
}
struct Gpu {
    device: u32,
    surface: u32,
    uniform: u32,
    compute: u32,
    render: u32,
    compute_group: u32,
    render_group: u32,
}
impl Gpu {
    async fn new() -> Result<Self, String> {
        let device = webgpu::request_device(None).await?;
        let info = webgpu::get_device_info(device)?;
        let stars = webgpu::create_buffer(device, 16384 * 16, 128)?;
        let uniform = webgpu::create_buffer(device, 16, 64 | 8)?;
        let compute_layout = webgpu::create_bind_group_layout(device, &[
            gpu_buffer_layout(0, 4, webgpu::BufferBindingType::Storage, 16384 * 16),
            gpu_buffer_layout(1, 4, webgpu::BufferBindingType::Uniform, 16),
        ])?;
        let render_layout = webgpu::create_bind_group_layout(device, &[
            gpu_buffer_layout(0, 1, webgpu::BufferBindingType::ReadOnlyStorage, 16384 * 16),
            gpu_buffer_layout(1, 1, webgpu::BufferBindingType::Uniform, 16),
        ])?;
        let compute_shader = webgpu::create_shader(device, include_str!("galaxy.wgsl").into()).await?;
        let render_shader = webgpu::create_shader(device, include_str!("stars.wgsl").into()).await?;
        let compute = webgpu::create_compute_pipeline(
            device,
            webgpu::ComputePipelineDescriptor { stage: webgpu::ShaderStage { shader: compute_shader, entry: "evolve".into() }, layouts: vec![compute_layout] },
        )
        .await?;
        let render = webgpu::create_render_pipeline(
            device,
            gpu_render_descriptor(render_shader, "vertex", "fragment", info.preferred_format, vec![render_layout]),
        )
        .await?;
        let bindings = [
            gpu_buffer_binding(0, stars, 16384 * 16),
            gpu_buffer_binding(1, uniform, 16),
        ];
        let compute_group = webgpu::create_bind_group(compute_layout, &bindings)?;
        let render_group = webgpu::create_bind_group(render_layout, &bindings)?;
        let surface = canvas::open("gpu", 640, 400)?;
        webgpu::configure_surface(device, surface, webgpu::SurfaceConfiguration { format: info.preferred_format, alpha: webgpu::AlphaMode::Opaque, width: 640, height: 400 })?;
        Ok(Self {
            device,
            surface,
            uniform,
            compute,
            render,
            compute_group,
            render_group,
        })
    }
    fn draw(&self, time: f32) -> Result<(), String> {
        let mut bytes = [0u8; 16];
        for (i, v) in [time, 640., 400., 16384.].iter().enumerate() {
            bytes[i * 4..i * 4 + 4].copy_from_slice(&v.to_le_bytes());
        }
        webgpu::write_buffer(self.uniform, 0, &bytes)?;
        let frame = webgpu::begin_frame(self.device)?;
        let result = (|| {
            webgpu::encode_compute_pass(frame, webgpu::ComputePassDescriptor { timestamps: None }, &[
                webgpu::ComputeCommand::Pipeline(self.compute),
                webgpu::ComputeCommand::Group(webgpu::GroupCommand { index: 0, group: self.compute_group, dynamic_offsets: vec![] }),
                webgpu::ComputeCommand::Dispatch(webgpu::DispatchCommand { x: 256, y: 1, z: 1 }),
            ])?;
            webgpu::encode_render_pass(frame, &gpu_surface_pass(self.surface), &[
                webgpu::RenderCommand::Pipeline(self.render),
                webgpu::RenderCommand::Group(webgpu::GroupCommand { index: 0, group: self.render_group, dynamic_offsets: vec![] }),
                webgpu::RenderCommand::Draw(webgpu::DrawCommand { vertices: 6, instances: 16384, first_vertex: 0, first_instance: 0 }),
            ])?;
            webgpu::submit_frame(frame)
        })();
        if result.is_err() { let _ = webgpu::destroy(frame); }
        result
    }
}

pub fn gpu_buffer_layout(binding: u32, visibility: u32, kind: webgpu::BufferBindingType, size: u32) -> webgpu::LayoutEntry {
    webgpu::LayoutEntry { binding, visibility, layout: webgpu::BindingLayout::Buffer(webgpu::BufferLayout { kind, dynamic: false, min_binding_size: size }) }
}
pub fn gpu_buffer_binding(binding: u32, buffer: u32, size: u32) -> webgpu::Binding {
    webgpu::Binding { binding, resource: webgpu::BindingResource::Buffer(webgpu::BufferBinding { buffer, offset: 0, size: Some(size) }) }
}
pub fn gpu_render_descriptor(shader: u32, vertex: &str, fragment: &str, format: webgpu::TextureFormat, layouts: Vec<u32>) -> webgpu::RenderPipelineDescriptor {
    webgpu::RenderPipelineDescriptor { vertex: webgpu::ShaderStage { shader, entry: vertex.into() }, fragment: Some(webgpu::ShaderStage { shader, entry: fragment.into() }), layouts, vertex_buffers: vec![], primitive: webgpu::PrimitiveState { topology: webgpu::PrimitiveTopology::TriangleList, front: webgpu::FrontFace::Ccw, cull: webgpu::CullMode::None, strip_index_format: None }, depth: None, colors: vec![webgpu::ColorTarget { format, blend: None, write_mask: 15 }], sample_count: 1, alpha_to_coverage: false }
}
pub fn gpu_surface_pass(surface: u32) -> webgpu::RenderPassDescriptor {
    webgpu::RenderPassDescriptor { colors: vec![webgpu::ColorAttachment { target: webgpu::AttachmentTarget::Surface(surface), resolve: None, load: webgpu::LoadOp::Clear, store: webgpu::StoreOp::Store, clear: webgpu::Color { r: 0.048, g: 0.079, b: 0.059, a: 1. } }], depth: None, timestamps: None }
}

pub struct Clip {
    decoder: u32,
    frames: Vec<&'static [u8]>,
    cursor: usize,
    last: f32,
    timestamp: f64,
}
impl Clip {
    async fn new() -> Result<Self, String> {
        let bytes = include_bytes!("../../fixtures/aurora.ivf");
        let mut frames = Vec::new();
        let mut offset = 32;
        while offset + 12 <= bytes.len() {
            let length = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
            let end = offset + 12 + length;
            if end > bytes.len() {
                return Err("Incomplete bundled video frame".into());
            }
            frames.push(&bytes[offset + 12..end]);
            offset = end;
        }
        if frames.is_empty() {
            return Err("Bundled video contains no frames".into());
        }
        let decoder = video::create_decoder(
            canvas::open("decoded", 480, 270)?,
            "vp8".into(),
            480,
            270,
            vec![],
        )
        .await?;
        Ok(Self {
            decoder,
            frames,
            cursor: 0,
            last: -1.,
            timestamp: 0.,
        })
    }
    fn draw(&mut self, time: f32) -> Result<(), String> {
        let frame_tick = (time * 24.).floor();
        if frame_tick == self.last || video::queue_size(self.decoder)? > 2 {
            return Ok(());
        }
        let key = self.frames[self.cursor][0] & 1 == 0;
        video::decode(
            self.decoder,
            key,
            self.timestamp,
            Some(1_000_000. / 24.),
            self.frames[self.cursor],
        )?;
        self.timestamp += 1_000_000. / 24.;
        self.cursor = (self.cursor + 1) % self.frames.len();
        self.last = frame_tick;
        Ok(())
    }
}
struct Sound {
    context: u32,
    buffer: u32,
    voice: u32,
    start: f64,
}
fn sample(t: f32) -> f32 {
    [220., 275., 330., 440.]
        .iter()
        .map(|f| (t * f * TAU).sin())
        .sum::<f32>()
        * 0.11
}
impl Sound {
    async fn new() -> Result<Self, String> {
        let context = audio::open(Some(48000.))?;
        if let Err(error) = audio::resume(context).await {
            audio::close(context)?;
            return Err(error);
        }
        let buffer = audio::create_buffer(context, 1, 96000, 48000.)?;
        let pcm: Vec<_> = (0..96000).map(|i| sample(i as f32 / 48000.)).collect();
        audio::write_channel(buffer, 0, &pcm, 0)?;
        let start = audio::time(context)? + 0.02;
        let voice = audio::play(context, buffer, start, 0.12, true)?;
        Ok(Self {
            context,
            buffer,
            voice,
            start,
        })
    }
    fn close(self) -> Result<(), String> {
        audio::stop(self.voice)?;
        audio::close(self.buffer)?;
        audio::close(self.context)
    }
}
struct Gallery {
    surface: u32,
    wave: u32,
    clock: u32,
    gl: Option<Gl>,
    gpu: Option<Gpu>,
    clip: Option<Clip>,
}
thread_local! {
    static GALLERY:RefCell<Option<Gallery>>=const {RefCell::new(None)};
    static RUNNING:Cell<bool>=const {Cell::new(false)};
    static PAUSED:Cell<bool>=const {Cell::new(false)};
    static PLAYER:Cell<Option<u32>>=const {Cell::new(None)};
    static SOUND:RefCell<Option<Sound>>=const {RefCell::new(None)};
    static POINTER:Cell<[f32;3]>=const {Cell::new([320.,200.,1.])};
    static PRESSED:Cell<bool>=const {Cell::new(false)};
}
pub fn pointer(event: crate::exports::druid::openui::pointer::PointerEvent) {
    use crate::exports::druid::openui::pointer::EventKind;
    if event.region != "orbit" {
        return;
    }
    let mut value = POINTER.get();
    match event.kind {
        EventKind::Move | EventKind::Down | EventKind::Enter => {
            value[0] = (event.x * 640. / event.width.max(1.)).clamp(0., 640.);
            value[1] = (event.y * 400. / event.height.max(1.)).clamp(0., 400.);
            PRESSED.set(event.buttons & 1 != 0);
        }
        EventKind::Wheel if !event.control && !event.meta => {
            value[2] = (value[2] - event.wheel_y * 0.001).clamp(0.4, 1.5)
        }
        EventKind::Up | EventKind::Cancel | EventKind::Blur => PRESSED.set(false),
        EventKind::Leave if event.buttons == 0 => {
            value[0] = 320.;
            value[1] = 200.;
        }
        _ => (),
    }
    POINTER.set(value);
}
pub async fn init() -> Result<(), String> {
    let surface = canvas::open("canvas", 640, 400)?;
    let wave = canvas::open("wave", 640, 400)?;
    let clock = canvas::open("clock", 640, 400)?;
    let gl = match Gl::new() {
        Ok(g) => {
            text("$glStatus", "GLSL shaders · persistent vertex buffer");
            Some(g)
        }
        Err(e) => {
            text("$glStatus", &e);
            None
        }
    };
    let gpu = match Gpu::new().await {
        Ok(g) => {
            text(
                "$gpuStatus",
                "16,384 particles · GPU compute + instanced rendering",
            );
            Some(g)
        }
        Err(e) => {
            text("$gpuStatus", &e);
            None
        }
    };
    let clip = match Clip::new().await {
        Ok(c) => {
            text("$videoStatus", "VP8 · 480 × 270 · 24 frames / second");
            Some(c)
        }
        Err(e) => {
            text("$videoStatus", &e);
            None
        }
    };
    match video::open("gallery-video", "./media/aurora.webm", true, true) {
        Ok(id) => PLAYER.set(Some(id)),
        Err(e) => text("$videoStatus", &e),
    };
    GALLERY.with(|g| {
        g.replace(Some(Gallery {
            surface,
            wave,
            clock,
            gl,
            gpu,
            clip,
        }))
    });
    Ok(())
}

fn orbit(surface: u32, time: f32) -> Result<(), String> {
    let [cx, cy, scale] = POINTER.get();
    let mut commands = vec![
        fill("#111d17", 640., 400.),
        canvas::DrawCommand::LineWidth(0.75),
    ];
    for ring in 0..5 {
        path(
            &mut commands,
            (0..=160).map(|i| {
                let a = i as f32 / 160. * TAU;
                let r = (65. + ring as f32 * 22. + (a * 5. + time * 0.35).sin() * 12.) * scale;
                (cx + a.cos() * r, cy + a.sin() * r * 0.83)
            }),
            ["#355a46", "#416c4d", "#4e7a54", "#62875d", "#7f9e6a"][ring],
        );
    }
    canvas::draw(surface, &commands)?;
    let particles: Vec<_> = (0..1000)
        .flat_map(|i| {
            let seed = i as f32 * 2.399963;
            let radius = (i as f32 / 1000.).sqrt() * 155. * scale;
            let a = seed + time * 0.08 + (radius * 0.03 + time * 0.12).sin() * 0.25;
            let size = if i % 9 == 0 { 2.2 } else { 1.1 };
            [
                cx + a.cos() * radius,
                cy + a.sin() * radius * 0.83,
                size,
                size,
            ]
        })
        .collect();
    canvas::fill_rects(
        surface,
        &particles,
        if PRESSED.get() { "#f3bd7d" } else { "#c3e0a7" },
    )
}
fn waveform(surface: u32, time: f32, playing: bool) -> Result<(), String> {
    let mut commands = vec![
        fill("#211e17", 640., 400.),
        canvas::DrawCommand::LineWidth(1.),
    ];
    for y in [100., 200., 300.] {
        path(&mut commands, [(40., y), (600., y)].into_iter(), "#353024");
    }
    for row in 0..3 {
        path(
            &mut commands,
            (0..=400).map(|i| {
                let x = 40. + i as f32 / 400. * 560.;
                let y = 200. + sample(time + i as f32 / 400. * 0.025 + row as f32 * 0.0003) * 130.;
                (x, y)
            }),
            ["#695239", "#b48d5d", "#f0c58a"][row],
        );
    }
    commands.push(canvas::DrawCommand::FillText(canvas::Text {
        value: if playing {
            "220 + 275 + 330 + 440 Hz".into()
        } else {
            "SOUND IS OFF · ENABLE ABOVE".into()
        },
        at: point(40., 355.),
        font: "11px monospace".into(),
        color: "#a38b67".into(),
    }));
    canvas::draw(surface, &commands)
}
fn clock(surface: u32, time: f32) -> Result<(), String> {
    let mut commands = vec![
        fill("#121d17", 640., 400.),
        canvas::DrawCommand::LineWidth(1.),
    ];
    for i in 0..120 {
        let a = i as f32 / 120. * TAU - TAU / 4.;
        let end = if i % 10 == 0 { 147. } else { 143. };
        path(
            &mut commands,
            [
                (320. + a.cos() * 134., 200. + a.sin() * 134.),
                (320. + a.cos() * end, 200. + a.sin() * end),
            ]
            .into_iter(),
            if i % 10 == 0 { "#72906a" } else { "#314b37" },
        );
    }
    let a = time * 0.7 - TAU / 4.;
    path(
        &mut commands,
        [(320., 200.), (320. + a.cos() * 107., 200. + a.sin() * 107.)].into_iter(),
        "#bad79e",
    );
    commands.push(canvas::DrawCommand::FillText(canvas::Text {
        value: format!(
            "{:02}:{:02}.{:01}",
            (time as u32 / 60) % 60,
            time as u32 % 60,
            (time.fract() * 10.) as u32
        ),
        at: point(247., 265.),
        font: "24px monospace".into(),
        color: "#d0e1bf".into(),
    }));
    canvas::draw(surface, &commands)
}
pub async fn start() -> Result<(), String> {
    if RUNNING.replace(true) {
        return Ok(());
    }
    let Some(mut scene) = GALLERY.with(|g| g.borrow_mut().take()) else {
        return Ok(());
    };
    if let Some(id) = PLAYER.get() {
        if let Err(e) = video::play(id).await {
            text("$videoStatus", &e);
        }
    }
    let mut last = animation::next_frame().await?;
    let mut time = 0f32;
    let mut report = last;
    let mut frames = 0;
    let mut timings = Vec::new();
    loop {
        let now = animation::next_frame().await?;
        if !PAUSED.get() {
            time += ((now - last) / 1000.) as f32;
            let before = animation::now();
            orbit(scene.surface, time)?;
            let audio_time = SOUND
                .with(|s| {
                    s.borrow()
                        .as_ref()
                        .map(|s| audio::time(s.context).map(|time| (time - s.start).max(0.)))
                })
                .transpose()?;
            waveform(
                scene.wave,
                audio_time.unwrap_or(time as f64 * 0.05) as f32,
                audio_time.is_some(),
            )?;
            clock(scene.clock, time)?;
            if let Some(gl) = &scene.gl {
                gl.draw(time)?;
            }
            if let Some(gpu) = &scene.gpu {
                gpu.draw(time)?;
            }
            if let Some(clip) = &mut scene.clip {
                clip.draw(time)?;
            }
            timings.push(animation::now() - before);
            frames += 1;
        }
        if now - report >= 1000. {
            text(
                "$fps",
                &format!("{:.0}", frames as f64 * 1000. / (now - report)),
            );
            if !timings.is_empty() {
                timings.sort_by(|a, b| a.total_cmp(b));
                text(
                    "$frameTime",
                    &format!(
                        "{:.1}",
                        timings[((timings.len() - 1) as f32 * 0.95) as usize]
                    ),
                );
            }
            frames = 0;
            timings.clear();
            report = now;
        }
        last = now;
    }
}
pub async fn toggle_motion() -> Result<(), String> {
    let paused = !PAUSED.get();
    PAUSED.set(paused);
    text(
        "$playLabel",
        if paused {
            "Resume motion"
        } else {
            "Pause motion"
        },
    );
    let context = SOUND.with(|s| s.borrow().as_ref().map(|s| s.context));
    if let Some(id) = context {
        if paused {
            audio::suspend(id).await?
        } else {
            audio::resume(id).await?
        }
        text(
            "$soundStatus",
            if paused {
                "Sound enabled · paused"
            } else {
                "Playing · four-note PCM chord · low volume"
            },
        );
    }
    if let Some(id) = PLAYER.get() {
        if paused {
            video::pause(id)?
        } else {
            video::play(id).await?
        }
    }
    Ok(())
}
pub async fn toggle_sound() -> Result<(), String> {
    if let Some(sound) = SOUND.with(|s| s.borrow_mut().take()) {
        sound.close()?;
        text("$soundLabel", "Enable sound");
        text("$soundStatus", "Visual preview · sound is off");
    } else {
        let sound = Sound::new().await?;
        if PAUSED.get() {
            audio::suspend(sound.context).await?;
        }
        SOUND.with(|s| s.replace(Some(sound)));
        text("$soundLabel", "Mute sound");
        text(
            "$soundStatus",
            if PAUSED.get() {
                "Sound enabled · paused"
            } else {
                "Playing · four-note PCM chord · low volume"
            },
        );
    }
    Ok(())
}
