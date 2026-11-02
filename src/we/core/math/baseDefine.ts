import { Vec3 } from 'wgpu-matrix';

export interface Rotation {
    /**
     * 旋转轴
     */
    axis: Vec3;
    /**
     * 旋转角度 ：弧度制
     */
    angleInRadians: number;
}
/**
 * 旋转数组
 */
// export type RotationArray =weVec4;//[number,number,number,number]
