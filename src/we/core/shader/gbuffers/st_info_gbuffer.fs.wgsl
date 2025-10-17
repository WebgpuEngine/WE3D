//start : st_gbuffer.fs.wgsl   
struct ST_MSAA_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) color : vec4f,
}
//end : st_gbuffer.fs.wgsl
