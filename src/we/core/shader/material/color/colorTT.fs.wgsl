//start : colorTO.fs.wgsl,示例模板，color不存在TO
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
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
