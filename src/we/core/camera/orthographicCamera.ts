import {
    mat4,
    vec4,
    Vec4,
} from 'wgpu-matrix';


import { BaseCamera, I_BaseCameraValue } from "./baseCamera";
import { computeAABB } from '../math/Box';
import { generateSphereFromBox3 } from '../math/sphere';

export interface IV_OrthographicCamera extends I_BaseCameraValue {
    left: number,
    right: number,
    top: number,
    bottom: number,

}

export class OrthographicCamera extends BaseCamera {
    _destroy(): void {
        throw new Error('Method not implemented.');
    }
    saveJSON() {
        throw new Error('Method not implemented.');
    }
    loadJSON(_json: any): void {
        throw new Error('Method not implemented.');
    }

    declare inpuValues: IV_OrthographicCamera;
    constructor(option: IV_OrthographicCamera) {
        super(option);
        this.inpuValues = option;
    }

    updateProjectionMatrix() {
        this.aspect = this.scene.aspect;
        // let baseViewW = this.inpuValues.right - this.inpuValues.left;
        const baseViewH = this.inpuValues.top - this.inpuValues.bottom;
        // let centerX = (this.inpuValues.right + this.inpuValues.left) / 2;
        const centerY = (this.inpuValues.top + this.inpuValues.bottom) / 2;

        const top = centerY + baseViewH / this.aspect / 2;
        const bottom = centerY - baseViewH / this.aspect / 2;
        // let right = centerX + baseViewW / 2;
        // let left = centerX - baseViewW / 2;
        // let near = this.inpuValues.near;
        // let far = this.inpuValues.far;
        this.projectionMatrix = mat4.ortho(this.inpuValues.left, this.inpuValues.right, bottom, top, this.inpuValues.near, this.inpuValues.far);
        if (this.scene.reversedZ.isReversedZ) {
            const reversedZ = mat4.create(
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, -1.0, 0.0,
                0.0, 0.0, 1.0, 1.0
            )
            this.projectionMatrix = mat4.multiply(reversedZ, this.projectionMatrix);
        }
        // console.log(this.projectionMatrix)
        this.updateBoundingBox();

    }
    updateBoundingBox(): void {
        const baseViewH = this.inpuValues.top - this.inpuValues.bottom;
        const baseViewW = this.inpuValues.right - this.inpuValues.left;

        const centerX = (this.inpuValues.right + this.inpuValues.left) / 2;
        const centerY = (this.inpuValues.top + this.inpuValues.bottom) / 2;

        const top = centerY + baseViewH / this.aspect / 2;
        const bottom = centerY - baseViewH / this.aspect / 2;
        const right = centerX + baseViewW / 2;
        const left = centerX - baseViewW / 2;
        const positions: Vec4[] = [
            vec4.fromValues(left, bottom, this.inpuValues.near, 1),
            vec4.fromValues(right, bottom, this.inpuValues.near, 1),
            vec4.fromValues(right, top, this.inpuValues.near, 1),
            vec4.fromValues(left, top, this.inpuValues.near, 1),

            vec4.fromValues(left, bottom, this.inpuValues.far, 1),
            vec4.fromValues(right, bottom, this.inpuValues.far, 1),
            vec4.fromValues(left, top, this.inpuValues.far, 1),
            vec4.fromValues(right, top, this.inpuValues.far, 1),
        ];

        for (let i of positions) {
            i = vec4.transformMat4(i, this.modelMatrix);
            i = vec4.transformMat4(i, this.viewMatrix);
        }
        const positionsForAABB: [number, number, number][] = []
        for (const i of positions) {
            positionsForAABB.push([i[0], i[1], i[2]]);
        }
        this.boundingBox = computeAABB(positionsForAABB);
        // this.boundingSphere = computeBoundingSphere(positionsForAABB);
        this.boundingSphere = generateSphereFromBox3(this.boundingBox);
    }

}