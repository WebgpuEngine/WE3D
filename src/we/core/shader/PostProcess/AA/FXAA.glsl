#version 330 core
// 输入：当前帧颜色纹理（需在渲染时绑定到纹理单元 0）
uniform sampler2D u_colorTexture;
// 输入：从顶点着色器传递的纹理坐标
in vec2 TexCoord;
// 输出：最终抗锯齿颜色
out vec4 fragColor;

// -------------------------- FXAA 3.1 核心参数（根据分辨率调整） --------------------------
const vec2 u_texelStep = vec2(1.0 / 1920.0, 1.0 / 1080.0); // 1080p 分辨率，其他分辨率需修改（如 4K：1/3840, 1/2160）
const float u_lumaThreshold = 0.125;    // 亮度对比度阈值（3.1 标准值）
const float u_mulReduce = 1.0 / 8.0;    // 采样方向缩减系数（3.1 标准值）
const float u_minReduce = 1.0 / 128.0;  // 最小缩减系数（3.1 标准值）
const float u_maxSpan = 8.0;            // 最大采样跨度（1080p 推荐 8.0，4K 可设为 12.0）
const bool u_showEdges = false;        // 调试用：是否显示检测到的边缘（红色）

void main() {
    // -------------------------- 步骤 2：采样 5 点颜色并转换为亮度 --------------------------
    // 采样当前像素（M）、左上（NW）、右上（NE）、左下（SW）、右下（SE）
    vec3 rgbM = texture(u_colorTexture, TexCoord).rgb;
    vec3 rgbNW = textureOffset(u_colorTexture, TexCoord, ivec2(-1, 1)).rgb;
    vec3 rgbNE = textureOffset(u_colorTexture, TexCoord, ivec2(1, 1)).rgb;
    vec3 rgbSW = textureOffset(u_colorTexture, TexCoord, ivec2(-1, -1)).rgb;
    vec3 rgbSE = textureOffset(u_colorTexture, TexCoord, ivec2(1, -1)).rgb;

    // 转换为亮度（Rec.601 标准，3.1 强制要求）
    const vec3 toLuma = vec3(0.299, 0.587, 0.114);
    float lumaM = dot(rgbM, toLuma);
    float lumaNW = dot(rgbNW, toLuma);
    float lumaNE = dot(rgbNE, toLuma);
    float lumaSW = dot(rgbSW, toLuma);
    float lumaSE = dot(rgbSE, toLuma);

    // -------------------------- 步骤 3：边缘判定 --------------------------
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
    
    // 亮度差异小，非边缘：直接返回原颜色
    if (lumaMax - lumaMin <= lumaMax * u_lumaThreshold) {
        fragColor = vec4(rgbM, 1.0);
        return;
    }

    // -------------------------- 步骤 4：计算边缘方向向量 --------------------------
    float dirX = (lumaNW + lumaNE) - (lumaSW + lumaSE); // 水平方向亮度梯度
    float dirY = (lumaNW + lumaSW) - (lumaNE + lumaSE); // 垂直方向亮度梯度
    vec2 samplingDirection = vec2(dirX, dirY);          // 边缘延伸方向（垂直于亮度梯度）

    // -------------------------- 步骤 5：调整采样步长（限制范围） --------------------------
    // 计算缩减系数，避免方向向量过强
    float samplingDirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * u_mulReduce, u_minReduce);
    // 归一化方向向量（避免某一方向过强）
    float minSamplingFactor = 1.0 / (min(abs(samplingDirection.x), abs(samplingDirection.y)) + samplingDirReduce);
    // 限制采样范围（不超过最大跨度，适配纹理分辨率）
    samplingDirection = clamp(
        samplingDirection * minSamplingFactor, 
        vec2(-u_maxSpan, -u_maxSpan), 
        vec2(u_maxSpan, u_maxSpan)
    ) * u_texelStep;

    // -------------------------- 步骤 6：分级采样与颜色混合 --------------------------
    // 内部采样（1/3 和 2/3 位置）：基础抗锯齿颜色
    vec3 rgbSample1 = texture(u_colorTexture, TexCoord + samplingDirection * (1.0/3.0 - 0.5)).rgb;
    vec3 rgbSample2 = texture(u_colorTexture, TexCoord + samplingDirection * (2.0/3.0 - 0.5)).rgb;
    vec3 rgbTwoTab = (rgbSample1 + rgbSample2) * 0.5;

    // 外部采样（0 和 1 位置）：优化边缘过渡
    vec3 rgbSample3 = texture(u_colorTexture, TexCoord + samplingDirection * (0.0/3.0 - 0.5)).rgb;
    vec3 rgbSample4 = texture(u_colorTexture, TexCoord + samplingDirection * (3.0/3.0 - 0.5)).rgb;
    vec3 rgbFourTab = (rgbSample3 + rgbSample4) * 0.25 + rgbTwoTab * 0.5;

    // 亮度校验：避免混合颜色超出边缘亮度范围
    float lumaFourTab = dot(rgbFourTab, toLuma);
    vec3 finalColor = (lumaFourTab < lumaMin || lumaFourTab > lumaMax) ? rgbTwoTab : rgbFourTab;

    // -------------------------- 调试模式：显示边缘 --------------------------
    if (u_showEdges) {
        finalColor.r = 1.0; // 边缘显示为红色
    }

    // 输出最终颜色
    fragColor = vec4(finalColor, 1.0);
}