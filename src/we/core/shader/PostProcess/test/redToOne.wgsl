
@group(0) @binding(0) var u_screen_texture : texture_2d<f32>;   
     
 

@fragment
fn fs(@builtin(position) coord: vec4f) -> @location(0)  vec4f {
    var color = textureLoad(u_screen_texture, vec2i(floor(vec2f(coord.x , coord.y ))), 0);
    color.r=1.0;
    return  color ;
    // return vec4f(1,0,0,1);
}