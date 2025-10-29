
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
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();   
    $materialColor             //颜色或纹理颜色
    $normal                             //来自VS，还是来自texture
    var inSpecularColor : vec3f = vec3f(1.0);
    $specular
    let shininess = u_bulinphong.shininess;
     metallic = u_bulinphong.metalness;
     roughness = u_bulinphong.roughness;

    let colorOfAmbient = PhongAmbientColor();
    var colorOfPhoneOfLights : array<vec3f, 2>;             //漫反射，高光反射
    colorOfPhoneOfLights[0]= vec3f(0.0);                    //漫反射：所有光源在pixel上的总和
    colorOfPhoneOfLights[1]= vec3f(0.0);                    //高光反射：所有光源在pixel上的总和

    // if(U_lights.lightNumber >0)
    // {
    //     for (var i : u32 = 0; i < U_lights.lightNumber; i = i + 1)
    //     {
    //         let onelight = U_lights.lights[i ];             //当前光源的struct 
    //         var visibility = getVisibilityOflight(onelight,fsInput.worldPosition,normal);  //可见性：是否在阴影中，1：不在阴影中，0：在阴影中

    //         var onelightPhongColor : array<vec3f, 2>;       //当前光源的漫反射，高光反射
    //         var computeShadow = false;                      //是否计算阴影
    //         var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
    //         var inPointShadow = false;                      //是否为点光源的阴影
            
    //         if (onelight.kind ==0)
    //         {
    //             onelightPhongColor = phongColorOfDirectionalLight(fsInput.worldPosition, normal, onelight.direction, onelight.color, onelight.intensity, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
    //         }
    //         else if (onelight.kind ==1)
    //         {
    //             onelightPhongColor = phongColorOfPointLight(fsInput.worldPosition, normal, onelight.position, onelight.color, onelight.intensity, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
    //         }
    //         else if (onelight.kind ==2)
    //         {
    //             onelightPhongColor = phongColorOfSpotLight(fsInput.worldPosition, normal, onelight.position, onelight.direction, onelight.color, onelight.intensity, onelight.angle, defaultCameraPosition,inSpecularColor,roughness,shininess,metallic);
    //         }
 
    //         colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] +visibility * onelightPhongColor[0];
    //         colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] +visibility * onelightPhongColor[1];
    //     }
    //     colorOfPhoneOfLights[0] = colorOfPhoneOfLights[0] /f32(U_lights.lightNumber);
    //     colorOfPhoneOfLights[1] = colorOfPhoneOfLights[1] /f32(U_lights.lightNumber);
    // }

    materialColor=calcLightAndShadowOfPhong(
        worldPosition,
        normal,
        inSpecularColor,
        metallic,
        roughness,
        shininess,
        materialColor,
        vec3f(0.0, 0.0, 0.0),
        1.0
    );
    var output: ST_GBuffer;
    $fsOutput
    // output.color = vec4f((colorOfAmbient + colorOfPhoneOfLights[0]) * materialColor.rgb + colorOfPhoneOfLights[1], materialColor.a);

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
