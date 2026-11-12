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

await scene.add(new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }));
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.2 }));

// 扩展依赖（Draco 等）由 createGLTFModel -> GltfDataAtTransform.init() 自动检测加载
const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/model/Box/glTF-Embedded/Box.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
