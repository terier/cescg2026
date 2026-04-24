@group(0) @binding(0) var<uniform> matrix: mat4x4f;
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@location(0) position: vec3f, @location(1) texcoords: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.position = matrix * vec4f(position, 1);
    output.position.w = 1 + output.position.z;
    output.texcoords = texcoords;
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, input.texcoords);
}
