@group(0) @binding(0) var<uniform> matrix: mat4x4f;
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var thesampler: sampler;

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@location(0) position: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = matrix * vec4f(position, 0, 1);
    output.texcoords = position * 0.5 + 0.5;
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, thesampler, input.texcoords);
}
