//start : texture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    //替换标识符，材质颜色
    //output.color= pow(textureSample(u_colorTexture, u_Sampler, fsInput.uv ), vec4f(1.0 / 2.2)) ;//gamma编码，这里不使用，最后统一进行tone mapping
    materialColor=textureSample(u_colorTexture, u_Sampler, fsInput.uv );
    //如果有alpha，按照input规则输出，按照图像原始数据处理，这里的透明也写深度）
    if( $materialColorRule)
    {
        discard;
    }
    $fsOutputColor
    return output;
}
//end : texture.fs.wgsl
