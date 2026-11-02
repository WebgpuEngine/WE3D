import { mat4, vec4, Vec4 } from 'wgpu-matrix';

import { BaseCamera, I_BaseCameraValue } from './baseCamera';
import { computeAABB } from '../math/Box';
import { generateSphereFromBox3 } from '../math/sphere';

/** 透视相机 */
export interface IV_PerspectiveCamera extends I_BaseCameraValue {
    /**The camera angle from top to bottom (in radians). */
    fov: number;
    aspect: number;
    filmGauge?: number;
    filmOffset?: number;
    focus?: number;
    zoom?: number;
}

export class PerspectiveCamera extends BaseCamera {
    _destroy(): void {
        throw new Error('Method not implemented.');
    }
    saveJSON() {
        throw new Error('Method not implemented.');
    }
    loadJSON(_json: any): void {
        throw new Error('Method not implemented.');
    }

    declare inpuValues: IV_PerspectiveCamera;
    /**
     *
     * @param option:IV_PerspectiveCamera
     */
    constructor(option: IV_PerspectiveCamera) {
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
        const aspect = this.scene.aspect;
        this.inpuValues.aspect = aspect;

        this.projectionMatrix = mat4.perspective(
            this.inpuValues.fov,
            aspect,
            this.inpuValues.near,
            this.inpuValues.far,
        );
        if (this.scene.reversedZ.isReversedZ) {
            const reversedZ = mat4.create(
                1.0,
                0.0,
                0.0,
                0.0,
                0.0,
                1.0,
                0.0,
                0.0,
                0.0,
                0.0,
                -1.0,
                0.0,
                0.0,
                0.0,
                1.0,
                1.0,
            );
            this.projectionMatrix = mat4.multiply(reversedZ, this.projectionMatrix);
        } // console.log(this.projectionMatrix)
        this.updateBoundingBox();
    }

    updateBoundingBox(): void {
        const nearHeight = 2 * this.inpuValues.near * Math.tan(this.inpuValues.fov / 2);
        const nearWidth = nearHeight * this.inpuValues.aspect;
        const farHeight = 2 * this.inpuValues.far * Math.tan(this.inpuValues.fov / 2);
        const farWidth = farHeight * this.inpuValues.aspect;
        const positions: Vec4[] = [
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
            i = vec4.transformMat4(i, this.modelMatrix);
            i = vec4.transformMat4(i, this.viewMatrix);
        }
        const positionsForAABB: [number, number, number][] = [];
        for (const i of positions) {
            positionsForAABB.push([i[0], i[1], i[2]]);
        }
        this.boundingBox = computeAABB(positionsForAABB);
        // this.boundingSphere = computeBoundingSphere(positionsForAABB);
        this.boundingSphere = generateSphereFromBox3(this.boundingBox);
    }
    getfov() {
        return this.inpuValues.fov;
    }
}
