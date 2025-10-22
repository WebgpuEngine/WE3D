@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput

    var materialColor = vec4f(1);
    //替换标识符，材质颜色
    $materialColor

    //输出的color
    $fsOutputColor

    return output;
}
