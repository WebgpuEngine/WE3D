@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput

     materialColor = vec4f(1);
    //替换标识符，材质颜色
    $materialColor

    //输出的color
    $fsOutputColor

    return output;
}
