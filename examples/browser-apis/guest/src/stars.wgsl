struct Params { time: f32, width: f32, height: f32, count: f32 }
@group(0) @binding(0) var<storage, read> stars: array<vec4f>;
@group(0) @binding(1) var<uniform> p: Params;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) tint: vec3f }
@vertex fn vertex(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Vertex {
    let quad = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
    let star = stars[i];
    let size = .5 + pow(star.z,6.0)*1.6;
    var out: Vertex;
    out.position = vec4f(star.xy + quad[v] * size * vec2f(2.0/p.width,2.0/p.height),0,1);
    out.uv = quad[v];
    let twinkle = .7 + .3 * sin(p.time + f32(i)*.13);
    out.tint = mix(vec3f(.27,.5,.45),vec3f(.89,.94,.70),pow(1.0-star.w,2.0)) * twinkle;
    return out;
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4f {
    let d = length(v.uv);
    if (d > 1.0) { discard; }
    return vec4f(v.tint * (1.0-d*.5), 1.0);
}
