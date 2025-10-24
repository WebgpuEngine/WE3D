//start : st_gbuffer.fs.wgsl   
struct ST_GBuffer{
    @builtin(frag_depth) depth : f32,
    @location(0) color : vec4f,
    @location(1) id : u32,
    @location(2) normal : vec4f,
    @location(3) RMAO : vec4f,
    @location(4) worldPosition : vec4f,
    @location(5) albedo : vec4f,
    // @location(4) X : f32,
    // @location(5) Y : f32,
    // @location(6) Z : f32,
}
//end : st_gbuffer.fs.wgsl
