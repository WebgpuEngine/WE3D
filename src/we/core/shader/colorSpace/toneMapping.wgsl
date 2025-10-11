//ACES 色调映射（线性 HDR → 线性 LDR）
fn acesToneMap(linearHDR : vec3 < f32>) -> vec3 < f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((linearHDR * (a * linearHDR + b)) / (linearHDR * (c * linearHDR + d) + e), 0.0, 1.0);
}

//reinhard色调映射
fn reinhardToneMap(hdrColor : vec3 < f32>, gamma : f32) -> vec3 < f32> {
  //const gamma = 2.2;
  //Reinhard色调映射
  var mapped = hdrColor / (hdrColor + vec3(1.0));
  //Gamma校正,注销掉的原因时，之后还需要进行colorspace的转换，会进行gamma校正
  //mapped = pow(mapped, vec3(1.0 / gamma));
  return mapped;
}
//exposure曝光色调映射
fn exposureToneMap(hdrColor : vec3 < f32>, exposure : f32) -> vec3 < f32> {
  //const gamma = 2.2;
  //曝光色调映射
  var mapped = vec3f(1.0) - exp(-hdrColor * exposure);
  return mapped;
}

// HDR-to-HDR 色调映射：将源HDR亮度压缩到设备支持的HDR范围
// 输入：
// - hdrColor：线性空间的源HDR颜色（可能包含超过设备上限的亮度）
// - sourceMaxNits：源数据的最大亮度（如10000.0 nits）
// - deviceMaxNits：当前设备支持的最大亮度（如1000.0 nits）
// 输出：压缩后仍在HDR范围内的颜色（亮度 ≤ deviceMaxNits）

fn hdrToHdrToneMap(hdrColor : vec3f, sourceMaxNits : f32, deviceMaxNits : f32) -> vec3f {
    // 1. 计算相对亮度（将亮度归一化到源最大亮度）
    // 亮度转换系数（Rec.709标准）
    let luminanceWeights = vec3f(0.2126, 0.7152, 0.0722);
    let luminance = dot(hdrColor, luminanceWeights); // 线性亮度值
    let normalizedLuminance = luminance / sourceMaxNits; // 归一化到0~1（源范围）

    // 2. 计算压缩因子：源超出设备的部分需要被压缩的比例
    let compressionRatio = deviceMaxNits / sourceMaxNits;
    var compressedLuminance : f32;

    // 3. 对超范围的亮度进行非线性压缩（保留细节）
    if (normalizedLuminance <= compressionRatio) {
        // 设备能直接显示的范围：线性映射（保留原始比例）
        compressedLuminance = normalizedLuminance / compressionRatio;
    } else {
        // 超范围部分：使用类似Reinhard的曲线压缩，避免硬截断
        // 公式：x / (x + k)，k为压缩系数（控制曲线陡峭度）
        let x = normalizedLuminance - compressionRatio;
        let k = 0.1 * compressionRatio; // 可调整以控制高光压缩强度
        compressedLuminance = compressionRatio + (x / (x + k));
    }

    // 4. 计算亮度缩放比例，将压缩后的亮度应用到原始颜色
    let scale = compressedLuminance * deviceMaxNits / max(luminance, 1e-6); // 避免除以0
    let compressedColor = hdrColor * scale;

    return compressedColor;
}

// // 示例：在片段着色器中使用
// void main() {
//     // 假设：
//     // - 源HDR数据最大亮度为10000 nits
//     // - 当前设备最大亮度为1000 nits
//     float sourceMax = 10000.0;
//     float deviceMax = 1000.0;

//     // 获取线性空间的源HDR颜色（可能包含超范围值）
//     vec3 linearHDRColor = ...; // 从纹理或光照计算获取

//     // 应用HDR-to-HDR色调映射
//     vec3 compressedHDRColor = hdrToHdrToneMap(linearHDRColor, sourceMax, deviceMax);

//     // 输出到HDR设备（无需gamma校正，设备会处理）
//     gl_FragColor = vec4(compressedHDRColor, 1.0);
// }