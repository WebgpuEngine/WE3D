
////////////////////////////////////////////////////////////////////////////
//sRGB
//线性空间 → sRGB 转换函数
//线性空间到sRGB的转换（包含gamma校正）
fn linearToSRGB(linearColor : vec3f) -> vec3f  {
    //分段gamma校正，更精确的sRGB转换
    //let isLow = linearColor <= vec3f(0.0031308);
    let low: vec3f = linearColor * 12.92;
    let high: vec3f = 1.055 * pow(linearColor, vec3f(1.0 / 2.4)) - 0.055;
    
    return select(high, low, linearColor <= vec3f(0.0031308));
}

//单通道转换函数（用于 XYZ → sRGB）
fn x_linearToSRGB(x : f32) -> f32 {
    if (x <= 0.0031308)
    {
        return 12.92 * x;
    } else {
        return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
    }
}
//多通道转换函数：XYZ 到 sRGB 转换函数（用于 XYZ → sRGB）
fn xyz_linearToSRGB(linear : vec3f) -> vec3f {
    return vec3f(
    x_linearToSRGB(linear.x),
    x_linearToSRGB(linear.y),
    x_linearToSRGB(linear.z)
    );
}

//// 示例XYZ->sRGB：片段着色器中使用
//@fragment
//fn fs(linearColor: vec3<f32>) -> @location(0) vec4<f32> {
//// 线性空间颜色（如光照计算结果）转换为 sRGB
//let srgbColor = linearToSRGB(linearColor);
//return vec4<f32>(srgbColor, 1.0);
//}

////////////////////////////////////////////////////////////////////////////
//diaplay P3
//线性空间 → XYZ 转换矩阵（线性 sRGB → XYZ）
const linearToXYZ : mat3x3f = mat3x3f(
0.4124564, 0.3575761, 0.1804375,
0.2126729, 0.7151522, 0.0721750,
0.0193339, 0.1191920, 0.9503041
);

//XYZ → display-p3 转换矩阵
const xyzToDisplayP3 : mat3x3f = mat3x3f(
2.4934969, -0.9313836, -0.4027108,
-0.8294889, 1.7626640, 0.0236247,
0.0358458, -0.0761724, 1.0206675
);

//线性空间 → display-p3 转换函数
fn linearToDisplayP3(linear : vec3f) -> vec3f {
    //步骤 1：线性 → XYZ
    let xyz = linearToXYZ * linear;

    //步骤 2：XYZ → display-p3 线性空间
    let p3Linear = xyzToDisplayP3 * xyz;

    //步骤 3：对 display-p3 应用 gamma 压缩（同 sRGB 公式）
    let low = p3Linear * 12.92;
    let high = 1.055 * pow(p3Linear, vec3f(1.0 / 2.4)) - 0.055;
    return select(high, low, p3Linear <= vec3f(0.0031308));
}

//// 示例linear->display-p3：片段着色器中使用
//@fragment
//fn fs(linearColor: vec3<f32>) -> @location(0) vec4<f32> {
//// 线性空间颜色转换为 display-p3
//let p3Color = linearToDisplayP3(linearColor);
//return vec4<f32>(p3Color, 1.0);
//}



////////////////////////////////////////////////////////////////////////////
// sRGB 解码
//sRGB 到线性空间的 gamma 变换函数
fn srgbToLinear(srgb : vec3 < f32>) -> vec3 < f32> {
    //对 RGB 三个通道分别处理
    //低亮度区域：线性转换
    let low = srgb / 12.92;
    //高亮度区域：gamma 扩展
    let high = pow((srgb + 0.055) / 1.055, vec3f(2.4));
    //根据 sRGB 值选择对应的转换结果
    return select(high, low, srgb <= vec3f(0.04045));
}

//示例：采样 sRGB 纹理并转换为线性空间
//@group(0) @binding(0) var srgbTexture: texture_2d<f32>; // 格式为 srgba8unorm
//@group(0) @binding(1) var texSampler: sampler;
//@fragment
//fn fragmentShader(uv: vec2<f32>) -> @location(0) vec4<f32> {
//// 采样 sRGB 纹理（获取 [0, 1] 范围的 sRGB 值）
//let srgbColor = textureSample(srgbTexture, texSampler, uv).rgb;

//// 转换为线性空间（用于后续光照计算）
//let linearColor = srgbToLinear(srgbColor);

//// 后续光照、阴影等计算（必须在线性空间进行）
//// ...
//return vec4<f32>(linearColor, 1.0);
//}
