struct Particle {
    position: vec2f,
    velocity: vec2f,
};

struct RenderParams {
    canvasSize: vec2f,
    radius: f32,
    _pad: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: RenderParams;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) local: vec2f,
};

fn pixel_to_clip(pixel: vec2f, size: vec2f) -> vec2f {
    let ndc = (pixel / size) * 2.0 - vec2f(1.0, 1.0);
    return vec2f(ndc.x, -ndc.y);
}

const corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, 1.0),
);

@vertex
fn vertex(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
    let particle = particles[instanceIndex];
    let local = corners[vertexIndex];
    let pixel = particle.position + local * params.radius;

    var out: VSOut;
    out.position = vec4f(pixel_to_clip(pixel, params.canvasSize), 0.0, 1.0);
    out.local = local;
    return out;
}

@fragment
fn fragment(in: VSOut) -> @location(0) vec4f {
    let distanceFromCenter = length(in.local);

    if distanceFromCenter > 1.0 {
        discard;
    }

    let highlight = 1.0 - distanceFromCenter;
    let base = vec3f(0.22, 0.62, 1.0);
    return vec4f(base * (0.55 + 0.45 * highlight), 1.0);
}
