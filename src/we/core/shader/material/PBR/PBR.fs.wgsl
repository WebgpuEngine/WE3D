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

struct PBRUniformTexture{
    kind: i32, //uniform 种类,-1=notUse,0=texture,1=value,2=vs
    texture_channel: i32,//E_TextureChannel 纹理通道:-1=user define,0=R,1=G,2=B,3=A,4=RG,5=RB,6=RA,7=GB,8=BA,9=RGB,10=RGBA
    data1:f32,//自定义:alphaTest,intensity,scale,
    data2:f32,//自定义:
    value: vec4f,//uniform value,按需匹配textureChannel适用
}
struct PBRUniformInput{
    albedo:PBRUniformTexture,   //u_texture_albedo, u_sampler_albedo
    metallic:PBRUniformTexture,  //u_texture_metallic, u_sampler_metallic
    roughness:PBRUniformTexture,  //u_texture_roughness, u_sampler_roughness
    ao:PBRUniformTexture,  //u_texture_ao, u_sampler_ao
    normal:PBRUniformTexture,  //u_texture_normal, u_sampler_normal
    color:PBRUniformTexture,  //u_texture_color, u_sampler_color
    emissive:PBRUniformTexture,  //u_texture_emissive, u_sampler_emissive
    depthmap:PBRUniformTexture,  //u_texture_depthmap, u_sampler_depthmap
    alpha:PBRUniformTexture,  //u_texture_alpha, u_sampler_alpha
    // irradianceMap:PBRUniformTexture,  //u_irradianceMap  
    // perfilteredMap:PBRUniformTexture,  //u_perfilteredMap  
    // brdfLUT:PBRUniformTexture,  //u_brdfLUT
    envmap:PBRUniformTexture,  //是否使用环境贴图
}
// @group(1) @binding(2) var<uniform> u_pbr_uniform : PBRUniformInput ;



@fragment fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();   
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    var albedo_uniform : vec4f = textureSample(u_texture_albedo,u_sampler_albedo,uv);
    var metallic_uniform : vec4f = textureSample(u_texture_metallic,u_sampler_metallic,uv);
    var roughness_uniform : vec4f = textureSample(u_texture_roughness,u_sampler_roughness,uv);
    var ao_uniform : vec4f = textureSample(u_texture_ao,u_sampler_ao,uv);
    var normal_uniform : vec4f = textureSample(u_texture_normal,u_sampler_normal,uv);
    var color_uniform : vec4f = textureSample(u_texture_color,u_sampler_color,uv);
    var emissive_uniform : vec4f = textureSample(u_texture_emissive,u_sampler_emissive,uv);
    var emissive_intensity_uniform : f32 = u_pbr_uniform.emissive.data1;
    var depthmap_uniform : vec4f = textureSample(u_texture_depthmap,u_sampler_depthmap,uv);
    var alpha_uniform : vec4f = textureSample(u_texture_alpha,u_sampler_alpha,uv);
    // var lightmap_uniform : vec4f = textureSample(u_texture_lightmap,u_sampler_lightmap,uv);//lightmap,目前未定义
    
    //albedo
    if(u_pbr_uniform.albedo.kind == 0){
        albedo_uniform = u_pbr_uniform.albedo.value;
    }
    albedo=albedo_uniform.rgb;
    //metallic
    if(u_pbr_uniform.metallic.kind == 0){
        metallic_uniform = u_pbr_uniform.metallic.value;
    }
    metallic=get_one_channel_value(metallic_uniform,u_pbr_uniform.metallic.texture_channel);
    //roughness
    if(u_pbr_uniform.roughness.kind == 0){
        roughness_uniform = u_pbr_uniform.roughness.value;
    }
    roughness=get_one_channel_value(roughness_uniform,u_pbr_uniform.roughness.texture_channel);    
    //ao    
    if(u_pbr_uniform.ao.kind == 0){
        ao_uniform = u_pbr_uniform.ao.value;
    }
    else if(u_pbr_uniform.ao.kind == -1){
        ao_uniform = vec4f(1);
    }
    ao=get_one_channel_value(ao_uniform,u_pbr_uniform.ao.texture_channel);    
    //normal
    if(u_pbr_uniform.normal.kind == 0){
        normal_uniform = u_pbr_uniform.normal.value;
    }
    if(u_pbr_uniform.normal.kind !=-1 && u_pbr_uniform.normal.kind != 2){
        normal= getNormalFromMap( normal ,normal_uniform.xyz, worldPosition, uv);
    }
    else if(u_pbr_uniform.normal.kind == 2){
        normal = normalize(normal);
    }
    //color
    if(u_pbr_uniform.color.kind == 0){
        color_uniform = u_pbr_uniform.color.value;
    }
    if(u_pbr_uniform.color.kind !=-1){
        materialColor = color_uniform;
    }
    //emissive
    if(u_pbr_uniform.emissive.kind == 0){
        emissive_uniform = u_pbr_uniform.emissive.value;
    }
    if(u_pbr_uniform.emissive.kind !=-1){
        emissiveRGB = emissive_uniform.rgb;
        emissiveIntensity = emissive_intensity_uniform;
    }
    //depthmap
    if(u_pbr_uniform.depthmap.kind == 0){
        depthmap_uniform = u_pbr_uniform.depthmap.value;
    }
    if(u_pbr_uniform.depthmap.kind !=-1){
        depthmap = get_one_channel_value(depthmap_uniform,u_pbr_uniform.depthmap.texture_channel);
    }
    //alpha
    if(u_pbr_uniform.alpha.kind == 0){
        alpha_uniform = u_pbr_uniform.alpha.value;
    }
    if(u_pbr_uniform.alpha.kind !=-1){
        alphamap = get_one_channel_value(alpha_uniform,u_pbr_uniform.alpha.texture_channel);
    }
    //envmap
    if( u_pbr_uniform.envmap.kind == 1){
        envmap_enable = true;
    }
    // $PBR_albedo
    // $PBR_metallic
    // $PBR_roughness
    // $PBR_ao
    // $PBR_normal
    // $PBR_color

    // albedo=vec3f(1.0, 0.71, 0.29);
    // metallic=0.91;
    // roughness=0.3;
    // ao=1.0;
    // materialColor=vec4f(1);

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

fn get_one_channel_value(value:vec4f,channel:i32) -> f32{
    var result:f32 = value.r;
    if(channel == 0){
        result = value.r;
    }
    else if(channel == 1){
        result = value.g;
    }
    else if(channel == 2){
        result = value.b;
    }
    else if(channel == 3){
        result = value.a;
    }
    return result;
}

//PBRColor.fs.wgsl   ,end

