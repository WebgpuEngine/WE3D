
import { weColor3 } from "../base/coreDefine";

type geometryMaterialStep = number[];
export interface xyz {
    x: number,
    y: number,
    z: number,
}
/**
 * 片面的几何属性
 */
export interface I_geometryAttribute {
    position: number[],
    normal: number[],
    uv: number[],
    color: number[],
    indeices: number[],
    materialStep: geometryMaterialStep[],
}
export interface I_GeometryAttributeGroup {
    [name: string]: number[]
}
/**
 * 线框的几何属性
 */
export interface I_geometryWireFrameAttribute {
    indeices: number[],
}

export interface IV_Gemetry {
    /**指定的shader code */
    code?: string,
    color?: weColor3,
}
/**
 * 设计目标提供静态的基础几何体
 */
export abstract class BaseGeometry {
    type!: string;
    input: IV_Gemetry;
    buffer: I_geometryAttribute = {
        position: [],
        normal: [],
        color: [],
        uv: [],
        indeices: [],
        materialStep: []
    };
    wireFrame: {
        indeices: number[]
    } = {
            indeices: []
        }
    _destroy: boolean = false;

    _wireframeColor!: weColor3;
    _wireframeEnable!: boolean;

    _already: boolean = false;

    constructor(input: IV_Gemetry) {
        this.input = input;
    }

    abstract init(input: IV_Gemetry): any
    // abstract destroy(): any

    //线框
    // abstract getWireFrame(): I_vsAttributes[]
    // abstract getWireFrameDrawCount(): number;
    // abstract getWireFrameIndeices(): indexBuffer | boolean
    // abstract getWireFrameShdaerCode(color: color3U): string;


    //片面
    /**
     * 输出 shader 的vs 部分code
     */
    // abstract getCodeVS(): any

    /**
     * 输出顶点信息
     */
    // abstract getAttribute(): I_vsAttributes[]
    // abstract getIndeices(): indexBuffer | boolean
    // abstract getDrawCount(): number

    isDestroy() {
        return this._destroy;
    }
    /**
 * 创建线框数据结构
 */
    createWrieFrame() {
        const list: { [name: string]: number[] } = {};
        if (this.buffer.indeices.length == 0) {
            let i_index = 0;
            for (let i = 0; i < this.buffer.position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {
            for (let i = 0; i < this.buffer.indeices.length; i += 3) {
                const A = this.buffer.indeices[i];
                const B = this.buffer.indeices[i + 1];
                const C = this.buffer.indeices[i + 2];
                const AB = [A, B].sort().toString();
                const BC = [B, C].sort().toString();
                const CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        const indeices: number[] = [];
        for (const i in list) {
            indeices.push(list[i][0], list[i][1]);
        }
        const output: I_geometryWireFrameAttribute = {
            indeices: indeices
        };
        this.wireFrame = output;
    }
    /**
     * 返回线框索引
     * @returns indexBuffer 结构
     */
    getWireFrameIndeices(): number[] {
        return this.wireFrame.indeices;
    }
    /**
     * 返回线框索引绘制的数量
     * @returns number
     */
    getWireFrameDrawCount(): number {
        if (this.wireFrame.indeices.length == 0) {
            return this.buffer.position.length / 3;
        }
        return this.wireFrame.indeices.length;
    }
    /***
     * 返回顶点属性，索引模式
     */
    getWireFrame(): number[] {
        return this.buffer.position;
    }
    /**
     * 返回片面的索引模式的绘制数量
     * @returns number
     */
    getDrawCount(): number {
        if (this.buffer.indeices.length == 0) {
            return this.buffer.position.length / 3;
        }
        return this.buffer.indeices.length;
    }
    // /**
    //  * 获取线框shaderCode
    //  * @param _color 线框颜色
    //  * @returns shader code
    //  */
    // getWireFrameShdaerCodeVS(_color: color4): string {
    //     let code = framelineVS;
    //     return code;
    // }

    // /**
    //  * todo：20241129，
    //  * 1、后期使用线材质，或线框材质，或shader线框，代替；
    //  * 2、这个目前这个目前没有输出entityID，输出的是0
    //  * 
    //  * 线框的FS
    //  * @param color 
    //  * @returns 
    //  */
    // getWireFrameShdaerCodeFS(color: color4): string {
    //     let red = color[0];
    //     let green = color[1];
    //     let blue = color[2];
    //     let alpha = color[3];
    //     let code = framelineFS;
    //     code = code.replace("$red", red.toString());
    //     code = code.replace("$blue", blue.toString());
    //     code = code.replace("$green", green.toString());
    //     code = code.replace("$alpha", alpha.toString());
    //     return code;
    // }

    /**      返回片面的索引数据跟上     */
    getIndeices() {
        return this.buffer.indeices;
    }

    /** 输出顶点信息    */
    getAttribute(): I_GeometryAttributeGroup {
        if(this.buffer.color.length==0){
            // this.buffer.color = this.generateColorArray(this.buffer.position.length /3);
            this.buffer.color=new Array(this.buffer.position.length).fill(0.6);
        }
        return {
            position: this.buffer.position,
            normal: this.buffer.normal,
            color: this.buffer.color,
            uv: this.buffer.uv,
            // indeices: this.buffer.indeices,
            // materialStep: this.buffer.materialStep
        };
    }
    generateColorArray(length: number, color : weColor3 = [1, 1, 1]) {
        if (this.input.color) {
            color = this.input.color;
        }
        const colorsArray = [];
        for (let i = 0; i < length; i++) {
            colorsArray.push(color[0], color[1], color[2]);
        }
        return colorsArray;
    }
    destroy() {
        this._destroy = true;
        this.buffer = {
            position: [],
            normal: [],
            uv: [],
            color: [],
            indeices: [],
            materialStep: []
        }
    }
    getReady() {
        if (this._already) {
            return true;
        }
        else {
            return false;
        }
    }
}