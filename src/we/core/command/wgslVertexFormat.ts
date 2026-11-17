/**
 * 第 3 期巨型文件拆分（C8）：WGSL 顶点格式映射表与 @location 字符串。
 * 两个纯函数无 this 依赖，逐字搬移；主类保留同名委托壳供 C0 快照断言与外部调用。
 */
/**
 * WGSL 顶点格式静态映射表（35 项）。
 * 原为 35 项纯 switch 逐条映射，改为模块级查表：O(1) 返回，新增格式只改此处。
 * 未知格式由 getWgslValueFormat 兜底抛错（保留原 default 分支行为）。
 */
const WGSL_FORMAT_TABLE: Record<string, string> = {
    // f32
    float32: 'f32',
    float32x2: 'vec2f',
    float32x3: 'vec3f',
    float32x4: 'vec4f',
    // u32
    uint32: 'u32',
    uint32x2: 'vec2u',
    uint32x3: 'vec3u',
    uint32x4: 'vec4u',
    // u16
    uint16: 'u16',
    uint16x2: 'vec2u',
    uint16x4: 'vec4u',
    // u8
    uint8: 'u32',
    uint8x2: 'vec2u',
    uint8x4: 'vec4u',
    // i32
    sint32: 'i32',
    sint32x2: 'vec2i',
    sint32x3: 'vec3i',
    sint32x4: 'vec4i',
    // i16
    sint16: 'i16',
    sint16x2: 'vec2i',
    sint16x4: 'vec4i',
    // i8
    sint8: 'i32',
    sint8x2: 'vec2i',
    sint8x4: 'vec4i',
    // unorm16
    unorm16: 'f32',
    unorm16x2: 'vec2f',
    unorm16x4: 'vec4f',
    // snorm16
    snorm16: 'f32',
    snorm16x2: 'vec2f',
    snorm16x4: 'vec4f',
    // unorm10-10-10-2
    'unorm10-10-10-2': 'vec4f',
    // unorm8x4-bgra
    'unorm8x4-bgra': 'vec4f',
    // f16
    float16: 'f16',
    float16x2: 'vec2f',
    float16x4: 'vec4f',
};

export function getWgslValueFormat(format: string) {
    if (!Object.prototype.hasOwnProperty.call(WGSL_FORMAT_TABLE, format)) {
        throw new Error('顶点属性格式不能匹配数据');
    }
    return WGSL_FORMAT_TABLE[format];
}

export function formatLocationStringOfAttribute(
    location: number,
    name: string,
    format: string,
): string {
    return `@location(${location}) ${name} : ${format} ,`;
}
