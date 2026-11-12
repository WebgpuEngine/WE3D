import type { I_bindGroupAndGroupLayout } from '../command/base';
import type { BaseEntity } from './baseEntity';

/**
 * 第 3 期巨型文件拆分（C5）：从 BaseEntity 抽出的 bindGroup0 构造。
 *
 * scope 用 import type 引入主类（编译后擦除，无运行时环）。这里刻意保留
 * scope.generateGPUBindGroupLayoutDescriptor() / scope.checkPointerRebuildTime() /
 * scope.generateGPUBindGroupEntries() / scope.getBindingOfBindGroup() 的虚调用：
 * SkinsEntity / MorphTargetEntity override 了其中 3 个，若改为直调本模块自由函数
 * 会绕过子类 override，造成皮肤/形变实体的 bindGroup 行为回归。
 * 所有写回（bindGroup / bindGroupLayout / flagInstanceArrayBufferReNew /
 * bufferPointers.*.rebuildTime）都作用在传入的 scope 本体上，不做快照/解构。
 */

export function getBindGroupAndBindGroupLayout(scope: BaseEntity): I_bindGroupAndGroupLayout {
    /**
     * 1、判断bind group 和layout 是否存在，没有新建
     *      A、判断 this.bindGroup ,this.bindGroupLayout  undefined
     *      B、新建
     *      C、缓存layout ，bindgroup
     * 2、如果存在，判断是否需要更新bind group。layout 不变.
     *      A、判断 flagInstanceArrayBufferReNew ，
     *      B、如果=true ，更新，并重置为false
     *      C、返回值
     *
     */
    let createBindGroup = false;
    //undefined，创建
    if (scope.bindGroup == undefined && scope.bindGroupLayout == undefined) {
        //////////////////////////////////////////////////
        //bind group  layout
        const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor =
            scope.generateGPUBindGroupLayoutDescriptor();
        scope.bindGroupLayout = scope.device.createBindGroupLayout(bindGroupLayoutDescriptor);
        //////////////////////////////////////////////////
        //bind group
        createBindGroup = true;
    }
    //当前帧有instance变化，更新
    else if (scope.flagInstanceArrayBufferReNew === true) {
        createBindGroup = true;
    }
    //当前帧有pointer布局有变化（来自BOL系统，非entity的变化，比如BOL的rebuild等），更新bind group
    else {
        createBindGroup = scope.checkPointerRebuildTime();
    }

    //创建或更新bind group
    if (createBindGroup === true) {
        const entries: GPUBindGroupEntry[] = scope.generateGPUBindGroupEntries();
        const bindGroupDescriptor: GPUBindGroupDescriptor = {
            label: `entity:${scope.ID}`,
            layout: scope.bindGroupLayout,
            entries: entries,
        };
        scope.bindGroup = scope.device.createBindGroup(bindGroupDescriptor);
        scope.flagInstanceArrayBufferReNew = false; //重置为false
    }

    return {
        bindGroup: scope.bindGroup,
        bindGroupLayout: scope.bindGroupLayout,
    };
}

export function generateGPUBindGroupLayoutDescriptor(
    scope: BaseEntity,
): GPUBindGroupLayoutDescriptor {
    return {
        label: `entity:${scope.ID}`,
        entries: [
            {
                //@group(1) @binding(0) var<uniform> u_entity_base:st_entity;
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: 'uniform',
                },
            },
            {
                //@group(1) @binding(1) var<storage> u_entity_instances: array<st_instance_info>;      //length=instance count
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: 'read-only-storage',
                },
            },
            {
                //@group(1) @binding(2) var<storage> world_matrix: array<mat4x4f>;          //length=instance count;
                binding: 2,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: 'read-only-storage',
                },
            },
            // {//@group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
            //     binding: 3,
            //     visibility: GPUShaderStage.VERTEX,
            //     buffer: {
            //         type: "read-only-storage"
            //     }
            // },
            // {//@group(1) @binding(4) var<storage> joint_matrix: array<mat4x4f>;           //length=instance count * joint matrix count
            //     binding: 4,
            //     visibility: GPUShaderStage.VERTEX,
            //     buffer: {
            //         type: "read-only-storage"
            //     }
            // },
        ],
    };
}

export function checkPointerRebuildTime(scope: BaseEntity): boolean {
    //当前帧匹配，调试模式下，使用手工调用rebuild，不能精确匹配。非手工模式可以
    // if (this.bufferPointers.uniformCommonEntity?.rebuildTime == this.scene.clock.now
    //     ||
    //     this.bufferPointers.instances?.rebuildTime == this.scene.clock.now
    //     ||
    //     this.bufferPointers.wolrdMatrix?.rebuildTime == this.scene.clock.now
    // )

    //匹配手工和当前帧模式
    if (
        scope.bufferPointers.uniformCommonEntity?.rebuildTime ||
        scope.bufferPointers.instances?.rebuildTime ||
        scope.bufferPointers.wolrdMatrix?.rebuildTime
    ) {
        //重新设置为0
        scope.bufferPointers.uniformCommonEntity!.rebuildTime = 0;
        scope.bufferPointers.instances!.rebuildTime = 0;
        scope.bufferPointers.wolrdMatrix!.rebuildTime = 0;
        return true;
    }
    return false;
}

/**
 * todo:20260322,这里需要BOL改造
 * 生成bind group 的entries
 * @returns GPUBindGroupEntry[]
 */
export function generateGPUBindGroupEntries(scope: BaseEntity): GPUBindGroupEntry[] {
    const entries: GPUBindGroupEntry[] = [];
    for (const i in scope.bufferPointers) {
        const binding = scope.getBindingOfBindGroup(i); //获取绑定的顺序
        const perEntry: GPUBindGroupEntry = {
            binding: binding,
            resource: {
                buffer: scope.bufferPointers[i as keyof typeof scope.bufferPointers]!.gpuBufferView
                    .buffer,
                offset: scope.bufferPointers[i as keyof typeof scope.bufferPointers]!.gpuBufferView
                    .offset,
                size: scope.bufferPointers[i as keyof typeof scope.bufferPointers]!.gpuBufferView
                    .size,
            },
        };
        entries.push(perEntry);
    }
    return entries;
}

/**
 * 获取bind group 的binding,固定的与shader中的顺序对应
 * 说明：
 *  1、bufferGPU使用的对象，没有使用Map。原因是需要有通用的占位Storage buffer，直接指向对象可以共享占位GPUBuffer。
 *  2、对象不能保障顺序，所以需要一个单独绑定的顺序。
 * @param name
 * @returns number
 */
export function getBindingOfBindGroup(name: string): number {
    switch (name) {
        case 'uniformCommonEntity':
            return 0;
        case 'instances':
            return 1;
        case 'wolrdMatrix':
            return 2;
        // case "morphMatrix":
        //     return 3;
        // case "jointMatrix":
        //     return 4;
    }
    throw new Error(`未找到绑定${name}`);
}
