import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    ColorMaterial,
    IV_LinesEntity,
    Lines,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        DC: any;
    }
}
let input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

let colorMaterial = new ColorMaterial({
    color: [0, 1, 0, 1],
});

let position = [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0];
let indices = [0, 1, 3, 2, 0];

let inputMesh: IV_LinesEntity = {
    attributes: {
        data: {
            vertices: {
                position,
            },
            indices,
            // vertexStepMode: "vertex"
        },
    },
    material: colorMaterial,
    lineMode: 'line-strip',
};
window.mesh = new Lines(inputMesh);
console.log(window.mesh);
await scene.add(window.mesh);
