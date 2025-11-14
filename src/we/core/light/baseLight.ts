import { mat4, Mat4, vec3, Vec3, } from "wgpu-matrix";
import { RootGPU, RootOrigin } from "../organization/root";
import { WeGenerateID, WeGenerateUUID } from "../math/baseFunction";
import { Scene } from "../scene/scene";
import { weColor3, I_Update, weVec3 } from "../base/coreDefine";
import { Clock } from "../scene/clock";
import { isWeColor3 } from "../base/coreFunction";
import { LightsManager } from "./lightsManager";

/**
 * 光源的类型
 * 需要与WGSL shader中的struct ST_Light 的kind匹配
 */
export enum E_lightType {
    direction,
    point,
    spot,
    area,
    ambient
}
export interface I_optionBaseLight extends I_Update {
    /**
     * 位置
     * position
     */
    position?: weVec3,

    /**
     * 颜色
     * color
     */
    color?: weColor3,

    /**
     * 光的强度 ， 默认=1.0
     * light intensity, default=1.0
    */
    intensity?: number,

    /**光的可视距离 
     * 0.0=无限远
    */
    distance?: number,

    /**
     * 方向: 方向光源和聚光灯需要
     * direction: direction light and spot light need
     */
    direction?: weVec3,

    /**
     * decay
     * 衰减因子，待定
     */
    decay?: number,
    /**
     * 角度(内切): 聚光灯需要
     * angle(in): spot light need
     */
    angle?: number,

    /**
     * 角度外切: 聚光灯需要
     * angleOut: spot light need
     */
    angleOut?: number,

    /**
     * 阴影
     * shadow
     */
    shadow?: boolean,
    /**
     * 大小
     * size
     */
    size?: number,

    /**
     * 可见性,目前看没有意义，保留
     * 
     * visibility,  
     */
    visible?: boolean
}

/**
 * 光源的uniform的尺寸，ArrayBuffer的大小(byte) 
 */
export var lightStructSize = 112;//20240104 change 96->112,add some about shadow 
// export var lightStructSizeOfShadowMapMVP = 80;//20240104 change 96->112,add some about shadow` 
// export var lightStructSizeForRenderOfBindGroup = 80;//20240104 change 96->112,add some about ` 

/**
 * 输出的uniform的buffer的类型，float32Array，大小(length)以float32(4个字节)计算=lightStructSize/4
 */
export type structBaselight = Float32Array;




/**
 * lights uniform's shadowmap in  struct of St_Light(in shader)
 * 光源uniform中的阴影的信息，在shader中，在St_Light结构体
 */
interface optionBaseShadowMapOfST_Light {
    shadow_map_type: number,  //1=one depth,6=cube,0=none
    shadow_map_array_index: number,   //-1 = 没有shadowmap,other number=开始的位置，从0开始
    shadow_map_array_lenght: number,  //1 or 6
    shadow_map_enable: number,  //depth texture array 会在light add之后的下一帧生效，这个是标志位
}

export abstract class BaseLight extends RootGPU {
    /**
     * type of lights
     * 光源的类型
     */
    kind!: E_lightType;
    /**
     * light's uniform buffer
     * 光源的uniform的buffer
     */
    _buffer!: structBaselight;
    /**
     * light's input values
     * 输入参数=input 
     * */
    declare inputValues: I_optionBaseLight;
    _color: Vec3 = vec3.create(1, 1, 1);
    _distance: number = 0;
    _visible: boolean = true;
    _enable: boolean = true;
    _direction: Vec3 = vec3.create(0, 0, 0);
    _intensity: number = 1.0;
    _decay: number = 0;
    _angle: number = 0;
    _angleOut: number = 0;
    _size: number = 1;

    /**
     * light's enable
     * 是否启用 
     * */

    /**
     * light's visible
     * 是否可见，未使用(当光源被移除时，会被设置为false)，即_parent==undefined
     * */
    visible: boolean = true;
    enable: boolean = true;
    /////////////////////////////////////////////////
    //about  shadow map 
    /**
     * matrix of MVP ,for shadow map .point light has 6 MVP,other have one MVP,so use array .
     * MVP 矩阵，shadowmap使用 。点光源有6个MVP，其他的有一个MVP，所以使用数组
     * */
    //这个与lightsManager中shadowArrayOfDepthMapAndMVP的重复，而且冲突了，目前（20250918）来看，这个应该是没有在
    MVP: Mat4[];
    // sizeOfMVP: number = 80;
    // bufferOfMVP: ArrayBuffer = new ArrayBuffer(this.sizeOfMVP);
    // GPUBufferOfMVP: GPUBuffer;
    /**
     * light's shadow enable
     * 是否启用阴影
     * */
    _shadow: boolean = false;

    /**
     * light's epsilon for matirx MVP
     * MVP矩阵的偏移量的大小
     * */
    epsilon = 0.1;

    /**
     * light's shadow map attribute for uniform
     * 光源的阴影的属性，在uniform中
     * */
    shadowMapOfSt_Light: optionBaseShadowMapOfST_Light = {
        /**
         * 阴影的类型
         * shadow map type
         */
        shadow_map_type: 0,
        /**
         * 定位当前光源在shadowmap的纹理中的位置
         * the location of light in shadowMapTexture
         * 
         * 阴影的数组的索引，在LightsManager中的shadowMapTexture：GPUTexture数组的索引
         * shadow map array index in LightsManager's shadowMapTexture:GPUTexture array index
         */
        shadow_map_array_index: -1,
        /**
         * 阴影的数组的长度：1 或 6
         * shadow map array length:1 or 6
         */
        shadow_map_array_lenght: 0,
        /**
         * 阴影的启用，这个定义重复了，与类中的shadow，保留
         * shadow map enable
         */
        shadow_map_enable: 0,
    }

    manager!: LightsManager;

    constructor(input: I_optionBaseLight, kind: E_lightType) {
        super();
        this.type = "Light";
        this.ID = WeGenerateID();

        this.UUID = WeGenerateUUID();
        this.enable = false;
        this.inputValues = input;
        this.MVP = [];
        if (input.position) this.Position = input.position;
        if (input.color) this.Color = vec3.create(...input.color);
        if (input.intensity) this._intensity = input.intensity;
        if (input.distance) this._distance = input.distance;
        if (input.direction) this.Direction = input.direction;
        if (input.decay) this._decay = input.decay;
        if (input.angle) this._angle = input.angle;
        if (input.angleOut) this._angleOut = input.angleOut;
        if (input.shadow) this._shadow = input.shadow;

        if (input.size !== undefined) this._size = input.size;
        if (input.visible !== undefined) this.visible = input.visible;
        this.kind = kind;

        this._buffer = this.updateStructBuffer();
        // this.GPUBufferOfMVP = this.device.createBuffer({
        //     size: this.sizeOfMVP,
        //     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        // });
    }



    get Kind(): number {
        return this.kind
    }
    set Kind(v: E_lightType) {
        this.kind = v;
    }

    get Color() {
        return this._color;
    }
    set Color(v: Vec3 | weColor3) {
        if (isWeColor3(v)) {
            vec3.copy(vec3.fromValues(...v), this._color);
        }
        else {
            vec3.copy(v, this._color);
        }
    }
    get Intensity(): number {
        return this._intensity!;
    }
    set Intensity(v: number) {
        this._intensity = v;
    }
    /***
     * 光源的作用距离
     * 默认=0，一直起作用
     */
    get Distance(): number {
        return this._distance;
    }
    set Distance(v: number) {
        this._distance = v;
    }
    get Shadow(): boolean {
        return this._shadow;
    }
    set Shadow(v: boolean) {
        this._shadow = v;
    }
    get Visible(): boolean {
        return this._visible;
    }
    set Visible(v: boolean) {
        this._visible = v;
    }

    /**只有方向光返回值，其他返回false */

    get Direction(): Vec3 | false {
        if (this.kind == E_lightType.point) {
            return false;
        }
        else {
            return this._direction;
        }
    }
    set Direction(v: Vec3 | weVec3) {
        if (isWeColor3(v)) {
            vec3.copy(vec3.fromValues(...v), this._direction);
        }
        else {
            vec3.copy(v, this._direction);
        }
    }

    get Decay(): number {
        return this._decay;
    }
    set Decay(v: number) {
        this._decay = v;
    }
    /**
     * only for spot    
     * 弧度制 :只有spot有值，其他false 
     * 
     * */
    get Angle(): number[] | false {
        if (this.kind == E_lightType.spot) {
            return [this._angle, this._angleOut];
        }
        return false;
    }

    // updateGPUBufferOfMVP() {
    //     const ST_SystemMVPViews = {
    //         MVP: new Float32Array(this.bufferOfMVP, 0, 16),
    //         reversedZ: new Uint32Array(this.bufferOfMVP, 64, 1),
    //     };
    //     ST_SystemMVPViews.reversedZ[0] = 1;//默认开启
    //     ST_SystemMVPViews.MVP.set(this.MVP.flat());
    //     mat4.copy(this.MVP, ST_SystemMVPViews.MVP);
    //     this.device.queue.writeBuffer(this.GPUBufferOfMVP, 0, this.bufferOfMVP);
    // }

    async updateSelf(clock: Clock) {
        this._buffer = this.updateStructBuffer();
        this.MVP = this.updateMVP(this.scene);
        // let scope=this;
        // console.log("Position = ", scope.Position[0], scope.Position[1], scope.Position[2])
        // console.log("worldPosition = ", scope.worldPosition[0], scope.worldPosition[1], scope.worldPosition[2])
    }
    /**更新光源MVP */
    abstract updateMVP(scene: Scene): Mat4[];

    /**
     * 获取光源的MVP矩阵数组。
     * get light’s MVP array
     * @returns Mat4[]
     */
    getMVP(): Mat4[] {
        return this.MVP;
    }
    /**
     * 获取光源的MVP数组的index的MVP。
     * get light’s MVP array[index]
     * @param index 索引
     * @returns Mat4
     */
    getMVPByIndex(index: number): Mat4 {
        if (this.MVP[index])
            return this.MVP[index];
        else {
            // console.error("返回单位矩阵,未找到index=", index, "的MVP", this);
            return mat4.identity();
        }
    }
    /**
     * 获取光源的structBuffer。
     * get light’s structBuffer
     * @returns structBaselight
     */
    getStructBuffer(): structBaselight {
        if (this._buffer == undefined) {
            this._buffer = this.updateStructBuffer();
        }
        return this._buffer;
    }

    /**
     * 更新光源的structBuffer(每个光源的uniform)。
     * update light’s structBuffer(per light's uniform )
     * @returns structBaselight
     */
    updateStructBuffer(): structBaselight {
        let ST_LightValues = new ArrayBuffer(lightStructSize);
        const ST_LightViews = {
            position: new Float32Array(ST_LightValues, 0, 3),
            decay: new Float32Array(ST_LightValues, 12, 1),
            color: new Float32Array(ST_LightValues, 16, 3),
            intensity: new Float32Array(ST_LightValues, 28, 1),
            direction: new Float32Array(ST_LightValues, 32, 3),
            distance: new Float32Array(ST_LightValues, 44, 1),
            angle: new Float32Array(ST_LightValues, 48, 2),
            shadow: new Int32Array(ST_LightValues, 56, 1),
            visible: new Int32Array(ST_LightValues, 60, 1),
            size: new Float32Array(ST_LightValues, 64, 4),
            kind: new Int32Array(ST_LightValues, 80, 1),
            id: new Uint32Array(ST_LightValues, 84, 1),
            shadow_map_type: new Uint32Array(ST_LightValues, 88, 1),//1=one depth,6=cube,0=none
            shadow_map_array_index: new Int32Array(ST_LightValues, 92, 1),//-1 = 没有shadowmap,other number=开始的位置，从0开始
            shadow_map_array_lenght: new Uint32Array(ST_LightValues, 96, 1),//1 or 6
            shadow_map_enable: new Int32Array(ST_LightValues, 100, 1),//depth texture array 会在light add之后的下一帧生效，这个是标志位。因为GPUTexture会重建
        };

        //种类
        ST_LightViews.kind[0] = this.Kind;

        // let position = this.Position;
        let position = this.worldPosition;
        if (position) {
            ST_LightViews.position[0] = position[0];
            ST_LightViews.position[1] = position[1];
            ST_LightViews.position[2] = position[2];
        }

        ST_LightViews.color[0] = this.Color[0];
        ST_LightViews.color[1] = this.Color[1];
        ST_LightViews.color[2] = this.Color[2];

        ST_LightViews.intensity[0] = this.Intensity;

        ST_LightViews.distance[0] = this.Distance;

        let dir = this.Direction;
        if (dir) {
            ST_LightViews.direction[0] = dir[0];
            ST_LightViews.direction[1] = dir[1];
            ST_LightViews.direction[2] = dir[2];
        }

        ST_LightViews.decay[0] = this.Decay;

        let angle = this.Angle;
        if (angle) {
            ST_LightViews.angle[0] = angle[0];
            ST_LightViews.angle[1] = angle[1];
        }


        ST_LightViews.visible[0] = this.Visible ? 1 : 0;
        //对应的shadowmap的信息,字面量(copy)
        ST_LightViews.shadow[0] = this.Shadow ? 1 : 0;
        ST_LightViews.shadow_map_type[0] = this.shadowMapOfSt_Light.shadow_map_type;
        ST_LightViews.shadow_map_array_index[0] = this.shadowMapOfSt_Light.shadow_map_array_index;
        ST_LightViews.shadow_map_array_lenght[0] = this.shadowMapOfSt_Light.shadow_map_array_lenght;
        ST_LightViews.shadow_map_enable[0] = this.shadowMapOfSt_Light.shadow_map_enable;
        return new Float32Array(ST_LightValues);
    }

    /**
     * 1、更新光源的shadowmap信息。
     * 2、更新光源的structBuffer(每个光源的uniform)。
     * @param index shadowmap索引
     * @param count shadowmap数量
     * @param kind  shadowmap类型（1=one depth,6=cube,0=none）
     */
    updateShdowMapValues(index: number, count: number, kind: number) {
        this.shadowMapOfSt_Light = {
            shadow_map_type: kind,
            shadow_map_array_index: index,
            shadow_map_array_lenght: count,
            shadow_map_enable: 1,
        };

        let ST_LightValues = this._buffer.buffer;
        const ST_LightViews = {
            // position: new Float32Array(ST_LightValues, 0, 3),
            // decay: new Float32Array(ST_LightValues, 12, 1),
            // color: new Float32Array(ST_LightValues, 16, 3),
            // intensity: new Float32Array(ST_LightValues, 28, 1),
            // direction: new Float32Array(ST_LightValues, 32, 3),
            // distance: new Float32Array(ST_LightValues, 44, 1),
            // angle: new Float32Array(ST_LightValues, 48, 2),
            // shadow: new Int32Array(ST_LightValues, 56, 1),
            // visible: new Int32Array(ST_LightValues, 60, 1),
            // size: new Float32Array(ST_LightValues, 64, 4),
            // kind: new Int32Array(ST_LightValues, 80, 1),
            // id: new Uint32Array(ST_LightValues, 84, 1),
            shadow_map_type: new Uint32Array(ST_LightValues, 88, 1),//1=one depth,6=cube,0=none
            shadow_map_array_index: new Int32Array(ST_LightValues, 92, 1),//-1 = 没有shadowmap,other number=开始的位置，从0开始
            shadow_map_array_lenght: new Uint32Array(ST_LightValues, 96, 1),//1 or 6
            shadow_map_enable: new Int32Array(ST_LightValues, 100, 1),//depth texture array 会在light add之后的下一帧生效，这个是标志位。因为GPUTexture会重建
        };
        ST_LightViews.shadow_map_type[0] = kind;
        ST_LightViews.shadow_map_array_index[0] = index;
        ST_LightViews.shadow_map_array_lenght[0] = count;
        ST_LightViews.shadow_map_enable[0] = 1;//todo ,20250105，如果是动态管理shadowmap texture大小，这个需要适配，目前未使用


    }

}