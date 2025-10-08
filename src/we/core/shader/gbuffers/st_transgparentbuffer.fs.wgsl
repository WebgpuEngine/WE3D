//start : st_transgparentbuffer.fs.wgsl   
struct ST_TransParentGBuffer{
    // @location(0) color1 : vec4f,
    // @location(1) color2 : vec4f,
    // @location(2) color3 : vec4f,
    // @location(3) color4 : vec4f,
    // @location(4) depth : vec4f,
    // @location(5) id : vec4u,
    @location(0) depth : vec4f,
    @location(1) id : vec4u,
}
//end :st_transgparentbuffer.fs.wgsl
