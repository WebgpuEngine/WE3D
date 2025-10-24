//start : color.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    $fsOutputColor    
    $fsIfAlpha
    return output;
}
//end : color.fs.wgsl
