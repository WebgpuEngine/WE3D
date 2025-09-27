/**
 * 管理DC的中间层，用于管理DC的GPU资源：GPUBuffer,GPUBindGroup。
 * 防止重复资源创建（前向渲染，延迟渲染的深度，shadowmap都是使用相同的资源），同时抽象DC的创建过程
 * 材质的资源不进行管理，传过来的已经是GPU资源
 */

import type { Scene } from "../scene/scene";
import type { I_drawMode, I_drawModeIndexed, I_uniformBufferPart, T_uniformGroup } from "./base";
import { createIndexBuffer, createUniformBuffer, createVerticesBuffer, updataOneUniformBuffer } from "./baseFunction";
import { DrawCommand, IV_DrawCommand, I_viewport } from "./DrawCommand";
import { E_renderForDC } from "../base/coreDefine";
import { isDynamicTextureEntry, isUniformBufferPart, ResourceManagerOfGPU } from "../resources/resourcesGPU";
import { AA } from "../scene/base";
import { E_shaderTemplateReplaceType, I_ShaderTemplate_Final, SHT_refDCG } from "../shadermanagemnet/base";
import { BaseCamera } from "../camera/baseCamera";

export interface IV_DrawCommandGenerator {
    scene: Scene,
}

//==================================================================================================================
export interface vsAttribute {
    // shaderLocation: 0,//这个在function，自动增加计算
    /**
     * 顶点相关的各类数据
     * 1、比如:position ,uv,normail,color
     * 2、也可以自定义，
     */
    data: number[],
    /**顶点数量 */
    count: number,
    /**
     * 顶点数据的格式,必须
     * 比如："float32x3",GPUBuffer对应ArrayBuffer按照对应的格式建立
     */
    format: GPUVertexFormat,
    /**      以byte计算 ，比如：xyz=4*3，uv=4*2    */
    arrayStride: number,
    /**默认从0开始 */
    offset?: 0,
}
/**单个vertex的多个属性merge在一起的形式
 * 1、一个数组形式，名称不能重复
 * 2、可以有多个map的，需要保持结构与数量同步，未测试
 */
export interface vsAttributeMerge {
    /**单个vertex的多个属性的大数组 */
    data: number[],
    /**顶点数量 */
    count: number,
    /**单个vertex属性的总长度*/
    arrayStride: number,
    mergeAttribute: vsAttributeMergeAttribute[],
    // /**每个vertex的属性的格式 */
    // format: GPUVertexFormat[],

    // /**单个vertex属性的偏移量 */
    // offset: number[],
    // /**每个vertex属性的名称 */
    // names: string[]
}
/**
 * 单个vertex属性的合并格式
 */
export interface vsAttributeMergeAttribute {
    name: string,
    format: GPUVertexFormat,
    offset: number
}

/**
 * 顶点属性的类型:三种类型
 */
export type T_vsAttribute = vsAttribute | vsAttributeMerge | number[]
/**
 * @data    数据部分 
 * @render  渲染参数 
 * @system  系统参数:camera 或 light
 */
export interface V_DC {
    /**是否包括动态资源在binding group中
     * 默认：false，
     * 如果true，则需要动态绑定资源
     */
    dynamic?: boolean,
    //没有意义，取消，因为transparent pass 透明渲染是在forward之后，这时候loadOP已经是load模式
    // /**
    //  * 是否透明渲染
    //  * 默认：false;forward pass 透明渲染需要开启
    //  * 如果是true，有2种情况：
    //  * 1、透明的不透明渲染，走的也是forward pass，这时，loadOP需要=load。
    //  * 2、透明的透明渲染，走的是transparent pass
    //  */
    // transparent?: boolean,
    label: string,
    data: {
        vertices: Map<string, T_vsAttribute>,
        vertexStepMode?: GPUVertexStepMode,
        indexes?: number[],
        /**
         * 1、最多4个bind group；
         * 2、如果有system，system的bindGroup是0，还剩3个；
         * 3、entity的bindGroup占用bindGroup1的位置；
         * 4、如果V_DC,没有定义system，则uniform不考虑system的BindGroup的问题，即raw模式（NDC）
         */
        uniforms?: T_uniformGroup[],//vs 部分有会 vertex texture
    },
    render: {
        // code: string,//这里需要进行VS 属性的映射替换
        vertex: {
            /**shader模板 */
            // shaderTemplate?: shaderTemplate,
            code: string | I_ShaderTemplate_Final,
            /**默认："vs" */
            entryPoint: string,
            constants?: Record<string, number>,
        },
        /**
         * 无,则只有VS渲染
         */
        fragment?: {
            /**未定义，则FS和VS代码共用 */
            code?: string | I_ShaderTemplate_Final,
            /**默认："fs" */
            entryPoint: string,
            constants?: Record<string, number>,
            /**
             * 没有，则去scene中获取
             */
            targets?: GPUColorTargetState[],
        },
        drawMode: I_drawMode | I_drawModeIndexed,
        primitive?: GPUPrimitiveState,
        // multisample?: GPUMultisampleState,
        // layout?: GPUPipelineLayout | "auto",
        depthStencil?: GPUDepthStencilState,
        viewport?: I_viewport,
    },
    /**
     * 有system：摄像机或光源模式
     * 没有system：NDC模式
     */
    system?: {
        /**
         * camera可以不设置ID，使用default camera
         */
        UUID?: string,
        type: E_renderForDC//"camera" | "light"
    },
    /**
     * 渲染pass的描述符，
     * 1、如果有同级别中的system存在，则安装camera或light，去scene中获取
     * 2、如果没有system：
     *  A、若有本项，则使用
     *  B、没有，则去scene中获取NDC的RPD
     */
    renderPassDescriptor?: GPURenderPassDescriptor,

}

export class DrawCommandGenerator {
    device: GPUDevice;
    scene: Scene;
    resources: ResourceManagerOfGPU;
    AA: AA;
    MSAA: boolean;

    /**DrawCommand的输入参数数组 */
    inputDC: V_DC[] = [];

    constructor(inputValue: IV_DrawCommandGenerator) {
        this.device = inputValue.scene.device;
        this.scene = inputValue.scene;
        this.resources = this.scene.resourcesGPU;
        this.AA = this.scene.AA;
        this.MSAA = this.scene.MSAA;
    }
    clear() {
        console.warn("DrawCommandGenerator.clear() 未实现");
    }
    /**     更新DC的GPU资源     */
    upadate() {
        this.updateUniform();
    }
    /**更新uniform中数据 */

    updateUniform() {
        for (let i of this.inputDC) {//所有的DrawCommand
            if (i.data.uniforms) {//更新uniform，如果有uniform
                let systemFlag = true;
                if (i.system) {
                    systemFlag = true;
                }
                else systemFlag = false
                for (let perGroup of i.data.uniforms) {
                    for (let perEntry of perGroup)
                        if ("data" in perEntry && "update" in perEntry && perEntry.update === true) {//需要更新,只更新数据
                            if (this.resources.has(perEntry, "uniformBuffer")) {
                                let buffer = this.resources.get(perEntry, "uniformBuffer");
                                if (buffer) {
                                    updataOneUniformBuffer(this.device, buffer, (perEntry as I_uniformBufferPart).data)
                                }
                                else {
                                    console.warn(i, perGroup, perEntry, "获取uiform对应的GPUBuffer资源获取失败");
                                }
                            }
                            else {
                                console.warn(i, perGroup, perEntry, "查询uiform对应的GPUBuffer资源获取失败");
                            }
                        }
                }
            }
        }
    }


    /**
     * 生成DrawCommand
     * @param values 
     * @returns 
     */

    generateDrawCommand(values: V_DC) {
        this.inputDC.push(values);//保存每个DC的init参数，为了后续的更新uniform使用（如果其中有update选项）
        //1、buffer资源
        //1.1、顶点资源
        let DC_vertexBuffers: GPUBuffer[] = [];//当前DC的顶点列表。之后在DC中passEncoder.setVertexBuffer(parseInt(i), verticesBuffer)使用。
        let DC_vertexNames: string[] = [];//顶点资源的名称列表，反射code中的内容使用
        let DC_localtions: string[] = [];//顶点资源的名称列表，反射code中的内容使用
        let DC_verticesBufferLayout: GPUVertexBufferLayout[] = [];//vertex.buffers[]
        let shaderLocation = 0;//最多16个
        let location_i = 0;
        for (const [key, value] of values.data.vertices) {
            let locationString: string = "";
            let lowKey = key.toLocaleLowerCase();
            let _GPUVertexBufferLayout: GPUVertexBufferLayout;//当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
            if (Array.isArray(value)) {//标准的数组格式，默认为position等
                if (value.length == 0) {
                    console.warn("顶点属性" + key + "数据为空");
                }
                let data = new Float32Array(value);//默认:float32
                let arrayStride = 4 * 3;
                let format: GPUVertexFormat = "float32x3";
                switch (lowKey) {
                    case "position":
                        arrayStride = 4 * 3;
                        format = "float32x3";
                        break;
                    case "uv":
                        // case "uv1":
                        // case "uv2":
                        arrayStride = 4 * 2;
                        format = "float32x2";
                        break;
                    case "normal":
                        arrayStride = 4 * 3;
                        format = "float32x3";
                        break;
                    case "color":
                        arrayStride = 4 * 3;
                        format = "float32x3";
                        break;
                    default:
                        arrayStride = 4 * 3;
                        format = "float32x3";
                        break;
                }
                let wgsl_value_format = this.getWgslValueFormat(format);
                locationString += ` @location(${location_i}) ${key} : ${wgsl_value_format}  ,`;


                //判断是否以及存在顶点GPUBuffer
                if (!this.resources.has(value, "vertices")) {
                    let vertexBuffer = createVerticesBuffer(this.device, data.buffer, values.label + " vertex GPUBuffer of " + lowKey);
                    this.resources.set(value, vertexBuffer, "vertices");
                }
                //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [{
                        shaderLocation: shaderLocation++,
                        format: format,
                        offset: 0,
                    }],
                }
            }
            else if ("format" in value) {
                let format: GPUVertexFormat = value.format;
                let data;//默认:float32
                let arrayStride = 4 * 3;
                switch (value.format) {//这里只匹配了几种数据，以后视情况而定
                    case "float32x3":
                        arrayStride = 4 * 3;
                        data = new Float32Array(value.data);
                        break;
                    case "float32x2":
                        arrayStride = 4 * 2;
                        data = new Float32Array(value.data);
                        break;
                    case "float32x4":
                        arrayStride = 4 * 4;
                        data = new Float32Array(value.data);
                        break;
                    case "float32":
                        arrayStride = 4 * 1;
                        data = new Float32Array(value.data);
                        break;
                    case "uint32":
                        arrayStride = 4 * 1;
                        data = new Uint32Array(value.data);
                        break;
                    case "uint32x2":
                        arrayStride = 4 * 2;
                        data = new Uint32Array(value.data);
                        break;
                    case "uint32x3":
                        arrayStride = 4 * 3;
                        data = new Uint32Array(value.data);
                        break;
                    case "uint32x4":
                        arrayStride = 4 * 4;
                        data = new Uint32Array(value.data);
                        break;
                    case "sint32":
                        arrayStride = 4 * 1;
                        data = new Int32Array(value.data);
                        break;
                    case "sint32x2":
                        arrayStride = 4 * 2;
                        data = new Int32Array(value.data);
                        break;
                    case "sint32x3":
                        arrayStride = 4 * 3;
                        data = new Int32Array(value.data);
                        break;
                    case "sint32x4":
                        arrayStride = 4 * 4;
                        data = new Int32Array(value.data);
                        break;
                    default:
                        arrayStride = 4 * 3;
                        data = new Float32Array(value.data);
                        break;
                }
                let wgsl_value_format = this.getWgslValueFormat(value.format);
                locationString += ` @location(${location_i}) ${key} : ${wgsl_value_format}  ,`;
                //判断是否以及存在顶点GPUBuffer
                if (!this.resources.has(value, "vertices")) {
                    let vertexBuffer = createVerticesBuffer(this.device, data.buffer, values.label + " vertex GPUBuffer of " + lowKey + " format =" + format);
                    this.resources.set(value, vertexBuffer, "vertices");
                }
                //当前顶点属性的GBufferLayout，就是vertex.buffers[]之中的内容
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes: [{
                        shaderLocation: shaderLocation++,
                        format: format,
                        offset: 0,
                    }],
                }
            }
            else if ("mergeAttribute" in value) {
                let mergeAttribute = value.mergeAttribute
                let arrayStride = value.arrayStride;
                let data = new Float32Array(value.data);
                let attributes: GPUVertexAttribute[] = [];
                for (let i in mergeAttribute) {
                    let item = mergeAttribute[i];
                    attributes.push({
                        shaderLocation: shaderLocation++,
                        format: item.format,
                        offset: item.offset,
                    });
                    let wgsl_value_format = this.getWgslValueFormat(item.format);
                    locationString += ` @location(${location_i}) ${item.name} : ${wgsl_value_format}  ,`;
                    location_i++;//合并属性，每个属性都要增加一个location
                }
                if (!this.resources.has(value, "vertices")) {
                    let vertexBuffer = createVerticesBuffer(this.device, data.buffer, values.label + " vertex GPUBuffer of " + lowKey + " format =mergeAttribute");
                    this.resources.set(value, vertexBuffer, "vertices");
                }
                _GPUVertexBufferLayout = {
                    arrayStride: arrayStride,
                    attributes,
                }
            }
            else {
                console.warn("顶点属性", key, value, " 不能匹配数据");
                continue;
            }
            if (values.data.vertexStepMode) {
                _GPUVertexBufferLayout.stepMode = values.data.vertexStepMode;
            }

            DC_verticesBufferLayout.push(_GPUVertexBufferLayout);      //顺序push顶点Buffer的layout
            DC_localtions.push(locationString);                                  //顺序push顶点名称
            DC_vertexNames.push(key);                                  //顺序push顶点名称
            let vertexBuffer = this.resources.get(value, "vertices");
            if (vertexBuffer) {
                DC_vertexBuffers.push(vertexBuffer);             //顺序push顶点Buffer
            }
            else {
                console.warn("顶点属性", key, value, " 不能匹配数据");
            }
            location_i++;
        }
        //1.2、索引资源
        let DC_indexBuffer: GPUBuffer | undefined;//GPUBuffer默认使用uint32的格式。passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
        if (values.data.indexes && values.data.indexes.length > 0) {
            let u32Buffer = new Uint32Array(values.data.indexes);
            if (!this.resources.has(values.data.indexes, "indexes")) {
                let _indexBuffer = createIndexBuffer(this.device, u32Buffer.buffer, values.label + " index GPUBuffer");
                this.resources.set(values.data.indexes, _indexBuffer, "indexes");
            }
            let index = this.resources.get(values.data.indexes, "indexes");
            if (index) {
                DC_indexBuffer = index;
            }
        }

        //2、bindgroup部分
        //2.1 、获取 BindGroup 0 以及其layout。camera 和light都从各自的体系获得
        let DC_bindGroupLayouts: GPUBindGroupLayout[] = [];
        let DC_bindGroups: GPUBindGroup[] = [];
        // let DC_bindGroupsDynamic: T_uniformGroup[] = [];
        // if (values.dynamic && values.dynamic === true) {
        //     DC_bindGroupsDynamic = values.data.uniforms!;
        // }
        let layoutNumber = 0;
        if (values.system) {
            let UUID = this.checkUUID(values);
            if (UUID) {
                let { bindGroup, bindGroupLayout } = this.scene.getSystemBindGroupAndBindGroupLayoutFroZero(UUID, values.system.type);
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                layoutNumber++;
            }

        }
        if (values.data.uniforms) {
            for (let i in values.data.uniforms) {
                if (layoutNumber > 3) break;
                let perGroup = values.data.uniforms[i];

                //BindGroup，重点1
                let bindGroup: GPUBindGroup;
                //BindGroupDesc ,重点1->1.1
                let bindGroupDesc: GPUBindGroupDescriptor;
                //BindGroup 的数据入口,主要是buffer的创建需要push,-->1.1.1
                let bindGroupEntry: GPUBindGroupEntry[] = [];


                //BindGroupLayout，重点2
                let bindGroupLayout: GPUBindGroupLayout;
                //BindGroup 的layout 描述，重点2->2.1
                let bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
                    label: values.label + " bindGroupLayoutDescriptor of " + layoutNumber,
                    entries: []
                };
                //BindGroup layout的数据入口  -->2.1.1
                let bindGroupLayoutEntry: GPUBindGroupLayoutEntry[] = [];

                if (this.resources.has(perGroup)) {//已经存在bindgroup，比如：同一个mesh中
                    let bindGroupGet = this.resources.get(perGroup);
                    if (bindGroupGet) {
                        bindGroup = bindGroupGet;
                        let bindGroupLayoutGet = this.resources.get(bindGroup)!;//这里没有进行判断，稍后补上
                        if (bindGroupLayoutGet) {
                            bindGroupLayout = bindGroupLayoutGet;
                        }
                        else {
                            throw new Error("bindGroupLayout 不存在");
                            // console.error("bindGroupLayout 不存在");
                        }
                    }
                    else {
                        throw new Error("bindGroup 不存在");
                        // console.error("bindGroup 不存在");
                    }

                }
                else {//不在BindGroup 和BindGroupLayout的记录，创建
                    for (let perEntry of perGroup) {
                        let perBindGroupLayoutEntry = this.resources.get(perEntry);//每个entry的layout
                        bindGroupLayoutEntry.push(perBindGroupLayoutEntry);

                        //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                        if (isUniformBufferPart(perEntry)) {
                            if (this.resources.has(perEntry, "uniformBuffer")) {//已有,直接获取，不创建
                                let buffer = this.resources.get(perEntry, "uniformBuffer");
                                if (buffer)
                                    bindGroupEntry.push({
                                        binding: perEntry.binding,
                                        resource: {
                                            buffer
                                        }
                                    });
                            }
                            else {//没有，创建
                                const label = (perEntry as I_uniformBufferPart).label;
                                let buffer = createUniformBuffer(this.device, (perEntry as I_uniformBufferPart).size, label, (perEntry as I_uniformBufferPart).data);
                                this.resources.set(perEntry, buffer, "uniformBuffer");
                                bindGroupEntry.push({
                                    binding: perEntry.binding,
                                    resource: {
                                        buffer
                                    }
                                });
                            }
                        }
                        else if (isDynamicTextureEntry(perEntry)) {
                            bindGroupEntry.push({
                                binding: perEntry.binding,
                                resource: perEntry.getResource(perEntry.scopy),
                            });
                        }
                        //其他非uniform传入ArrayBuffer的，直接push，不Map（在其他的owner保存）
                        else {
                            bindGroupEntry.push(perEntry);
                        }
                    }


                    //更新BindGroup 的layout 描述的entry部分
                    bindGroupLayoutDescriptor.entries = bindGroupLayoutEntry;
                    //创建BindGroupLayout
                    bindGroupLayout = this.device.createBindGroupLayout(bindGroupLayoutDescriptor);
                    //初始化BindGroup描述
                    bindGroupDesc = {
                        label: values.label + " bindGroupLayoutDescriptor of " + layoutNumber,
                        layout: bindGroupLayout,
                        entries: bindGroupEntry,
                    }
                    //创建BindGroup
                    bindGroup = this.device.createBindGroup(bindGroupDesc);
                    ///////////////////
                    //增加到资源
                    this.resources.set(perGroup, bindGroup,);
                    this.resources.set(bindGroup, bindGroupLayout);
                }
                DC_bindGroups.push(bindGroup);
                DC_bindGroupLayouts.push(bindGroupLayout);
                layoutNumber++;
            }
        }

        // //2.2、创建BindGroup和BindGroupLayout
        // let layout: GPUBindGroupLayout[] = [];
        // //暂时空，先测试
        // if (values.system) {

        // }

        //2、反射顶点名称到shader code的顶点属性的占位符中

        //vertex shader
        let moduleVS: GPUShaderModule
        let shadercode: string;
        if (typeof values.render.vertex.code === "string")
            shadercode = values.render.vertex.code;
        else {
            shadercode = this.formatShaderCode(values.render.vertex.code, DC_vertexNames, DC_localtions);
        }
        moduleVS = this.device.createShaderModule({
            label: values.label + " createShaderModule()",
            code: shadercode,
        });
        //3、生产GPURenderPipelineDescriptor

        //3.1、GPURenderPipelineDescriptor.vertex部分
        let constansVS = {};
        if (values.render.vertex.constants) { constansVS = values.render.vertex.constants; }
        let vertex: GPUVertexState = {
            module: moduleVS,
            entryPoint: values.render.vertex.entryPoint,
            buffers: DC_verticesBufferLayout,
            constants: constansVS,
        }

        //3.2、GPURenderPipelineDescriptor.fragment部分
        let moduleFS = moduleVS;
        let fragment: GPUFragmentState | undefined;
        if (values.render.fragment) {
            let targets: GPUColorTargetState[] = [];
            if (values.render.fragment.targets) targets = values.render.fragment.targets;//使用传入参数
            else if (values.system && values.render.fragment.targets == undefined) {//获取默认camera
                let UUID = this.checkUUID(values);
                if (UUID)
                    targets = this.scene.getColorAttachmentTargets(UUID, values.system.type);
                else
                    // console.error("获取UUID失败");
                    this.errorUUID();
            }
            let constansFS = {};
            if (values.render.fragment.code) {
                if (typeof values.render.fragment.code === "string") {
                    moduleFS = this.device.createShaderModule({
                        code: values.render.fragment.code,
                    })
                }
                else {
                    //todo moduleFS  
                }
            }
            else {
                moduleFS = moduleVS;
            }
            if (values.render.fragment?.constants) { constansFS = values.render.fragment.constants; }

            fragment = {
                module: moduleFS,
                entryPoint: values.render.fragment.entryPoint,
                targets,
                constants: constansFS,
            }
        }


        //3.3、GPURenderPipelineDescriptor.layout 部分
        let pipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
            label: values.label,
            bindGroupLayouts: DC_bindGroupLayouts,
        }
        let pipelineLayout = this.device.createPipelineLayout(pipelineLayoutDescriptor);
        let descriptor: GPURenderPipelineDescriptor = {
            label: values.label,
            vertex,
            layout: pipelineLayout,
        }
        //3.4、GPURenderPipelineDescriptor.其他部分
        if (fragment) descriptor.fragment = fragment;
        if (values.render.primitive) descriptor.primitive = values.render.primitive;
        if (this.MSAA) {
            descriptor.multisample = {
                count: 4,
            }
        }
        if (values.render.depthStencil) descriptor.depthStencil = values.render.depthStencil;
        else {
            descriptor.depthStencil = this.scene.depthMode.depthStencil;
        }

        // if (values.system && !values.render.depthStencil) {
        //     if (values.render.depthStencil) descriptor.depthStencil = values.render.depthStencil;
        // }

        //4、GPURenderPassDescriptor
        let renderPassDescriptor = () => {
            let renderPassDescriptor: GPURenderPassDescriptor;
            if (values.system) {
                let UUID = this.checkUUID(values);
                if (UUID) {
                    renderPassDescriptor = this.scene.getRenderPassDescriptor(UUID, values.system.type);
                }
                else {
                    this.errorUUID();// throw new Error("获取UUID失败");
                }

            }
            else if (values.renderPassDescriptor) {
                renderPassDescriptor = values.renderPassDescriptor;
                if (!values.render.depthStencil) {
                    console.error("与renderPassDescriptor匹配的传入参数的depthStencil 不存在,使用默认的depthStencil，可能出现不匹配错误！");
                }
            }
            else {
                renderPassDescriptor = this.scene.getRenderPassDescriptorForNDC();

            }
            return renderPassDescriptor!;
        }


        //3.6 生产pipeline
        let pipeline: GPURenderPipeline;
        if (this.resources.renderPipelineDescriptor.has(descriptor)) {
            const pl = this.resources.renderPipelineDescriptor.get(descriptor);
            if (pl)
                pipeline = pl;
            else {
                pipeline = this.device.createRenderPipeline(descriptor);
                this.resources.renderPipelineDescriptor.set(descriptor, pipeline);
            }
        }
        else {
            pipeline = this.device.createRenderPipeline(descriptor);
            this.resources.renderPipelineDescriptor.set(descriptor, pipeline);
        }

        //5、传参，生产DC
        let commandOption: IV_DrawCommand = {
            scene: this.scene,
            device: this.device,
            pipeline,
            vertexBuffers: DC_vertexBuffers,
            drawMode: values.render.drawMode,
            label: values.label,
            uniform: DC_bindGroups,
            renderPassDescriptor,
            // dynamic: values.dynamic || false,
        }
        if (values.render.viewport) commandOption.viewport = values.render.viewport;
        let camera = this.getCamera(values);
        if (camera) {
            commandOption.viewport = camera.viewport;
        }
        if (values.dynamic && values.dynamic === true) {
            let layoutNumber = 0;
            if (values.system) {
                layoutNumber = 1;
            }
            commandOption.dynamicUniform = {
                bindGroupLayout: DC_bindGroupLayouts,
                bindGroupsUniform: values.data.uniforms!,
                layoutNumber: layoutNumber,
            };
        }

        if (DC_indexBuffer) {
            commandOption.indexBuffer = DC_indexBuffer;
        }
        let drawCommand = new DrawCommand(commandOption);
        return drawCommand;
    }

    /**
     * 获取camera从scene中根据UUID
     * @param values 
     * @returns BaseCamera | false
     */
    getCamera(values: V_DC): BaseCamera | false {
        if (values.system?.type == E_renderForDC.camera) {
            let UUID = this.checkUUID(values);
            if (UUID) {
                let camera = this.scene.cameraManager.getCameraByUUID(UUID);
                if (camera)
                    return camera;
            }
        }
        return false;
    }

    errorUUID() {
        throw new Error("获取UUID失败");
    }

    checkUUID(values: V_DC): string | false {
        if (values.system) {
            let UUID = values.system.UUID;
            if (values.system.type === E_renderForDC.camera && values.system.UUID == undefined) {//相机没有UUID，默认使用默认相机
                if (this.scene.cameraManager.DefaultCamera)
                    UUID = this.scene.cameraManager.DefaultCamera.UUID;
            }
            if (UUID != undefined)
                return UUID;
            else
                // throw new Error("获取UUID失败,DCG未收到camera UUID,get default camera UUID fail");
                return false;
        }
        return false
    }
    /**
     * 格式化（替换）shader代码
     * @param templateFinal  shader模板
     * @param refName 反射的变量名
     * @param locations 反射的变量location
     * @returns 
     */
    formatShaderCode(templateFinal: I_ShaderTemplate_Final, refName: string[], locations: string[]): string {
        let groupAndBindingString: string = "";
        let shaderCode: string = "";
        for (let i in templateFinal) {
            let perPart = templateFinal[i];
            for (let i_single in perPart) {
                if (i_single == "groupAndBindingString") {
                    groupAndBindingString += perPart[i_single as keyof typeof perPart];
                }
                else if (i_single == "templateString") {
                    shaderCode += perPart[i_single as keyof typeof perPart];
                }
            }
        }
        for (let i in SHT_refDCG) {
            if (i == "replace") {
                for (let perReplace of SHT_refDCG.replace!) {
                    if (perReplace.replaceType == E_shaderTemplateReplaceType.replaceCode) {
                        shaderCode = shaderCode.replace(perReplace.replace!, perReplace.replaceCode!);
                    }
                    else if (perReplace.replaceType == E_shaderTemplateReplaceType.selectCode) {
                        if (refName.indexOf(perReplace.check!) != -1) {
                            shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![1]);
                        }
                        else {
                            shaderCode = shaderCode.replace(perReplace.replace, perReplace.selectCode![0]);
                        }
                    }
                    else if (perReplace.replaceType == E_shaderTemplateReplaceType.value) {
                        if (perReplace.name == "refName") {
                            let locationString: string = locations.join("\n");
                            shaderCode = shaderCode.replace(perReplace.replace!, locationString);
                        }
                    }
                }
            }
        }
        return groupAndBindingString + "\n" + shaderCode;
    }
    /**
     * 获取attribute的属性格式转换为wgsl的变量格式
     * @param format string
     * @returns string
     */
    getWgslValueFormat(format: string) {
        let wgsl_value_format = "";
        if (format == "float32x3") {
            wgsl_value_format = "vec3f";
        }
        else if (format == "float32x2") {
            wgsl_value_format = "vec2f";
        }
        else if (format == "float32x4") {
            wgsl_value_format = "vec4f";
        }
        else if (format == "float32") {
            wgsl_value_format = "f32";
        }
        else if (format == "uint32") {
            wgsl_value_format = "u32";
        }
        else if (format == "uint32x2") {
            wgsl_value_format = "vec2u";
        }
        else if (format == "uint32x3") {
            wgsl_value_format = "vec3u";
        }
        else if (format == "uint32x4") {
            wgsl_value_format = "vec4u";
        }
        else if (format == "sint32") {
            wgsl_value_format = "i32";
        }
        else if (format == "sint32x2") {
            wgsl_value_format = "vec2i";
        }
        else if (format == "sint32x3") {
            wgsl_value_format = "vec3i";
        }
        else if (format == "sint32x4") {
            wgsl_value_format = "vec4i";
        }
        else {
            throw new Error("顶点属性格式不能匹配数据");
        }
        return wgsl_value_format;
    }
}

