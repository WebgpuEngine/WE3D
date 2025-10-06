
// @group(1) @binding(1) var<uniform> u_Shininess : f32;
// @group(1) @binding(2) var<uniform> u_metalness : f32;
// @group(1) @binding(3) var<uniform> u_roughness : f32;
struct st_bulin_phong {
  shininess: f32,
  metalness: f32,
  roughness: f32,
  parallaxScale: f32,
}

@fragment fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    initSystemOfFS();   
    var uv = fsInput.uv;
    var normal=fsInput.normal;
    // $deferRender_Depth                                  //为空或进行深度判断（discar）
    var materialColor =vec4f(1);
    $materialColor             //颜色或纹理颜色
    $normal                             //来自VS，还是来自texture

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
            var onelightPhongColor : array<vec3f, 2>;       //当前光源的漫反射，高光反射
            let onelight = U_lights.lights[i ];             //当前光源的struct 
            // var visibility = 0.0;                           //可见性：是否在阴影中，1：不在阴影中，0：在阴影中
            var computeShadow = false;                      //是否计算阴影
            // var shadow_map_index = onelight.shadow_map_array_lenght;         //当前光源的阴影贴图索引
            var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
            var inPointShadow = false;                      //是否为点光源的阴影
            if (onelight.kind ==0)
            {
                onelightPhongColor = phongColorOfDirectionalLight(fsInput.worldPosition, normal, onelight.direction, onelight.color, onelight.intensity, defaultCameraPosition, uv);
            }
            else if (onelight.kind ==1)
            {
                onelightPhongColor = phongColorOfPointLight(fsInput.worldPosition, normal, onelight.position, onelight.color, onelight.intensity, defaultCameraPosition, uv);
            }
            else if (onelight.kind ==2)
            {
                onelightPhongColor = phongColorOfSpotLight(fsInput.worldPosition, normal, onelight.position, onelight.direction, onelight.color, onelight.intensity, onelight.angle, defaultCameraPosition, uv);
            }
 
            var visibility = getVisibilityOflight(onelight,fsInput.worldPosition,normal); 
            colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] +visibility * onelightPhongColor[0];
            colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] +visibility * onelightPhongColor[1];
        }
        colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] /f32(U_lights.lightNumber);
        colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] /f32(U_lights.lightNumber);
    }
    var output: ST_GBuffer;
    $fsOutput
    output.color = vec4f((colorOfAmbient + colorOfPhoneOfLights[0]) * materialColor.rgb + colorOfPhoneOfLights[1], materialColor.a);

//     let lightIntensity = 1.0;
//     let lightDir = vec3f(0.0, 1.0, 0.0);
//     let lightColor = vec3f(1.0, 1., 0.0);
//     let onelight = U_lights.lights[0 ]; 
//     let colorOfPhongDS = phongColorDS(fsInput.worldPosition, fsInput.normal, lightDir, lightColor, lightIntensity, defaultCameraPosition,uv);
//     let colorOfAmbient = PhongAmbientColor();
//     output.color =  vec4f((colorOfAmbient + colorOfPhongDS[0]) * materialColor.rgb + colorOfPhongDS[1], materialColor.a);
    // output.color = vec4f( visibility,visibility,visibility   , 1.0);

    // let depth=textureLoad(U_shadowMap_depth_texture, vec2i(i32(fsInput.position.x*2),i32(fsInput.position.y*2)),0,0) ;
    // output.color = vec4f( depth,depth,depth,1);

    return output;
}
fn phongColorDS(position : vec3f, vNormal : vec3f, lightDir : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f,uv:vec2f) -> vec3f
{
    // let lightDir = normalize(lightPosition - position);
    let normal = normalize(vNormal);
    let light_atten_coff = lightIntensity ;
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * u_bulinphong.roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    let halfDir = normalize(lightDir + viewDir);
    spec = pow (max(dot(normal, halfDir), 0.0), u_bulinphong.shininess);
    //spec = pow (max(dot(viewDir, reflectDir), 0.0), u_Shininess);
    let specularColor : vec3f = light_atten_coff *u_bulinphong.metalness * spec * lightColor;
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
fn phongColorOfDirectionalLight(position : vec3f, vNormal : vec3f, lightDir : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f, uv : vec2f) ->array<vec3f, 2>
{
    var colos_DS : array<vec3f, 2>;
    let normal = normalize(vNormal);
    let light_atten_coff = lightIntensity ;
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * u_bulinphong.roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    let halfDir = normalize(lightDir + viewDir);
    spec = pow (max(dot(viewDir, halfDir), 0.0), u_bulinphong.shininess);
    //spec = pow (max(dot(viewDir, reflectDir), 0.0), u_Shininess);
    var  specularColor : vec3f = light_atten_coff *u_bulinphong.metalness * spec * lightColor;
    $specular   ;        //占位符,如果有高光图，specularColor再次从高光图中采样
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
fn phongColorOfPointLight(position : vec3f, vNormal : vec3f, lightPosition : vec3f, lightColor : vec3f, lightIntensity : f32, viewerPosition : vec3f, uv : vec2f) -> array<vec3f, 2>
{
    var colos_DS : array<vec3f, 2>;
    let lightDir = normalize(lightPosition - position);
    var normal = normalize(vNormal);            //归一化normal，或法线贴图的值
 
    let light_atten_coff = lightIntensity / length(lightPosition - position);   //光衰减，这里阳光是平方，todo，需要考虑gamma校正
    let diff = max(dot(lightDir, normal), 0.0);
    let diffColor = diff * light_atten_coff * lightColor * u_bulinphong.roughness;
    var spec = 0.0;
    let viewDir = normalize(viewerPosition - position);
    let reflectDir = reflect(-lightDir, normal);
    spec = pow (max(dot(viewDir, reflectDir), 0.0), u_bulinphong.shininess);
    var specularColor = light_atten_coff * u_bulinphong.metalness * spec * lightColor;
    $specular   ;        //占位符,如果有高光图，specularColor再次从高光图中采样
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
fn phongColorOfSpotLight(position : vec3f, vNormal : vec3f, lightPosition : vec3f, lightDirection : vec3f, lightColor : vec3f, lightIntensity : f32, angle : vec2f, viewerPosition : vec3f, uv : vec2f) ->array<vec3f, 2>
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
    diffColor = inLight * diff * light_atten_coff * lightColor * u_bulinphong.roughness;
    let reflectDir = reflect(-lightDir, normal);
        //spec = inLight * pow (max(dot(viewDir, reflectDir), 0.0), u_bulinphong.shininess);
    let specular = dot(normal, halfVector);
    var spec = inLight * select(    0.0,                                        //value if condition false
                                    pow(specular, u_bulinphong.shininess),          //value if condition is true
                                    specular > 0.0);                            //condition
    var specularColor = light_atten_coff * u_bulinphong.metalness * spec * lightColor;
    $specular   ;        //占位符,如果有高光图，specularColor再次从高光图中采样

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
