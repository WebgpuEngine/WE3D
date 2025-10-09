//start : texture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    //替换标识符，材质颜色
    //output.color= pow(textureSample(u_colorTexture, u_Sampler, fsInput.uv ), vec4f(1.0 / 2.2)) ;//gamma编码，这里不使用，最后统一进行tone mapping
    var materialColor=textureSample(u_colorTexture, u_Sampler, fsInput.uv );
    //如果有alpha，按照input规则输出，按照图像原始数据处理，这里的透明也写深度）
    // if(output.color.a<1.0)
    if($materialColorRule)
    {
        discard;
    }
    output.color= materialColor;
    return output;
}
//end : texture.fs.wgsl
