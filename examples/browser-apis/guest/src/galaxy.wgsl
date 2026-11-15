struct Params { time: f32, width: f32, height: f32, count: f32 }
@group(0) @binding(0) var<storage, read_write> stars: array<vec4f>;
@group(0) @binding(1) var<uniform> p: Params;
fn hash(n: f32) -> f32 { return fract(sin(n * 127.1 + 17.13) * 43758.5453); }
@compute @workgroup_size(64)
fn evolve(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= u32(p.count)) { return; }
    let seed = hash(f32(i));
    let radius = pow(seed, 0.72) * 0.92;
    let angle = f32(i % 4u) * 1.5707963 + radius * 5.8 - p.time * .075 + (hash(f32(i)+7.0)-.5)*.6;
    let jitter = (hash(f32(i)+15.0)-.5)*.07;
    stars[i] = vec4f(cos(angle)*radius*1.04, sin(angle)*radius*.66+jitter, hash(f32(i)+3.0), seed);
}
