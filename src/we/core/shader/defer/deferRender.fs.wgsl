//deferPBR.fs.wgsl   ,start

@group(1) @binding(0) var u_colorTexture: texture_2d<f32>;
// @group(1) @binding(1) var u_idTexture: texture_2d<f32>;
@group(1) @binding(1) var u_normalTexture: texture_2d<f32>;
@group(1) @binding(2) var u_RMAOTexture: texture_2d<f32>;
@group(1) @binding(3) var u_worldPositionTexture: texture_2d<f32>;
@group(1) @binding(4) var u_albedoTexture: texture_2d<f32>;
// @group(1) @binding(6) var u_Sampler : sampler; 

@fragment fn fs( @builtin(position) pos : vec4f) ->  @location(0) vec4f {
    initSystemOfFS();   
    let uv =vec2i(floor(pos.xy));
    var  color =textureLoad(u_colorTexture,uv,0);
    let  normal =textureLoad(u_normalTexture,uv,0);
    let  RMAO =textureLoad(u_RMAOTexture,uv,0);
    let  worldPosition =textureLoad(u_worldPositionTexture,uv,0);
    let  albedo =textureLoad(u_albedoTexture,uv,0);

    let  roughness = RMAO.r;
    let  metallic = RMAO.g;
    let  ao = RMAO.b;
    let  emissiveIntensity = albedo.a;
    
    var  emissiveRGB = vec3f(0.0);
    let  emissiveColorRG = decodeF16ToF32x2(normal.a);
    emissiveRGB.r = emissiveColorRG.x;
    emissiveRGB.g = emissiveColorRG.y;

    let  emissiveColorB_LSH = decodeF16ToU8x2(RMAO.a);
    emissiveRGB.b = U8ToF32(emissiveColorB_LSH.x) ;

    let defer_4xU8InF16 = decodeLightAndShadowFromU8bitToU8x4(emissiveColorB_LSH.y);
    let acceptShadow=defer_4xU8InF16.r;
    let shadowKind=defer_4xU8InF16.g;
    let acceptlight=defer_4xU8InF16.b;
    let materialKind=defer_4xU8InF16.a;


    var materialColor = vec4f(.0);
    // materialColor = calcLightAndShadowOfPBR(
    //         worldPosition.rgb,
    //         normal.rgb,
    //         albedo.rgb,
    //         metallic,
    //         roughness,
    //         ao,
    //         color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
    //         emissiveRGB,
    //         emissiveIntensity);


    // materialColor = calcLightAndShadowOfPhong(
    //         worldPosition.rgb,
    //         normal.rgb,
    //         albedo.rgb,
    //         metallic,
    //         roughness,
    //         ao,
    //         color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
    //         emissiveRGB,
    //         emissiveIntensity,
    //         );

    materialColor = calcLightAndShadow(
            worldPosition.rgb,
            normal.rgb,
            albedo.rgb,
            metallic,
            roughness,
            ao,
            color,//vec3f(1),albedo的颜色已经在color中，不需要再乘以albedo
            emissiveRGB,
            emissiveIntensity,
            materialKind
            );

    if(materialKind==0){  
          materialColor =color;
          }
    else if(materialKind==1){
        //   materialColor =worldPosition;
    }
    // else if(materialKind==2){
    //     // materialColor = calcLightAndShadowOfPhong(
    // }

    //测试阴影贴图
    // let depthTest=textureLoad(U_shadowMap_depth_texture, vec2i(i32(pos.x),i32(pos.y)),1,0) ;//第一个方向光的阴影
    // let depthTest=textureLoad(U_shadowMap_depth_texture, vec2i(i32(pos.x),i32(pos.y)),2,0) ;//第二个方向光的阴影
    // materialColor = vec4f( depthTest,depthTest,depthTest,1);

    // //测试可见性
    //  var visibility = getVisibilityOflight(U_lights.lights[1],worldPosition.rgb,normal.rgb); 
    //  materialColor =vec4f(visibility,visibility,visibility,1);

    // let abc=f32(U_lights.lights[1].shadow_map_array_index);
    // materialColor =vec4f(abc,abc,abc,1);
    return materialColor;
}

fn calcLightAndShadow(
    worldPosition : vec3f,
    normal : vec3f,
    albedo : vec3f,
    metallic : f32,
    roughness : f32,
    ao : f32,
    color : vec4f,
    emissiveColor : vec3f,
    emissiveIntensity : f32,
    materialKind : u32
    ) -> vec4f
{
    //phong 光照模型
    var colorOfPhoneOfLights : array<vec3f, 2>;             //漫反射，高光反射
    colorOfPhoneOfLights[0]= vec3f(0.0);                    //漫反射：所有光源在pixel上的总和
    colorOfPhoneOfLights[1]= vec3f(0.0);                    //高光反射：所有光源在pixel上的总和

    //PBR 光照模型
    let F0 = vec3(0.04);
    let wo = normalize(defaultCameraPosition - worldPosition);
    var Lo = vec3(0.0);
    //计算光照模型
    if(U_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < U_lights.lightNumber; i = i + 1)
        {
            // if(i==0) {
            //     continue;
            // }

            //计算当前光源的可见性
            let onelight = U_lights.lights[i ];  
            var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
            //分别计算PBR和Phong光照模型
            if(materialKind==1){
                // let onelight = U_lights.lights[i ];  
                let lightColor = U_lights.lights[i].color;
                let lightPosition = U_lights.lights[i].position;
                let lightIntensity = U_lights.lights[i].intensity;
                var distance = 0.0;                         //方向光没有距离
                var attenuation = lightIntensity;           //方向光没有衰减
                var wi = U_lights.lights[i].direction;      //方向光
                if(U_lights.lights[i].kind!=0)
                {
                    wi = normalize(lightPosition - worldPosition);
                    distance = length(lightPosition - worldPosition);
                    attenuation = lightIntensity / (distance * distance);       //光衰减,这里光是平方,todo:需要考虑gamma校正
                }
                //计算光照强度
                let cosTheta = max(dot(normal, wi), 0.0);
                let radiance = lightColor * attenuation * cosTheta;         //光强
                //计算 DFG
                let halfVector = normalize(wi + wo);
                let f0 = mix(F0, albedo, metallic);
                let F = fresnelSchlick(max(dot(halfVector, wo), 0.0), f0);
                let NDF = DistributionGGX(normal, halfVector, roughness);
                let G = GeometrySmith(normal, wo, wi, roughness);
                //计算Cook-Torrance BRDF:
                let numerator = NDF * G * F;
                let denominator = 4.0 * max(dot(normal, wo), 0.0) * max(dot(normal, wi), 0.0) + 0.0001;
                let specular = numerator / denominator;
                //kS is equal to Fresnel
                let kS = F;
                var kD = vec3(1.0) - kS;
                kD *= 1.0 - metallic;
                //scale light by NdotL   L=wi
                let NdotL = max(dot(normal, wi), 0.0);
                //add to outgoing radiance Lo
                let diffuse = (kD * albedo / PI) * radiance * NdotL;//only diffuse light is currently implemented
                // var visibility = getVisibilityOflight(onelight,worldPosition,normal); 
                Lo += (diffuse + specular) * radiance* visibility;
            }
            else if(materialKind==2){
                let inSpecularColor = albedo;
                let shininess = ao;
                var onelightPhongColor : array<vec3f, 2>;       //当前光源的漫反射，高光反射
                var computeShadow = false;                      //是否计算阴影
                var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
                var inPointShadow = false;                      //是否为点光源的阴影
                if (onelight.kind ==0)
                {
                    onelightPhongColor = phongColorOfDirectionalLight(worldPosition, normal, onelight, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
                }
                else if (onelight.kind ==1)
                {
                    onelightPhongColor = phongColorOfPointLight(worldPosition, normal, onelight, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
                }
                else if (onelight.kind ==2)
                {
                    onelightPhongColor = phongColorOfSpotLight(worldPosition, normal, onelight, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
                }    
                colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] +visibility * onelightPhongColor[0];
                colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] +visibility * onelightPhongColor[1];
                }
        }
    }
    var finialColor:vec4f=vec4f(0);
    if(materialKind==1){
        let ambient = getAmbientColor(albedo, ao);
        let emissive = emissiveColor * emissiveIntensity;
        finialColor =vec4f(  color.rgb*(ambient + Lo) + emissive,color.a);
    }
    else if(materialKind==2){
        let colorOfAmbient = PhongAmbientColor();
        colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] /f32(U_lights.lightNumber);
        colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] /f32(U_lights.lightNumber);
        finialColor = vec4f((colorOfAmbient + colorOfPhoneOfLights[0]) * color.rgb + colorOfPhoneOfLights[1], color.a);
        finialColor = vec4f(finialColor.rgb, 1.0);
        // finialColor = vec4f(1,0,0,1);
    }
    return finialColor;
}
//deferPBR.fs.wgsl   ,end
