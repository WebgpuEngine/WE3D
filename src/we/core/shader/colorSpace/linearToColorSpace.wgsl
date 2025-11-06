////////////////////////////////////////////////////////////////////////////
//ACES色调映射函数（简化版）
fn acesToneMap(linearHDR : vec3f) -> vec3f  {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((linearHDR * (a * linearHDR + b)) / (linearHDR * (c * linearHDR + d) + e), vec3f(0.0), vec3f(1.0));
}
// 带纯白补偿的ACES色调映射
fn acesToneMapWithWhite(linearHDR: vec3f) -> vec3f {
    let a: f32 = 2.51;
    let b: f32 = 0.03;
    let c: f32 = 2.43;
    let d: f32 = 0.59;
    let e: f32 = 0.14;
    
    // 标准ACES映射
    let mapped = (linearHDR * (a * linearHDR + b)) / (linearHDR * (c * linearHDR + d) + e);
    
    // 计算纯白补偿系数：让输入1.0映射到1.0
    const whiteInput: f32 = 1.0;
    const targetWhite: f32 = 1.0;
    let whiteMapped: f32 = (whiteInput * (a * whiteInput + b)) / (whiteInput * (c * whiteInput + d) + e);
    let whiteScale: f32 = targetWhite / whiteMapped; // 约为1.245
    
    // 应用补偿并裁剪
    return clamp(mapped * whiteScale, vec3f(0.0), vec3f(1.0));
}
//////////////////////////////////////////////////////////////////////////
//diaplay P3，目前一步法与两步法的P3颜色都不对，而且白平衡验证不通过。需要深入研究。

//线性空间到display P3的转换（包含gamma校正）
fn linearToDisplayP3(linearColor : vec3f) -> vec3f  {
    //线性空间到display P3线性的转换矩阵
    // let linearToP3Matrix = mat3x3f(
    //     1.0478112, 0.0228866, -0.0501270,
    //     0.0295424, 0.9904844, -0.0170491,
    //     -0.0092345, 0.0150436, 0.7521316
    // );
    // let linearToP3Matrix: mat3x3f = mat3x3f(
    //     1.0478112,  0.0295424, -0.0092345,  // 第一列：Display P3红色分量的转换系数
    //     0.0228866,  0.9904844,  0.0150436,  // 第二列：Display P3绿色分量的转换系数
    //     -0.0501270, -0.0170491,  0.7521316   // 第三列：Display P3蓝色分量的转换系数
    // );
    //这个矩阵偏淡粉色
    let linearToP3Matrix = mat3x3f(
        0.9442, -0.0504, -0.0176,
        -0.0180, 0.8534, -0.0362,
        0.0015, -0.0371, 1.0833
    );
    //转换到display P3线性空间
    let p3Linear = linearToP3Matrix * linearColor;

    let low: vec3f = p3Linear * 12.92;         // 暗部分段：线性映射
    let high: vec3f = 1.055 * pow(p3Linear, vec3f(1.0 / 2.4)) - 0.055; // 亮部分段：gamma映射
    // mix支持“布尔分量向量”作为权重：true取high，false取low（分量级生效）
    return select(high, low, p3Linear <= vec3f(0.0031308));//分段gamma编码
    // return pow(p3Linear, vec3f(1.0 / 2.2));//简化的gamma编码

}

//线性空间 → display-p3 转换函数
//1、使用pow函数进行gamma校正时，颜色错误
//2、目前偏亮、部分颜色偏绿
fn processColorToP3_twoStep(hdrLinearColor : vec3f) -> vec3f {
      //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMap(hdrLinearColor);
    // let ldrLinear = hdrLinearColor;

    //线性空间 → XYZ 转换矩阵（线性 sRGB → XYZ）
    const linearToXYZ : mat3x3f = mat3x3f(
    0.5151, 0.2412, 0.0250,  // P3红→XYZ
    0.2919, 0.6922, 0.1288,  // P3绿→XYZ
    0.1571, 0.0666, 0.8490   // P3蓝→XYZ
    );

    //XYZ → display-p3 转换矩阵
    const xyzToDisplayP3 : mat3x3f = mat3x3f(
    3.240970, -0.969244, 0.055630,   // X→sRGB红
    -1.537383, 1.875968, -0.203977,  // Y→sRGB绿
    -0.498611, 0.041555, 1.056972    // Z→sRGB蓝
    );
    //步骤 1：线性 → XYZ
    let xyz = linearToXYZ * ldrLinear;

    //步骤 2：XYZ → display-p3 线性空间
    let p3Linear = xyzToDisplayP3 * xyz;
    // let p3Linear=ldrLinear;

    //步骤 3：对 display-p3 应用 gamma 压缩（同 sRGB 公式）
    let low = p3Linear * 12.92;
    let high = 1.055 * pow(p3Linear, vec3f(1.0 / 2.4)) - 0.055;
    return select(high, low, p3Linear <= vec3f(0.0031308));
    // return pow(p3Linear, vec3f(1.0 / 2.2));
    
}
//线性空间 → aces → display-p3 转换函数
//1、目前偏亮、部分颜色偏粉，这个就是问题了，纯白的输出也是偏粉的。（目前看是矩阵问题，不用矩阵，进行gamma编码，就没有这个问题）
fn acesToP3(hdrLinearColor : vec3f) -> vec3f  {
    //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMap(hdrLinearColor);
    // let ldrLinear = hdrLinearColor;

    //2. 选择目标色域（二选一）
    let displayColor = linearToDisplayP3(ldrLinear);//转换到display P3
    //let displayColor = linearToSRGB(ldrLinear);     // 转换到sRGB

    return displayColor;
}

////////////////////////////////////////////////////////////////////////////
//sRGB
//sRGBgamma两段式编码
//线性空间 → sRGB 转换函数
fn linearToSRGB(linearColor : vec3f) -> vec3f  {
    //分段gamma校正，更精确的sRGB转换
    //let isLow = linearColor <= vec3f(0.0031308);
    let low: vec3f = linearColor * 12.92;
    let high: vec3f = 1.055 * pow(linearColor, vec3f(1.0 / 2.4)) - 0.055;
    
    return select(high, low, linearColor <= vec3f(0.0031308));
}
//线性空间 → ACES → sRGB 转换函数
//1、进行ACES色调映射，后颜色偏亮
//2、目前是不适用ACES色调映射，直接使用sRGB的gamma编码，颜色正确（考虑，目前没有HDR，使用ACES后颜色偏亮）
//3、ACES色调映射后，颜色偏亮（考虑是ACES色调映射的风格问题，电影风格），而非映射问题。比如：纯白色经ACES转换后变为(0.8,0.8,0.8)左右，这是正常现象
fn ACESToSRGB(hdrLinearColor : vec3f) -> vec3f  {
    //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMap(hdrLinearColor);
    // let ldrLinear = acesToneMapWithWhite(hdrLinearColor);
    
    // let ldrLinear = hdrLinearColor;//不使用ACES色调映射，直接使用线性空间颜色

    //2. 选择目标色域（二选一）
    let displayColor = linearToSRGB(ldrLinear);    //转换到sRGB
    return displayColor;
}
//进行了白色补偿，白色会被映射到1.0，不是0.8
fn ACESToSRGB_white(hdrLinearColor : vec3f) -> vec3f  {
    //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMapWithWhite(hdrLinearColor);
    // let ldrLinear = acesToneMapWithWhite(hdrLinearColor);
    
    // let ldrLinear = hdrLinearColor;//不使用ACES色调映射，直接使用线性空间颜色

    //2. 选择目标色域（二选一）
    let displayColor = linearToSRGB(ldrLinear);    //转换到sRGB
    return displayColor;
}

//linear  HDR output
fn linearToHDR(hdrLinearColor : vec3f) -> vec3f  {
    return hdrLinearColor;
}

//////////////////////////////////////////////////////////////////////////
// 验证矩阵正确性：检查白色转换是否准确（线性sRGB白色应转换为Display P3白色）
fn testWhitePoint() -> vec3f {
    // 第一步：线性Display P3 → XYZ（基于CIE标准，列主序矩阵）
    let p3ToXyzMatrix: mat3x3f = mat3x3f(
        0.5151, 0.2412, 0.0250,  // P3红→XYZ
        0.2919, 0.6922, 0.1288,  // P3绿→XYZ
        0.1571, 0.0666, 0.8490   // P3蓝→XYZ
    );

    // 第二步：XYZ → 线性sRGB（基于CIE标准，列主序矩阵）
    let xyzToSrgbMatrix: mat3x3f = mat3x3f(
        3.240970, -0.969244, 0.055630,   // X→sRGB红
        -1.537383, 1.875968, -0.203977,  // Y→sRGB绿
        -0.498611, 0.041555, 1.056972    // Z→sRGB蓝
    );

    let oneStepMatrix: mat3x3f = mat3x3f(
        0.9442, -0.0504, -0.0176,
        -0.0180, 0.8534, -0.0362,
        0.0015, -0.0371, 1.0833        
    );


    let p3White: vec3f = vec3f(1.0, 1.0, 1.0); // 线性P3白色
    // let xyzWhite: vec3f = p3ToXyzMatrix * p3White;
    // let srgbWhite: vec3f = xyzToSrgbMatrix * xyzWhite;
    // let srgbWhite: vec3f = oneStepMatrix * p3White;
    let srgbWhite: vec3f = pow(p3White, vec3f(1.0 / 2.2));

    if( all(abs(srgbWhite - vec3f(1.0)) < vec3f(0.02))){
        return vec3f(0.0, 1.0, 0.0);//正确输出纯绿色，这比较显眼
    }
    else {
        // return p3White;
        return srgbWhite;
        // return vec3f(1.0, 0.0, 0.0);
    }
}
//纯白色经ACES转换后变为(0.8,0.8,0.8)左右”是正常现象
fn testACES() -> vec3f {
    let white: vec3f = vec3f(1.0, 1.0, 1.0); // 线性P3白色
    let acesColor=     acesToneMap(white);


    if( all(abs(acesColor - vec3f(1.0)) < vec3f(0.02))){
        return vec3f(0.0, 1.0, 0.0);//正确输出纯绿色，这比较显眼
    }
    else {
        // return p3White;
        return acesColor;
        // return vec3f(1.0, 0.0, 0.0);
    }
}
