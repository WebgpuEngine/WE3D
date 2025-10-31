import { mat4, Mat4, vec3, Vec3, vec4 } from "wgpu-matrix";
import { E_lightType, I_optionBaseLight } from "./baseLight";
import { BaseLight } from "./baseLight";
import { Scene } from "../scene/scene";
import { weVec3 } from "../base/coreDefine";



export interface IV_SpotLight extends I_optionBaseLight {
    position: weVec3,
    /**光的强度 ,wgsl，不受距离与立体角影响
     * 默认=1.0
    */
    intensity?: number,
    /**
     * 1、isLookat=false时， direction 是方向，
     * 2、isLookat=true时，  direction是lookat的位置，方向计算是direction-position
     */
    direction: weVec3,
    /**
     * direction 是方向还是lookAt
     * 如果是lookAt，direction 是lookAt的位置，否则是方向
     * 默认是lookat ，=true
     */
    isLookAt?: boolean,
    /**弧度制 */
    angle: number,
    /**弧度制 */
    angleOut?: number,//todo
}

export class SpotLight extends BaseLight {
    async readyForGPU(): Promise<any> {
    }
    _destroy(): void {
        throw new Error("Method not implemented.");
    }
    saveJSON() {
        throw new Error("Method not implemented.");
    }
    loadJSON(json: any): void {
        throw new Error("Method not implemented.");
    }
    declare inputValues: IV_SpotLight;
    constructor(input: IV_SpotLight) {

        super(input, E_lightType.spot);
        this.inputValues = input;
        if (this.inputValues.isLookAt === undefined || this.inputValues.isLookAt === true) {
            this.Direction = vec3.normalize(vec3.sub(this.inputValues.direction, this.worldPosition));
        }
    }

    // generateShadowMap(_device: GPUDevice): shadowMap {
    //     throw new Error("Method not implemented.");
    // }

    updateMVP(scene: Scene): Mat4[] {
        // throw new Error("Method not implemented.");
        //1、cameras的boundingSphere
        //2、light的boundingSphere
        //3、取两个boundingSphere的交集
        //4、取交集的boundingSphere的中心点
        //5、取交集的boundingSphere的半径
        //6、取中心点+半径为光源的位置
        //7、取中心点为光源的方向
        //8、取半径为光源的范围

        let matrix = new Float32Array([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ]);

        if (this.Shadow) {

            // const box3 = scene.getBoundingBox();//
            const spshere = scene.getBoundingSphere();

            if (spshere) {
                let projectionMatrix;
                // if (this.inputValues.isLookAt === undefined || this.inputValues.isLookAt === true) {
                // //lookat                  
                // //   let m4 = mat4.lookAt(this.worldPosition, vec3.add(this.worldPosition, this.inputValues.direction!), vec3.create(0, 1, 0));//正交的测试
                // matrix = mat4.lookAt(vec3.fromValues(this.worldPosition,...this.inputValues.direction),  vec3.create(0, 1, 0));//正交的测试

                // let matrixModel = new Float32Array([
                //     1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
                // ]);
                // mat4.setTranslation(matrixModel, this.worldPosition, matrixModel);
                // matrix = mat4.multiply(matrix, matrixModel);
                // }
                // else {
                //direction
                // let modelMatrix = new Float32Array([
                //     1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
                // ]);;
                // let position = new Float32Array(modelMatrix.buffer, 4 * 12, 4);
                // vec3.copy(this.inputValues.position!, position);

                /** 第一行,X轴 */
                let right = new Float32Array(matrix.buffer, 4 * 0, 4);
                /** 第二行,Y轴 */
                let up = new Float32Array(matrix.buffer, 4 * 4, 4);
                /** 第三行,Z轴 */
                let back = new Float32Array(matrix.buffer, 4 * 8, 4);
                /** 第四行,位置 */
                let position = new Float32Array(matrix.buffer, 4 * 12, 4);
                vec3.copy(this.worldPosition, position);
                // 
                // vec3.copy(vec3.create(-3,-3,-3), position);

                //+Z
                //摄像机是position-lookat,光的摄像机方向是（0，0，0）-direction，就是光源的照射来的方向（spot的光源的反方向，+Z）。
                let dir = vec3.normalize(vec3.sub(vec3.create(0, 0, 0), this.inputValues.direction!));
                //方向在世界坐标系的+轴
                if (this.inputValues.direction![0] == 0 && this.inputValues.direction![1] == 1 && this.inputValues.direction![2] == 0) {
                    vec3.copy(dir, back);
                    vec3.copy(vec3.create(1, 0, 0), right);
                    vec3.copy(vec3.create(0, 0, 1), up);
                }
                //方向在世界坐标系的-Y轴
                else if (this.inputValues.direction![0] == 0 && this.inputValues.direction![1] == -1 && this.inputValues.direction![2] == 0) {
                    vec3.copy(dir, back);
                    vec3.copy(vec3.create(1, 0, 0), right);
                    vec3.copy(vec3.create(0, 0, -1), up);
                }
                else {
                    if (this.inputValues.isLookAt === undefined || this.inputValues.isLookAt === true) {
                        //这个方向是shader中使用的（位置-->光源，即-Z），需要与shader保持一致
                        //之所以时-Z，同camera的视线方向
                        if (this.inputValues.isLookAt == true)//都是用这个是可以的，为了理解方便，分成两个
                            this.Direction = vec3.normalize(vec3.sub(this.inputValues.direction, this.worldPosition));//lookat方向=lookat-position
                        else
                            this.Direction = vec3.normalize(this.inputValues.direction);//固定的位置与方向，也是-Z

                        vec3.copy(vec3.normalize(vec3.sub(this.worldPosition, this.inputValues.direction)), back);//正Z轴方向
                        // console.log('lookAt', vec3.normalize(this.Direction));
                    }
                    else {
                        vec3.copy(vec3.normalize(dir), back);
                        // console.log('lookAt', vec3.normalize(dir));

                    }
                    vec3.copy(vec3.normalize(vec3.cross(up, back)), right);
                    vec3.copy(vec3.normalize(vec3.cross(back, right)), up);
                }


                // let p0 = vec4.transformMat4(vec4.create(spshere.position[0], spshere.position[1], spshere.position[2], 1), mat4.invert(matrix));
                // const projectionMatrix = mat4.ortho(p0[0] - spshere.radius - this.epsilon, p0[0] + spshere.radius + this.epsilon, p0[1] - spshere.radius - this.epsilon, p0[1] + spshere.radius + this.epsilon, p0[2] - spshere.radius - this.epsilon, p0[2] + spshere.radius*2 + this.epsilon);

                //  projectionMatrix = mat4.perspective(this.inputValues.angleOut! * 2.1, 1, 0.51, p0[2] + spshere.radius * 2 + this.epsilon);//todo,分析：near ,需要大于0.5，否则会被裁掉
                // const projectionMatrix = mat4.perspective(this.inputValues.angleOut! * 2, 1, 0.1, 30);//ok,test

                // }
                //p0 sphere 原点
                let p0 = vec4.transformMat4(vec4.create(spshere.position[0], spshere.position[1], spshere.position[2], 1), mat4.invert(matrix));
                projectionMatrix = mat4.perspective(this.inputValues.angleOut! * 2.1, 1, 0.25, p0[2] + spshere.radius * 2 + this.epsilon);//todo,分析：near ,需要大于0.5，否则会被裁掉
                const MVP = mat4.multiply(projectionMatrix, mat4.invert(matrix));
                // const MVP = mat4.multiply(projectionMatrix, matrix);
                return [MVP];
            }
        }

        return [matrix];

    }


}