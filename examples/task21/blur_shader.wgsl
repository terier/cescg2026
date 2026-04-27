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
    return vec4f(0.0, 0.0, 1.0, 1.0);
}