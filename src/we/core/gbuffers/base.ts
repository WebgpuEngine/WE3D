import { V_weLinearFormat } from "../base/coreDefine"
import { BaseCamera } from "../camera/baseCamera"
import { T_uniformGroup } from "../command/base"
import { Scene } from "../scene/scene"

/**GBuffer的 GPUTexture集合 
 * 每个camera最终的GBuffer存储位置
 * 其中的名称是 buffer的名称
 *  如： E_GBufferNames中的名称或者transparent 中的名称
*/
export interface I_GBuffer {
    [name: string]: GPUTexture
};
// /**多cameras中，多个摄像机对应的GBuffer */
// export interface I_GBufferGroup {
//     /**name= camera  的 id */
//     [name: string]: I_GBuffer,
// }
/**GBuffer的组成描述 */
export interface I_GBufferStruct {
    format: GPUTextureFormat,
    label: string,
    usage: number,
    uniformType?: string,
}
export enum E_GBufferNames {
    depth = "depth",
    color = "color",
    id = "id",
    normal = "normal",
    worldPosition = "worldPosition",
    X = "X",
    Y = "Y",
    Z = "Z",
    ru_ma_AO = "ru_ma_AO",
}
/**GBuffer的组成描述的集合（最终的集合） */
export interface I_GBufferName {
    [name: string]: I_GBufferStruct
}

/**MSAA GBuffer*/
export var V_MsaaGBufferNames: I_GBufferName = {
    [E_GBufferNames.depth]: {
        "format": "depth32float",
        "label": "GBuffer depth attachment:",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
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
        "format": "depth32float",
        "label": "GBuffer depth attachment:",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING 
    },
    [E_GBufferNames.color]: {
        "format": V_weLinearFormat,
        "label": "GBuffer color :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.id]: {
        "format": "r32uint",
        "label": "GBuffer id :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.normal]: {
        "format": "rgba8unorm",
        "label": "GBuffer normal :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.ru_ma_AO]: {
        "format": V_weLinearFormat,
        "label": "GBuffer ru_ma_AO :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    [E_GBufferNames.worldPosition]: {
        "format": "rgba32float",
        "label": "GBuffer worldPosition :",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    },
    // [E_GBufferNames.X]: {
    //     "format": "r32float",
    //     "label": "GBuffer X :",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.Y]: {
    //     "format": "r32float",
    //     "label": "GBuffer Y :",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // [E_GBufferNames.Z]: {
    //     "format": "r32float",
    //     "label": "GBuffer Z :",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
}
/**
 * 预定义的transparent GBuffer变量
 * 注意：这个顺序需要与shader中的“st_transgparentbuffer.fs.wgsl”的约定顺序一致。（depth 除外）
 * 
 */
export var V_TransparentGBufferNames: I_GBufferName = {

    /**
     * 调试用的color
     * 1、不用时，注释掉，	节省8个纹理
     * 2、若开启，需要在shader多个，cameraMan啊个人，等处同步，参加20251008的开发日志
     */
    // "color1": {
    //     "format": V_weLinearFormat,
    //     "label": "color 1",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    //     uniformType: " texture_2d<f32>",
    // },
    // "color2": {
    //     "format": V_weLinearFormat,
    //     "label": "color 2",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    //     uniformType: " texture_2d<f32>",
    // },
    // "color3": {
    //     "format": V_weLinearFormat,
    //     "label": "color 3",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    //     uniformType: " texture_2d<f32>",
    // },
    // "color4": {
    //     "format": V_weLinearFormat,
    //     "label": "color 4",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    //     uniformType: " texture_2d<f32>",
    // },
    // "depth1": {
    //     "format": "depth32float",
    //     "label": "depth 1",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    // "depth2": {
    //     "format": "depth32float",
    //     "label": "depth 2",
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    // },
    "depth": {
        "format": "rgba32float",
        "label": "depth ",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        uniformType: " texture_2d<f32>",
    },
    "id": {
        "format": "rgba32uint",
        "label": "id",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        uniformType: " texture_2d<u32>",
    },
}
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
            RPD_TTPF?: GPURenderPassDescriptor,
            /**
            * 每个camera最终的GBuffer的颜色附件描述
            */
            colorAttachmentTargets: GPUColorTargetState[],
            /** 每个camera的forward GBuffer存储位置 */
            GBuffer: I_GBuffer,
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
        deferDepth?: {
            /** 每个camera最终的GBuffer的深度附件描述 */
            RPD: GPURenderPassDescriptor,
            /** 每个camera的延迟渲染的buffer ：1个*/
            GBuffer: GPUTexture,
        },
        finalRender: {

            /**
             * ToneMapping的输出纹理,必须
             */
            toneMappingTexture: GPUTexture,
            /**
             * ToneMapping的颜色附件描述,必须
             */
            toneMappingColorAttachmentTargets: GPUColorTargetState[],
            /**
             * ToneMapping的渲染描述,必须
             */
            rpdToneMapping: GPURenderPassDescriptor,
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

/**
 * material 获取相机对应的texture的GBuffer的uniform的bundle
 */
export interface I_GBufferBundle {
    binding: number,
    groupAndBindingString: string,
    uniformGroup: T_uniformGroup,
}

/**
 * 暂未使用：20250928
 * 获取GBuffer的uniform的bundle 
 * 1、获取相机对应的texture的GBuffer的uniform的bundle
 * 2、根据相机对应的texture的GBuffer的uniform的bundle，获取相机对应的texture的GBuffer的uniform的bundle的字符串
 * 3、Map机对应的texture的GBuffer的uniform的layout
 * @param binding ：绑定的起始位置
 * @param scene ：场景
 * @param camera ：相机
 * @returns I_GBufferBundle
 */
export function getOpacity_GBufferOfUniformOfDefer(binding: number, scene: Scene, camera: BaseCamera): I_GBufferBundle {
    let bundle: I_GBufferBundle = {
        binding: binding,
        groupAndBindingString: "",
        uniformGroup: [],
    }
    Object.entries(V_ForwardGBufferNames).forEach(([name, struct]) => {
        let texture = scene.cameraManager.getGBufferTextureByUUID(camera.UUID, name as E_GBufferNames);
        let uniform: GPUBindGroupEntry = {
            binding: binding,
            resource: texture.createView(),
        }
        //uniform texture layout
        let sampleType: GPUTextureSampleType;
        switch (name) {
            case "depth":
                sampleType = "depth";
                break;
            case "color":
                sampleType = "float";
                break;
            case "id":
                sampleType = "uint";
                break;
            case "ru_ma_AO":
                sampleType = "float";
                break;
            case "normal":
                sampleType = "float";
                break;
            case "worldPosition":
                sampleType = "float";
                break;
            default:
                throw new Error("GBuffer name not found");
                break;
        }
        let uniformTextureLayout: GPUBindGroupLayoutEntry = {
            binding: binding,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            texture: {
                sampleType,
                viewDimension: "2d",
                // multisampled: false,
            },
        };
        //添加到resourcesGPU的Map中
        scene.resourcesGPU.set(uniform, uniformTextureLayout)
        bundle.uniformGroup.push(uniform);
        bundle.groupAndBindingString += `uniform texture2D u_${name} : binding = ${binding};\n`;
        binding++;
    })
    return bundle;
}