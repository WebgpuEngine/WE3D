import {
    mat4,
    vec4,
    Vec4,
} from 'wgpu-matrix';


import { BaseCamera, projectionOptions } from "./baseCamera";
import { computeAABB } from '../math/Box';
import { generateSphereFromBox3 } from '../math/sphere';

export interface optionOrthProjection extends projectionOptions {
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
    loadJSON(json: any): void {
        throw new Error('Method not implemented.');
    }

    declare inpuValues: optionOrthProjection;
    constructor(option: optionOrthProjection) {
        super(option);
        this.inpuValues = option;
    }

    updateProjectionMatrix() {
        this.aspect = this.scene.aspect;
        // let baseViewW = this.inpuValues.right - this.inpuValues.left;
        let baseViewH = this.inpuValues.top - this.inpuValues.bottom;
        // let centerX = (this.inpuValues.right + this.inpuValues.left) / 2;
        let centerY = (this.inpuValues.top + this.inpuValues.bottom) / 2;

        let top = centerY + baseViewH / this.aspect / 2;
        let bottom = centerY - baseViewH / this.aspect / 2;
        // let right = centerX + baseViewW / 2;
        // let left = centerX - baseViewW / 2;
        // let near = this.inpuValues.near;
        // let far = this.inpuValues.far;

        this.projectionMatrix = mat4.ortho(this.inpuValues.left, this.inpuValues.right, bottom, top, this.inpuValues.near, this.inpuValues.far);
        // console.log(this.projectionMatrix)
        this.updateBoundingBox();

    }
    updateBoundingBox(): void {
        let baseViewH = this.inpuValues.top - this.inpuValues.bottom;
        let baseViewW = this.inpuValues.right - this.inpuValues.left;

        let centerX = (this.inpuValues.right + this.inpuValues.left) / 2;
        let centerY = (this.inpuValues.top + this.inpuValues.bottom) / 2;

        let top = centerY + baseViewH / this.aspect / 2;
        let bottom = centerY - baseViewH / this.aspect / 2;
        let right = centerX + baseViewW / 2;
        let left = centerX - baseViewW / 2;
        let positions: Vec4[] = [
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
        let positionsForAABB: [number, number, number][] = []
        for (let i of positions) {
            positionsForAABB.push([i[0], i[1], i[2]]);
        }
        this.boundingBox = computeAABB(positionsForAABB);
        // this.boundingSphere = computeBoundingSphere(positionsForAABB);
        this.boundingSphere = generateSphereFromBox3(this.boundingBox);
    }

}