struct Transforms {
    projection: mat4x4f,
    view: mat4x4f,
    model: mat4x4f
};

@group(0) @binding(0) var<uniform> transform: Transforms;
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var thesampler: sampler;

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@location(0) position: vec3f, @location(1) texcoords: vec2f) -> VertexOutput {
    var output: VertexOutput;

    let P = transform.projection;
    let V = transform.view;
    let M = transform.model;

    output.clipPosition = P * V * M * vec4f(position, 1.0);
    output.texcoords = texcoords;
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, thesampler, input.texcoords);
}
