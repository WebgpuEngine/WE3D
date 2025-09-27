//start : st_transgparentbuffer.fs.wgsl   
struct ST_TransParentGBuffer{
    @location(0) color1 : vec4f,
    @location(1) color2 : vec4f,
    @location(2) color3 : vec4f,
    @location(3) color4 : vec4f,
    @location(4) depth1 : f32,
    @location(5) depth2 : f32,
    @location(6) depth3 : f32,
    @location(7) depth4 : f32,
}
//end :st_transgparentbuffer.fs.wgsl
