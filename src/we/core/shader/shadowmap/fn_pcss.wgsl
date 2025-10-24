//shadow map 相关函数
const  NUM_SAMPLES: i32=100;
const  NUM_RINGS: i32 = 10;
const FILTER_RADIUS =10.0;

//生成泊松分布的样本点
fn poissonDiskSamples(randomSeed: vec2f) -> array<vec2f,NUM_SAMPLES> {
    let ANGLE_STEP = PI * 2.0 * f32(NUM_RINGS) / f32(NUM_SAMPLES);
    let  INV_NUM_SAMPLES = 1.0 / f32(NUM_SAMPLES);
    var poissonDisk = array<vec2f, NUM_SAMPLES>();
    var angle = rand_2to1(randomSeed) * PI * 2.0;
    var radius = INV_NUM_SAMPLES;
    var radiusStep = radius;
    for (var i = 0; i < NUM_SAMPLES; i ++) {
        poissonDisk[i] = vec2(cos(angle), sin(angle)) * pow(radius, 0.75);
        radius += radiusStep;
        angle += ANGLE_STEP;
    }
    return poissonDisk;
}
//生成均匀分布的样本点
fn uniformDiskSamples(randomSeed: vec2f) -> array<vec2f,NUM_SAMPLES> {
    var randNum = rand_2to1(randomSeed);
    var sampleX = rand_1to1(randNum) ;
    var sampleY = rand_1to1(sampleX) ;
    var angle = sampleX * PI * 2.0;
    var radius = sqrt(sampleY);
    var poissonDisk = array<vec2f, NUM_SAMPLES>();
    for (var i = 0; i < NUM_SAMPLES; i ++) {
        poissonDisk[i] = vec2(radius * cos(angle), radius * sin(angle));
        sampleX = rand_1to1(sampleY) ;
        sampleY = rand_1to1(sampleX) ;
        angle = sampleX * PI * 2.;
        radius = sqrt(sampleY);
    }
    return poissonDisk;
}
//查找阴影遮挡块
fn findBlocker(uv: vec2f, zReceiver: f32, depth_texture: texture_depth_2d_array, array_index: i32) -> f32 {
    let disk = poissonDiskSamples(uv);
    var blockerNum = 0;
    var blockDepth = 0.;
    let  NEAR_PLANE = 0.01;
    let  LIGHT_WORLD_SIZE = 5.;
    let  FRUSTUM_SIZE = 400.;
    let  LIGHT_SIZE_UV = LIGHT_WORLD_SIZE / FRUSTUM_SIZE;
    let searchRadius = LIGHT_SIZE_UV * (zReceiver - NEAR_PLANE) / zReceiver;    //约等于1/80
    let searchRadius2 = 50.0 / shadowDepthTextureSize;                            //约等于1/40
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
        let offset = disk[i] * searchRadius;
        let depth = textureLoad(depth_texture, vec2i(floor((uv + offset) * shadowDepthTextureSize)), array_index, 0);//uv转成vec2i,因为使用textureLoad，uv必须是vec2i
        if(U_MVP.reversedZ == 1){
            if zReceiver < depth+0.001  {
                blockerNum += 1;
                blockDepth += depth;
            }
        }
        else{
            if zReceiver > depth+0.001  {
                blockerNum += 1;
                blockDepth += depth;
            }
        }
    }
    if blockerNum == 0 {
        return -1.;
    } else {
        return blockDepth / f32(blockerNum);
    }
}
//计算阴影Bias
fn getShadowBias(c: f32, filterRadiusUV: f32, normal: vec3f, lightDirection: vec3f) -> f32 {    //自适应Shadow Bias算法 https://zhuanlan.zhihu.com/p/370951892
    let  FRUSTUM_SIZE = 100.;//在系数=400.0是，产生 petter shadow问题，所以这里改为100.0
    let fragSize = (1. + ceil(filterRadiusUV)) * (FRUSTUM_SIZE / shadowDepthTextureSize / 2.);
    return max(fragSize, fragSize * (1.0 - dot(normal, lightDirection))) * c;
}
//计算阴影可见度
fn shadowMapVisibilityPCSS(onelight: ST_Light, shadow_map_index:i32,position: vec3f, normal: vec3f, biasC: f32) -> f32 {
    var posFromLight =matrix_z* U_shadowMapMatrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){       //posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let zReceiver = posFromLight.z;
    let avgBlockerDepth = findBlocker(vec2f(shadowPos.x, shadowPos.y), zReceiver, U_shadowMap_depth_texture, shadow_map_index);
    let EPS = 1e-6;    
    //半影
    let  LIGHT_SIZE_UV = 05. / 400.;
    var  penumbra: f32;//= (zReceiver - avgBlockerDepth) * LIGHT_SIZE_UV / avgBlockerDepth;
    let  pcfBiasC = .08;    // 有PCF时的Shadow Bias
    let oneOverShadowDepthTextureSize = FILTER_RADIUS / shadowDepthTextureSize;
    var bias = getShadowBias(biasC, oneOverShadowDepthTextureSize, normal, onelight.direction);
    // let disk = uniformDiskSamples(vec2f(shadowPos.x, shadowPos.y));//todo，改成从findBlocker中获取的结构体
    let disk = poissonDiskSamples(vec2f(shadowPos.x, shadowPos.y));//todo，改成从findBlocker中获取的结构体
    var visibility = 0.0;
    if avgBlockerDepth < -EPS {
        penumbra = oneOverShadowDepthTextureSize;
    } else {
        penumbra = (zReceiver - avgBlockerDepth) * LIGHT_SIZE_UV / avgBlockerDepth;
    }
    if(U_MVP.reversedZ == 1){
        bias = -bias;
    }
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
         var offset = disk[i] * oneOverShadowDepthTextureSize;
        if(any((shadowPos.xy + offset )< vec2(0.0)) || any ((shadowPos.xy + offset )> vec2(1.0))){
             offset = vec2(0.0);
        }
       //  let offset = disk[i] * oneOverShadowDepthTextureSize;
        visibility += textureSampleCompare(
            U_shadowMap_depth_texture,                  //t: texture_depth_2d_array
            shadowSampler,                              //s: sampler_comparison,
            shadowPos.xy + offset,                      //coords: vec2<f32>,
            shadow_map_index,            //array_index: A,
            shadowPos.z - bias                      //depth_ref: f32,//这个产生的petter shadoww问题比较大，
            // shadowPos.z -0.005                      //depth_ref: f32,//ok
        );
    }
    visibility /= f32(NUM_SAMPLES);
    //无遮挡物
    if (avgBlockerDepth < -EPS ){
        if(U_MVP.reversedZ == 1){
            return 1.0;
        }
        else {
            return 1.0;
        }
    } else {
        return visibility;
    }
}
//PCF阴影可见度
fn shadowMapVisibilityPCF(onelight: ST_Light,shadow_map_index:i32, position: vec3f, normal: vec3f, biasC: f32) -> f32 {
    var bias = max(0.005 * (1.0 - dot(normal, onelight.direction)), 0.005);
    var posFromLight =matrix_z* U_shadowMapMatrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){       //posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let oneOverShadowDepthTextureSize = FILTER_RADIUS / shadowDepthTextureSize;
    let disk = poissonDiskSamples(vec2f(shadowPos.x, shadowPos.y));
    var visibility = 0.0;
    if(U_MVP.reversedZ == 1){
        bias = -bias;
    }
    for (var i = 0 ; i <= NUM_SAMPLES; i++) {
        var offset = disk[i] * oneOverShadowDepthTextureSize;
        visibility += textureSampleCompare(
            U_shadowMap_depth_texture,                  //t: texture_depth_2d_array
            shadowSampler,                              //s: sampler_comparison,
            shadowPos.xy + offset,                      //coords: vec2<f32>,
            shadow_map_index,            //array_index: A,
            shadowPos.z - bias                      //depth_ref: f32,
        );

    }
    visibility /= f32(NUM_SAMPLES);
    return visibility;
}
//3x3 PCF阴影可见度
fn shadowMapVisibilityPCF_3x3(onelight: ST_Light,shadow_map_index:i32, position: vec3f, normal: vec3f) -> f32 {
    var bias =0.007;// max(0.05 * (1.0 - dot(normal, onelight.direction)), 0.005);
    var posFromLight =matrix_z* U_shadowMapMatrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
     if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){
       //posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5), posFromLight.z);  //这里的z是深度数据,xy是UV在光源depth texture中的位置
    let oneOverShadowDepthTextureSize = 1.0 / shadowDepthTextureSize;
    var visibility = 0.0;
    if(U_MVP.reversedZ == 1){
        bias = -bias;
    }
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2f(vec2(x, y)) * oneOverShadowDepthTextureSize;
            visibility += textureSampleCompare(
                U_shadowMap_depth_texture,                  //t: texture_depth_2d_array
                shadowSampler,                              //s: sampler_comparison,在scene中是：compare: 'less'
                shadowPos.xy + offset,                      //coords: vec2<f32>,
                shadow_map_index,            //array_index: A,
                shadowPos.z - bias                      //depth_ref: f32,
            );
        }
    }
    visibility /= 9.0;
    return visibility;
}
//硬阴影可见度
fn shadowMapVisibilityHard(onelight: ST_Light,shadow_map_index:i32, position: vec3f, normal: vec3f) -> f32 {
    var posFromLight =matrix_z* U_shadowMapMatrix[shadow_map_index].MVP * vec4(position, 1.0);    //光源视界的位置
    //var posFromLight =matrix_z* U_shadowMapMatrix[onelight.shadow_map_array_index].MVP * vec4(position, 1.0);    //光源视界的位置
    if(posFromLight.w < 0.000001   && posFromLight.w > -0.000001){     // posFromLight =posFromLight/posFromLight.w;
    }
    else{
      posFromLight =posFromLight/posFromLight.w; 
    }
    //Convert XY to (0, 1)    //Y is flipped because texture coords are Y-down.
    let shadowPos = vec3(
        posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5),
        posFromLight.z
    );
    var visibility = 0.0;
    var bias = 0.007;
    if(U_MVP.reversedZ == 1){
        bias = -bias;
    }
    visibility += textureSampleCompare(
        U_shadowMap_depth_texture,                  //t: texture_depth_2d_array
        shadowSampler,                              //s: sampler_comparison,
        shadowPos.xy,                      //coords: vec2<f32>,
        shadow_map_index,// onelight.shadow_map_array_index,            //array_index: A,
        shadowPos.z - bias                         //depth_ref: f32,
    );
    return visibility;
}

//spot light 判断点是否在spot light的范围内
fn checkPixelInShadowRangOfSpotLight(position : vec3f, lightPosition : vec3f, lightDirection : vec3f, angle : vec2f) -> bool
{
    let ligh2PostDir = normalize(position - lightPosition);                     //光源到物体的点的方向
    let limit_inner = cos(angle.x);                                                 //spot内角度的点积域
    let limit_outer = cos(angle.y);                                                 //spot外角度的点积域
    let dotFromDirection = dot(ligh2PostDir, normalize(lightDirection));               //当前点的点积域的值，向量都B-A
    if(dotFromDirection >= limit_outer)
    {
        return true;
    }
    else{
        return false;
    }
}
// 检查pixel是否在点光源的阴影中（6个投影方向中的那个）   //未处理距离
fn checkPixelInShadowRangOfPointLight(pixelWorldPosition : vec3f, onelight : ST_Light,) -> i32 {
    var index = -1;
    for (var i : i32 = 0; i <6; i = i + 1)
    { 
        var posFromLight = matrix_z * U_shadowMapMatrix[onelight.shadow_map_array_index+i].MVP * vec4(pixelWorldPosition, 1.0);  //光源视界的位置
        if(posFromLight.w < 0.000001 && posFromLight.w > -0.000001)
        {           //posFromLight =posFromLight/posFromLight.w;
        }
        else{
            posFromLight = posFromLight / posFromLight.w;
        }
        //判断当前像素的world Position是否在剪切空间中
        if(posFromLight.x >= -1.0 && posFromLight.x <= 1.0 && posFromLight.y <= 1.0 && posFromLight.y >= -1.0 && posFromLight.z <= 1.0 && posFromLight.z >= 0.0)
        {
            index = i;
        }
    }
    return index;
}

//根据光源类型获取阴影可见度
fn getVisibilityOflight(onelight: ST_Light,worldPosition: vec3f, normal: vec3f) -> f32 {
            var computeShadow = false;                      //是否计算阴影
            var isPointShadow = false;                      //是否为点光源的阴影
            var shadow_map_index = onelight.shadow_map_array_index;         //当前光源的阴影贴图索引
            var visibility = 0.0; 
            if (onelight.kind ==0)
            {
                computeShadow = true;
            }
            else if (onelight.kind ==1)
            {
                computeShadow = true;
                shadow_map_index = checkPixelInShadowRangOfPointLight(worldPosition, onelight);
            }
            else if (onelight.kind ==2)
            {
                computeShadow = checkPixelInShadowRangOfSpotLight(worldPosition, onelight.position, onelight.direction, onelight.angle);
            }
            if(shadow_map_index >=0){            //如果在点光源的阴影中，计算阴影
                isPointShadow = true;
            }
            // else{            //如果不在点光源的阴影中，不计算阴影，进行一次统一工作流
            //     shadow_map_index = onelight.shadow_map_array_index;
            // }

            //统一工作流问题 start
            if (onelight.kind ==1){
                visibility = shadowMapVisibilityPCSS(onelight, shadow_map_index, worldPosition, normal, 0.08); //点光源的pcss在计算block是需要适配，目前多出来了边界的黑框，目前考虑是block的uv在边界的地方越界了，需要进行特殊处理
                //下面三个在V01版本中没有问题，应该时wordPosition相关的问题
                //是因为：near的问题，near的默认值是1，没问题，0.1就出现问题，todo
                // visibility = shadowMapVisibilityPCF(onelight, shadow_map_index, worldPosition, normal,0.08);//出现了在点光源半径3.5时，远端的实体的阴影消失问题
                // visibility = shadowMapVisibilityPCF_3x3(onelight,shadow_map_index,  worldPosition, normal);//点光源在cube中的阴影，右下前三方向消失，其他方向存在远端消失问题
                //   visibility = shadowMapVisibilityHard(onelight, shadow_map_index, worldPosition, normal);
            }
            else{
                visibility = shadowMapVisibilityPCSS(onelight, shadow_map_index, worldPosition, normal, 0.08); 
                // visibility = shadowMapVisibilityPCF_3x3(onelight,shadow_map_index,  worldPosition, normal);
                // visibility = shadowMapVisibilityPCF(onelight, shadow_map_index, worldPosition, normal,0.08);
                //  visibility = shadowMapVisibilityHard(onelight, shadow_map_index, worldPosition, normal);
           }
           if (onelight.shadow ==0 ) //没有阴影
           {
                visibility = 1.0;
           }
           else if(computeShadow ==false){//不计算阴影，visibility为0
                visibility = 0.0;
            }
            //统一工作流问题 end
           return visibility;
}
