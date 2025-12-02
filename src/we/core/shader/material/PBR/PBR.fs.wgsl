//PBRColor.fs.wgsl   ,start
//统一uniform，将data和texture统一进行处理
struct PBRBaseUniform{
    color : vec4f,           //颜色
    normal : vec3f,          //法线
    height: f32,             //高度,没有数据版本的高度图(只看use)，默认:1
    albedo : vec3f,          //反射率
    metallic : f32,          //金属度
    roughness : f32,         //粗糙度
    ao : f32,                //环境光遮蔽,没有数据版本的AO图(只看use)，默认:1
    emissive : vec4f,        //自发光颜色,只有数据版本的自发光
    useColorModel: u32,     //是否使用颜色纹理:0=vs color, 1=texture,2= uniform color
    useNormalModel: u32,    //是否使用法线纹理:0=vs normal, 1=texture
    useHeightModel: u32,    //是否使用高度纹理:0=没有高度图, 1=有高度图
    useAlbedoModel: u32,    //是否使用反射率纹理:0= uniform albedo, 1=texture
    useMetallicModel: u32,   //是否使用金属度纹理:0= uniform metallic, 1=texture
    useRoughnessModel: u32,   //是否使用粗糙度纹理:0= uniform roughness, 1=texture
    useAOModel: u32,        //是否使用环境光遮蔽纹理:0= 1, 1=texture,2= uniform ao
}

struct PBRTextureUniform{
    kind: i32,
    textureChannel: i32,
    reMap: vec2f,
    value: vec4f,
}
struct PBRUniformInput{
    albedo:PBRTextureUniform,
    metallic:PBRTextureUniform,
    roughness:PBRTextureUniform,
    ao:PBRTextureUniform,
    normal:PBRTextureUniform,
    color:PBRTextureUniform,
    emissive:PBRTextureUniform,
    alpha:PBRTextureUniform,
    irradianceMap:PBRTextureUniform,
    perfilteredMap:PBRTextureUniform,
    brdfLUT:PBRTextureUniform,
}
// @group(1) @binding(2) var<uniform> U_shadowMapMatrix : array<PBRTextureUniform, 8 >;//数组对应的texture在PBRMaterial.ts中,

@fragment
fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();   
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    $PBR_albedo
    $PBR_metallic
    $PBR_roughness
    $PBR_ao
    $PBR_normal
    $PBR_color
    $mainColorCode
    $encodeLightAndShadow
    RMAO=vec3f(roughness,metallic,ao);
    var output : ST_GBuffer;
    $fsOutput                         //fs 输出
    //output.color = vec4f(normal*0.5+0.5, 1);    //
    // output.color = vec4f(colorOfPBR, 1);    //
    //    let depthTest=textureLoad(U_shadowMap_depth_texture, vec2i(i32(fsInput.position.x),i32(fsInput.position.y)),0,0) *1.;
    // output.color = vec4f( depthTest,depthTest,depthTest,1);
    return output;
}

//PBRColor.fs.wgsl   ,end
