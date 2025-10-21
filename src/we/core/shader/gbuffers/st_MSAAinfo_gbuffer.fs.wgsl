//start : st_MSAAinfo_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    // @location(0) color : vec4f,
    // @location(1) id : u32,
    // @location(2) normal : vec4f,
    // @location(3) ru_ma_AO : vec4f,
    // @location(4) worldPosition : vec4f,
    @location(0) id : u32,
    @location(1) normal : vec4f,
    @location(2) ru_ma_AO : vec4f,
    @location(3) worldPosition : vec4f,
}
//end : st_MSAAinfo_gbuffer.fs.wgsl
