
//////////////////////////////////////////////////////////////////////////////
//rgbafloat32中的一个f32， 为存储格式的编解码
//////////////////////////////////////////////////////////////////////////////
// 将 rgba8unorm 采样的 vec4f（每个通道 [0.0, 1.0]）编码为 f32
// 输入：从 rgba8unorm 采样的 vec4f（每个通道 [0.0, 1.0]）
// 输出：编码到 rgba8unorm 的 f32（范围[0,1]，实际上是 [0,255]）
fn encodeRGBAu8ToF32(rgba: vec4f) -> f32 {
    // 步骤1：将 [0.0, 1.0] 转换为 [0, 255] 的 8 位整数（四舍五入并 clamp 防止溢出）
    let r = clamp(u32(rgba.r * 255.0 + 0.5), 0u, 255u);
    let g = clamp(u32(rgba.g * 255.0 + 0.5), 0u, 255u);
    let b = clamp(u32(rgba.b * 255.0 + 0.5), 0u, 255u);
    let a = clamp(u32(rgba.a * 255.0 + 0.5), 0u, 255u);
    
    // 步骤2：将四个 8 位整数打包为 u32（r 占高8位，a 占低8位）
    let packedU32 = (r << 24u) | (g << 16u) | (b << 8u) | a;
    
    // 步骤3：通过 bitcast 将 u32 转换为 f32（位模式不变，仅改变类型）
    return bitcast<f32>(packedU32);
}

// 将编码后的 f32 解码回 rgba8unorm 格式的 vec4f（每个通道 [0.0, 1.0]）
// 输入：从 rgba8unorm 采样的 f32（范围[0,1]，实际上是 [0,255]）
// 输出：解码回 rgba8unorm 格式的 vec4f（每个通道 [0.0, 1.0]）
fn decodeF32ToRGBAu8(encoded: f32) -> vec4f {
    // 步骤1：通过 bitcast 将 f32 转回 u32（恢复原始位模式）
    let packedU32 = bitcast<u32>(encoded);
    
    // 步骤2：从 u32 中拆分出四个 8 位通道（通过位运算）
    let r = (packedU32 >> 24u) & 0xFFu;  // 取高8位（r通道）
    let g = (packedU32 >> 16u) & 0xFFu;  // 取次高8位（g通道）
    let b = (packedU32 >> 8u) & 0xFFu;   // 取次低8位（b通道）
    let a = packedU32 & 0xFFu;           // 取低8位（a通道）
    
    // 步骤3：将 [0, 255] 转换回 [0.0, 1.0] 的浮点数
    return vec4f(f32(r), f32(g), f32(b), f32(a)) / 255.0;
}

// 编码为 f32
// let encodedF32: f32 = encodeRGBA8ToF32(originalRGBA);
// 解码回 RGBA
// let decodedRGBA: vec4f = decodeF32ToRGBA8(encodedF32);


//////////////////////////////////////////////////////////////////////////////
//rgba16float的f16中转格式的编解码 
//////////////////////////////////////////////////////////////////////////////

// 输入：从 RGB8unorm 采样的 vec3f（r/g 范围 [0.0,1.0]）(red,green只是表述形式，可任意u8,但一定是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeU8inF32x2ToF16(red: f32,green: f32) -> f32 {
    // 步骤1：将 R/G 从 [0.0,1.0] 转换为 [0,255] 的 u8
    let r_u8 = clamp(u32(red * 255.0 + 0.5), 0u, 255u);
    let g_u8 = clamp(u32(green * 255.0 + 0.5), 0u, 255u);
    return    encodeU8x2ToF16(r_u8,g_u8);
}

// 输入：从 U32(必须是u8,一定是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeU8x2ToF16(red: u32,green: u32) -> f32 {
    // 步骤1：组合为16位整数（r 占高8位，g 占低8位）
    let combined = (red << 8u) | green;  // 范围 [0, 65535]
    // 步骤2：直接存储为 float16 的 Alpha 通道（用 f32 传递，最终以 float16 存储）
    // float16 对 [0,65535] 整数的精度足够还原 R/G（离散值）
    let alpha = f32(combined);
    return  alpha;
}

// 输入：从 rgba16float 采样的 f16（范围[0,1]，实际上是 [0,65535]）
// 输出：解码为 vec2u（每个通道 [0.0, 1.0]，对应 RGB8unorm 格式）
fn decodeF16ToU8x2(data: f32) -> vec2u {
    // 步骤1:提取浮点数，转换回16位整数（四舍五入抵消精度误差）
    let combined = clamp(u32(round(data)), 0u, 65535u);
    
    // 步骤2：拆分出 R（高8位）和 G（低8位）
    let r_u8 = (combined >> 8u) & 0xFFu;  // 提取高8位
    let g_u8 = combined & 0xFFu;          // 提取低8位
    
    // 步骤3：转换回 [0.0,1.0] 范围（匹配 RGB8unorm 原始格式）
    return vec2u(r_u8, g_u8);
}
// 输入：从 U32(必须是u8,一定是0~255)
// 输出：转换为 [0.0,1.0] 范围的 f32
fn  U8ToF32(u8: u32) -> f32 {
    return f32(u8) / 255.0;
}
// 输入：从 [0.0,1.0] 范围的 f32
// 输出：转换为 U32(范围0~255)
fn F32ToU8(f32Value: f32) -> u32 {
    return clamp(u32(f32Value * 255.0 + 0.5), 0u, 255u);
}

//light and shadow 参数编码: 4xU8 到 f16
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba16float 的 f16
fn encodeLightAndShadowFromU8x4ToF16(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,      
) -> f32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;
    // 3. 确保打包值在u8范围（[0,255]）
    let clamped = clamp(packedU8, 0u, 255u);
    // 4. 转换为float16可精确表示的浮点数（关键：直接用f32存储整数，避免小数误差）
    // 因为255 < 2048，float16可精确存储该范围的整数
    let result_f16 = f32(clamped);  // 注意：此处不除以255.0，直接存储整数
    
    return result_f16;
}

// light and shadow 参数解码为:f16 到 4xU8
// 输入：从 rgba16float 采样的 f16（Alpha 通道存储编码值）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadow, materialKind, acceptlight）
fn decodeLightAndShadowFromF16ToU8x4(oneF16: f32) -> vec4u {
    let packed = clamp(u32(oneF16 * 255.0 + 0.5), 0u, 255u);
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packed >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packed >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packed >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packed & 7u;            // 取第0~2位（3位，掩码0b111=7）
    
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}
//////////////////////////////////////////////////////////////////////////////
//rgba8unorm中u8中转格式的编解码
//////////////////////////////////////////////////////////////////////////////

// light and shadow 参数编码为 f32（范围[0,1]，实际上是 [0,255]）
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba8unorm 的 f32（范围[0,1]，实际上是 [0,255]）
fn encodeLightAndShadowFromU8x4ToF32(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,     
) -> f32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;

    return f32(packedU8)/255.0;
}

// light and shadow 参数从 f32 （范围[0,1]，实际上是 [0,255]）解码为 4 个 u8
// 输入：从 rgba8unorm 采样的 f32（范围[0,1]，实际上是 [0,255]）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadowKind,acceptlight, materialKind ）
fn decodeLightAndShadowFromF32ToU8x4(packed: f32) -> vec4u {
     let packedU8 = clamp(u32(packed * 255.0 + 0.5), 0u, 255u);
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packedU8 >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packedU8 >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packedU8 >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packedU8 & 7u;            // 取第0~2位（3位，掩码0b111=7）
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}

// light and shadow 参数编码为 u32（范围[0,255]）,按照位操作
// 输入：4个u8(每个u8必须是0~255)
// 输出：编码到 rgba8unorm 的 u32（范围[0,255]）
fn encodeLightAndShadowFromU8x4ToU8bit(
    acceptShadow: u32,
    shadowKind: u32, 
    acceptlight: u32,
    materialKind: u32,    
) -> u32 {  // 返回u32类型，但数值在u8范围内（0~255）
    // 1. 限制每个变量的范围，避免位溢出
    let a = clamp(acceptShadow, 0u, 1u);    // 1位：[0,1]
    let s = clamp(shadowKind, 0u, 7u);          // 3位：[0,7]
    let l = clamp(acceptlight, 0u, 1u);           // 1位：[0,1]
    let m = clamp(materialKind, 0u, 7u);    // 3位：[0,7]
    // 2. 按位打包（总8位，符合u8范围）
    let packedU8= (a << 7u) | (s << 4u) | (l << 3u) | m;
    return packedU8;
}

// light and shadow 参数从 u32 （范围是 [0,255]）解码为 4 个 u8,按照位操作
// 输入：从 rgba8unorm 采样的 u32（范围[0,255]）
// 输出：恢复的 4 个 u8 变量（acceptShadow, shadowKind,acceptlight, materialKind ）
fn decodeLightAndShadowFromU8bitToU8x4(packedU8: u32) -> vec4u {
    // 1. 提取每个变量（先掩码再移位）
    let acceptShadow = (packedU8 >> 7u) & 1u;    // 取第7位（1位）
    let shadowKind = (packedU8 >> 4u) & 7u;          // 取第4~6位（3位，掩码0b111=7）
    let acceptlight = (packedU8 >> 3u) & 1u;           // 取第3位（1位）
    let materialKind = packedU8 & 7u;            // 取第0~2位（3位，掩码0b111=7）
    return vec4u(acceptShadow, shadowKind,acceptlight, materialKind );
}

//简版encode
fn encodeLightAndShadowToF32(acceptShadow:u32,shadowKind:u32,materialKind:u32,acceptlight:u32)->f32{
    let packedU32 = (acceptShadow << 7u) | (shadowKind << 4)| (acceptlight <<3) | materialKind  ;
    return f32(packedU32)/255.0;
}