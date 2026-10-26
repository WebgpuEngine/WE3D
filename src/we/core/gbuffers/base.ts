import { V_weDepthFormat, V_weLinearFormat } from "../base/coreDefine"

/**GBuffer的 GPUTexture集合 
 * 每个camera最终的GBuffer存储位置
 * 其中的名称是 buffer的名称
 *  如： E_GBufferNames中的名称或者transparent 中的名称
*/
export interface I_GBuffer {
    [name: string]: GPUTexture
};
/**GBuffer的组成描述 */
export interface I_GBufferStruct {
    format: GPUTextureFormat,
    label: string,
    usage: number,
    uniformType?: string,
}
/**GBuffer的名称枚举 ,用于保障GBuffer的名称的一致性*/
export enum E_GBufferNames {
    depth = "depth",
    color = "color",
    id = "id",
    normal = "normal",
    worldPosition = "worldPosition",
    // // X = "X",
    // // Y = "Y",
    // // Z = "Z",
    RMAO = "RMAO",
    albedo = "albedo",
    emissiveIntensity = "emissiveIntensity",
    /**PBR GBuffer 
     * 1、取消了worldPosition
     * 2、将RMAO、albedo、emissive、emissiveIntensity合并为一个通道
    */
    pbr = "pbr",
}
/**GBuffer的组成描述的集合（最终的集合） */
export interface I_GBufferName {
    [name: string]: I_GBufferStruct
}

/**MSAA GBuffer*/
export var V_MsaaGBufferNames: I_GBufferName = {
    // [E_GBufferNames.depth]: {
    //     "format": "depth32float",
    //     "label": "GBuffer depth attachment:",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    [E_GBufferNames.color]: {
        "format": V_weLinearFormat,
        "label": "GBuffer color :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
}
/**
 * 预定义的forward GBuffer变量
 * 注意：这个顺序需要与shader中的“st_gbuffer.fs.wgsl”的约定顺序一致。（depth 除外）
 */
export var V_ForwardGBufferNames: I_GBufferName = {
    [E_GBufferNames.depth]: {
        "format": V_weDepthFormat,
        "label": "GBuffer depth attachment",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.color]: {
        "format": V_weLinearFormat,
        "label": "GBuffer color",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.id]: {
        "format": "r32uint",
        "label": "GBuffer id",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.normal]: {
        "format": "rgb10a2unorm",
        "label": "GBuffer normal",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    // [E_GBufferNames.normal]: {
    //     "format": "rgba16float",
    //     "label": "GBuffer normal",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.RMAO]: {
    //     "format": "rgba8unorm",
    //     "label": "GBuffer RMAO",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.worldPosition]: {
    //     "format": "rgba32float",
    //     "label": "GBuffer worldPosition",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.albedo]: {
    //     "format": "rgba8unorm",
    //     "label": "GBuffer albedo",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.emissiveIntensity]: {
    //     "format": "rgba8unorm",
    //     "label": "GBuffer albedo",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },

    [E_GBufferNames.pbr]: {
        "format": "rgba32uint",
        "label": "GBuffer pbr",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },

}

// /**
//  * 20260810：
//  *      1、这个是透明的TTP使用，目前放弃，改用A-Buffer(todo);
//  * 
//  * 预定义的transparent GBuffer变量
//  * 注意：这个顺序需要与shader中的“st_transgparentbuffer.fs.wgsl”的约定顺序一致。（depth 除外）
//  * 
//  */
// export var V_TransparentGBufferNames: I_GBufferName = {

//     /**
//      * 调试用的color
//      * 1、不用时，注释掉，	节省8个纹理
//      * 2、若开启，需要在shader多个，cameraMan啊个人，等处同步，参加20251008的开发日志
//      */
//     // "color1": {
//     //     "format": V_weLinearFormat,
//     //     "label": "color 1",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//     //     uniformType: " texture_2d<f32>",
//     // },
//     // "color2": {
//     //     "format": V_weLinearFormat,
//     //     "label": "color 2",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//     //     uniformType: " texture_2d<f32>",
//     // },
//     // "color3": {
//     //     "format": V_weLinearFormat,
//     //     "label": "color 3",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//     //     uniformType: " texture_2d<f32>",
//     // },
//     // "color4": {
//     //     "format": V_weLinearFormat,
//     //     "label": "color 4",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//     //     uniformType: " texture_2d<f32>",
//     // },
//     // "depth1": {
//     //     "format": "depth32float",
//     //     "label": "depth 1",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
//     // },
//     // "depth2": {
//     //     "format": "depth32float",
//     //     "label": "depth 2",
//     //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
//     // },
//     "depth": {
//         "format": "rgba32float",//TTP写4个深度使用
//         "label": "depth",
//         usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//         uniformType: " texture_2d<f32>",
//     },
//     "id": {
//         "format": "rgba32uint",
//         "label": "id",
//         usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
//         uniformType: " texture_2d<u32>",
//     },
// }
/**
 * 预定义的GBuffer和RPD的集合
 */
export interface I_GBufferGroup {
    /**      name = camera 的 id     */
    [name: string]: {
        forward: {
            /** 每个camera最终的GBuffer的渲染描述 */
            RPD: GPURenderPassDescriptor,
            /**entity  创建TTPF DC时私用 */
            // RPD_TTPF?: GPURenderPassDescriptor,
            blendRPD: GPURenderPassDescriptor,
            /**
            * 每个camera最终的GBuffer的颜色附件描述
            */
            colorAttachmentTargets: GPUColorTargetState[],
            /** 每个camera的forward GBuffer存储位置 */
            GBuffer: I_GBuffer,
            // deferColor: GPUTexture,
        },
        MSAA?: {
            /** 每个camera MSAA GBuffer的渲染描述 */
            RPD_MSAA: GPURenderPassDescriptor,
            /** 每个camera MSAA info GBuffer的渲染描述 */
            RPD_MSAAinfo: GPURenderPassDescriptor,
            /**
             * 每个camera最终的GBuffer的颜色附件描述
             */
            colorAttachmentTargetsMSAA: GPUColorTargetState[],
            colorAttachmentTargetsMSAAinfo: GPUColorTargetState[],
            /** 每个camera的forward GBuffer存储位置 */
            GBuffer: I_GBuffer,
        }

        finalRender: {
            /**
             * ToneMapping的输出纹理,必须
             */
            color: GPUTexture,
            /**
             * ToneMapping的颜色附件描述,必须
             */
            colorAttachmentTargets: GPUColorTargetState[],
            /**
             * ToneMapping的渲染描述,必须
             */
            rpd: GPURenderPassDescriptor,
        }
    }
}
export interface I_TransparentGBufferGroup {
    // RPD: GPURenderPassDescriptor,
    /**
     * 每个camera的RPD，带有depth附件
     */
    RPD: {
        [UUID: string]: GPURenderPassDescriptor
    },
    colorAttachmentTargets: GPUColorTargetState[],
    /**每个camera的透明渲染的GBuffer 
     * colorAttacheMent:4个color存储，4个depth存储；
     * 这里只是比较，存储，无blend
     * */
    GBuffer: I_GBuffer,
    name: string,
}

// /**
//  * material 获取相机对应的texture的GBuffer的uniform的bundle
//  */
// export interface I_GBufferBundle {
//     binding: number,
//     groupAndBindingString: string,
//     uniformGroup: T_uniformGroups,
// }


export function getColorAttachmentTargetsOfToneMapping(): GPUColorTargetState[] {
    return [{ format: V_ForwardGBufferNames[E_GBufferNames.color].format }];
}
export function getColorAttachmentTargetsOfBlend(): GPUColorTargetState[] {
    const colorAttachmentTargets: GPUColorTargetState[] = [];
    const perOneBuffer = V_ForwardGBufferNames[E_GBufferNames.color];
    colorAttachmentTargets.push({ format: perOneBuffer.format });
    return colorAttachmentTargets;
}
export function getColorAttachmentTargetsOfForward(): GPUColorTargetState[] {
    const colorAttachmentTargets: GPUColorTargetState[] = [];
    for (const key in V_ForwardGBufferNames) {
        const perOneBuffer = V_ForwardGBufferNames[key];
        if (key != E_GBufferNames.depth) colorAttachmentTargets.push({ format: perOneBuffer.format });
    }
    return colorAttachmentTargets;
}

export function getColorAttachmentTargetsOfMSAAinfo(): GPUColorTargetState[] {
    const colorAttachmentTargets: GPUColorTargetState[] = [];
    for (const key in V_ForwardGBufferNames) {
        const perOneBuffer = V_ForwardGBufferNames[key];
        if (key != E_GBufferNames.depth && key != E_GBufferNames.color) colorAttachmentTargets.push({ format: perOneBuffer.format });
    }
    return colorAttachmentTargets;
}

export function getColorAttachmentTargetsOfMSAA(): GPUColorTargetState[] {
    const colorAttachmentTargets: GPUColorTargetState[] = [];
    for (const key in V_MsaaGBufferNames) {
        const perOneBuffer = V_MsaaGBufferNames[key];
        if (key != E_GBufferNames.depth) colorAttachmentTargets.push({ format: perOneBuffer.format });
    }
    return colorAttachmentTargets;
}