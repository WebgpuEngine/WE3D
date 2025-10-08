import { mat4, vec3 } from "wgpu-matrix";
import { RootOfGPU } from "../organization/root";

import { boundingBox, generateBox3 } from "../math/Box";
import { boundingSphere, generateSphereFromBox3 } from "../math/sphere";


import {
    I_EntityBundleOfUniformAndShaderTemplateFinal,
    I_entityInstance,
    I_optionBaseEntity,
    I_optionShadowEntity,
    I_ShadowMapValueOfDC,
} from "./base";
import { E_lifeState } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { DrawCommand } from "../command/DrawCommand";
import { BaseCamera } from "../camera/baseCamera";
import { BaseLight } from "../light/baseLight";
import { I_uniformBufferPart } from "../command/base";
import { I_ShaderTemplate } from "../shadermanagemnet/base";
import { EntityManager } from "./entityManager";
import { Scene } from "../scene/scene";
import { DrawCommandGenerator } from "../command/DrawCommandGenerator";
import { renderPassName } from "../scene/renderManager";
import { mergeLightUUID } from "../light/lightsManager";


export abstract class BaseEntity extends RootOfGPU {
    ///////////////////////////////////////////
    // shader
    /**for shader  */
    entity_id!: Uint32Array;
    /**for shader */
    stage_id!: Uint32Array;

    /**entiy 的ID（u32）等其他数据占位，这个需要与wgsl shader中同步更改 */
    _entityIdSizeForWGSL = 4;//以u32（f32）计算
    ////////////////////////////////////////////////////////////////////
    //基础属性
    input: I_optionBaseEntity;
    /** stageID*/
    stageID: number = 0;
    /**实例化数量，默认为1 */
    instance: I_entityInstance = {
        numInstances: 1,
    }
    /**     剔除模式    默认=back      */
    _cullMode: GPUCullMode = "back";

    ///////////////////////////////////////////////////////////////////
    //空间属性
    boundingBox!: boundingBox;//initDCC中赋值
    boundingSphere!: boundingSphere;
    ///////////////////////////////////////////////////////////////////
    //uniform
    /** 最终输出@group(1) @binding(0)的uniform buffer*/
    structUnifomrBuffer!: ArrayBuffer;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
    /** matrix buffer是structUnifomrBuffer的matrix部分的arrybuffer view，因为实例化可能是一个或多个，最终输出是一个structUnifomrBuffer的buffer     */
    matrixWorldBuffer!: Float32Array;//instance的uniform 数组数量，在createDCCC中进行字符串替换，每个子类单独进行
    ///////////////////////////////////////////////////////////////////
    //状态属性
    // _init: E_lifeState = E_lifeState.unstart;
    /**是否每帧更新 */
    updateMatrixPerFrame: boolean = true;
    // /**是否单独更新每个instance  默认=false    */
    // flagUpdateForPerInstance: boolean = false;
    /**是否需要更新 */
    needUpdate: boolean = true;
    //////////////////////////////////////////////////////////////////
    //是否透明属性
    /**透明属性     , 默认=false， 通过后续材质或函数设置     */
    _transparent: boolean = false;

    //////////////////////////////////////////////////////////////////
    //阴影相关
    _shadow: I_optionShadowEntity = {
        accept: true,
        generate: true,
    };

    /**
     * cameraDC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    cameraDC: {
        [name: string]: {
            // deferDepth: DrawCommand[],
            // forward: DrawCommand[],
            // transparent: DrawCommand[],
            [renderPassName.depth]: DrawCommand[],
            [renderPassName.forward]: DrawCommand[],
            [renderPassName.transparent]: DrawCommand[],
        }
    } = {};

    /**
     * light的shadow map DC 队列 
     * 1、由enity生成(每个摄像机)
     * 2、由entityManager调度给renderManager
     */
    shadowmapDC: {
        [name: string]: {
            // depth: DrawCommand[],
            // transparent: DrawCommand[],
            [renderPassName.shadowmapOpacity]: DrawCommand[],
            [renderPassName.shadowmapTransparent]: DrawCommand[],
        }
    } = {}
    /**
     * DrawCommand 生成器
     */
    DCG!: DrawCommandGenerator;

    ////////////////////////////////////////////////////////////////////////////
    //渲染相关
    //延迟渲染，depth模式，先绘制depth，单像素
    deferRenderDepth!: boolean;
    //延迟渲染，color模式，todo：先绘制color，depth，材质集中在一起处理，需要一个shader进行处理，即，合批shader
    deferRenderColor!: boolean;
    ////////////////////////////////////////////////////////////////////////////
    entityManager!: EntityManager;

    constructor(input: I_optionBaseEntity) {
        super();
        this.type = "entity";
        this._state = E_lifeState.constructing;
        this.input = input;
        if (input.instance) {
            this.instance = input.instance;
            this.checkInstance();
        }
        if (input.cullmode) {
            this._cullMode = input.cullmode;
        }
        if (input.position) this._position = vec3.fromValues(input.position[0], input.position[1], input.position[2]);
        if (input.scale) this._scale = vec3.fromValues(input.scale[0], input.scale[1], input.scale[2]);
        if (input.rotate) this._rotate = {
            axis: vec3.fromValues(input.rotate[0], input.rotate[1], input.rotate[2]),
            angleInRadians: input.rotate[3],
        };
        if (input.name) this.Name = input.name;

        //////////////////
        //about shader
        if (input.shadow) {
            if (input.shadow.accept === false) this._shadow.accept = false;
            if (input.shadow.generate === false) {
                this._shadow.generate = false;
            }
        }
        console.log(this.ID);
    }
    /**
     * 检查instance是否合法
     */
    checkInstance() {
        if (this.instance.index) {
            if (this.instance.index.length < this.instance.numInstances) {
                throw new Error("instance.index 长度必须大于等于 instance.numInstances");
            }
        }
        else if (this.instance.position) {
            if (this.instance.numInstances > this.instance.position.length) {
                throw new Error("instance.position 长度必须大于等于 instance.numInstances");
            }
            this.instance.numInstances = this.instance.position.length / 3;
        }
        let posLen = 0, rotLen = 0, scaleLen = 0;
        if (this.instance.position) {
            posLen = this.instance.position.length;
        }
        else {
            throw new Error("instance.position 必须有");
        }
        if (this.instance.rotate) {
            rotLen = this.instance.rotate.length;
        }
        if (this.instance.scale) {
            scaleLen = this.instance.scale.length;
        }

        if (rotLen != 0 && rotLen / 4 != posLen / 3) {
            throw new Error("position rotate 长度必须相同");
        }
        if (scaleLen != 0 && scaleLen != posLen) {
            throw new Error("position scale 长度必须相同");
        }
    }
    /**
     * 三段式初始化的第二步：init
     * @param values
     */
    async init(scene: Scene, parent: RootOfGPU, renderID: number): Promise<number> {
        this.structUnifomrBuffer = new ArrayBuffer(this.getSizeOfUniformArrayBuffer());//4 * 4 * this.numInstances * 4 + this._entityIdSizeForWGSL * 4
        this.matrixWorldBuffer = new Float32Array(this.structUnifomrBuffer, 0, 4 * 4 * this.instance.numInstances);
        this.entity_id = new Uint32Array(this.structUnifomrBuffer, 4 * 4 * this.instance.numInstances * 4, 1);
        this.stage_id = new Uint32Array(this.structUnifomrBuffer, 4 * 4 * this.instance.numInstances * 4 + 4, 1);
        await super.init(scene, parent, renderID);
        this.transparent = this.getTransparent();
        this.DCG = new DrawCommandGenerator({ scene: this.scene });
        this._state = E_lifeState.constructed;
        return this.renderID + 1;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // abstract 部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 可见性(visible)、
     * 可用性(enable)、
     * 初始化状态(_state)
     * 上级group的状态（可见性、使用性）
     */
    abstract checkStatus(): boolean
    /** 生成Box和Sphere */
    abstract generateBoxAndSphere(): void
    /** 获取混合模式 */
    abstract getBlend(): GPUBlendState | undefined;
    /** 获取是否透明 */
    abstract getTransparent(): boolean;

    /**延迟渲染的深度渲染：单像素模延迟 ，不透明*/
    abstract createDeferDepthDC(camera: BaseCamera): void
    /**前向渲染 不透明 */
    abstract createForwardDC(camera: BaseCamera): void
    /**透明渲染 */
    abstract createTransparent(camera: BaseCamera): void

    /**渲染shadowmap 不透明*/
    abstract createShadowMapDC(input: I_ShadowMapValueOfDC): void
    /**渲染shadowmap 透明模式 */
    abstract createShadowMapTransparentDC(input: I_ShadowMapValueOfDC): void

    /**获取uniform 和shader模板输出，其中包括了uniform 对应的layout到resourceGPU的map
     * 涉及三个部分：
     * 1、uniformGroups：uniform多组，至少有group0(system),group1(entity)。
     * 2、shaderTemplateFinal：shader模板输出，包括了shader代码和groupAndBindingString。
     * 3、enity 和material的uniform layout 到ResourceGPU的Map操作
     * @param startBinding 
     * @returns  uniformGroups: T_uniformGroup[], shaderTemplateFinal: I_ShaderTemplate_Final 
     */
    abstract getUniformAndShaderTemplateFinal(SHT_VS: I_ShaderTemplate, startBinding: number): I_EntityBundleOfUniformAndShaderTemplateFinal

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 基础部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 设置是否透明 */
    set transparent(transparent: boolean) {
        this._transparent = transparent;
    }
    /** 获取是否透明 */
    get transparent() {
        return this._transparent;
    }
    setBoundingBox(box: boundingBox) {
        this.boundingBox = box;
        this.boundingSphere = this.generateSphere(box);
    }
    /** 世界坐标的Box */
    generateBox(position: number[]): boundingBox {
        let box = generateBox3(position);
        const min = vec3.transformMat4(box.min, this.matrixWorld);
        const max = vec3.transformMat4(box.max, this.matrixWorld);
        box.max[0] = max[0];
        box.max[1] = max[1];
        box.max[2] = max[2];
        box.min[0] = min[0];
        box.min[1] = min[1];
        box.min[2] = min[2];
        return box;
    }
    /**世界坐标的sphere */
    generateSphere(box: boundingBox): boundingSphere {
        if (this.boundingBox == undefined) {
            console.error("boundingBox 没有计算");
        }
        return generateSphereFromBox3(box);
    }
    /**获取实例渲染的buffer， 单个示例可以在input.update（）进行更新     */
    getUniformArrayBuffer() {
        // return this.matrixWorldBuffer;
        return this.structUnifomrBuffer;
    }
    /**size of uniform of this.structUnifomrBuffer */
    getSizeOfUniformArrayBuffer() {
        return this._entityIdSizeForWGSL * 4 + 4 * 16 * this.instance.numInstances;
    }
    /**检查camear的id在commands中是否已经存在 */
    checkIdOfCommands(id: string, commands: Object): boolean {
        for (let i in commands) {
            if (i == id) return true;
        }
        return false;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 阴影相关部分
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**是否产生阴影
     * @returns boolean
     */
    getShadwoMapGenerate(): boolean {
        return this._shadow.generate;
    }
    /**
     * 是否接受阴影
     * @returns boolean
     */
    getShadowmAccept() {
        return this._shadow.accept;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //// update 部分
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /** 获取当前状态（是否可以进行update）*/
    getStateus(): boolean {
        if (this.checkStatus() && this.visible && this.enable) {
            return true;
        }
        return false;
    }
    /** 清除DCC 渲染队列*/
    clearDC() {
        this.cameraDC = {};
        this.shadowmapDC = {};
    }
    /**
     * 透明的实体由于使用了camera的GBUffer，所以需要处理onSize
     */
    onResize(): void {
        for (let i in this.cameraDC) {
            let perCameraDC = this.cameraDC[i];
            // perCameraDC.transparent = [];
        }
        this.upgradeCameras();
    }
    /**更新(创建)关于cameras的DCCC commands
     * 
     * @param parent 
     */
    upgradeCameras() {
        for (let camera of this.scene.cameraManager.list) {
            const id = camera.UUID;
            let already: boolean
            //判断透明还是不透明
            if (this.transparent === true) {
                // this.createDCCCForTransparent({ parent, id: "transparent", kind: E_renderForDC.transparent });
                already = this.checkIdOfCommands(id, this.cameraDC);//获取是否已经存在
            }
            else {
                already = this.checkIdOfCommands(id, this.cameraDC);//获取是否已经存在
            }

            if (already) {
                continue;
            }
            else {
                if (this.cameraDC[camera.UUID] == undefined) {
                    this.cameraDC[camera.UUID] = {
                        [renderPassName.forward]: [],
                        [renderPassName.depth]: [],
                        [renderPassName.transparent]: [],
                    }
                }
                if (this.transparent === true) {
                    this.createTransparent(camera);
                }
                else {
                    if (this.scene.deferRender.enable && this.scene.deferRender.deferRenderDepth) {
                        this.createDeferDepthDC(camera);
                    }
                    this.createForwardDC(camera);
                }
            }
        }
    }
    /**更新(创建)关于lights的DCCC commands
     * 
     */
    upgradeLights() {
        for (let i of this.scene.lightsManager.getShdowMapsStructArray()) {
            const id = i.light_id.toString();
            let UUID = this.scene.lightsManager.getUUIDByID(i.light_id);
            let already: boolean;
            // if (this.transparent === true) {
            //     already = this.checkIdOfCommands(id, this.shadowmapDC);//获取是否已经存在 
            // }
            // else {
            already = this.checkIdOfCommands(UUID, this.shadowmapDC);//获取是否已经存在
            // }
            if (already) {
                continue;
            }
            else {
                // this.shadowmapDC[UUID] = {
                //     depth: [],
                //     transparent: [],
                // }
                let perLight = this.scene.lightsManager.getLightByID(i.light_id);
                if (!perLight) {
                    throw new Error("light not found");
                }
                const valueOfLight: I_ShadowMapValueOfDC = {
                    light: perLight as BaseLight,
                    UUID: UUID,
                    matrixIndex: i.matrix_self_index
                };
                this.shadowmapDC[mergeLightUUID(UUID, i.matrix_self_index)] = {
                    [renderPassName.shadowmapOpacity]: [],
                    [renderPassName.shadowmapTransparent]: [],
                }
                if (this.transparent === true) {
                    this.createShadowMapTransparentDC(valueOfLight);
                }
                else {
                    this.createShadowMapDC(valueOfLight);
                }
            }
        }
    }
    /**检查是否有新摄像机，有进行更新 */
    checkUpgradeCameras() {
        const countsOfCamerasCommand = Object.keys(this.cameraDC).length;
        const countsOfCamera = this.scene.cameraManager.count();
        if (countsOfCamera > countsOfCamerasCommand) {
            this.upgradeCameras()
        }
    }
    /**检查是否有新光源，有进行更新 */
    checkUpgradeLights() {
        const countsOfCamerasCommand = Object.keys(this.shadowmapDC).length;
        const countsOfCameraActors = this.scene.lightsManager.getShdowMapsStructArray().length;
        if (countsOfCameraActors > countsOfCamerasCommand) {//比较的是shadowmap的数量
            this.upgradeLights()
        }
    }



    updateSelf(clock: Clock) {
        //uniform @group(1) @binding(0)
        this.updateUniformBuffer();
        //比如：material 是在运行中是可以更改的，需要重新初始化。
        //由人工按需触发
        if (this.needUpdate === true) {
            this._state = E_lifeState.constructed;//重新初始化，下一帧进行重新初始化工作 
            this.DCG.clear();
        }
        if (this._state === E_lifeState.constructed) {
            this.clearDC();
            if (this.checkStatus()) {
                this._state = E_lifeState.initializing;
                this.generateBoxAndSphere();
                this.upgradeLights();//todo:20250911 ，light完成
                this.upgradeCameras();
                this._state = E_lifeState.finished;//this.createDCCC(valueOfCamera);
            }
            this.needUpdate = false;
        }
        //初始化是完成状态，同时checkStatus=true
        //material 是在运行中是可以更改的，所以需要检查状态。
        else if (this._state === E_lifeState.finished && this.checkStatus()) {
            //检查是否有新摄像机，有进行更新
            this.checkUpgradeCameras();
            //检查是否有新光源，有进行更新
            this.checkUpgradeLights();
        }
        else if (this._state == E_lifeState.initializing) {
            this.checkStatus();
        }
        this.DCG.upadate();
    }
    /**
     * 被update调用，更新vs、fs的uniform
     * 
     * this.flagUpdateForPerInstance 影响是否单独更新每个instance，使用用户更新的update（）的结果，或连续的结果
     */
    updateUniformBuffer(): void {
        if (this.instance.numInstances == 1) {
            this.matrixWorldBuffer.set(this.matrixWorld, 0 * 16);
        }
        else if (this.instance.numInstances > 1) {
            let positionEnable: boolean = false;
            let rotateEnable: boolean = false;
            let scaleEnable: boolean = false;
            if (this.instance.position && this.instance.position.length > 0) {
                positionEnable = true;
            }
            if (this.instance.rotate && this.instance.rotate.length > 0) {
                rotateEnable = true;
            }
            if (this.instance.scale && this.instance.scale.length > 0) {
                scaleEnable = true;
            }
            if (this.instance.index && this.instance.numInstances != this.instance.index.length) {
                this.instance.numInstances = this.instance.index.length;
            }
            else if (this.instance.position && this.instance.numInstances != this.instance.position.length / 3) {
                this.instance.numInstances = this.instance.position.length / 3;
            }
            for (let i = 0; i < this.instance.numInstances; i++) {
                let perMatrix = this.matrixWorldBuffer.subarray(i * 16, (i + 1) * 16);
                let index: number = i;
                if (this.instance.index) {
                    index = this.instance.index[i];
                }
                perMatrix = mat4.identity();
                if (scaleEnable) {
                    let perScale = vec3.fromValues(this.instance.scale![index * 3 + 0], this.instance.scale![index * 3 + 1], this.instance.scale![index * 3 + 2]);
                    mat4.scale(perMatrix, perScale, perMatrix);
                }
                if (rotateEnable) {
                    let perAxis = vec3.fromValues(this.instance.rotate![index * 3] + 0, this.instance.rotate![index * 3] + 1, this.instance.rotate![index * 3] + 2);
                    let perAngle = this.instance.rotate![index * 3 + 3];
                    if (perAngle != 0 && (this.instance.rotate![index * 3 + 0] != 0 || this.instance.rotate![index * 3 + 1] != 0 || this.instance.rotate![index * 3 + 2] != 0)) {
                        mat4.axisRotate(perMatrix, perAxis, perAngle, perMatrix);
                    }
                }
                if (positionEnable) {
                    let perPosition = vec3.fromValues(this.instance.position![index * 3 + 0], this.instance.position![index * 3 + 1], this.instance.position![index * 3 + 2]);
                    mat4.setTranslation(perMatrix, perPosition, perMatrix);
                }
                // mat4.scale(perMatrix, this.instance.scale[i], perMatrix);
                // mat4.axisRotate(perMatrix, this.instance.rotate[i].axis, this.instance.rotate[i].angleInRadians, perMatrix);
                // mat4.translate(perMatrix, this.instance.position[i], perMatrix);
                mat4.multiply(this.matrixWorld, perMatrix, perMatrix);     // 先缩放，再旋转，最后平移，然后乘以world matrix ，得到instance的world matrix，在shader中的VS是再次的局部坐标*这个world matrix，得到顶点的world position
                this.matrixWorldBuffer.set(perMatrix, i * 16);
            }

        }
        this.entity_id[0] = this.ID;
        this.stage_id[0] = this.stageID;
    }

    /**
     * 获取用户自定义的shader代码
     * @returns string
     */
    getUserCodeVS(): string {
        if (this.input.shaderCode) {
            return this.input.shaderCode;
        }
        return "";
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //TTPF 相关部分
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 透明材质的TTPF的uniform layer 
     */
    uniformOfTTPFSize: number = 16;//需要确保 uniform 缓冲区的大小至少等于管线要求的最小大小，且是 16 字节的倍数。
    uniformOfTTPF: ArrayBuffer = new ArrayBuffer(this.uniformOfTTPFSize);
    unifromTTPF!:I_uniformBufferPart;
    /**
     * 设置透明材质的TTPF的uniform
     * @param layer  对应RGBA四层
     */
    setUniformLayerOfTTPF(layer: number) {
        let view = new Uint32Array(this.uniformOfTTPF);
        view[0] = layer;
        view[1] = this.ID;
        this.updateUniformLayerOfTTPF();
        // console.log(view)
    }
    abstract updateUniformLayerOfTTPF(): void

}

