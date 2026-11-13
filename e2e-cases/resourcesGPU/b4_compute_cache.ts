/**
 * §3.3 B4：补齐 CS / compute pipeline 缓存
 *
 * 旧实现 ComputeCommand 每次 device.createShaderModule() + createComputePipeline()；
 * 新实现统一走 DerivedCache（VS/FS/CS shaderModule、render/compute pipeline 均按内容去重）。
 *
 * 同一段 compute WGSL 创建三个 ComputeCommand（label 不同、shaderCode 相同）：
 * 新实现应只编译一次。构造阶段即完成 module / pipeline 创建，不需要 dispatch。
 * 画面用一个彩色盒子保持稳定，作为截图基线；若缓存串用导致编译错误，会体现为 console error 或画面异常。
 */
import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    ComputeCommand,
    IV_ComputeCommand,
} from '@we3d';

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
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

const computeShaderCode = /* wgsl */ `
@compute @workgroup_size(1)
fn cs_main() {
    // 无 bindGroup 的极简 compute shader：只用于覆盖 shaderModule / pipeline 创建路径
}
`;

const baseOptions: IV_ComputeCommand = {
    label: 'e2e-cs-cache',
    device: scene.device,
    computeInfo: {
        dispatchCount: [1, 1, 1],
        pipeline: {
            pipelineLayout: 'auto',
            shader: {
                shaderCode: computeShaderCode,
                entryPoint: 'cs_main',
            },
        },
    },
};

// 三次创建、相同 WGSL：切换前后应都无 console error，且新实现只编译一次
new ComputeCommand({ ...baseOptions, label: 'e2e-cs-cache-a' });
new ComputeCommand({ ...baseOptions, label: 'e2e-cs-cache-b' });
new ComputeCommand({ ...baseOptions, label: 'e2e-cs-cache-c' });

const mesh = new Mesh({
    attributes: { geometry: new BoxGeometry() },
    material: new ColorMaterial({ color: [0.15, 0.75, 0.95, 1] }),
} as IV_MeshEntity);
await scene.add(mesh);
