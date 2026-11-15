#version 300 es
precision highp float;
uniform float time;
out vec4 color;
void main() {
    vec2 uv = (gl_FragCoord.xy - vec2(320.0, 200.0)) / 200.0;
    vec3 bg = vec3(0.067, 0.067, 0.095);
    bg += vec3(0.06, 0.035, 0.09) * exp(-dot(uv,uv)*1.8);
    vec2 p = uv - vec2(0.0, sin(time*0.65)*0.05);
    float r = 0.67;
    float d = length(p);
    if (d < r) {
        vec3 n = normalize(vec3(p / r, sqrt(1.0 - dot(p,p)/(r*r))));
        vec3 light = normalize(vec3(-0.6, 0.9, 1.4));
        float diffuse = max(dot(n, light), 0.0);
        float fresnel = pow(1.0 - n.z, 2.3);
        float bands = sin(n.x*5.0 + n.y*8.0 + time*0.4 + sin(n.y*6.0-time*.2));
        vec3 a = vec3(0.28, 0.20, 0.48);
        vec3 b = vec3(0.69, 0.62, 0.84);
        vec3 c = mix(a,b,bands*.5+.5) * (0.25 + diffuse*.8);
        c = mix(c,vec3(0.47,0.83,0.76), pow(max(sin(n.x*3.0+n.y*4.0+time*.15),0.0),4.0)*.55);
        float specular = pow(max(dot(reflect(-light,n),vec3(0,0,1)),0.0),90.0);
        c += specular*.8 + fresnel*vec3(0.37,0.55,0.54)*.7;
        c += exp(-pow((n.y+.35)*15.0,2.0)) * vec3(.08,.02,.11);
        bg = c;
    }
    float ring = abs(length((uv + vec2(0.0, 0.03)) * vec2(0.82, 2.8)) - 0.78);
    if (ring < .005 && (uv.y < 0.0 || d > r)) bg += vec3(.45,.35,.62) * (1.0-ring/.005);
    color = vec4(bg,1.0);
}
