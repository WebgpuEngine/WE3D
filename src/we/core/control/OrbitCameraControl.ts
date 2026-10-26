import {   vec3 } from "wgpu-matrix";
import { InputManager } from "../input/inputManager";
import { ArcballCameraControl } from "./arcballCameraControl";
import {  IV_CamreaControl } from "./cameracControl";
import * as MathFun from "../math/baseFunction"


export interface IV_OrbitCameraControl extends IV_CamreaControl {
    /** 坐标系向上轴（默认轴）方向的角度范围 
     * 1、默认：
    */
    upAxisAngle?: {
        top?: number,
        bottom?: number,
    }
}

export class OrbitCameraControl extends ArcballCameraControl {
    declare inputValues: IV_OrbitCameraControl;
    upAxisAngle = {
        top: Math.PI / 2,
        bottom: -Math.PI / 2,
    };
    constructor(option: IV_CamreaControl, manager: InputManager) {
        super(option, manager);
        this.type = "orbit";
        this.inputValues = option;
        if (this.inputValues.upAxisAngle) {
            if (this.inputValues.upAxisAngle.top !== undefined && this.inputValues.upAxisAngle.top <= this.upAxisAngle.top) {
                this.upAxisAngle.top = this.inputValues.upAxisAngle.top;
            }
            if (this.inputValues.upAxisAngle.bottom !== undefined && this.inputValues.upAxisAngle.bottom >= this.upAxisAngle.bottom) {
                this.upAxisAngle.bottom = this.inputValues.upAxisAngle.bottom;
            }
        }
        // this.rotationSpeed = 0.5;

    }
    init() {
    }


    update(_deltaTime: number): boolean {
        if (this.upAxisAngle.bottom > this.upAxisAngle.top) {
            throw new Error("top角度必须小于bottom角度");
        }
        /**
         * 没有使用欧拉角，而是使用arcball旋转方法进行了扩展。
         * 1、上方向轴的角度范围判断，采用arcball的方法先进行计算，然后计算camera与lookat的向量，然后与上方向向量进行点积，判断是否在范围内。
         * 2、负方向相同方法；
         * 3、const epsilon = 0.000001; epsilon是为了避免浮点数精度问题，导致判断错误。
         * 4、判断到达极点（top，bottom）（camera.back dot +-Y）。
         *      A、需要将两个三维向量转为共平面的二维向量，其中上方向为X轴。
         *      B、可以后边，不能前进。
         *      C、计算下一步在camera.back与+-Y的cross，
         *              a、正，是向前旋转，拒绝，保持camera不变
         *              b、负，是向后旋转，许可
         */
        if (typeof this.camera !== 'boolean') {
            //一、通用数据
            const input = this.getInputValue();
            let position = vec3.subtract(this.camera.worldPosition, this.camera.LookAt);
            //1.1、计算当前距离，旋转距离不变
            this.distance = vec3.distance(this.camera.PositionOfModelMatrix, this.camera.LookAt);
            const oldDistance = this.distance;
            //阈值，for 旋转角 & 旋转轴
            const epsilon = 0.0000001;

            //二、判断是否有鼠标操作
            if (this.eventValues.mouseValue.downOrUP == "down") {
                //2.1、鼠标左键（主键）
                if (this.eventValues.mouseValue.buttons == 1) {

                    const pointOfPlaneZ = vec3.normalize(position);//将position向量归一化，得到相机Z轴的单位向量。

                    const radianX = -input.analog.x * this.rotationSpeed / 180 * Math.PI;
                    const radianY = -input.analog.y * this.rotationSpeed / 180 * Math.PI;
                    if (Math.abs(radianX) < epsilon && Math.abs(radianY) < epsilon) {
                        return false;
                    }
                    // console.log("radianX", radianX, "radianY", radianY);

                    const upDotCameraZ = vec3.dot(this.camera.UpDirection, pointOfPlaneZ);//两个向量的点积，判断相机的上方向是否与Z轴平行，cos值，范围[-1,1]。
                    // console.log("upDotCameraZ", upDotCameraZ, "radianY", radianY, "radianX", radianX);

                    //2.1.1 判断北极：camera的Z轴是否与upY轴平行
                    if (Math.abs((this.upAxisAngle.top - Math.PI / 2)) < this.epsilon && upDotCameraZ > 0.9999) {
                        if (radianY > 0) {
                            const x = vec3.transformMat3(this.camera.RightOfViewMatrix, this.camera.Parent!.matrixWorld);//将camera.right向量从camera坐标系转换到world坐标系。
                            position = MathFun.rotate(position, x, radianY);
                        }
                        else if (Math.abs(radianX) > epsilon) {
                            /** *********************************** */
                            //旋转camera.right向量和camera.up向量
                            const right = MathFun.rotate(this.camera.RightOfViewMatrix, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转camera.right向量。
                            vec3.normalize(right, this.camera.RightOfViewMatrix);                                       //归一化right向量，保持其长度为1。
                            vec3.normalize(vec3.cross(this.camera.BackOfViewMatrix, this.camera.RightOfViewMatrix), this.camera.UpOfViewMatrix);    //计算新的up向量，保持与right向量垂直。
                        }
                    }
                    //2.1.2 判断南极：camera的Z轴是否与upY轴平行
                    else if (Math.abs((this.upAxisAngle.bottom - (-Math.PI / 2))) < this.epsilon && upDotCameraZ < -0.9999) {
                        if (radianY < 0) {
                            const x = vec3.transformMat3(this.camera.RightOfViewMatrix, this.camera.Parent!.matrixWorld);
                            position = MathFun.rotate(position, x, radianY);
                        }
                        else if (radianX != 0) {
                            //
                            const right = MathFun.rotate(this.camera.RightOfViewMatrix, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转camera.right向量。
                            vec3.normalize(right, this.camera.RightOfViewMatrix);                                       //归一化right向量，保持其长度为1。
                            vec3.normalize(vec3.cross(this.camera.BackOfViewMatrix, this.camera.RightOfViewMatrix), this.camera.UpOfViewMatrix);    //计算新的up向量，保持与right向量垂直。
                        }
                    }
                    //2.1.3 其他情况：camera的Z轴与upY轴不平行
                    else {
                        const sinCosCameraZ = this.computeSinAndCosOfUpDirectionAndX0z(position);//sin  cos 

                        //2.1.3.1 判断当前角度+增量是否超出范围（正负90度）
                        const rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneZ));       //camera Z轴对应的X轴，非lookat的X轴【原始相等】
                        const positionOutOfRange = MathFun.rotate(position, rotateAxisX, radianY);                    //旋转后的临时camera位置
                        const axixYTemp = vec3.create(0, 1, 0);
                        const leftOrRight = this.computeSinOfUpDirectionAndPosition(axixYTemp, positionOutOfRange);   //判断camera是否在upY轴的左侧或右侧。
                        if (leftOrRight > 0) {                                                                      //camera在upY轴的左侧，已经过头了
                            if (sinCosCameraZ.sin >= 0) {                                                           //上半球
                                position = vec3.create(0, this.distance, 0);                                        //北极点
                                position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);                 //可以旋转Y轴
                            }
                            else {                                                                                  //下半球
                                position = vec3.create(0, -this.distance, 0);                                       //南极点
                                position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);                 //可以旋转Y轴
                            }
                        }
                        //2.1.3.2 当前角度+增量，未超出范围（正负90度）
                        else {
                            // console.log("sinCosCameraZ:", sinCosCameraZ,"position:",position);
                            // console.log("upDotCameraZ:", upDotCameraZ);

                            {//(一）、计算旋转x和y轴的角度后的position
                                const limit = 0.991;
                                //1、 sin角度小于极限，上半球，继续进行x 和y 轴旋转。
                                if (upDotCameraZ < limit && sinCosCameraZ.sin >= 0) {
                                    ////绕X轴（为camera Z轴对应的X轴，非lookat的X轴【原始相等】）旋转
                                    // let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneZ));
                                    position = MathFun.rotate(position, rotateAxisX, radianY);
                                    ////绕Y轴（为lookat Y轴）旋转
                                    position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                                }
                                //2、 sin角度大于极限（上半球）时。
                                else if (upDotCameraZ > limit && sinCosCameraZ.sin > 0) {
                                    //鼠标向下移动，radianY增量为负值。
                                    if (radianY > 0) {
                                        const x = vec3.transformMat3(this.camera.RightOfViewMatrix, this.camera.Parent!.matrixWorld);//将camera.right向量从camera坐标系转换到world坐标系。
                                        position = MathFun.rotate(position, x, radianY);                    //绕X轴（为camera Z轴对应的X轴，非lookat的X轴【原始相等】）旋转
                                    }
                                    //否则，只能旋转Y轴（为lookat Y轴）
                                    else {
                                        position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);//绕Y轴（为lookat Y轴）旋转
                                    }
                                }
                                //3、sin角度大于底部极限(都是负值),下半球，继续进行 x 和 y 轴旋转。
                                else if (upDotCameraZ > -limit && sinCosCameraZ.sin < 0) {
                                    // let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneZ));
                                    position = MathFun.rotate(position, rotateAxisX, radianY);
                                    ////绕Y轴（为lookat Y轴）旋转
                                    position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                                }
                                //4、sin角度小于底部极限(都是负值),下半球时。
                                else if (upDotCameraZ < -limit && sinCosCameraZ.sin < 0) {
                                    //鼠标向上移动，radianY增量为正值。
                                    if (radianY < 0) {
                                        // let rotateAxisX = vec3.normalize(vec3.cross(this.camera.UpDirection, pointOfPlaneZ));
                                        position = MathFun.rotate(position, rotateAxisX, radianY);
                                    }
                                    //鼠标向下移动，radianY增量为负值。
                                    else {
                                        position = MathFun.rotate(position, vec3.create(0, 1, 0), radianX);
                                    }
                                }
                                else {
                                    // console.log("position================", position,upDotCameraZ,sinCosCameraZ,radianX,radianY);
                                }
                            }
                            {//（二）、是否超过有设定top和bottom的角度限制，如果超过，重置到限定角度的position
                                const sinOfTop = Math.sin(this.upAxisAngle.top);
                                const sinOfBottom = Math.sin(this.upAxisAngle.bottom);
                                if (sinCosCameraZ.sin > sinOfTop) {//摄像机视角在+Y方向,且已经超过top角度
                                    const vectorOfPlaneXZ = vec3.normalize(vec3.create(position[0], 0, position[2]));//XZ平面的单位向量
                                    const axisOfRotationZ = vec3.cross(vectorOfPlaneXZ, vec3.create(0, 1, 0,));//旋转轴Z, X cross Y = Z;反过来，当中X轴也可以；
                                    const pointOfPlaneXZ = vec3.scale(vectorOfPlaneXZ, this.distance);//XZ平面的单位向量，长度为distance
                                    position = MathFun.rotate(pointOfPlaneXZ, axisOfRotationZ, this.upAxisAngle.top);//作为Z轴，角度不变
                                }
                                else if (sinCosCameraZ.sin < sinOfBottom) {//摄像机视角在+Y方向,且已经超过top角度
                                    // console.log("position", position);
                                    const vectorOfPlaneXZ = vec3.normalize(vec3.create(position[0], 0, position[2]));//XZ平面的单位向量
                                    const axisOfRotationZ = vec3.cross(vectorOfPlaneXZ, vec3.create(0, 1, 0,));//旋转轴Z, X cross Y = Z;反过来，当中X轴也可以；
                                    const pointOfPlaneXZ = vec3.scale(vectorOfPlaneXZ, this.distance);//XZ平面的单位向量，长度为distance

                                    if (this.upAxisAngle.bottom != 0) {
                                        position = MathFun.rotate(pointOfPlaneXZ, axisOfRotationZ, this.upAxisAngle.bottom);//作为Z轴，角度不变
                                    }
                                    else {
                                        position = pointOfPlaneXZ;
                                    }
                                }
                            }
                        }
                    }
                    //2.1.4、更新摄像机的position和lookAt
                    const dir = vec3.normalize(position);
                    const positionOfLookat = vec3.add(position, this.camera.LookAt);//在现有位置上增加lookat位的增量。camera和lookat的坐标系在xyz的三个向量上保持一致，只有position不同（no zoom情况下）。
                    //3.4 更新摄像机的position和lookAt
                    this.camera.updateByPositionDirection(positionOfLookat, dir, true, true);//第二、三个参数，在控制器情况下，不使用，无意义。具体参见camera.updateByPositionDirection
                    // console.log("position", positionOfLookat,dir);
                    return true;
                }
                //2.2、鼠标右键（次键）
                else if (this.eventValues.mouseValue.buttons == 2) {
                    // console.log(this.eventValues.mouseValue.buttons, this.eventValues.mouseValue.downOrUP);
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.RightOfViewMatrix, -input.analog.x * this.rightKeyRate, movement);//X 方向的增量,负号是因为鼠标向右是负方向
                    vec3.addScaled(movement, this.camera.UpOfViewMatrix, input.analog.y * this.rightKeyRate, movement);//Y 方向的增量

                    if (movement[0] || movement[1]) {//如果X或Y方向有增量
                        const position = vec3.copy(this.camera.worldPosition);
                        const localLookat = this.camera.getLocalLookAtVec3();

                        vec3.add(localLookat, movement, localLookat);//lookat 加上增量
                        vec3.add(position, movement, position);//lookat 加上position

                        this.camera.setLookAtFromLocalVec3(localLookat);//更新lookat
                        this.camera.updateByPositionDirection(position, localLookat, false, true);//更新position和lookat
                        return true;
                    }
                }
            }
            //2.3、 zoom，重新计算在dir方向上的摄像机的position的距离。 recalculate `this.position` from `this.back` considering zoom
            else if (input.analog.zoom !== 0) {
                //5.1 计算在dir方向上的摄像机的position的位置
                this.distance *= 1 + input.analog.zoom * this.zoomSpeed;
                //5.2 距离变化了，重新计算position
                if (oldDistance != this.distance) {
                    //5.3 重新计算position
                    position = vec3.add(vec3.scale(this.camera.BackOfViewMatrix, this.distance), this.camera.LookAt);//重新计算位置
                    // console.log("zoom:dir", ...this.camera._back, "position", ...position, "distance", this.distance);
                    this.camera.updateByPositionDirection(position, this.camera.BackOfViewMatrix, true, true);
                    return true;
                }
            }
            // //没有变化的更新。比如：通过程序改变了camera的positio等.这里会出现，如果lookat不是0，0，0的情况下，camera会一直拉远。
            // else {
            //     this.camera.updateByPositionDirection(position, this.camera.back, false);
            //     return true;
            // }
            return false;
        }
        else {
            console.log("arcbalCameraControl's camere didn't defined !,error from update()");
            return false;
        }
    }

}