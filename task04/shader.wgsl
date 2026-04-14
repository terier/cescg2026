const vertexArray = array(
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
    vec2f( 0.0,  0.5),
);

@vertex
fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(vertexArray[i], 0, 1);
}

@fragment
fn fragment() -> @location(0) vec4f {
    return vec4f(1, 0, 0, 1);
}
