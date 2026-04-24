struct ConfigUniform {
    displacementMask: vec2f
}

@group(0) @binding(0)
var texture: texture_2d<f32>;
@group(0) @binding(1)
var thesampler: sampler;
@group(1) @binding(0)
var<uniform> config: ConfigUniform;

const GAUSSIAN_X = array(
    0.00038771, 0.01330373, 0.11098164, 0.22508352, 0.11098164, 0.01330373, 0.00038771
);

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

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = vec4f(SCREEN_VERTICES[vertexIndex], 0.0, 1.0);
    output.texcoords = SCREEN_TEXCOORDS[vertexIndex];
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    let dims = textureDimensions(texture);
    let pixelSize = 1.0 / vec2f(dims);

    let mask = config.displacementMask;

    var sum = vec4f(0);
    for (var i = -5; i < 6; i++) {
        let pixelDisplacement = pixelSize * f32(i) * mask;
        let index = pixelDisplacement + input.texcoords;
        sum += textureSampleLevel(texture, thesampler, index, 0);
    }
    sum /= 11;
    return sum;
}