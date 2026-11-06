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

// Khronos MeshoptCubeTest 是 Z=0 平面上的 5x5 立方体网格：
// node translation 实测 X[-4.5,16] / Y[0,19]，中心约 (5.75, 9.5)，需正对中心并拉远
const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [5.75, 9.5, 25],
    lookAt: [5.75, 9.5, 0],
});
await scene.add(camera);

await scene.add(
    new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }),
);
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.2 }));

// 官方样本：EXT_meshopt_compression（来源/授权/扩展名规范化见资产目录 README.md）
// 由内置 meshopt.decoder provider 自动检测加载，宿主零注入
const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/base/meshopt/MeshoptCubeTest/MeshoptCubeTest.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
