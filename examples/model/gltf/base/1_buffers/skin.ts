import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, initScene, createGLTFModel } from '@we3d';

declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let input: IV_Scene = {
    canvas: "render",
    backgroudColor: [0, 0, 0, 0.91],
    reversedZ: true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    //   update: (scope: any) => {
    //     const now = Date.now() / 1000;
    //     // console.log(scope.lookAt);
    //     scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
    //     // console.log(scope.position);
    //   },
    controlType: "arcball",

});
await scene.add(camera);

let gltf = await createGLTFModel({
    scene: scene,
    url: "/models/gltf/base/skin/simpleSkin.gltf"
}
);
window.gltf = gltf;
// console.warn("accessor 4: inversBindMatrices(2个4*4矩阵)")
// gltf.printAccessorContent(4)
// console.warn("accessor 5: samplers input ,time(12个时间点[f32] )")
// gltf.printAccessorContent(5)
// console.warn("accessor 6: samplers output ,rotate(12个 vec4)")
// gltf.printAccessorContent(6)
// console.log("==================================attribute ======================    ")
// console.warn("attribute：10个vec4 joints_0")
// let joints_0 = gltf.printAccessorContent(2, )
// for (let i = 0; i < joints_0.length; i += 4) {
//     console.log(joints_0[i], joints_0[i + 1], joints_0[i + 2], joints_0[i + 3])
// }
// console.warn("attribute：10个vec4 weights_0")
// let weights_0 = gltf.printAccessorContent(3, false)
// for (let i = 0; i < weights_0.length; i += 4) {
//     console.log(weights_0[i], weights_0[i + 1], weights_0[i + 2], weights_0[i + 3])
// }

await scene.add(gltf);
