import { E_BOLBufferType } from '../bufferBlock/base';
import { I_pointerCreateParams, I_pointerStruct, T_pointerDataType } from '../bufferBlock/pointer';
import { createVerticesBuffer, getTypedArrayType } from './baseFunction';
import type { I_VertexBufferEntry } from './BaseDrawCommand';
import { isI_vsAttributeMerge, isVSGPUBufferBundle } from './drawCommandGeneratorTypes';
import type { I_indexGPUBufferBundle, IV_DC } from './drawCommandGeneratorTypes';
import type { DrawCommandGenerator as DCG } from './DrawCommandGenerator';

/**
 * 第 3 期巨型文件拆分（C8）：initVertexPart。
 * 636 行逐字搬移、不重构；代码行 this. 改为 scope.；注释文本保持原样。
 * scope 用 import type 引入主类（编译后擦除，无运行时环），保留 scope.getWgslValueFormat()
 * / scope.formatLocationStringOfAttribute() 虚调用与 scope.pointers / scope.device 读写。
 */
export function initVertexPart(
    scope: DCG,
    values: IV_DC,
): {
    DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[];
    DC_indexBuffer: (I_pointerStruct | I_VertexBufferEntry) | undefined;
    DC_vertexNames: string[];
    DC_localtions: string[];
    DC_verticesBufferLayout: GPUVertexBufferLayout[];
} {
    //1、buffer资源
    // 20260114修改为 I_VertexBufferEntry
    const DC_vertexBuffers: (I_pointerStruct | I_VertexBufferEntry)[] = []; //当前DC的顶点列表。之后在DC中passEncoder.setVertexBuffer(parseInt(i), verticesBuffer)使用。
    /** GPUVertexBufferLayout格式样本：
          {
            "arrayStride": 12,
            "attributes": [
                {
                    "shaderLocation": 0,
                    "format": "float32x3",
                    "offset": 0
                }
            ],
            "stepMode": "vertex"
           }
         */
    const DC_verticesBufferLayout: GPUVertexBufferLayout[] = []; //vertex.buffers[]
    const DC_localtions: string[] = []; //顶点资源的名称列表，反射code中的内容使用，在WGSL中结构体：VertexShaderOutput中使用；exp：" @location(0) position : vec3f  ,"
    const DC_vertexNames: string[] = []; //顶点资源的名称列表，反射code中的内容使用；exp："position"
    let DC_indexBuffer: (I_pointerStruct | I_VertexBufferEntry) | undefined; //GPUBuffer默认使用uint32的格式。passEncoder.setIndexBuffer(scope.indexBuffer, 'uint32');
    //1.1、顶点资源
    let shaderLocation = 0; //最多16个
    let location_i = 0;
    if (values.data.vertices) {
        // for (const [key, value] of values.data.vertices) {
        for (const key in values.data.vertices) {
            const value = values.data.vertices[key];
            let locationString: string = '';
            const lowKey = key.toLocaleLowerCase();
            let _GPUVertexBufferLayout: GPUVertexBufferLayout; //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
            // let vertexBuffer: GPUBufferBinding;
            let pointerOfVertex: I_pointerStruct;
            //20260114 增加interface I_VertexBufferEntry
            let vertexBufferEntry: I_pointerStruct | I_VertexBufferEntry;
            //动态顶点属性
            if (values.dynamic?.vs) {
                //标准的数组格式，默认为position等
                if (Array.isArray(value)) {
                    if (value.length == 0) {
                        console.warn('顶点属性' + key + '数据为空');
                    }
                    const data = new Float32Array(value); //默认:float32
                    let arrayStride = 4 * 3;
                    let format: GPUVertexFormat = 'float32x3';
                    switch (lowKey) {
                        case 'position':
                            arrayStride = 4 * 3;
                            format = 'float32x3';
                            break;
                        case 'uv':
                            // case "uv1":
                            // case "uv2":
                            arrayStride = 4 * 2;
                            format = 'float32x2';
                            break;
                        case 'normal':
                            arrayStride = 4 * 3;
                            format = 'float32x3';
                            break;
                        case 'color':
                            arrayStride = 4 * 3;
                            format = 'float32x3';
                            break;
                        case 'joints':
                            arrayStride = 4 * 4;
                            format = 'float32x4';
                            break;
                        case 'weights':
                            arrayStride = 4 * 4;
                            format = 'float32x4';
                            break;
                        default:
                            arrayStride = 4 * 3;
                            format = 'float32x3';
                            break;
                    }
                    const wgsl_value_format = scope.getWgslValueFormat(format);
                    locationString += scope.formatLocationStringOfAttribute(
                        values,
                        location_i,
                        lowKey,
                        wgsl_value_format,
                    );

                    //动态顶点：使用GPUBuffer
                    const vertexBuffer: GPUBuffer = createVerticesBuffer(
                        scope.device,
                        `${values.IDS?.ID}->${lowKey}`,
                        data.buffer,
                    );
                    if (values.system?.parent)
                        values.system.parent.vertexPointers[lowKey] = {
                            gpuBuffer: vertexBuffer,
                        };
                    vertexBufferEntry = {
                        name: lowKey,
                        buffer: vertexBuffer,
                    };
                    //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                    _GPUVertexBufferLayout = {
                        arrayStride: arrayStride,
                        attributes: [
                            {
                                shaderLocation: shaderLocation++,
                                format: format,
                                offset: 0,
                            },
                        ],
                    };
                } else throw new Error("动态顶点属性:'" + key + "'数据必须为数组形式");
            }
            //标准的数组格式，默认为position等
            else if (Array.isArray(value)) {
                if (value.length == 0) {
                    console.warn('顶点属性' + key + '数据为空');
                }
                // let data = new Float32Array(value);//默认:float32
                let arrayStride = 4 * 3;
                let format: GPUVertexFormat = 'float32x3';
                switch (lowKey) {
                    case 'position':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'uv':
                        // case "uv1":
                        // case "uv2":
                        arrayStride = 4 * 2;
                        format = 'float32x2';
                        break;
                    case 'normal':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'color':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'joints':
                        arrayStride = 4 * 4;
                        format = 'float32x4';
                        break;
                    case 'weights':
                        arrayStride = 4 * 4;
                        format = 'float32x4';
                        break;
                    default:
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                }
                const wgsl_value_format = scope.getWgslValueFormat(format);
                locationString += scope.formatLocationStringOfAttribute(
                    values,
                    location_i,
                    lowKey,
                    wgsl_value_format,
                );

                const sysParent = values.system?.parent;
                const vp = sysParent?.vertexPointers[lowKey];
                if (sysParent && vp) {
                    pointerOfVertex = vp.pointer!;
                } else {
                    const pointerParams: I_pointerCreateParams = {
                        name: lowKey + ' ' + values.label,
                        byteSize: value.length * 4,
                        type: E_BOLBufferType.VS,
                        viewType: 'f32',
                        data: {
                            sourceData: { data: value },
                        },
                    };
                    pointerOfVertex = scope.pointers.createPointer(
                        pointerParams,
                        values.system?.parent,
                    );
                    // parent保存顶点指针，用于后续更新顶点数据
                    if (values.system?.parent)
                        values.system.parent.vertexPointers[lowKey] = {
                            pointer: pointerOfVertex,
                        };
                }
                vertexBufferEntry = pointerOfVertex;
                // vertexBufferEntry = {
                //     name: lowKey,
                //     buffer: pointerOfVertex.gpuBufferView.buffer,
                //     offset: pointerOfVertex.gpuBufferView.offset,
                //     byteSize: pointerOfVertex.gpuBufferView.size,
                // }
                //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [
                        {
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        },
                    ],
                };
            } else if (ArrayBuffer.isView(value)) {
                // let md5OfVertexOfArray = MD5.hex(value.buffer as ArrayBuffer);
                let pointerOfVertex: I_pointerStruct;
                let arrayStride = 4 * 3;
                let format: GPUVertexFormat = 'float32x3';
                // if (!this.resources.hasVertex(md5OfVertexOfArray)) {
                const arrayBuffertype = getTypedArrayType(value);
                let viewType: T_pointerDataType;
                switch (arrayBuffertype) {
                    case 'Float32Array':
                        viewType = 'f32';
                        break;
                    case 'Uint32Array':
                        viewType = 'u32';
                        break;
                    case 'Uint8Array':
                        viewType = 'u8';
                        break;
                    case 'Uint16Array':
                        viewType = 'u16';
                        break;
                    case 'Int32Array':
                        viewType = 'i32';
                        break;
                    case 'Int8Array':
                        viewType = 'i8';
                        break;
                    case 'Int16Array':
                        viewType = 'i16';
                        break;
                    default:
                        viewType = 'f32';
                        break;
                }
                const _arrayBufferType: T_pointerDataType = 'f32';
                const arrarBufferUnitLength = 4;
                switch (lowKey) {
                    case 'position':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'uv':
                        // case "uv1":
                        // case "uv2":
                        arrayStride = 4 * 2;
                        format = 'float32x2';
                        break;
                    case 'normal':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'color':
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        break;
                    case 'joints':
                        arrayStride = 4 * 4;
                        format = 'uint32x4';
                        break;
                    case 'weights':
                        arrayStride = 4 * 4;
                        format = 'float32x4';
                        break;
                    default:
                        arrayStride = 4 * 3;
                        format = 'float32x3';
                        console.warn(
                            '顶点属性' +
                                lowKey +
                                '的类型' +
                                arrayBuffertype +
                                '未被支持.按照float32x3处理',
                        );
                        break;
                }
                const sysParent = values.system?.parent;
                const vp = sysParent?.vertexPointers[lowKey];
                if (sysParent && vp) {
                    pointerOfVertex = vp.pointer!;
                } else {
                    const pointerParams: I_pointerCreateParams = {
                        name: lowKey + ' ' + values.label,
                        byteSize: value.length * arrarBufferUnitLength,
                        type: E_BOLBufferType.VS,
                        viewType: viewType,
                        data: {
                            sourceData: { data: value },
                        },
                    };
                    pointerOfVertex = scope.pointers.createPointer(pointerParams);
                    if (values.system?.parent)
                        values.system.parent.vertexPointers[lowKey] = {
                            pointer: pointerOfVertex,
                        };
                }
                vertexBufferEntry = pointerOfVertex;
                // vertexBufferEntry = {
                //     name: lowKey,
                //     buffer: pointerOfVertex.gpuBufferView.buffer,
                //     offset: pointerOfVertex.gpuBufferView.offset,
                //     byteSize: pointerOfVertex.gpuBufferView.size,
                // }
                //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [
                        {
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        },
                    ],
                };
            }
            //I_vsAttribute格式。有更多详细的数据说明，来约定顶点数据，例如format,arrayStride,offset等
            else if ('format' in value && 'data' in value) {
                const format: GPUVertexFormat = value.format;
                let _data; //默认:float32
                const datakind: number = 4; //默认:float32|uint32|sint32
                let arrayStride = 4 * 3;
                switch (
                    value.format //这里只匹配了几种数据，以后视情况而定
                ) {
                    case 'float32x3':
                        arrayStride = 4 * 3;
                        // data = new Float32Array(value.data);
                        break;
                    case 'float32x2':
                        arrayStride = 4 * 2;
                        // data = new Float32Array(value.data);
                        break;
                    case 'float32x4':
                        arrayStride = 4 * 4;
                        // data = new Float32Array(value.data);
                        break;
                    case 'float32':
                        arrayStride = 4 * 1;
                        // data = new Float32Array(value.data);
                        break;
                    case 'uint32':
                        arrayStride = 4 * 1;
                        // data = new Uint32Array(value.data);
                        break;
                    case 'uint32x2':
                        arrayStride = 4 * 2;
                        // data = new Uint32Array(value.data);
                        break;
                    case 'uint32x3':
                        arrayStride = 4 * 3;
                        // data = new Uint32Array(value.data);
                        break;
                    case 'uint32x4':
                        arrayStride = 4 * 4;
                        // data = new Uint32Array(value.data);
                        break;
                    case 'sint32':
                        arrayStride = 4 * 1;
                        // data = new Int32Array(value.data);
                        break;
                    case 'sint32x2':
                        arrayStride = 4 * 2;
                        // data = new Int32Array(value.data);
                        break;
                    case 'sint32x3':
                        arrayStride = 4 * 3;
                        // data = new Int32Array(value.data);
                        break;
                    case 'sint32x4':
                        arrayStride = 4 * 4;
                        // data = new Int32Array(value.data);
                        break;
                    default:
                        arrayStride = 4 * 3;
                        // data = new Float32Array(value.data);
                        break;
                }
                const wgsl_value_format = scope.getWgslValueFormat(value.format);
                locationString += scope.formatLocationStringOfAttribute(
                    values,
                    location_i,
                    lowKey,
                    wgsl_value_format,
                );

                const sysParent = values.system?.parent;
                const vp = sysParent?.vertexPointers[lowKey];
                if (sysParent && vp) {
                    pointerOfVertex = vp.pointer!;
                } else {
                    const pointerParams: I_pointerCreateParams = {
                        name: lowKey + ' ' + values.label,
                        byteSize: value.data.length * datakind,
                        type: E_BOLBufferType.VS,
                        viewType: 'f32',
                        data: {
                            sourceData: { data: value.data },
                        },
                    };
                    pointerOfVertex = scope.pointers.createPointer(pointerParams);
                    if (values.system?.parent)
                        values.system.parent.vertexPointers[lowKey] = {
                            pointer: pointerOfVertex,
                        };
                }
                vertexBufferEntry = pointerOfVertex;
                // vertexBufferEntry = {
                //     name: lowKey,
                //     buffer: pointerOfVertex.gpuBufferView.buffer,
                //     offset: pointerOfVertex.gpuBufferView.offset,
                //     byteSize: pointerOfVertex.gpuBufferView.size,
                // }
                //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [
                        {
                            shaderLocation: shaderLocation++,
                            format: format,
                            offset: 0,
                        },
                    ],
                };
            }
            //I_vsAttributeMerge合并属性，例如position和normal合并到一个顶点属性中
            else if (isI_vsAttributeMerge(value)) {
                const mergeAttribute = value.mergeAttribute;
                const arrayStride = value.arrayStride;
                // let data = new Float32Array(value.data);
                const attributes: GPUVertexAttribute[] = [];
                const stepMode = values.data.vertexStepMode?.[location_i] || undefined; //存储合并属性的stepMode，多个使用相同的stepMode
                for (const i in mergeAttribute) {
                    const item = mergeAttribute[i];
                    attributes.push({
                        shaderLocation: shaderLocation++,
                        format: item.format,
                        offset: item.offset,
                    });
                    const wgsl_value_format = scope.getWgslValueFormat(item.format);
                    locationString += ` @location(${location_i}) ${item.name.toLowerCase()} : ${wgsl_value_format}  ,`;
                    location_i++; //合并属性，每个属性都要增加一个location
                }
                const sysParent = values.system?.parent;
                const vp = sysParent?.vertexPointers[lowKey];
                if (sysParent && vp) {
                    pointerOfVertex = vp.pointer!;
                } else {
                    const pointerParams: I_pointerCreateParams = {
                        name: lowKey + ' ' + values.label,
                        byteSize: value.data.length * 4,
                        type: E_BOLBufferType.VS,
                        viewType: 'f32',
                        data: {
                            sourceData: { data: value.data },
                        },
                    };
                    pointerOfVertex = scope.pointers.createPointer(pointerParams);
                    if (values.system?.parent)
                        values.system.parent.vertexPointers[lowKey] = {
                            pointer: pointerOfVertex,
                        };
                    //合并属性没有办法绑定name，不支持动态更新vertex GPUBuffer
                }
                vertexBufferEntry = pointerOfVertex;
                // vertexBufferEntry = {
                //     name: lowKey,
                //     buffer: pointerOfVertex.gpuBufferView.buffer,
                //     offset: pointerOfVertex.gpuBufferView.offset,
                //     byteSize: pointerOfVertex.gpuBufferView.size,
                // }
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes,
                };
                //合并属性要增加一个location
                if (stepMode) {
                    _GPUVertexBufferLayout.stepMode = stepMode;
                }
            }
            //顶点数据是GPUBuffer数据的
            // else if ("format" in value && value.buffer instanceof GPUBuffer) {
            else if (isVSGPUBufferBundle(value)) {
                if (values.system?.parent)
                    values.system.parent.vertexPointers[lowKey] = { gpuBuffer: value };

                const format = value.format;
                const arrayStride = value.arrayStride;
                const wgsl_value_format = scope.getWgslValueFormat(format);
                locationString += scope.formatLocationStringOfAttribute(
                    values,
                    location_i,
                    lowKey,
                    wgsl_value_format,
                );

                // vertexBuffer = value.buffer;
                //GPUBuffer属性暂时不支持动态更新vertex GPUBuffer。（可以支持，但需要重新绑定GPUBuffer，GPUBuffer内部还有stride组合的比较复杂，不考虑）
                vertexBufferEntry = {
                    name: lowKey,
                    buffer: value.buffer, //GPUBuffer
                    offset: value.offset, //当前vertex 数据在GPUBuffer的offset，默认从0开始读取
                    byteSize: value.byteSize, //当前vertex 数据在GPUBuffer的size，默认是全部
                };
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [
                        {
                            shaderLocation: shaderLocation++,
                            format: format,
                            //todo：20260115，还差个stride中的offset
                            offset: value.offsetInStride || 0, //默认从0开始读取，指的是arraystride中的offset
                        },
                    ],
                };
            } else {
                console.warn('顶点属性', key, value, ' 不能匹配数据');
                throw new Error('顶点属性 key, value 不能匹配数据');
                continue;
            }
            if (values.data.vertexStepMode && !isI_vsAttributeMerge(value)) {
                //如果有stepMode，且不是合并属性，则一一对应
                _GPUVertexBufferLayout.stepMode = values.data.vertexStepMode[location_i];
            }

            DC_verticesBufferLayout.push(_GPUVertexBufferLayout); //顺序push顶点Buffer的layout
            DC_localtions.push(locationString); //顺序push顶点名称
            DC_vertexNames.push(key); //顺序push顶点名称

            if (vertexBufferEntry) {
                DC_vertexBuffers.push(vertexBufferEntry); //顺序push顶点Buffer
            } else {
                console.warn('顶点属性', key, value, ' 不能匹配数据');
                throw new Error('顶点属性 key, value 不能匹配数据');
            }
            location_i++;
        }
        //1.2、索引资源
        if (values.data.indices) {
            //索引资源为动态模式，且数据为数组类型
            if (values.dynamic?.vs) {
                if (Array.isArray(values.data.indices)) {
                    const data = new Uint32Array(values.data.indices); //默认:u32
                    const index = createVerticesBuffer(
                        scope.device,
                        `${values.IDS?.ID}->indices`,
                        data,
                    );
                    if (index) {
                        DC_indexBuffer = {
                            name: 'indices ' + values.label,
                            buffer: index,
                        };
                    }
                } else {
                    throw new Error('动态模式：索引资源数据必须是数组类型');
                }
            }
            //索引资源为数组
            else if (Array.isArray(values.data.indices)) {
                const wireFrame = values.label.toLowerCase().includes('wireframe')
                    ? 'Wireframe'
                    : 'Mesh';
                let index: I_pointerStruct;
                // let md5OfIndicesOfArray = MD5.hex(values.data.indices);
                if (values.data.indices && values.data.indices.length > 0) {
                    const sysParent = values.system?.parent;
                    const vp = sysParent?.vertexPointers['index' + wireFrame];
                    if (sysParent && vp) {
                        index = vp.pointer!;
                    } else {
                        // if (!this.resources.hasIndices(md5OfIndicesOfArray)) {
                        const pointerParams: I_pointerCreateParams = {
                            name: 'indices ' + values.label,
                            byteSize: values.data.indices.length * 4,
                            type: E_BOLBufferType.VS,
                            viewType: 'u32',
                            data: {
                                sourceData: { data: values.data.indices },
                            },
                        };
                        index = scope.pointers.createPointer(pointerParams);
                        // parent保存索引指针，用于后续更新索引数据
                        if (values.system?.parent)
                            values.system.parent.vertexPointers['index' + wireFrame] = {
                                pointer: index,
                            };
                    }
                    if (index) {
                        DC_indexBuffer = index;
                        // DC_indexBuffer = {
                        //     name: index.name,
                        //     buffer: index.gpuBufferView.buffer,
                        //     offset: index.gpuBufferView.offset,
                        //     byteSize: index.gpuBufferView.size,
                        // }
                    }
                }
            }
            //索引资源为GPUBufferBundle
            else {
                const indexBundle = values.data.indices as I_indexGPUBufferBundle;
                if (indexBundle) {
                    DC_indexBuffer = {
                        name: indexBundle.name,
                        buffer: indexBundle.buffer,
                        // offset:,
                        // offset: indexBundle.buffer.size,
                    };
                    if (values.system?.parent)
                        values.system.parent.vertexPointers.index = { gpuBuffer: indexBundle };
                }
            }
        }
    }

    return {
        DC_vertexBuffers,
        DC_indexBuffer,
        DC_vertexNames,
        DC_localtions,
        DC_verticesBufferLayout,
    };
}
