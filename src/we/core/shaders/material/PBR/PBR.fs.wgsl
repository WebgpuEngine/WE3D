//PBRColor.fs.wgsl   ,start
#includeFile "graphic/bindgroup3/bindgroup.wgsl"
// #includeFile "graphic/ibl/struct_ibl.wgsl"
#includeFile "graphic/ibl/ibl_fn.wgsl"

#includeFile "system/structOfCamera.wgsl" 
#includeFile "system/system.wgsl"
#tag gbuffers
#includeFile "function/encodeAndDecode.wgsl"
#includeFile "entity/st_vertex_output.wgsl"

#includeFile "math/baseconst.wgsl"
#includeFile "math/TBN.wgsl"
#includeFile "math/random.wgsl"
#includeFile "shadowmap/fn_pcss.wgsl"
#includeFile "material/PBR/PBRfunction.wgsl"


/**PBR的统一参数化单项，用于判断PBR相关参数是否使用，及来源：是来自于数值，还是纹理 */
struct PBRUniformTexture{
    kind: i32, //uniform 种类,-1=notUse,0=value,1=texture,2=vs
    texture_channel: i32,//E_TextureChannel 纹理通道:-1=user define,0=R,1=G,2=B,3=A,4=RG,5=RB,6=RA,7=GB,8=BA,9=RGB,10=RGBA
    // uv:i32,//uv channel,0=uv,1=uv1
    data1:i32,//自定义:模式判别使用，各自不同，按需处理
    data2:f32,//自定义:alphaTest,intensity,scale,
    value: vec4f,//factor uniform value,按需匹配textureChannel适用
}
/**所有参数的统一化输入，判断参数来源，以进行统一控制流处理 */
struct st_pbr_UniformInput{
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
    emissive_intensity:PBRUniformTexture,  //u_texture_emissive, u_sampler_emissive
}
// @group(1) @binding(2) var<uniform> u_pbr_uniform : PBRUniformInput ;     //这里可以写成固定，因为就是固定的。考虑到扩展，目前是在PBRMaterial.getUniformEntryBundleOfCommon()中定义的。

#replace user_shader_function_code


@fragment fn fs(fsInput : st_vertex_output) -> ST_GBuffer {
#includeFile "gbuffers/commonGBufferValue.wgsl"  //初始化GBuffer的通用值
    init_system_fs();   
    //占位符,统一工作流在这里处理
    // $PBR_Uniform
    
    // 判断UV使用的通道
    var uv_temp:vec2f=uv;
    
    //albedo
    var albedo_uniform : vec4f = u_pbr_uniform.albedo.value;
    if(u_pbr_uniform.albedo.kind == 1){//use texture albedo * (uniform albedo as factor)
        if(u_pbr_uniform.albedo.data1 == 1){        uv_temp = uv1;    }    else {        uv_temp = uv;    }
         albedo_uniform = textureSample(u_texture_albedo,u_sampler_albedo,uv_temp) * u_pbr_uniform.albedo.value;
    }    
    albedo=albedo_uniform.rgb;
    
    // 是否有color 设置
    var color_uniform : vec4f = vec4f(0.0);
    //判断color 类型
    if(u_pbr_uniform.alpha.kind == 0){//use texture 
        var uv_temp:vec2f=uv;
        if(u_pbr_uniform.color.data1 == 1){        uv_temp = uv1;    }    else {        uv_temp = uv;    }
         color_uniform = textureSample(u_texture_color, u_sampler_color, uv_temp);
    }
    else if(u_pbr_uniform.alpha.kind == 1){//use value data
        color_uniform = u_pbr_uniform.color.value;
    }
    else if(u_pbr_uniform.alpha.kind == 2){//use vs data
        color_uniform = vec4(fsInput.color,1.0);
    }
    // //color
    // if(u_pbr_uniform.color.kind == 0){
    //     color_uniform = u_pbr_uniform.color.value;
    // }
    // else if(u_pbr_uniform.color.kind == 1){//use texture color * (uniform color as factor)
    //     // color_uniform *= u_pbr_uniform.color.value;//考虑的过于复杂，取消，直接使用纹理颜色（rgba）；2026058；
    // }
    // // else{ //} if(u_pbr_uniform.color.kind !=-1){
    // //     materialColor = color_uniform;//这时是(0,0,0)
    // // }




    // 判断 alpha discard ,before early Z of hardware
    if(u_pbr_uniform.alpha.kind == -1){//直接使用纹理（albedo或color）的alpha通道值
        if(u_pbr_uniform.color.kind == 1 &&  u_pbr_uniform.alpha.data1  ==1){//有单独的color 纹理  ;alpha.data1=1(alphaTest ,MASK)
            // alphamap = color_uniform.a; 
            if(color_uniform.a <=  u_pbr_uniform.alpha.data2){
                discard;
            }
        }
        // else if(u_pbr_uniform.albedo.kind == 1 &&  u_pbr_uniform.alpha.data2  ==1){//有单独的albedo 纹理
        else if(u_pbr_uniform.albedo.kind == 1 &&  u_pbr_uniform.alpha.data1  ==1){//有单独的albedo 纹理  ;alpha.data1=0(alphaTest ,MASK)
            // alphamap = albedo_uniform.a; 
            if(albedo_uniform.a <=  u_pbr_uniform.alpha.data2){
                discard;
            }
        }
        // alphamap = 1;
        // alphamap = get_one_channel_value(alpha_uniform,u_pbr_uniform.alpha.texture_channel);//获得alpha通道值
    }    

    // 是否有alpha 设置
    var alpha_uniform : vec4f = vec4f(0.0);
    if(u_pbr_uniform.alpha.kind == 1){//use texture
        var uv_temp:vec2f=uv;
        if(u_pbr_uniform.alpha.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }   //20260813，这个应该是错误的   
         alpha_uniform = textureSample(u_texture_alpha,u_sampler_alpha,uv_temp);
    }
    else if(u_pbr_uniform.alpha.kind == 0){//use vs data
        alpha_uniform = u_pbr_uniform.alpha.value;
    }

    // 是否有metallic 设置
    var metallic_uniform : vec4f  = u_pbr_uniform.metallic.value;
    if(u_pbr_uniform.metallic.kind == 1){//use texture metallic * (uniform metallic as factor)
        if(u_pbr_uniform.metallic.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }    
        metallic_uniform  = textureSample(u_texture_metallic,u_sampler_metallic,uv_temp);
        // metallic_uniform *= u_pbr_uniform.metallic.value;
    }
        metallic=get_one_channel_value(metallic_uniform,u_pbr_uniform.metallic.texture_channel);


    //roughness
    var roughness_uniform : vec4f =  u_pbr_uniform.roughness.value;
    if(u_pbr_uniform.roughness.kind == 1){//use texture roughness * (uniform roughness as factor)
        if(u_pbr_uniform.roughness.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
         roughness_uniform  = textureSample(u_texture_roughness,u_sampler_roughness,uv_temp);
        // roughness_uniform *= u_pbr_uniform.roughness.value;
    }
    roughness=get_one_channel_value(roughness_uniform,u_pbr_uniform.roughness.texture_channel);    


    //ao    
    var ao_uniform : vec4f  = u_pbr_uniform.ao.value;
    if(u_pbr_uniform.ao.kind == 1){//use texture ao * (uniform ao as factor)
        if(u_pbr_uniform.ao.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
        ao_uniform = textureSample(u_texture_ao,u_sampler_ao,uv_temp);
        ao_uniform *= u_pbr_uniform.ao.data2;
    }
    else if(u_pbr_uniform.ao.kind == -1){//unuse
        ao_uniform = vec4f(1);
    }
    ao=get_one_channel_value(ao_uniform,u_pbr_uniform.ao.texture_channel);   



    //normal
    if(u_pbr_uniform.normal.kind ==1 ){//use texture normal 
        if(u_pbr_uniform.normal.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
        var normal_uniform : vec4f = textureSample(u_texture_normal,u_sampler_normal,uv_temp);
        normal= getNormalFromMap( normal ,normal_uniform.xyz, worldPosition, uv);
    }
    else// if(u_pbr_uniform.normal.kind == 2)
    {//use vs normal
        normal = normalize(normal);
    }

    //emissive intensity
    var emissive_intensity_uniform : vec4f = u_pbr_uniform.emissive_intensity.value;
    //emissive
    var emissive_uniform : vec4f =  u_pbr_uniform.emissive.value;
    if(u_pbr_uniform.emissive.kind == 1){//use texture emissive * (uniform emissive as factor)
        if(u_pbr_uniform.emissive.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }
        emissive_uniform  = textureSample(u_texture_emissive,u_sampler_emissive,uv_temp);
        emissive_uniform *= u_pbr_uniform.emissive.value;
    }
    if(u_pbr_uniform.emissive.kind !=-1){
        emissiveRGB = emissive_uniform.rgb;
        // emissiveRGB.b = 0.0;//20260518 编码错误
        emissiveIntensity = emissive_intensity_uniform.xyz;
    }

    

    if(u_pbr_uniform.depthmap.data1 == 1){ uv_temp = uv1;  } else {        uv_temp = uv;    }    
    var depthmap_uniform : vec4f = textureSample(u_texture_depthmap,u_sampler_depthmap,uv_temp);


    // var lightmap_uniform : vec4f = textureSample(u_texture_lightmap,u_sampler_lightmap,uv);//lightmap,目前未定义
    
    ///RGB通道的直接在赋值时使用；
    ///单通道的使用get_one_channel_value()函数进行获取；
    ///其他情况：设计未使用。TS：E_TextureChannel
    







    //depthmap
    if(u_pbr_uniform.depthmap.kind == 0){
        depthmap_uniform = u_pbr_uniform.depthmap.value;
    }
    //todo
    else if(u_pbr_uniform.depthmap.kind == 1){//use texture depthmap * (uniform depthmap as factor)
        // depthmap_uniform *= u_pbr_uniform.depthmap.value;
    }
    if(u_pbr_uniform.depthmap.kind !=-1){
        depthmap = get_one_channel_value(depthmap_uniform,u_pbr_uniform.depthmap.texture_channel);
    }

    //envmap,todo
    if( u_pbr_uniform.envmap.kind == 1){
        envmap_enable = true;
    }
#weStart
    #renderMode  Msaa
     #includeFile "material/MSAA/msaa.wgsl"
#weEnd

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

    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 1;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);
 
    RMAO=vec3f(roughness,metallic,ao);

#replace user_shader_code


#weStart 
  #renderMode  MsaaInfo  
    //无color输出
  #renderMode  defer     
    //color使用上面代码中的materialColor即可，无需处理
  #renderMode forward  Msaa   blend
    materialColor = calcLightAndShadowOfPBR(
        worldPosition,
        normal,
        albedo,
        metallic,
        roughness,
        ao,
        materialColor,
        emissiveRGB,
        emissiveIntensity
        );
#weEnd
    if( u_pbr_uniform.alpha.data1  ==2  ){
        if( u_pbr_uniform.albedo.kind == 1 ){
            materialColor.a=albedo_uniform.a;
        }
        else if( u_pbr_uniform.color.kind == 1 ){
            materialColor.a=color_uniform.a;
        }
        else if (u_pbr_uniform.albedo.kind == 0){
            materialColor.a=albedo_uniform.a;
        }
    }
    // else if(u_pbr_uniform.alpha.data2  ==2){//alpha mode =BLend
    //     //两种方式
    //     //1、非成组模式，由pipeline渲染
    //     //2、TTP -A-Buffer, 由TT渲染
    // }

    //output.color = vec4f(normal*0.5+0.5, 1);    //
    // output.color = vec4f(colorOfPBR, 1);    //
    //    let depthTest=textureLoad(u_shadowmap_depth_texture, vec2i(i32(fsInput.position.x),i32(fsInput.position.y)),0,0) *1.;
    // output.color = vec4f( depthTest,depthTest,depthTest,1);
    var output : ST_GBuffer;
#tag gbuffers_output 


    return output;
}
//按通道值，获取分量值
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

