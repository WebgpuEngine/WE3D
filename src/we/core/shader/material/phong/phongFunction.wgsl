// phongFunction.wgsl start
//todo,包含占位符，未使用uniform替换，会产生shader简单变体

// 初版方向光计算
fn phongColorDS(position : vec3f, vNormal : vec3f, lightDir : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f,roughness : f32,shininess : f32,metallic : f32) -> vec3f
{
    // let lightDir = normalize(lightPosition - position);
    let normal = normalize(vNormal);
    let light_atten_coff = lightIntensity ;
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    let halfDir = normalize(lightDir + viewDir);
    spec = pow (max(dot(normal, halfDir), 0.0), shininess);
    //spec = pow (max(dot(viewDir, reflectDir), 0.0), u_Shininess);
    let specularColor : vec3f = light_atten_coff *metallic * spec * lightColor;
    return diffColor + specularColor;
}


fn dotNormal(normal : vec3f, lightDir : vec3f) -> bool{
    let diff = max(dot(lightDir, normal), 0.0);
    if(diff ==0.0)
    {
        return false;
    }
    else{
        return true;
    }
}

fn PhongAmbientColor() -> vec3f{    return AmbientLight.color * AmbientLight.intensity;}

// 方向光计算，返回漫反射和高光颜色
fn phongColorOfDirectionalLight(position : vec3f, vNormal : vec3f, lightDir : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f, inSpecularColor : vec3f,roughness : f32,shininess : f32,metallic : f32) ->array<vec3f, 2>
{
    var colos_DS : array<vec3f, 2>;
    let normal = normalize(vNormal);
    let light_atten_coff = lightIntensity ;
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    let halfDir = normalize(lightDir + viewDir);
    spec = pow (max(dot(viewDir, halfDir), 0.0), shininess);
    //spec = pow (max(dot(viewDir, reflectDir), 0.0), u_Shininess);
    var  specularColor : vec3f = light_atten_coff *metallic * spec * lightColor * inSpecularColor;
    
    colos_DS[0]=diffColor;
    colos_DS[1]=specularColor;
    if(diff ==0.0)
    {
        colos_DS[0]=vec3f(0.0);
        colos_DS[1]=vec3f(0.0);
        return colos_DS;
    }
    return colos_DS;
}

// 点光源计算，返回漫反射和高光颜色
fn phongColorOfPointLight(position : vec3f, vNormal : vec3f, lightPosition : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f, inSpecularColor : vec3f,roughness : f32,shininess : f32,metallic : f32) -> array<vec3f, 2>
{
    var colos_DS : array<vec3f, 2>;
    let lightDir = normalize(lightPosition - position);
    var normal = normalize(vNormal);            //归一化normal，或法线贴图的值
 
    let light_atten_coff = lightIntensity / length(lightPosition - position);   //光衰减，这里阳光是平方，todo，需要考虑gamma校正
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    spec = pow (max(dot(viewDir, reflectDir), 0.0), shininess);
    var specularColor = light_atten_coff * metallic * spec * lightColor * inSpecularColor;
    if(diff ==0.0)
    {
        colos_DS[0]=vec3f(0.0);
        colos_DS[1]=vec3f(0.0);
        return colos_DS;
    }
    colos_DS[0]=diffColor;
    colos_DS[1]=specularColor;
    return colos_DS;
}

// 聚光灯计算，返回漫反射和高光颜色
fn phongColorOfSpotLight(position : vec3f, vNormal : vec3f, lightPosition : vec3f, lightDirection : vec3f, lightColor : vec3f, lightIntensity : f32, angle : vec2f, viewerPosition : vec3f, inSpecularColor : vec3f,roughness : f32,shininess : f32,metallic : f32) ->array<vec3f, 2>
{
    var colos_DS : array<vec3f, 2>;
    let lightDir = normalize(lightPosition - position);                     //光源到物体的点的方向
    let viewDir = normalize(viewerPosition - position);
    var normal = normalize(vNormal);                //归一化normal，或法线贴图的值
     
    let light_atten_coff = lightIntensity / length(lightPosition - position);               //光衰减，这里阳光是平方，todo，需要考虑gamma校正
    var diffColor = vec3f(0);
    let limit_inner = cos(angle.x);                                                 //spot内角度的点积域
    let limit_outer = cos(angle.y);                                                 //spot外角度的点积域
    let dotFromDirection = dot(lightDir, normalize(-lightDirection));               //当前点的点积域的值，-是因为光的方向是反的，
    //let limitRange = limit_inner - limit_outer + 0.0000000001;                  //+ 0.00000001,保证inner-outer!=0.0
    //let inLight = saturate((dotFromDirection - limit_outer) / limitRange);
    let inLight = smoothstep(limit_outer, limit_inner, dotFromDirection);       //平滑step
    let halfVector = normalize(lightDir + viewDir);
    let diff = max(dot(lightDir, normal), 0.0);
    diffColor = inLight * diff * light_atten_coff * lightColor * roughness;
    let reflectDir = reflect(-lightDir, normal);
        //spec = inLight * pow (max(dot(viewDir, reflectDir), 0.0), shininess);
    let specular = dot(normal, halfVector);
    var spec = inLight * select(    0.0,                                        //value if condition false
                                    pow(specular, shininess),          //value if condition is true
                                    specular > 0.0);                            //condition
    var specularColor = light_atten_coff * metallic * spec * lightColor * inSpecularColor;

    if(diff ==0.0)
    {
        colos_DS[0]=vec3f(0.0);
        colos_DS[1]=vec3f(0.0);
        return colos_DS;
    }
    colos_DS[0]=diffColor;
    colos_DS[1]=specularColor;
    return colos_DS;
}

// 计算Phong模型的光照和阴影,unuse
fn calcLightAndShadowOfPhong(
    worldPosition: vec3f,
    normal: vec3f,
    albedo: vec3f,
    metallic: f32,
    roughness: f32,
    ao: f32,
    color: vec4f,
    emissiveRGB: vec3f,
    emissiveIntensity: f32 ,    
    ) -> vec4f {
    let inSpecularColor = albedo;
    let shininess = ao;

    let colorOfAmbient = PhongAmbientColor();
    var colorOfPhoneOfLights : array<vec3f, 2>;             //漫反射，高光反射
    colorOfPhoneOfLights[0]= vec3f(0.0);                    //漫反射：所有光源在pixel上的总和
    colorOfPhoneOfLights[1]= vec3f(0.0);                    //高光反射：所有光源在pixel上的总和
    //以lightRealNumberOfSystem计算
    var depthColor : vec3f;
    var depthVisibility = 0.0;
    var posFromLight : vec4f;
    var depth_sub_z : f32;
    if(U_lights.lightNumber >0)
    {
        for (var i : u32 = 0; i < U_lights.lightNumber; i = i + 1)
        {
            let onelight = U_lights.lights[i ];             //当前光源的struct 
            var visibility = getVisibilityOflight(onelight,worldPosition,normal);  //可见性：是否在阴影中，1：不在阴影中，0：在阴影中

            var onelightPhongColor : array<vec3f, 2>;       //当前光源的漫反射，高光反射
            var computeShadow = false;                      //是否计算阴影
            var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
            var inPointShadow = false;                      //是否为点光源的阴影
            if (onelight.kind ==0)
            {
                onelightPhongColor = phongColorOfDirectionalLight(worldPosition, normal, onelight.direction, onelight.color, onelight.intensity, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
            }
            else if (onelight.kind ==1)
            {
                onelightPhongColor = phongColorOfPointLight(worldPosition, normal, onelight.position, onelight.color, onelight.intensity, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
            }
            else if (onelight.kind ==2)
            {
                onelightPhongColor = phongColorOfSpotLight(worldPosition, normal, onelight.position, onelight.direction, onelight.color, onelight.intensity, onelight.angle, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
            }
 
            colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] +visibility * onelightPhongColor[0];
            colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] +visibility * onelightPhongColor[1];
        }
        colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] /f32(U_lights.lightNumber);
        colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] /f32(U_lights.lightNumber);
    }
    return vec4f((colorOfAmbient + colorOfPhoneOfLights[0]) * color.rgb + colorOfPhoneOfLights[1], color.a);
}

// phongFunction.wgsl   ,end
