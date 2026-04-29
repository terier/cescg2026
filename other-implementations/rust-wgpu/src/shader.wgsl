const vertexArray = array(
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
    vec2f( 0.0,  0.5),
);
const colorArray = array(
    vec4f(1.0, 0.0, 0.0, 1.0),
    vec4f(0.0, 1.0, 0.0, 1.0),
    vec4f(0.0, 0.0, 1.0, 1.0)
);

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn vertex(@builtin(vertex_index) i: u32) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = vec4f(vertexArray[i], 0, 1);
    output.color = colorArray[i];
    return output;
}

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4f {
    return in.color;
}
