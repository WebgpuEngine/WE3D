//start : color.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_TransParentGBuffer {    
    initSystemOfFS();
    
    var color1: vec4f = vec4f(0,0,0,0);
    var color2: vec4f = vec4f(0,0,0,0);
    var color3: vec4f = vec4f(0,0,0,0);
    var color4: vec4f = vec4f(0,0,0,0);
    var depth1: f32 = 0.0;
    var depth2: f32 = 0.0;
    var depth3: f32 = 0.0;
    var depth4: f32 = 0.0;
    //start coding

    //end coding
    var output: ST_TransParentGBuffer;
     $fsOutput
    return output;
}
//end : color.fs.wgsl
