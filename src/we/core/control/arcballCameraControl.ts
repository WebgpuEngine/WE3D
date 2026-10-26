import {
    mat4,
    Vec3, vec3,
} from 'wgpu-matrix';

import { CamreaControl, IV_CamreaControl, } from "./cameracControl"

import * as MathFun from "../math/baseFunction"
import { InputManager } from '../input/inputManager';


/**
 * arcball 控制器
 */
export class ArcballCameraControl extends CamreaControl {

    // The current angular velocity
    angularVelocity = 0;
    distance = 0;
    // Speed multiplier for camera zoom
    zoomSpeed = 0.1;

    /** Rotation velocity drag coeffient [0 .. 1]
     0: Spins forever
     1: Instantly stops spinning
    */
    frictionCoefficient = 0.999;


    // The current rotation axis，旋转轴
    axis_ = vec3.create();

    // Speed multiplier for camera rotation，角度旋转系数
    rotationSpeed = 1;

    epsilon = 0.000001;


    // Returns the rotation axis
    get axis() {
        return this.axis_;
    }
    // Assigns `vec` to the rotation axis
    set axis(vec: Vec3) {
        vec3.copy(vec, this.axis_);
    }

    /** 右键旋转系数 */
    rightKeyRate = 0.01;

    constructor(option: IV_CamreaControl, manager: InputManager) {
        super(option, manager);
        this.type = "arcball";
    }
    // constructor(option: IV_CamreaControl) {
    //     super(option)
    // }
    init() {
        // throw new Error('Method not implemented.');
    }
    /**
     * 更新相机位置，这里更新camera的position和dir 
     * 1、position是在camera的lookat位置为原点的坐标系下的位置
     *      （最后调用camera的updateByPositionDirection()会转化为camera的local坐标系下的位置）
     * 2、direction是在camera的lookat位置为原点的坐标系下的方向向量
     *      A、lookat为原点的坐标系与camera的local坐标系是只有position是不一样的，各自为原点。view空间是一致的，即xyz的分量相对于camera的parent的坐标系一致
     * @param deltaTime 
     * @returns 
     */
    update(deltaTime: number): boolean {
        if (typeof this.camera !== 'boolean') {
            //一、通用数据
            const input = this.getInputValue();
            let position = vec3.copy(this.camera.worldPosition);
            //1.1、计算当前距离，旋转距离不变
            this.distance = vec3.distance(this.camera.PositionOfModelMatrix, this.camera.LookAt);
            const oldDistance = this.distance;
            //阈值，for 旋转角 & 旋转轴
            const epsilon = 0.0000001;

            //二、判断是否有鼠标操作
            if (this.eventValues.mouseValue.downOrUP == "down") {
                //2.1、处理旋转
                if (input.analog.touching) {//拖动
                    // Currently being dragged.//角速度归零
                    this.angularVelocity = 0;
                } else {//衰减角速度
                    // Dampen any existing angular velocity
                    this.angularVelocity *= Math.pow(1 - this.frictionCoefficient, deltaTime);
                    // console.log(this.angularVelocity)
                }
                //三、鼠标左键（主键）
                if (this.eventValues.mouseValue.buttons == 1) {
                    //2.2、处理移动 ：X , Y
                    // Calculate the movement vector，计算移动方向
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.RightOfViewMatrix, input.analog.x, movement);//X 方向的增量
                    vec3.addScaled(movement, this.camera.UpOfViewMatrix, -input.analog.y, movement);//Y 方向的增量,负号是因为鼠标向上是负方向
                    // 3.1 叉乘出Z轴的增量 Cross the movement vector with the view direction to calculate the rotation axis x magnitude
                    const crossProduct = vec3.cross(movement, this.camera.BackOfViewMatrix);

                    //3.1 计算拖动的量级，Z方向的向量长度; Calculate the magnitude of the drag
                    const magnitude = vec3.len(crossProduct);

                    //3.3 如果Z方向的的增量大于 epsilon，重新计算旋转轴和角速度
                    if (magnitude > epsilon) {//如果Z方向的的增量大于 epsilon，重新计算旋转轴
                        //旋转轴。 Normalize the crossProduct to get the rotation axis
                        this.axis = vec3.scale(crossProduct, 1 / magnitude);
                        //更新当前角速度 ，Z方向的增量*旋转系数。 Remember the current angular velocity. This is used when the touch is released for a fling.
                        this.angularVelocity = magnitude * this.rotationSpeed;
                    }
                    //3.4 计算旋转角 =角速度*时间区间。The rotation around this.axis to apply to the camera matrix this update
                    const rotationAngle = this.angularVelocity * deltaTime;

                    //3.5 计算camera的position 
                    //3.5.11 camera的Z轴，旋转角度大于阈值，重新计算Z轴
                    let dir!: Vec3;
                    if (rotationAngle > epsilon) {//旋转角度大于阈值
                        // Rotate the matrix around axis
                        // Note: The rotation is not done as a matrix-matrix multiply as the repeated multiplications
                        // will quickly introduce substantial error into the matrix.
                        dir = vec3.normalize(MathFun.rotate(this.camera.BackOfViewMatrix, this.axis, rotationAngle));
                    }
                    //3.5.2 计算在dir方向上的摄像机的position的位置
                    if (dir) {//方向变化，距离有可能变化
                        position = vec3.scale(dir, this.distance);//重新计算位置：以相同的距离，不同的方向向量
                        const positionOfLookat = vec3.add(position, this.camera.LookAt);//在现有位置上增加lookat位的增量。camera和lookat的坐标系在xyz的三个向量上保持一致，只有position不同（no zoom情况下）。
                        //3.4 更新摄像机的position和lookAt
                        this.camera.updateByPositionDirection(positionOfLookat, dir, true, true);//第二、三个参数，在控制器情况下，不使用，无意义。具体参见camera.updateByPositionDirection
                        return true;
                    }
                    return false;
                }
                //四、鼠标右键（次键）
                else if (this.eventValues.mouseValue.buttons == 2) {
                    // console.log(this.eventValues.mouseValue.buttons, this.eventValues.mouseValue.downOrUP);
                    // const movement = vec3.create(-input.analog.x * this.rightKeyRate, input.analog.y * this.rightKeyRate, 0); //若旋转后，直接增加xy，会改变距离。

                    //ok，在位置上+xy，和在位置+轴方向的增量，效果相同。有可能轴方向增量，有轴向量的scale，差距不大。
                    const movement = vec3.create();  //以屏幕中心(lookat )为原点
                    vec3.addScaled(movement, this.camera.RightOfViewMatrix, -input.analog.x * this.rightKeyRate, movement);//X 方向的增量,负号是因为鼠标向右是负方向
                    vec3.addScaled(movement, this.camera.UpOfViewMatrix, input.analog.y * this.rightKeyRate, movement);//Y 方向的增量

                    if (movement[0] || movement[1]) {//如果X或Y方向有增量
                        const localLookat = this.camera.getLocalLookAtVec3();
                        // console.log("before add: ", localLookat, movement, position);
                        vec3.add(localLookat, movement, localLookat);//lookat 加上增量
                        vec3.add(position, movement, position);//lookat 加上position
                        // console.log("after add: ", localLookat, movement, position);

                        this.camera.setLookAtFromLocalVec3(localLookat);//更新lookat
                        this.camera.updateByPositionDirection(position, localLookat, false, true);//更新position和lookat
                        return true;
                    }
                }
            }
            //五、 zoom，重新计算在dir方向上的摄像机的position的距离。 recalculate `this.position` from `this.back` considering zoom
            else if (input.analog.zoom !== 0) {
                //5.1 计算在dir方向上的摄像机的position的位置
                this.distance *= 1 + input.analog.zoom * this.zoomSpeed;
                //5.2 距离变化了，重新计算position
                if (oldDistance != this.distance) {
                    //5.3 重新计算position
                    position = vec3.add(vec3.scale(this.camera.BackOfViewMatrix, this.distance), this.camera.LookAt);//重新计算位置
                    // console.log("zoom:dir", ...this.camera.BackOfViewMatrix, "position", ...position, "distance", this.distance);
                    this.camera.updateByPositionDirection(position, this.camera.BackOfViewMatrix, true, true);
                    return true;
                }
            }
            return false;
        }
        else {
            console.log("arcbalCameraControl's camere didn't defined !,error from update()");
            return false;
        }
    }

    /**
    * 计算摄像机Z方向
    * @param position ：摄像机位置
    * @returns ：摄像机Z方向（归一化）
    */
    computeCameraZByPosition(position: Vec3): Vec3 {
        let lookAt = vec3.create();
        //lookat是camera local 坐标系
        if (this.camera.isLookAtGlobal === false) {
            lookAt = vec3.transformMat4(this.camera.LookAt, this.camera.Parent!.matrixWorld);//position 乘以 matrixWorld，得到position的世界坐标
        }
        //lookat是世界坐标系
        else {
            vec3.copy(this.camera.LookAt, lookAt);
        }
        const worldPosition = vec3.transformMat4(position, this.camera.Parent!.matrixWorld);//position 乘以 matrixWorld，得到position的世界坐标
        const back = vec3.normalize(vec3.sub(worldPosition, lookAt));
        return back;
    }
    /**
     * 判断左右
     * 计算 Y轴Up向量 与camera Z向量的叉积(sin)，orbiteControl中使用
     *  1、右侧：摄像机Z指向北极，sin 负值
     *  2、左侧：摄像机Z指向南极，sin 正值；翻转了
     * 
     *           |Y（cross)
     *           |
     *           |       。vector(point乘逆矩阵，忽略z值，xy与（1，—0)进行cross,即sin
     *           ——————————————————————————————————————————————————————————————————————————————————X（原来的Y轴）
     *          /        。point
     *         /
     *        /Z（camera  -X）
     * 
     * @param up ：Up向量：固定，top时：(0,1,0)，bottom时：(0,-1,0)
     * @param position ：摄像机位置
     * @returns ：Up向量与Z向量的叉积（标量值,共面二维化）
     */
    computeSinOfUpDirectionAndPosition(up: Vec3, position: Vec3): number {
        const viewMatrix = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
        //新的X轴=up方向
        const axisX = new Float32Array(viewMatrix.buffer, 4 * 0, 4);
        vec3.copy(up, axisX);
        // 新的Z轴=camrea X
        const axizZ = new Float32Array(viewMatrix.buffer, 4 * 4 * 2, 4);
        vec3.normalize(vec3.negate(vec3.create(this.camera.RightOfViewMatrix[0], this.camera.RightOfViewMatrix[1], this.camera.RightOfViewMatrix[2])), axizZ);
        //新的Y轴=新的Z轴叉积新的X轴
        const axizY = new Float32Array(viewMatrix.buffer, 4 * 4 * 1, 4);
        vec3.normalize(vec3.cross(axizZ, axisX), axizY);
        //获取camera Z方向
        const cameraZ = this.computeCameraZByPosition(position);
        //将camera Z方向转换到本地坐标系
        vec3.normalize(vec3.transformMat4(cameraZ, mat4.invert(viewMatrix)), cameraZ);//cameraZ[3]应该=0
        //计算XY平面上，Up向量与Z向量的叉积
        const sin = 1 * cameraZ[1] - 0 * cameraZ[0];
        return sin;
    }

    /**
     * 判断前后
     * 计算 camera Z向量与 up方向 的点积（cos)，orbiteControl中使用
     * 1、camera在上半球，cos 正值
     * 2、camera在下半球，cos 负值
     * 
     *                    | Y cross
     *                    | 
     *                    |          
     *                    |_________________________________________________X (原来的 Y up)
     *   camera          / 
     *    。            /                       。camera的Z轴向量(求xy与(1,0)的点积)
     *                 / 
     *                /  
     *               /
     *              / Z （camera -X ）
     * 
     * @param up ：Up向量：固定，都是up方向，通常是(0,1,0)
     * @param position ：摄像机位置
     * @returns ：Up向量与Z向量的点积（标量值,共面二维化）
     */
    computeCosOfUpDirectionAndPositionOld(position: Vec3): number {
        const viewMatrix = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
        //新的X轴=up方向
        const axisX = new Float32Array(viewMatrix.buffer, 4 * 0, 4);
        vec3.copy(vec3.create(0, 1, 0), axisX);

        // 新的Z轴=camrea X
        const axizZ = new Float32Array(viewMatrix.buffer, 4 * 4 * 2, 4);
        vec3.normalize(vec3.negate(vec3.create(this.camera.RightOfViewMatrix[0], this.camera.RightOfViewMatrix[1], this.camera.RightOfViewMatrix[2])), axizZ);

        //新的Y轴=新的Z轴叉积新的X轴
        const axizY = new Float32Array(viewMatrix.buffer, 4 * 4 * 1, 4);
        vec3.normalize(vec3.cross(axizZ, axisX), axizY);

        //获取camera Z方向
        const cameraZ = this.computeCameraZByPosition(position);
        //将camera Z方向转换到本地坐标系
        vec3.normalize(vec3.transformMat4(cameraZ, mat4.invert(viewMatrix)), cameraZ);//cameraZ[3]应该=0
        //计算XY平面上，Up向量与Z向量的叉积
        const cos = 1 * cameraZ[0] + 0 * cameraZ[1];
        return cos;
    }

    /**
    * 计算摄像机Up向量与Z向量的点积，orbiteControl中使用
    * 
    *     | Y不变
    *     |          。point(求xy与(1,0)的点积)
    *     |_________________________________________________X (X0Z)
    *    /
    *   / 
    *  Z （cross）
    * @param up ：Up向量：固定，都是up方向，通常是(0,1,0)
    * @param position ：摄像机位置
    * @returns ：Up向量与Z向量的点积（标量值,共面二维化）
    */
    computeSinAndCosOfUpDirectionAndX0z(position: Vec3): { sin: number, cos: number } {
        const xOfPoint = position[0];
        if (Math.abs(xOfPoint) < 0.0001) {
            if (position[1] > 0) {//判断Y值是否大于0，大于0，说明摄像机在Y轴的上方；X值趋近0，但可为正负
                return { sin: 1, cos: 0 };
            }
            else {
                return { sin: -1, cos: 0 };
            }
        }
        else {
            const viewMatrix = mat4.create(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,);
            //新的X轴= x0z方向
            const axisX = new Float32Array(viewMatrix.buffer, 4 * 0, 4);
            vec3.normalize(vec3.create(position[0], 0, position[2]), axisX);

            //新的Y轴=新的Z轴叉积新的X轴
            const axisY = new Float32Array(viewMatrix.buffer, 4 * 4 * 1, 4);

            // 新的Z轴：-camrea X
            const axizZ = new Float32Array(viewMatrix.buffer, 4 * 4 * 2, 4);
            vec3.normalize(vec3.cross(axisX, axisY), axizZ);

            //获取camera Z方向xiang
            const cameraZ = vec3.create();
            //将camera Z方向转换到本地坐标系
            vec3.normalize(vec3.transformMat4(position, mat4.invert(viewMatrix)), cameraZ);//cameraZ[3]应该=0
            // console.log("cameraZ", cameraZ, "viewMatrix", viewMatrix, "position", position);
            //计算XY平面上，Up向量与Z向量的叉积
            const sin = 1 * cameraZ[1] - 0 * cameraZ[0];
            const cos = 1 * cameraZ[0] + 0 * cameraZ[1];
            return { sin, cos };
        }
    }


    //     //sin ,判断摄像机视角是否在camera的Y轴是否指向北极（sin 负值）。而不是，指向南极（sin 正值）。
    // let sinOfPosition = this.computeSinOfUpDirectionAndPosition(this.camera.UpDirection, positionOfLookat);

    // //cos ,判断摄像机视角是在上半球（cos 正值）。还是，在下半球（cos 负值）。
    // let cosOfPosition = this.computeCosOfUpDirectionAndPosition(positionOfLookat);
    // // console.log("sinOfPosition", sinOfPosition, "cosOfPosition", cosOfPosition);
}