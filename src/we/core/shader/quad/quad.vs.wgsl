
struct st_quad_output {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f
};
//"triangle-strip"
@vertex fn vs(@builtin(vertex_index) vertexIndex: u32) ->st_quad_output {
    let pos = array(
            vec2f( -1.0,  -1.0),  // bottom left
            vec2f( 1.0,  -1.0),  // top left
            vec2f( -1.0,  1.0),  // top right
            vec2f( 1.0,  1.0),  // bottom right
            );
    return st_quad_output(
        vec4f(pos[vertexIndex], 0.0, 1.0),
        vec2f(pos[vertexIndex].x * 0.5 + 0.5, pos[vertexIndex].y * -0.5 + 0.5)
    );
}
