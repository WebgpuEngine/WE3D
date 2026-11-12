import { E_renderForDC } from '../base/coreDefine';
import type { I_bindGroupAndGroupLayout } from '../command/base';
import type { Scene } from './scene';

/**
 * 第 3 期巨型文件拆分（C6）：Scene 的 system bindGroup0 构造。
 * scope 用 import type 引入主类（编译后擦除，无运行时环）；
 * 缓存字段 _bindGroupLayoutZeroOfCamera / _bindGroupZeroOfCamera /
 * _bindGroupLayoutZeroOfLight / _bindGroupZeroOfLight 仍声明在 Scene 类上，
 * 这里通过 scope 本体读写，保证缓存写回生效。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 */

/**
 *
 * @param UUID UUID,camera的UUID是正常的UUID，light的UUID是merge的UUID，通过“__”分割shadowmap的index（默认=0，point有6个：0-5）
 * @param kind 渲染的类型
 * @returns
 */
export function getSystemBindGroupAndBindGroupLayoutForZero(
    scope: Scene,
    UUID: string,
    kind: E_renderForDC,
): I_bindGroupAndGroupLayout {
    let bindGroup: GPUBindGroup;
    let bindGroupLayout: GPUBindGroupLayout;
    if (kind == E_renderForDC.light) {
        bindGroupLayout = scope.getBindGroupLayoutZeroOfLight();
        bindGroup = scope.getBindGroupZeroOfLight(UUID);
    } else if (kind == E_renderForDC.camera) {
        bindGroupLayout = scope.getBindGroupLayoutZeroOfCamera();
        bindGroup = scope.getBindGroupZeroOfCamera(UUID);
    }
    return { bindGroup: bindGroup!, bindGroupLayout: bindGroupLayout! };
}

/** 获取系统的bindGroupLayoutZeroOfCamera，用于渲染camera */
export function getBindGroupLayoutZeroOfCamera(scope: Scene): GPUBindGroupLayout {
    if (scope._bindGroupLayoutZeroOfCamera === undefined) {
        const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
            label: 'System BGLD(0) Camera',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'read-only-storage',
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'read-only-storage',
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: 'depth',
                        viewDimension: '2d-array',
                        multisampled: false,
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: 'comparison',
                    },
                },
            ],
        };
        scope._bindGroupLayoutZeroOfCamera =
            scope.device.createBindGroupLayout(bindGroupLayoutDescriptor);
    }
    return scope._bindGroupLayoutZeroOfCamera;
}

/** 获取系统的bindGroupZeroOfCamera，用于渲染camera */
export function getBindGroupZeroOfCamera(scope: Scene, UUID: string): GPUBindGroup {
    if (scope._bindGroupZeroOfCamera[UUID] == undefined) {
        const camera = scope.cameraManager.getCameraByUUID(UUID);
        if (camera) {
            const entriesGroup: GPUBindGroupEntry[] = [
                {
                    //camera uniform MVP
                    binding: 0,
                    resource: {
                        buffer: camera.systemUniformBuffersOfGPU, //更新在perlight的updateSelf（）中
                    },
                },
                {
                    //lights uniform
                    binding: 1,
                    resource: {
                        buffer: scope.lightsManager.getLightsUniformForSystem(), //更新在lightManager.update()
                    },
                },
                {
                    //shadow map matrix uniform
                    binding: 2,
                    resource: {
                        buffer: scope.lightsManager.getShadowMapUniformForSystem(), //更新在lightManager.update()
                    },
                },
                {
                    //shadow map depth texture
                    binding: 3,
                    resource: scope.lightsManager.shadowMapTexture.createView({
                        dimension: '2d-array',
                    }),
                },
                {
                    //shadow map sampler
                    binding: 4,
                    resource: scope.reversedZ.isReversedZ
                        ? scope.device.createSampler({
                              compare: 'greater-equal',
                          })
                        : scope.device.createSampler({
                              compare: 'less',
                          }),
                },
            ];
            const bindGroupDescriptor: GPUBindGroupDescriptor = {
                label: 'System BGD(0) Camera:' + UUID,
                layout: scope.getBindGroupLayoutZeroOfCamera(),
                entries: entriesGroup,
            };
            scope._bindGroupZeroOfCamera[UUID] = scope.device.createBindGroup(bindGroupDescriptor);
        } else throw new Error('获取Camera失败');
    }
    return scope._bindGroupZeroOfCamera[UUID];
}

export function getBindGroupLayoutZeroOfLight(scope: Scene): GPUBindGroupLayout {
    if (scope._bindGroupLayoutZeroOfLight === undefined) {
        const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
            label: 'System BGLD(0) Light',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ],
        };
        scope._bindGroupLayoutZeroOfLight =
            scope.device.createBindGroupLayout(bindGroupLayoutDescriptor);
    }
    return scope._bindGroupLayoutZeroOfLight;
}

export function getBindGroupZeroOfLight(scope: Scene, UUID: string): GPUBindGroup {
    if (scope._bindGroupZeroOfLight[UUID] == undefined) {
        const mvpGPUBuffer = scope.lightsManager.getOneLightMVP_ByMergeID(UUID);
        if (!mvpGPUBuffer) {
            throw new Error('getBindGroup0OfLight error,mvpGPUBuffer is undefined');
        }
        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: 'System BGD(0) Light:' + UUID,
            layout: scope.getBindGroupLayoutZeroOfLight(),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: mvpGPUBuffer, //更新在perlight的updateSelf()中更新MVP,lightmanager.updateSytemUniformOfShadowMap()更结构中的GPUBuffer
                    },
                },
            ],
        };
        scope._bindGroupZeroOfLight[UUID] = scope.device.createBindGroup(bindGroupDescriptor);
    }
    return scope._bindGroupZeroOfLight[UUID];
}
