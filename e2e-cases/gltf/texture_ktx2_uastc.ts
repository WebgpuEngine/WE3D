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

// P2-2：KHR_texture_basisu 视觉回归（UASTC / Zstd 超压缩）。
// Zstd 由官方 transcoder wasm 内置支持，无需额外解码器。
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
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.4 }));

const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/base/texture/ktx2/BoxTexturedUASTC.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
