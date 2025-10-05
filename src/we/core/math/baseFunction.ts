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

const usedIds = new Set();
/**
 * generate ID
 * @returns ID like :17573813347954602
 */
export function WeGenerateID() {
    // return  WERandomInt(10000, 40000) + WERandomInt(1001, 10000)+ WERandomInt(100, 1000)+ WERandomInt(1, 100);
    let id;
    do {
        id = Math.floor(Math.random() * 65536);
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
}

/**
 * generate UUID,like:'0bkahk-zp3xge-l7xdgn-wnt9c9'
 * @returns UUID
 */
export function WeGenerateUUID() {
    let sub = 7;
    let len = 36
    return Math.random().toString(len).substring(sub) + '-' + Math.random().toString(len).substring(sub) + '-' + Math.random().toString(len).substring(sub) + '-' + Math.random().toString(len).substring(sub);
}
