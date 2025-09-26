import { type Box3 } from "./Box";

export interface Sphere {
    position: [number, number, number],
    radius: number,
}
export type boundingSphere = Sphere;

export function generateSphereFromBox3(box: Box3): Sphere {
    const xR = Math.max(Math.pow(box.min[0], 2), Math.pow(box.max[0], 2));
    const yR = Math.max(Math.pow(box.min[1], 2), Math.pow(box.max[1], 2));
    const zR = Math.max(Math.pow(box.min[2], 2), Math.pow(box.max[2], 2));
    const maxR = Math.max(xR, yR, zR);
    let sphere: Sphere = {
        position: [
            (box.min[0] + box.max[0]) / 2,
            (box.min[1] + box.max[1]) / 2,
            (box.min[2] + box.max[2]) / 2
        ],
        radius: Math.sqrt(maxR + maxR),
    }
    return sphere;
}


/**
 * 计算点集的包围球（几何中心法）
 * @param points 点集，每个点占3个元素，[[x,y,z],[x,y,z],...]
 * @returns 
 */
export function computeBoundingSphere(points: [number, number, number][]): Sphere {
    // 计算球心（几何中心）
    const center: [number, number, number] = [0, 0, 0];
    points.forEach(p => {
        center[0] += p[0];
        center[1] += p[1];
        center[2] += p[2];
    });
    center[0] /= points.length;
    center[1] /= points.length;
    center[2] /= points.length;

    // 计算半径（最大距离）
    let radius = 0;
    points.forEach(p => {
        const dist = Math.sqrt((p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2 + (p[2] - center[2]) ** 2);
        radius = Math.max(radius, dist);
    });

    return { position: center, radius };
}