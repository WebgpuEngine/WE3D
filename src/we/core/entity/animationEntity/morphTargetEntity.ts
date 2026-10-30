import { I_pointerStruct } from '../../bufferBlock/pointer';
import { Clock } from '../../scene/clock';
import { IV_BaseEntity } from '../base';
import { AnimationEntity } from './animationEntity';

export abstract class MorphTargetEntity extends AnimationEntity {
    /** 变形目标数量
     * 1、由checkMorphTargetCount() 检查并设置
     * 2、checkMorphTargetCount()由class MorphTargetAnimation 调用
     */
    _morphTargetWeightsCount: number = 0;
    /** 获取变形目标数量 */
    get MorphtTargetCount(): number {
        return this._morphTargetWeightsCount;
    }
    /** 设置变形目标数量
     * 1、设置_morphTargetWeightsCount
     * 2、设置_instanceMorphTargetByteSize
     * 3、设置storageBufferList[2].byteSize
     * 4、检查storageBuffer是否匹配
     */
    set MorphtTargetCount(count: number) {
        this._morphTargetWeightsCount = count;
        this._instanceMorphTargetByteSize = count * 4;
        this.storageBufferList[2].byteSize = this.MorphTargetByteSize;
        if (this.scene) this.checkStorageBuffer(this.storageBufferList);
        else
            console.warn(
                'MorphTargetEntity: MorphtTargetCount 未设置场景，无法检查storageBuffer是否匹配',
            );
    }

    /**storage array(初始化默认一个矩阵，以适配没有morph target的通用情况；)
     * 1、默认大小:4*4=16 byte(即4个position*，一般默认是4个，也可以多。webgpu默认attribute：16个，vertex buffer：8个)
     * 2、size计算= M*(N*4)
     *  A、instance 数量（M=1，动态，程序中）
     *  B、一个顶点的morphTarget数量N ;一般情况为4个，即大小=N*f32Size=4*4=16 byte
     */
    _instanceMorphTargetByteSize = 4 * 4;
    set MorphTargetByteSize(value: number) {
        this._instanceMorphTargetByteSize = value;
    }
    get MorphTargetByteSize(): number {
        return this._instanceMorphTargetByteSize;
    }

    override storageBufferList: {
        name: string;
        byteSize: number;
    }[] = [
        {
            name: 'instances',
            byteSize: this._instanceInfoByteSize,
        },
        {
            name: 'wolrdMatrix',
            byteSize: this._instanceWorldMatrixByteSize,
        },
        {
            name: 'morphMatrix',
            byteSize: this._instanceMorphTargetByteSize,
        },
    ];

    override bufferPointers: {
        uniformCommonEntity: I_pointerStruct | undefined;
        instances: I_pointerStruct | undefined;
        wolrdMatrix: I_pointerStruct | undefined;
        morphMatrix: I_pointerStruct | undefined;
    } = {
        uniformCommonEntity: undefined,
        instances: undefined,
        wolrdMatrix: undefined,
        morphMatrix: undefined,
    };

    constructor(input: IV_BaseEntity) {
        super(input);
    }

    /** 检查变形目标数量是否匹配,检查attribute中position*的数量 ,并设置_morphTargetWeightsCount*/
    checkMorphTargetCount(count: number): boolean {
        // throw new Error("EntityBundleMaterial: checkMorphTargetCount not implemented");
        let countFromAttribute = 0;
        for (const key in this.attributes.vertices) {
            if (key.indexOf('position_') == 0) {
                countFromAttribute++;
            }
        }
        this._morphTargetWeightsCount = countFromAttribute;
        return countFromAttribute == count;
    }
    async updateAnimationBuffer() {
        this.updateMorphtTargetBuffer();
    }
    /**
     * 被update调用，更新vs、fs的uniform
     *
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    override updateUniformCommonEntity(clock: Clock, _write: boolean = true): void {
        super.updateUniformCommonEntity(clock, false);
        if (this.bufferPointers.uniformCommonEntity !== undefined) {
            const st_entityValues = this.bufferPointers.uniformCommonEntity.cpuBuffer;
            const offset = this.bufferPointers.uniformCommonEntity.offset;
            const st_entityViews = {
                animation_kind: new Uint32Array(st_entityValues, offset + 16, 1),
                morpht_target_count: new Uint32Array(st_entityValues, offset + 20, 1),
                // vertex_count: new Uint32Array(st_entityValues, offset + 24, 1),
            };
            st_entityViews.animation_kind[0] = this.getAnimationKind();
            st_entityViews.morpht_target_count[0] = this.MorphtTargetCount;
            // st_entityViews.vertex_count[0] = 0;//this.getVertexCount();
            this.scene.pointers.updatePointerWriteTime(this.bufferPointers.uniformCommonEntity);
        }
    }

    /**
     * morph target update
     * 如果没有morph target，使用默认的storage buffer占位
     */
    updateMorphtTargetBuffer() {
        if (this.bufferPointers.morphMatrix) {
            for (const i in this.outSideInstance) {
                const offset = this.bufferPointers.morphMatrix.offset;
                const perNode = this.outSideInstance[i];
                if (perNode.MorphTarget) {
                    const instanceIndex = parseInt(i);
                    for (let j = 0; j < this.instance.numInstances; j++) {
                        const offsetOfPointer =
                            (instanceIndex * this.instance.numInstances + j) *
                                this.MorphTargetByteSize +
                            offset; //内外部instance的偏移量加上内部instance的偏移量
                        // this.device.queue.writeBuffer(this.bufferGPU.morphMatrix, offset, perNode.MorphTarget!);//写入每个instance的矩阵,内部instance写入相同的矩阵
                        const f32DataViewOfPointer = new Float32Array(
                            this.bufferPointers.morphMatrix.cpuBuffer,
                            offsetOfPointer,
                            this.bufferPointers.morphMatrix.byteLength / 4,
                        );
                        const f32DataViewOfNodeObject = new Float32Array(perNode.MorphTarget);
                        f32DataViewOfPointer.set(f32DataViewOfNodeObject);
                    }
                    this.scene.pointers.updatePointerWriteTime(this.bufferPointers.morphMatrix);
                }
            }
        } else {
            throw new Error('更新世界矩阵数组与GPU世界矩阵数组失败');
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //uniform merge part
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    override generateGPUBindGroupLayoutDescriptor(): GPUBindGroupLayoutDescriptor {
        return {
            label: `entity:${this.ID} @ ${this.scene.clock.now}`,
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
                {
                    //@group(1) @binding(3) var<storage> morph_matrix: array<f32>;              //length=instance count * morph target count * vertex count
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'read-only-storage',
                    },
                },
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

    override checkPointerRebuildTime(): boolean {
        //匹配手工和当前帧模式
        if (
            this.bufferPointers.uniformCommonEntity?.rebuildTime ||
            this.bufferPointers.instances?.rebuildTime ||
            this.bufferPointers.wolrdMatrix?.rebuildTime ||
            this.bufferPointers.morphMatrix?.rebuildTime
        ) {
            //重新设置为0
            this.bufferPointers.uniformCommonEntity!.rebuildTime = 0;
            this.bufferPointers.instances!.rebuildTime = 0;
            this.bufferPointers.wolrdMatrix!.rebuildTime = 0;
            this.bufferPointers.morphMatrix!.rebuildTime = 0;
            return true;
            // console.log("rebuild time:", this.bufferPointers.wolrdMatrix?.rebuildTime, "system time:", this.scene.clock.now);
        }
        return false;
    }
    /**
     * 获取bind group 的binding,固定的与shader中的顺序对应
     * 说明：
     *  1、bufferGPU使用的对象，没有使用Map。原因是需要有通用的占位Storage buffer，直接指向对象可以共享占位GPUBuffer。
     *  2、对象不能保障顺序，所以需要一个单独绑定的顺序。
     * @param name
     * @returns number
     */
    override getBindingOfBindGroup(name: string): number {
        switch (name) {
            case 'uniformCommonEntity':
                return 0;
            case 'instances':
                return 1;
            case 'wolrdMatrix':
                return 2;
            case 'morphMatrix':
                return 3;
            // case "jointMatrix":
            //     return 4;
        }
        throw new Error(`未找到绑定${name}`);
    }
}
