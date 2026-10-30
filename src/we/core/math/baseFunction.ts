import { mat4, vec3, type Vec3 } from 'wgpu-matrix';

// Returns `x` clamped between [`min` .. `max`]
export function clamp(x: number, min: number, max: number): number {
    return Math.min(Math.max(x, min), max);
}

// Returns `x` float-modulo `div`
export function mod(x: number, div: number): number {
    return x - Math.floor(Math.abs(x) / div) * div * Math.sign(x);
}

// Returns `vec` rotated `angle` radians around `axis`
export function rotate(vec: Vec3, axis: Vec3, angle: number): Vec3 {
    return vec3.transformMat4Upper3x3(vec, mat4.rotation(axis, angle));
}

// Returns the linear interpolation between 'a' and 'b' using 's'
export function lerp(a: Vec3, b: Vec3, s: number): Vec3 {
    return vec3.addScaled(a, vec3.sub(b, a), s);
}

export function WERandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

const weIDs: Set<number> = new Set();
const weUUIDs = new Set();
const _weNodeIDs = new Set();
/**
 * generate ID
 * @returns ID : number
 */
export function WeGenerateID() {
    // return  WERandomInt(10000, 40000) + WERandomInt(1001, 10000)+ WERandomInt(100, 1000)+ WERandomInt(1, 100);
    let id = 0;
    do {
        // id = Math.floor(Math.random() * 65536);//shader 中，ID 为16位（u32中的16位）。最大值为65536，如果需要扩大ID范围，需要修改shader。
        id++;
    } while (weIDs.has(id));
    weIDs.add(id);
    return id;
}

/**
 * generate UUID,like:'0bkahk-zp3xge-l7xdgn-wnt9c9'
 * @returns UUID
 */
export function WeGenerateUUID() {
    let UUID: string;
    do {
        const sub = 7;
        const len = 36;
        // UUID = Math.random().toString(len).substring(sub);
        UUID =
            Math.random().toString(len).substring(sub) +
            '-' +
            Math.random().toString(len).substring(sub) +
            '-' +
            Math.random().toString(len).substring(sub) +
            '-' +
            Math.random().toString(len).substring(sub);
    } while (weUUIDs.has(UUID));
    weUUIDs.add(UUID);
    return UUID;
}

/**
 * 从顶点位置和索引计算法线:索引模式
 * @param {number[]} positions - 顶点位置数组（格式：[x0,y0,z0, x1,y1,z1, ...]）
 * @param {number[]} indices - 三角面索引数组（格式：[i0,i1,i2, i3,i4,i5, ...]）
 * @returns {number[]} 顶点法线数组（格式与 positions 一致）
 */
export function computeNormalsArrayFromPositionsAndIndices(
    positions: number[],
    indices: number[],
): number[] {
    // 1. 初始化法线数组为 0
    const normals: number[] = new Array(positions.length).fill(0);
    const stride = 3; // 每个顶点 3 个分量（x,y,z）

    // 2. 遍历所有三角面，计算面法线并累加到顶点
    for (let i = 0; i < indices.length; i += 3) {
        // 获取三角面的三个顶点索引
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        // 获取三个顶点的位置
        const p0 = [positions[i0 * stride], positions[i0 * stride + 1], positions[i0 * stride + 2]];
        const p1 = [positions[i1 * stride], positions[i1 * stride + 1], positions[i1 * stride + 2]];
        const p2 = [positions[i2 * stride], positions[i2 * stride + 1], positions[i2 * stride + 2]];

        // 计算边向量, v1: p1 -> p0, v2: p2 -> p0
        const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

        // 叉乘计算面法线（右手系）, faceNormal: v1 cross v2
        const faceNormal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];

        // 归一化面法线（避免长度异常）
        const len = Math.sqrt(faceNormal[0] ** 2 + faceNormal[1] ** 2 + faceNormal[2] ** 2);
        if (len < 1e-6) continue; // 跳过退化的三角面
        const n = [faceNormal[0] / len, faceNormal[1] / len, faceNormal[2] / len];
        // const n = [
        //     faceNormal[0] ,
        //     faceNormal[1] ,
        //     faceNormal[2]
        // ];
        // 将面法线累加到三个顶点的法线中
        normals[i0 * stride] += n[0];
        normals[i0 * stride + 1] += n[1];
        normals[i0 * stride + 2] += n[2];

        normals[i1 * stride] += n[0];
        normals[i1 * stride + 1] += n[1];
        normals[i1 * stride + 2] += n[2];

        normals[i2 * stride] += n[0];
        normals[i2 * stride + 1] += n[1];
        normals[i2 * stride + 2] += n[2];
    }

    // 3. 归一化所有顶点法线
    for (let i = 0; i < normals.length; i += stride) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];
        // const len = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        const len = Math.hypot(x, y, z);
        if (len < 1e-6) {
            normals[i] = 0;
            normals[i + 1] = 1; // 无有效法线时默认向上
            normals[i + 2] = 0;
        } else {
            normals[i] = x / len;
            normals[i + 1] = y / len;
            normals[i + 2] = z / len;
        }
    }
    // console.log("normal:", normals);
    return normals;
}
/**
 * 从顶点位置和索引计算面法线:索引模式
 * @param positions 顶点位置数组（格式：[x0,y0,z0, x1,y1,z1, ...]）
 * @param indices 三角面索引数组（格式：[i0,i1,i2, i3,i4,i5, ...]）
 * @returns 三角面法线数组（格式与 indices 一致）
 */
export function computeFaceNormalsArrayFromPositionsAndIndices(
    positions: number[],
    indices: number[],
): number[] {
    const normals = new Array(indices.length).fill(0);

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        // 取三个顶点
        const v0x = positions[i0 * 3];
        const v0y = positions[i0 * 3 + 1];
        const v0z = positions[i0 * 3 + 2];

        const v1x = positions[i1 * 3];
        const v1y = positions[i1 * 3 + 1];
        const v1z = positions[i1 * 3 + 2];

        const v2x = positions[i2 * 3];
        const v2y = positions[i2 * 3 + 1];
        const v2z = positions[i2 * 3 + 2];

        // 两条边
        const ax = v1x - v0x;
        const ay = v1y - v0y;
        const az = v1z - v0z;
        const bx = v2x - v0x;
        const by = v2y - v0y;
        const bz = v2z - v0z;

        // 叉乘 → 面法线（关键：只给当前三角面使用，不共享！）
        let nX = ay * bz - az * by;
        let nY = az * bx - ax * bz;
        let nZ = ax * by - ay * bx;

        // 归一化
        const len = Math.hypot(nX, nY, nZ);
        if (len > 0) {
            nX /= len;
            nY /= len;
            nZ /= len;
        }

        // 重点：只赋值，不叠加！不混合！
        normals[i] = nX;
        normals[i + 1] = nY;
        normals[i + 2] = nZ;
    }
    return normals;
}
export function convertPositionsWithIndicesToPositionNonIndex(
    positions: number[],
    indices: number[],
): number[] {
    const positionNonIndex = [];
    for (const i of indices) {
        positionNonIndex.push(positions[i * 3 + 0]);
        positionNonIndex.push(positions[i * 3 + 1]);
        positionNonIndex.push(positions[i * 3 + 2]);
        const _abc = 1;
    }
    return positionNonIndex;
}

/**
 * 从顶点位置计算法线:非索引模式
 * @param positions 顶点位置数组（格式：[x0,y0,z0, x1,y1,z1, ...]）
 * @returns 顶点法线数组（格式与 positions 一致）
 */
export function computeNormalsArrayFromPositionsNoIndex(positions: number[]): number[] {
    // 1. 初始化法线数组为 0
    const normals: number[] = new Array(positions.length).fill(0);
    const _stride = 3; // 每个顶点 3 个分量（x,y,z）

    // 2. 遍历所有三角面，计算面法线并累加到顶点
    for (let i = 0; i < positions.length; i += 3 * 3) {
        // 获取三个顶点的位置,逆时针顺序(0,1,2,一定，否则法线指向内部)，计算法线时需要注意，法线指向外部
        const p0 = [positions[i + 0], positions[i + 1], positions[i + 2]];
        const p1 = [positions[i + 3], positions[i + 4], positions[i + 5]];
        const p2 = [positions[i + 6], positions[i + 7], positions[i + 8]];

        // 计算边向量
        const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

        // 叉乘计算面法线（右手系）
        const faceNormal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0],
        ];

        // 归一化面法线（避免长度异常）
        const len = Math.sqrt(faceNormal[0] ** 2 + faceNormal[1] ** 2 + faceNormal[2] ** 2);
        let n = [0, 1, 0];
        if (len < 1e-6) {
            // 跳过退化的三角面
        } else {
            n = [faceNormal[0] / len, faceNormal[1] / len, faceNormal[2] / len];
        }

        // 将面法线累加到三个顶点的法线中
        normals[i + 0] = n[0];
        normals[i + 1] = n[1];
        normals[i + 2] = n[2];

        normals[i + 3] = n[0];
        normals[i + 4] = n[1];
        normals[i + 5] = n[2];

        normals[i + 6] = n[0];
        normals[i + 7] = n[1];
        normals[i + 8] = n[2];
    }
    return normals;
}
