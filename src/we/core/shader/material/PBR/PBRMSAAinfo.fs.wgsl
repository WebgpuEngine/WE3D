//PBRMSAAinfo.fs.wgsl   ,start
struct PBRBaseUniform{
    color : vec4f,          //颜色
    albedo : vec3f,             //反射率
    metallic : f32,             //金属度
    roughness : f32,        //粗糙度
    ao : f32,               //环境光遮蔽
}
@fragment
fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();   
    let F0 = vec3(0.04);
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    $PBR_albedo
    $PBR_metallic
    $PBR_roughness
    $PBR_ao
    $PBR_normal

    var output : ST_GBuffer;
    $fsOutput                         //占位符
 
    return output;
}

//PBRMSAAinfo.fs.wgsl   ,end
