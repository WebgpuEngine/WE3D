import type { IV_DC } from './drawCommandGeneratorTypes';

/**
 * 第 3 期巨型文件拆分（C8）：WGSL 顶点格式映射表与 @location 字符串。
 * 两个纯函数无 this 依赖，逐字搬移；主类保留同名委托壳供 C0 快照断言与外部调用。
 */
export function getWgslValueFormat(format: string) {
        let wgsl_value_format = '';
        switch (format) {
            /////////////////////////////////////////f32
            case 'float32':
                wgsl_value_format = 'f32';
                break;
            case 'float32x2':
                wgsl_value_format = 'vec2f';
                break;
            case 'float32x3':
                wgsl_value_format = 'vec3f';
                break;
            case 'float32x4':
                wgsl_value_format = 'vec4f';
                break;
            /////////////////////////////////////////u32
            case 'uint32':
                wgsl_value_format = 'u32';
                break;
            case 'uint32x2':
                wgsl_value_format = 'vec2u';
                break;
            case 'uint32x3':
                wgsl_value_format = 'vec3u';
                break;
            case 'uint32x4':
                wgsl_value_format = 'vec4u';
                break;
            /////////////////////////////////////////u16
            case 'uint16':
                wgsl_value_format = 'u16';
                break;
            case 'uint16x2':
                wgsl_value_format = 'vec2u';
                break;
            case 'uint16x4':
                wgsl_value_format = 'vec4u';
                break;
            /////////////////////////////////////////i8
            case 'uint8':
                wgsl_value_format = 'u32';
                break;
            case 'uint8x2':
                wgsl_value_format = 'vec2u';
                break;
            case 'uint8x4':
                wgsl_value_format = 'vec4u';
                break;
            /////////////////////////////////////////i32
            case 'sint32':
                wgsl_value_format = 'i32';
                break;
            case 'sint32x2':
                wgsl_value_format = 'vec2i';
                break;
            case 'sint32x3':
                wgsl_value_format = 'vec3i';
                break;
            case 'sint32x4':
                wgsl_value_format = 'vec4i';
                break;
            /////////////////////////////////////////i16
            case 'sint16':
                wgsl_value_format = 'i16';
                break;
            case 'sint16x2':
                wgsl_value_format = 'vec2i';
                break;
            case 'sint16x4':
                wgsl_value_format = 'vec4i';
                break;
            /////////////////////////////////////////i8
            case 'sint8':
                wgsl_value_format = 'i32';
                break;
            case 'sint8x2':
                wgsl_value_format = 'vec2i';
                break;
            case 'sint8x4':
                wgsl_value_format = 'vec4i';
                break;
            /////////////////////////////////////////unorm16
            case 'unorm16':
                wgsl_value_format = 'f32';
                break;
            case 'unorm16x2':
                wgsl_value_format = 'vec2f';
                break;
            case 'unorm16x4':
                wgsl_value_format = 'vec4f';
                break;
            /////////////////////////////////////////snorm16
            case 'snorm16':
                wgsl_value_format = 'f32';
                break;
            case 'snorm16x2':
                wgsl_value_format = 'vec2f';
                break;
            case 'snorm16x4':
                wgsl_value_format = 'vec4f';
                break;
            /////////////////////////////////////////unorm10-10-10-2
            case 'unorm10-10-10-2':
                wgsl_value_format = 'vec4f';
                break;
            /////////////////////////////////////////unorm8x4-bgra
            case 'unorm8x4-bgra':
                wgsl_value_format = 'vec4f';
                break;
            /////////////////////////////////////////f16
            case 'float16':
                wgsl_value_format = 'f16';
                break;
            case 'float16x2':
                wgsl_value_format = 'vec2f';
                break;
            case 'float16x4':
                wgsl_value_format = 'vec4f';
                break;

            default:
                throw new Error('顶点属性格式不能匹配数据');
                break;
        }

        return wgsl_value_format;
    }

export function formatLocationStringOfAttribute(
        values: IV_DC,
        location: number,
        name: string,
        format: string,
    ): string {
        //@location(4) @interpolate(flat) entityID : u32,
        // if (values.system?.parent && values.system?.parent.locationInterpolate) {
        //     if (values.system?.parent.locationInterpolate.all) {
        //         return `@location(${location}) @interpolate(${values.system?.parent.locationInterpolate.all.type},${values.system?.parent.locationInterpolate.all.sampling}) ${name} : ${format} ,`;
        //     }
        //     else {
        //         for (let key in values.system?.parent.locationInterpolate) {
        //             if (key == name) {
        //                 return `@location(${location}) @interpolate(${values.system?.parent.locationInterpolate[key].type},${values.system?.parent.locationInterpolate[key].sampling}) ${name} : ${format} ,`;
        //             }
        //         }
        //     }
        // }
        return `@location(${location}) ${name} : ${format} ,`;
    }
