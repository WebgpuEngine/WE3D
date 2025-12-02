// 标量 f32 区间映射（基础版）
fn remap_f32(x: f32, inMin: f32, inMax: f32, outMin: f32, outMax: f32) -> f32 {
    // 避免除以 0，若原区间无范围，返回目标区间最小值
    if (inMax == inMin) {
        return outMin;
    }
    // 核心映射公式
    return (x - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
}

// 向量通用映射（适配 vec2f/vec3f/vec4f，复用标量逻辑）
fn remap_vec2(x: vec2f, inMin: vec2f, inMax: vec2f, outMin: vec2f, outMax: vec2f) -> vec2f {
    return vec2f(
        remap_f32(x.x, inMin.x, inMax.x, outMin.x, outMax.x),
        remap_f32(x.y, inMin.y, inMax.y, outMin.y, outMax.y)
    );
}

fn remap_vec3(x: vec3f, inMin: vec3f, inMax: vec3f, outMin: vec3f, outMax: vec3f) -> vec3f {
    return vec3f(
        remap_f32(x.x, inMin.x, inMax.x, outMin.x, outMax.x),
        remap_f32(x.y, inMin.y, inMax.y, outMin.y, outMax.y),
        remap_f32(x.z, inMin.z, inMax.z, outMin.z, outMax.z)
    );
}

fn remap_vec4(x: vec4f, inMin: vec4f, inMax: vec4f, outMin: vec4f, outMax: vec4f) -> vec4f {
    return vec4f(
        remap_f32(x.x, inMin.x, inMax.x, outMin.x, outMax.x),
        remap_f32(x.y, inMin.y, inMax.y, outMin.y, outMax.y),
        remap_f32(x.z, inMin.z, inMax.z, outMin.z, outMax.z),
        remap_f32(x.w, inMin.w, inMax.w, outMin.w, outMax.w)
    );
}
