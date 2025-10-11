//ACES色调映射函数（简化版）
fn acesToneMap(linearHDR : vec3f) -> vec3f  {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((linearHDR * (a * linearHDR + b)) / (linearHDR * (c * linearHDR + d) + e), vec3f(0.0), vec3f(1.0));
}

//线性空间到display P3的转换（包含gamma校正）
fn linearToDisplayP3(linearColor : vec3f) -> vec3f  {
    //线性空间到display P3线性的转换矩阵
    let linearToP3Matrix = mat3x3f(
    1.0478112, 0.0228866, -0.0501270,
    0.0295424, 0.9904844, -0.0170491,
    -0.0092345, 0.0150436, 0.7521316
    );

    //转换到display P3线性空间
    let p3Linear = linearToP3Matrix * linearColor;

    let low: vec3f = p3Linear * 12.92;         // 暗部分段：线性映射
    let high: vec3f = 1.055 * pow(p3Linear, vec3f(1.0 / 2.4)) - 0.055; // 亮部分段：gamma映射
    // mix支持“布尔分量向量”作为权重：true取high，false取low（分量级生效）
    return select(high, low, p3Linear <= vec3f(0.0031308));
}

//线性空间到sRGB的转换（包含gamma校正）
fn linearToSRGB(linearColor : vec3f) -> vec3f  {
    //分段gamma校正，更精确的sRGB转换
    //let isLow = linearColor <= vec3f(0.0031308);
    let low: vec3f = linearColor * 12.92;
    let high: vec3f = 1.055 * pow(linearColor, vec3f(1.0 / 2.4)) - 0.055;
    
    return select(high, low, linearColor <= vec3f(0.0031308));
}

//完整的处理流程示例
fn processColorToP3(hdrLinearColor : vec3f) -> vec3f  {
    //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMap(hdrLinearColor);

    //2. 选择目标色域（二选一）
    let displayColor = linearToDisplayP3(ldrLinear);//转换到display P3
    //let displayColor = linearToSRGB(ldrLinear);     // 转换到sRGB

    return displayColor;
}
fn processColorToSRGB(hdrLinearColor : vec3f) -> vec3f  {
    //1. HDR线性空间 -> LDR线性空间（ACES色调映射）
    let ldrLinear = acesToneMap(hdrLinearColor);

    //2. 选择目标色域（二选一）
    let displayColor = linearToSRGB(ldrLinear);    //转换到sRGB
    return displayColor;
}
