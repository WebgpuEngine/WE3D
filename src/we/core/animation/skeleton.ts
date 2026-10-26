import { mat4, Mat4 } from "wgpu-matrix";
import { NodeObject } from "../organization/nodeObject";
import { Clock } from "../scene/clock";

export interface IV_Skeleton {
    joints: NodeObject[];
    jointsMatrices: Float32Array | Mat4[];
}

export class Skeleton {

    /** 骨骼节点数量 */
    count: number = 0;
    /** 骨骼节点 ，必须与inverseBindMatrices顺序与数量一致 */
    joints: NodeObject[] = [];

    /** 骨骼节点逆绑定矩阵 */
    inverseBindMatrices: Mat4[] = [];
    /** 骨骼节点变换矩阵 arraybuffer */
    _jointsMat: Float32Array | undefined;

    output: ArrayBuffer | undefined;
    outputMatrices: Mat4[] = [];

    constructor(values?: IV_Skeleton) {
        if (values) {
            if (Array.isArray(values.jointsMatrices)) {
                this._jointsMat = new Float32Array(values.jointsMatrices.length * 4 * 16);
                for (let i = 0; i < values.joints.length; ++i) {
                    this.inverseBindMatrices.push(new Float32Array(this._jointsMat.buffer, this._jointsMat.byteOffset + i * 4 * 16, 16));
                    mat4.copy(values.jointsMatrices[i], this.inverseBindMatrices[i]);
                }
            }
            else if (values.jointsMatrices instanceof Float32Array) {
                this._jointsMat = values.jointsMatrices;
                for (let i = 0; i < values.joints.length; ++i) {
                    this.inverseBindMatrices.push(new Float32Array(this._jointsMat.buffer, this._jointsMat.byteOffset + i * 4 * 16, 16));
                }
            }
            if (values.joints) {
                this.joints = values.joints;
                this.count = values.joints.length;
            }
            else {
                throw new Error("Skeleton: joints is undefined");
            }
            if (values.joints.length != this.inverseBindMatrices.length) {
                throw new Error("Skeleton: joints length is not equal to inverseBindMatrices length");
            }

            this.output = new ArrayBuffer(values.joints.length * 4 * 16);
            for (let i = 0; i < values.joints.length; ++i) {
                this.outputMatrices.push(new Float32Array(this.output, i * 4 * 16, 16));
            }
        }
    }
    destroy() {
        this.output = undefined;
        this.outputMatrices = [];
        this.inverseBindMatrices = [];
        this._jointsMat = undefined;
    }
    check() {
        if (this.output == undefined || this.outputMatrices.length != this.joints.length) {
            this.output = new ArrayBuffer(this.joints.length * 16);
            for (let i = 0; i < this.joints.length; ++i) {
                this.outputMatrices.push(new Float32Array(this.output, i * 4 * 16, 16));
            }
        }
    }
    // addJoint(joint: NodeObject) {
    //     this.joints.push(joint);
    // }
    // addInverseBindMatrix(matrix: Mat4) {
    //     this.inverseBindMatrices.push(matrix);
    // }
    // add(joint: NodeObject, matrix: Mat4) {
    //     this.addJoint(joint);
    //     this.addInverseBindMatrix(matrix);
    //     this.count = this.joints.length;
    // }
    setJointsMatricesForBuffer(jointsMatrices: Float32Array) {
        this._jointsMat = jointsMatrices;
    }
    setInverseBindMatrices(matrices: Mat4[]) {
        this.count = matrices.length;
        this.inverseBindMatrices = matrices;
    }
    setJoints(joints: NodeObject[]) {
        this.count = joints.length;
        this.joints = joints;
    }
    /** 生成骨骼节点逆绑定矩阵 
     * 1、骨骼节点逆绑定矩阵=骨骼节点初始世界矩阵的逆
     * 2、世界矩阵需要至少更新过一次
    */
    generateInverseBindMatrices() {
        this.inverseBindMatrices = this.joints.map((joint) => {
            return mat4.inverse(joint.matrixWorld);
        });
    }
    update(_clock: Clock) {
        this.check();
        for (const i in this.joints) {
            const perJoint = this.joints[i];
            mat4.multiply(perJoint.matrixWorld, this.inverseBindMatrices[i], this.outputMatrices[i]);

        }
    }
}