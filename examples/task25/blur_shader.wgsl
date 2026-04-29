const SCREEN_VERTICES = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0)
);
const SCREEN_TEXCOORDS = array(
    vec2f(0.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0)
);


struct MaskUniform {
    mask: vec2f,
}


struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(1) texcoords: vec2f,
};


@group(0) @binding(0)
var texture: texture_2d<f32>;
@group(0) @binding(1)
var textureSampler: sampler;
@group(1) @binding(0)
var<uniform> maskUniform: MaskUniform;

@vertex
fn vertex(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = vec4f(SCREEN_VERTICES[vertexIndex], 0.0, 1.0);
    output.texcoords = SCREEN_TEXCOORDS[vertexIndex];
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    const kernelSize = 11;
    const kernelHalfSize = (kernelSize / 2);
    const kernelLeftmostIndex = kernelHalfSize - kernelSize + 1;
    const kernelRightmostIndex = kernelHalfSize;

    let dims = textureDimensions(texture);
    let pixelSize = 1.0 / vec2f(dims);

    let mask = maskUniform.mask;

    var sum = vec4f(0);
    for (var i = kernelLeftmostIndex; i <= kernelRightmostIndex; i++) {
        let pixelDisplacement = pixelSize * f32(i) * mask;
        let textureCoordinates = pixelDisplacement + input.texcoords;
        sum += textureSample(texture, textureSampler, textureCoordinates);
    }
    sum /= f32(kernelSize);
    return sum;
}