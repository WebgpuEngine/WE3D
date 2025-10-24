//PBRColor.fs.wgsl   ,start
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
    $PBR_color
    //normal = normalize(normal); //这里是切线空间的法线，vs插值输出的，需要归一化
    // $deferRender_Depth  //延迟渲染的深度比较占位符
    let wo = normalize(defaultCameraPosition - fsInput.worldPosition);
    var Lo = vec3(0.0);
    if(U_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < U_lights.lightNumber; i = i + 1)
        {
            let onelight = U_lights.lights[i ];  

            let lightColor = U_lights.lights[i].color;
            let lightPosition = U_lights.lights[i].position;
            let lightIntensity = U_lights.lights[i].intensity;
            var distance = 0.0;                         //方向光没有距离
            var attenuation = lightIntensity;           //方向光没有衰减
            var wi = U_lights.lights[i].direction;      //方向光
            if(U_lights.lights[i].kind!=0)
            {
                wi = normalize(lightPosition - fsInput.worldPosition);
                distance = length(lightPosition - fsInput.worldPosition);
                attenuation = lightIntensity / (distance * distance);       //光衰减，这里光是平方，todo，需要考虑gamma校正
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
            //let ambient = getAmbientColor(albedo, ao);
            var visibility = getVisibilityOflight(onelight,fsInput.worldPosition,normal); 
            Lo += (diffuse + specular) * radiance* visibility;
            // Lo += (diffuse + specular) * radiance;
            //Lo=vec3f(metallic);          
        }
    }
    let ambient = getAmbientColor(albedo, ao);
    var colorOfPBR = (ambient + Lo);
        //HDR tonemapping,取消单个的，最后集中进行
    // colorOfPBR = colorOfPBR / (colorOfPBR + vec3f(1.0));
    // colorOfPBR = pow(colorOfPBR, vec3f(1.0 / 2.2)) * materialColor.rgb;
     colorOfPBR = colorOfPBR * materialColor.rgb;
    var output : ST_GBuffer;
    $fsOutput                         //占位符
    //output.color = vec4f(normal*0.5+0.5, 1);    //
    output.color = vec4f(colorOfPBR, 1);    //
    //    let depth=textureLoad(U_shadowMap_depth_texture, vec2i(i32(fsInput.position.x*2),i32(fsInput.position.y*2)),0,0) ;
    // output.color = vec4f( depth,depth,depth,1);
    return output;
}

//PBRColor.fs.wgsl   ,end
