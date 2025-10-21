//start : st_MSAA_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) color : vec4f,
}
//end : st_MSAA_gbuffer.fs.wgsl
