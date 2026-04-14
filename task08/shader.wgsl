@group(0) @binding(0) var<uniform> matrix: mat4x4f;

@vertex
fn vertex(@location(0) position: vec2f) -> @builtin(position) vec4f {
    return matrix * vec4f(position, 0, 1);
}

@fragment
fn fragment() -> @location(0) vec4f {
    return vec4f(1, 0, 0, 1);
}
