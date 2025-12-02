// 片元输入结构（从顶点着色器接收）
struct st_FXAA_values {
    textelStep: vec2f,//  分辨率的像素步长（uv 偏移量）. 1080p 为 vec2f(1.0 / 1920.0, 1.0 / 1080.0)
    lumaThreshold: f32,// 亮度对比度阈值（3.1 标准值，控制边缘检测灵敏度）
    mulReduce: f32,// 采样方向缩减系数（避免方向向量过强）
    minReduce: f32,// 最小缩减系数（防止采样方向过度压缩）
    maxSpan: f32, // 最大采样跨度（1080p 推荐 8.0，4K 可设为 12.0）
    showEdges:u32,// 调试开关：1=true 显示边缘（红色），0=false 正常抗锯齿
};

// 全局 uniforms：输入纹理 + FXAA 参数
@group(0) @binding(0) var<uniform> u_FXAA_values : st_FXAA_values;
@group(0) @binding(1) var u_colorTexture: texture_2d<f32>;  // 待抗锯齿的场景颜色纹理（HDR→LDR 后）
@group(0) @binding(2) var u_colorSampler: sampler;         // 纹理采样器（默认线性采样）

// FXAA 3.1 核心参数（需根据实际分辨率调整）
// const u_texelStep: vec2f = vec2f(1.0 / 1920.0, 1.0 / 1080.0); // 1080p 分辨率的像素步长（uv 偏移量）
// const u_lumaThreshold: f32 = 0.125;    // 亮度对比度阈值（3.1 标准值，控制边缘检测灵敏度）
// const u_mulReduce: f32 = 1.0 / 8.0;    // 采样方向缩减系数（避免方向向量过强）
// const u_minReduce: f32 = 1.0 / 128.0;  // 最小缩减系数（防止采样方向过度压缩）
// const u_maxSpan: f32 = 8.0;            // 最大采样跨度（1080p 推荐 8.0，4K 可设为 12.0）
// const u_showEdges: bool = false;       // 调试开关：true 显示边缘（红色），false 正常抗锯齿

// 辅助函数：采样纹理颜色（简化纹理采样调用）
fn sampleColor(uv: vec2f) -> vec3f {
    return textureSample(u_colorTexture, u_colorSampler, uv).rgb;
}
fn sampleColorOfPosition(uv: vec2i) -> vec4f {
    return textureLoad(u_colorTexture, uv,0);
}

// 辅助函数：颜色转亮度（Rec.601 标准，符合人眼视觉特性）
fn rgbToLuma(rgb: vec3f) -> f32 {
    const toLuma: vec3f = vec3f(0.299, 0.587, 0.114);
    return dot(rgb, toLuma);
}

// 片元着色器主函数
@fragment
fn fs(fsInput: st_quad_output) -> @location(0) vec4f {
    let u_texelStep: vec2f = u_FXAA_values.textelStep; 
    let u_lumaThreshold: f32 = u_FXAA_values.lumaThreshold;    
    let u_mulReduce: f32 = u_FXAA_values.mulReduce;    
    let u_minReduce: f32 = u_FXAA_values.minReduce;  
    let u_maxSpan: f32 = u_FXAA_values.maxSpan;           
    let u_showEdges: bool = u_FXAA_values.showEdges == 1;       

    let uv: vec2f = fsInput.uv.xy;
    let uvOfPos :vec2i = vec2i(floor(vec2f(fsInput.position.xy)));

    // -------------------------- 步骤 1：采样 5 个关键像素的颜色与亮度 --------------------------
    // 5点采样：当前像素(M)、左上(NW)、右上(NE)、左下(SW)、右下(SE)
    let rgbM: vec4f = sampleColorOfPosition(uvOfPos);
    let rgbNW: vec4f = sampleColorOfPosition(uvOfPos + vec2i(-1, 1));
    let rgbNE: vec4f = sampleColorOfPosition(uvOfPos + vec2i(1 ,1));
    let rgbSW: vec4f = sampleColorOfPosition(uvOfPos + vec2i(-1, -1));
    let rgbSE: vec4f = sampleColorOfPosition(uvOfPos + vec2i(1, -1));

    // 转换为亮度值
    let lumaM: f32 = rgbToLuma(rgbM.rgb);
    let lumaNW: f32 = rgbToLuma(rgbNW.rgb);
    let lumaNE: f32 = rgbToLuma(rgbNE.rgb);
    let lumaSW: f32 = rgbToLuma(rgbSW.rgb);
    let lumaSE: f32 = rgbToLuma(rgbSE.rgb);

    // -------------------------- 步骤 2：边缘判定（过滤非边缘像素） --------------------------
    // 计算 5 点亮度的最大/最小值
    let lumaMin: f32 = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    let lumaMax: f32 = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    // -------------------------- 调试模式：显示边缘（黑白） --------------------------
    // return vec4f(vec3f(lumaMax - lumaMin), 1.0);

    var noEdge=false;
    if (lumaMax - lumaMin <= lumaMax * u_lumaThreshold) {
        noEdge=true;
    }

    // -------------------------- 步骤 3：计算边缘方向向量（垂直于亮度梯度） --------------------------
    // 水平方向亮度差：(左上+右上) - (左下+右下)
    let dirX: f32 = (lumaNW + lumaNE) - (lumaSW + lumaSE);
    // 垂直方向亮度差：(左上+左下) - (右上+右下)
    let dirY: f32 = (lumaNW + lumaSW) - (lumaNE + lumaSE);
    // 边缘延伸方向（后续沿此方向采样）
    var samplingDir: vec2f = vec2f(dirX, dirY);

    // -------------------------- 步骤 4：调整采样方向（限制范围，避免过度模糊） --------------------------
    // 计算方向缩减系数（平衡灵敏度与稳定性）
    let dirReduce: f32 = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * u_mulReduce, u_minReduce);
    // 归一化方向向量（避免某一方向过强导致采样步长失控）
    let minDirFactor: f32 = 1.0 / (min(abs(samplingDir.x), abs(samplingDir.y)) + dirReduce);
    // 限制采样方向的最大跨度（适配纹理分辨率）
    samplingDir = clamp(
        samplingDir * minDirFactor,
        vec2f(-u_maxSpan, -u_maxSpan),
        vec2f(u_maxSpan, u_maxSpan)
    ) * u_texelStep;

    // -------------------------- 步骤 5：分级采样与颜色混合（生成抗锯齿结果） --------------------------
    // 内部采样（靠近当前像素的 1/3 和 2/3 位置）→ 基础混合色
    let rgbSample1: vec3f = sampleColor(uv + samplingDir * (1.0/3.0 - 0.5));
    let rgbSample2: vec3f = sampleColor(uv + samplingDir * (2.0/3.0 - 0.5));
    let rgbTwoTab: vec3f = (rgbSample1 + rgbSample2) * 0.5;

    // 外部采样（远离当前像素的 0 和 1 位置）→ 优化边缘过渡
    let rgbSample3: vec3f = sampleColor(uv + samplingDir * (0.0/3.0 - 0.5));
    let rgbSample4: vec3f = sampleColor(uv + samplingDir * (3.0/3.0 - 0.5));
    let rgbFourTab: vec3f = (rgbSample3 + rgbSample4) * 0.25 + rgbTwoTab * 0.5;

    // 亮度校验：避免混合色超出原边缘亮度范围（防止错误采样导致的色偏）
    let lumaFourTab: f32 = rgbToLuma(rgbFourTab);
    let finalColor: vec3f = select(
        rgbTwoTab,    // 条件为 true 时使用（FourTab 亮度超出范围）
        rgbFourTab,   // 条件为 false 时使用（FourTab 亮度正常）
        lumaFourTab < lumaMin || lumaFourTab > lumaMax
    );

    // -------------------------- 调试模式：显示边缘（可选） --------------------------

    // 替换最终返回值，输出亮度差异（白色=差异大，黑色=差异小）
    // return vec4f(vec3f(lumaMax - lumaMin), 1.0);
    
    // 非边缘像素直接返回原颜色
    if (noEdge) {
        // 替换最终返回值，输出当前像素的亮度（白色=亮，黑色=暗）
        // return vec4f(vec3f(lumaM), 1.0);
        return rgbM;
    }

    let outputColor: vec3f = select(finalColor, vec3f(1.0, 0.0, 0.0), u_showEdges);

    // 亮度差异小于阈值 → 非边缘，直接返回原颜色（节省性能）//uniform control flow
    // if (lumaMax - lumaMin <= lumaMax * u_lumaThreshold) {
    //     return vec4f(rgbM, 1.0);
    // }
    // 输出最终颜色（alpha 通道设为 1.0）
    return vec4f(outputColor, 1.0);
}