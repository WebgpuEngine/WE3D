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

// P1-3：EXT_texture_webp 显式支持的视觉回归用例。
// 资产声明 EXT_texture_webp，贴图为外部 .webp；引擎由 getImage() 的
// MIME 白名单解析后交给 createImageBitmap 解码，无需宿主注入任何解码器。
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
    url: '/models/gltf/base/texture/webp/BoxTextured.webp.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
