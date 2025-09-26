import { mat4, vec4, Vec4 } from 'wgpu-matrix';


import { BaseCamera, projectionOptions } from "./baseCamera"
import { Clock } from '../scene/clock';
import { computeAABB } from '../math/Box';
import { computeBoundingSphere, generateSphereFromBox3 } from '../math/sphere';

/** 透视相机 */
export interface optionPerspProjection extends projectionOptions {
    /**The camera angle from top to bottom (in radians). */
    fov: number,
    aspect: number,
    filmGauge?: number,
    filmOffset?: number,
    focus?: number,
    zoom?: number
}

export class PerspectiveCamera extends BaseCamera {
    destroy(): void {
        throw new Error('Method not implemented.');
    }
    saveJSON() {
        throw new Error('Method not implemented.');
    }
    loadJSON(json: any): void {
        throw new Error('Method not implemented.');
    }

    declare inpuValues: optionPerspProjection
    /**
     * 
     * @param option:optionPerspProjection
     */
    constructor(option: optionPerspProjection) {
        super(option);
        this.inpuValues = option;
    }

    /**
     * 更新摄像机矩阵（三个，M，V，P）
     * @param position ：摄像机位置
     * @param direction ：摄像机方向
     * @param normalize ：摄像机方向是否归一化的
     * @returns  MVP的Mat4[]
     */
    // update(position: Vec3, direction: Vec3, normalize = false): Mat4[] {
    //     this.position = position;
    //     if (normalize === false) {
    //         vec3.normalize(vec3.subtract(position, direction, this.back));
    //     }
    //     else {
    //         this.back = direction;
    //     }
    //     this.right = vec3.normalize(vec3.cross(this.up, this.back));
    //     this.up = vec3.normalize(vec3.cross(this.back, this.right));

    //     // console.log("projectionMatrix=", this.projectionMatrix)

    //     this.MVP = [mat4.invert(this.modelMatrix), mat4.invert(this.viewMatrix), this.projectionMatrix];
    //     // let mv = mat4.multiply(this.viewMatrix, this.modelMatrix,);
    //     // // console.log("M*V=", mv, "M*V的invert=", mat4.invert(mv))

    //     // let mv1 = mat4.multiply(mat4.invert(this.viewMatrix), mat4.invert(this.modelMatrix),);
    //     // // console.log("M.invert * V.invert=", mv1)

    //     // let mvp = mat4.multiply(this.projectionMatrix, mat4.invert(mv));
    //     // // console.log(mat4.invert(mv), mvp)

    //     return this.MVP;
    // }

    /**
     * 更新透视相机的投影矩阵
     * @param option 透视相机的初始化参数
     */
    updateProjectionMatrix() {
        let aspect = this.scene.aspect;
        this.inpuValues.aspect = aspect;

        this.projectionMatrix = mat4.perspective(this.inpuValues.fov, aspect, this.inpuValues.near, this.inpuValues.far);
        // console.log(this.projectionMatrix)
        this.updateBoundingBox();
    }

    set aspect(aspect: number) { (this.inpuValues as optionPerspProjection).aspect = aspect }
    get aspect() { return (this.inpuValues as optionPerspProjection).aspect }
    updateBoundingBox(): void {
        let nearHeight = 2 * this.inpuValues.near * Math.tan(this.inpuValues.fov / 2);
        let nearWidth = nearHeight * this.inpuValues.aspect;
        let farHeight = 2 * this.inpuValues.far * Math.tan(this.inpuValues.fov / 2);
        let farWidth = farHeight * this.inpuValues.aspect;
        let positions: Vec4[] = [
            vec4.fromValues(-nearWidth / 2, -nearHeight / 2, this.inpuValues.near, 1),
            vec4.fromValues(nearWidth / 2, -nearHeight / 2, this.inpuValues.near, 1),
            vec4.fromValues(nearWidth / 2, nearHeight / 2, this.inpuValues.near, 1),
            vec4.fromValues(-nearWidth / 2, nearHeight / 2, this.inpuValues.near, 1),

            vec4.fromValues(-farWidth / 2, -farHeight / 2, this.inpuValues.far, 1),
            vec4.fromValues(farWidth / 2, -farHeight / 2, this.inpuValues.far, 1),
            vec4.fromValues(-farWidth / 2, farHeight / 2, this.inpuValues.far, 1),
            vec4.fromValues(farWidth / 2, farHeight / 2, this.inpuValues.far, 1),
        ];

        for (let i of positions) {
            i = vec4.transformMat4(i,  this.modelMatrix);
            i = vec4.transformMat4(i,  this.viewMatrix);
        }
        let positionsForAABB: [number, number, number][] = []
        for (let i of positions) {
            positionsForAABB.push([i[0], i[1], i[2]]);
        }
        this.boundingBox = computeAABB(positionsForAABB);
        // this.boundingSphere = computeBoundingSphere(positionsForAABB);
        this.boundingSphere = generateSphereFromBox3(this.boundingBox );
    }
}