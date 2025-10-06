//start : color.fs.wgsl

struct st_TTPF{
     layer:u32,
     meshID:u32,
}

@fragment  fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {    
//@fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
    var id:u32 =0;
    if(u_TTPF.layer==1){
        id   = textureLoad(u_texture_ID, vec2i(floor( fsInput.position.xy)),0 ).g;
    }
    else if(u_TTPF.layer==2){
        id   = textureLoad(u_texture_ID, vec2i(floor( fsInput.position.xy)),0 ).b;
    }
    else if(u_TTPF.layer==3){
        id   = textureLoad(u_texture_ID, vec2i(floor( fsInput.position.xy)),0 ).a;
    }
    else {
        id   = textureLoad(u_texture_ID, vec2i(floor( fsInput.position.xy)),0 ).r;
    }
    let mask:u32 = (1<<30)-1;
    id=id&mask;
    id=id>>14;
    let ID:u32 =u_TTPF.meshID;
    if(id!=ID){
        discard;
        // return vec4f(0,0,1,0.03);
    }
    var color:vec4f =vec4f(1);
    $fsOutputColor
    return color;
    // return vec4f(1,0,0,0.31);
}
//end : color.fs.wgsl
