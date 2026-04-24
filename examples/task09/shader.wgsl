@group(0) @binding(0) var<uniform> matrix: mat4x4f;
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

@vertex
fn vertex(@location(0) position: vec2f) -> @builtin(position) vec4f {
    return matrix * vec4f(position, 0, 1);
}

@fragment
fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, position.xy / 1000);
}
