//PBRdefer.fs.wgsl   ,start
struct PBRBaseUniform{
    color : vec4f,          //颜色
    albedo : vec3f,             //反射率
    metallic : f32,             //金属度
    roughness : f32,        //粗糙度
    ao : f32,               //环境光遮蔽
}
@fragment
fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    initSystemOfFS();   
    let F0 = vec3(0.04);
    var albedo : vec3f; var metallic : f32; var roughness : f32; var ao : f32; var normal : vec3f; var materialColor : vec4f;   //基础参数
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    $PBR_albedo
    $PBR_metallic
    $PBR_roughness
    $PBR_ao
    $PBR_normal
    //normal = normalize(normal); //这里是切线空间的法线，vs插值输出的，需要归一化
    var output : ST_GBuffer;
    $fsOutput                         //占位符
    return output;
}


//PBRdefer.fs.wgsl   ,end
