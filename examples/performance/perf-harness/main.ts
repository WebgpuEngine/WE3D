import {
    PerspectiveCamera,
    type IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    type IV_MeshEntity,
    Mesh,
    DirectionalLight,
    AmbientLight,
    createGLTFModel,
    eventOfScene,
    type userDefineEventCall,
    type Scene,
    type NodeObject,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        gltf: any;
    }
}

// ============================================================
// S0 perf-harness 示例（examples/performance/perf-harness）
// 1、perf.enabled=true：注入 GPU timestamp（render.gpu）
// 2、每帧更新 9 个 box 的 position/rotate（nonRender.cpu / gpu 上传）
// 3、加载一个 gltf 模型（nonRender.vram.gltf）
// 4、每 60 帧聚合输出到 console，并经 window.__WE3D_PERF__ 暴露
// ============================================================
let input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0.05, 0.06, 0.08, 1],
    reversedZ: true,
    perf: {
        enabled: true,
        gpu: true,
        maxPass: 64,
        sampleFrames: 60,
        output: 'console',
        exposeGlobal: true,
    },
};

let scene = await initScene({ initConfig: input });
window.scene = scene;

// 灯光
await scene.add(
    new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }),
);
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.2 }));

// 相机
let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 3, 8],
    lookAt: [0, 0, 0],
    controlType: 'orbit',
});
await scene.add(camera);

// 多个动态 box（产生多个 draw call + 每帧 uniform 更新）
let boxCount = 9;
let instances: NodeObject[] = [];
let palette: [number, number, number, number][] = [
    [0.9, 0.3, 0.3, 1],
    [0.3, 0.9, 0.3, 1],
    [0.3, 0.3, 0.9, 1],
    [0.9, 0.9, 0.3, 1],
    [0.9, 0.3, 0.9, 1],
    [0.3, 0.9, 0.9, 1],
    [0.9, 0.6, 0.3, 1],
    [0.6, 0.3, 0.9, 1],
    [0.3, 0.6, 0.9, 1],
];
for (let i = 0; i < boxCount; i++) {
    let inputMesh: IV_MeshEntity = {
        attributes: { geometry: new BoxGeometry() },
        material: new ColorMaterial({ color: palette[i] }),
    };
    let mesh = new Mesh(inputMesh);
    let instance = await scene.add(mesh);
    instances.push(instance);
}

// 每帧更新 position / rotate，触发 uniform buffer 更新
let update: userDefineEventCall = {
    call: (_scope: Scene) => {
        const now = Date.now() / 1000;
        instances.forEach((inst, i) => {
            const angle = (i / boxCount) * Math.PI * 2 + now * 0.6;
            const radius = 3;
            inst.Position = [
                Math.cos(angle) * radius,
                Math.sin(now * 2 + i) * 0.6,
                Math.sin(angle) * radius,
            ] as [number, number, number];
            inst.Rotate = [0, 1, 0, now + i] as [number, number, number, number];
        });
    },
    name: 'perf-harness-update',
    state: true,
    event: eventOfScene.onUpdate,
};
await scene.addUserDefineEvent(update);

// 加载 gltf（加载期一次性上传，验证 nonRender.vram.gltf）
let gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/model/Box/glTF/Box.gltf',
});
window.gltf = gltf;
let gltfNode = await scene.add(gltf);
gltfNode.Position = [0, 1.5, 0] as [number, number, number];
