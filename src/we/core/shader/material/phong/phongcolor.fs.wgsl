
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
    $encodeLightAndShadow
    albedo=inSpecularColor;
    ao=shininess;
    RMAO=vec3f(roughness,metallic,ao);
    
    //手工参数测试
    // materialColor=calcLightAndShadowOfPhong(
    //     worldPosition,
    //     normal,
    //     inSpecularColor,
    //     metallic,
    //     roughness,
    //     shininess,
    //     materialColor,
    //     vec3f(0.0, 0.0, 0.0),
    //     1.0
    // );

    $mainColorCode
    var output: ST_GBuffer;
    $fsOutput

    // 手工参数测试
    // let lightIntensity = 1.0;
    // let lightDir = vec3f(0.0, 1.0, 0.0);
    // let lightColor = vec3f(1.0, 1., 0.0);
    // let onelight = U_lights.lights[0 ]; 
    // let colorOfPhongDS = phongColorDS(fsInput.worldPosition, fsInput.normal, lightDir, lightColor, lightIntensity, defaultCameraPosition,uv);
    // let colorOfAmbient = PhongAmbientColor();
    // output.color =  vec4f((colorOfAmbient + colorOfPhongDS[0]) * materialColor.rgb + colorOfPhongDS[1], materialColor.a);
    // output.color = vec4f( visibility,visibility,visibility   , 1.0);

    //测试shadow map
    // let depth=textureLoad(U_shadowMap_depth_texture, vec2i(i32(fsInput.position.x*2),i32(fsInput.position.y*2)),0,0) ;
    // output.color = vec4f( depth,depth,depth,1);
    
    //测试可见性，
    //  var visibility = getVisibilityOflight(U_lights.lights[1],worldPosition.rgb,normal.rgb); 
    //  output.color  =vec4f(visibility,visibility,visibility,1);

    return output;
}
