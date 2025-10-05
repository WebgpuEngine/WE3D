import { weVec3 } from "../base/coreDefine";
import { Scene } from "../scene/scene";
import { BaseLight, E_lightType, I_optionBaseLight } from "./baseLight";
import { mat4, Mat4, vec3, Vec3, vec4 } from "wgpu-matrix";

export interface IV_DirectionalLight extends I_optionBaseLight {
    // color: coreConst.color3F,
    /**光的强度 ,wgsl，不受距离与立体角影响
     * 默认=1.0
    */
    intensity: number,
    direction: weVec3,
    distance?: 0,
}


export class DirectionalLight extends BaseLight {
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
    /**
     * 更新以光源为视点的MVP
     * @param scene 
     * @returns Mat4[]
     */
    updateMVP(scene: Scene): Mat4[] {
        let matrix = new Float32Array([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ]);

        if (this.Shadow) {

            // const box3 = scene.getBoundingBox();//
            const sphere = scene.getBoundingSphere();
            // const sphere ={
            //     position: [0,0,0],
            //     radius: 8,
            // }

            if (sphere) {
                /** 第一行,X轴 */
                let right = new Float32Array(matrix.buffer, 4 * 0, 4);
                /** 第二行,Y轴 */
                let up = new Float32Array(matrix.buffer, 4 * 4, 4);
                /** 第三行,Z轴 */
                let back = new Float32Array(matrix.buffer, 4 * 8, 4);
                /** 第四行,位置 */
                let position = new Float32Array(matrix.buffer, 4 * 12, 4);

                let dir = vec3.normalize(vec3.sub(vec3.create(0, 0, 0), this.Direction as Vec3));
                if ((this.Direction as Vec3)[0] == 0 && (this.Direction as Vec3)[1] == 1 && (this.Direction as Vec3)[2] == 0) {
                    vec3.copy((this.Direction as Vec3), back);
                    vec3.copy(vec3.create(1, 0, 0), right);
                    vec3.copy(vec3.create(0, 0, 1), up);
                }
                else {
                    // vec3.copy(vec3.normalize(dir), back);
                    vec3.copy(vec3.normalize((this.Direction as Vec3)), back);
                    vec3.copy(vec3.normalize(vec3.cross(up, back)), right);
                    vec3.copy(vec3.normalize(vec3.cross(back, right)), up);
                }

                //todo,202501024,暂时使用sphere代替摄像机的视锥体可视范围
                let p0 = vec4.transformMat4(vec4.create(sphere.position[0], sphere.position[1], sphere.position[2], 1), mat4.invert(matrix));



                //todo,20250124,四至这里目前先简单的写成固定的sphere
                //todo，后期改为视锥体中所有boundingbox的聚会的boudingbox或boudingsphere
                const projectionMatrix = mat4.ortho(
                    p0[0] - sphere.radius - this.epsilon,
                    p0[0] + sphere.radius + this.epsilon,

                    p0[1] - sphere.radius - this.epsilon,
                    p0[1] + sphere.radius + this.epsilon,

                    p0[2] - sphere.radius - this.epsilon,
                    p0[2] + sphere.radius + this.epsilon
                );


                //todo,20250114,四至与box3的关系随方向光的vec3而变化，这里目前先简单的写成固定的box3
                //  const projectionMatrix = mat4.ortho(-10, 10, -10, 10, -10, 10);//ok
                const MVP = mat4.multiply(projectionMatrix, mat4.invert(matrix));
                return [MVP];
            }
        }

        return [matrix];

    }
    constructor(input: IV_DirectionalLight) {
        super(input, E_lightType.direction);

    }




}