//start : colorTO.fs.wgsl,示例模板，color不存在TO
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值

    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    $fsOutputColor    
    if(output.color.a>=1.0)
    {
        discard;
    }
    return output;
}
//end : color.fs.wgsl
