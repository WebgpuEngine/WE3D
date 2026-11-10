import {
    IV_Scene,
    initScene,
    PerspectiveCamera,
    AmbientLight,
    DirectionalLight,
    createGLTFModel,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        gltf: any;
    }
}

const input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
};
const scene = await initScene({ initConfig: input });
window.scene = scene;

const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
});
await scene.add(camera);

await scene.add(
    new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }),
);
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.2 }));

// P4-1 D2：mode=2 (LINE_LOOP) 的 4 顶点闭合矩形，带 COLOR_0（mode 2 强制 vertexColor 材质）。
// 修复前按 triangle-list 取原始索引，只能画出上下两条水平线；修复后应为闭合四边形线框。
const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/base/line/LineLoop.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
