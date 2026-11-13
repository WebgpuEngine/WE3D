/**
 * §3.3 B5：VS 反射注入的 attribute 布局
 *
 * 旧实现 md5OfVScode 在 reflection() 之后计算（正常路径已含 attribute 信息），
 * 但 NDC 模式跳过反射、反射占位符缺失只 log 不 throw；新实现把
 * reflectionSignature(names/locations/buffers/ndc/applied) 作为显式 key 维度。
 *
 * 三个并排三角形使用同一 ColorMaterial，但顶点属性组合不同：
 *   A: position + color
 *   B: position + color + normal
 *   C: position + color + normal + uv
 * 若 VS module 被错误复用（key 未含反射维度），会出现渲染错乱或 WebGPU validation error。
 * 画面判读：红 / 绿 / 蓝三个三角形都应完整显示。
 */
import { PerspectiveCamera, IV_Scene, initScene, ColorMaterial, IV_MeshEntity, Mesh } from '@we3d';

declare global {
    interface Window {
        scene: any;
    }
}

const initConfig: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
};
const scene = await initScene({ initConfig });
window.scene = scene;

const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 4],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

const colors: [number, number, number, number][] = [
    [1, 0.2, 0.2, 1],
    [0.2, 1, 0.35, 1],
    [0.25, 0.5, 1, 1],
];

function makePositions(offsetX: number): number[] {
    return [offsetX, 0.45, 0, offsetX - 0.4, -0.45, 0, offsetX + 0.4, -0.45, 0];
}

const vertexColors = [1, 1, 1, 1, 1, 1, 1, 1, 1];
const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1];
const uvs = [0, 0, 0.5, 1, 1, 0];

// 三种不同的顶点属性布局（同一材质 => 同一 aliasName，靠反射维度区分 VS）
const layouts: { offsetX: number; vertices: Record<string, number[]> }[] = [
    {
        offsetX: -1.1,
        vertices: { position: makePositions(-1.1), color: vertexColors },
    },
    {
        offsetX: 0,
        vertices: { position: makePositions(0), color: vertexColors, normal: normals },
    },
    {
        offsetX: 1.1,
        vertices: { position: makePositions(1.1), color: vertexColors, normal: normals, uv: uvs },
    },
];

for (let i = 0; i < layouts.length; i++) {
    const mesh = new Mesh({
        attributes: {
            data: {
                vertices: layouts[i].vertices,
                indices: [0, 1, 2],
            },
        },
        material: new ColorMaterial({ color: colors[i] }),
    } as IV_MeshEntity);
    await scene.add(mesh);
    void layouts[i].offsetX;
}
