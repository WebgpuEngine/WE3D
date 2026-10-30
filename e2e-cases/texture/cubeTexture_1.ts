import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    TextureMaterial,
    CubeTextureMaterial,
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
    // reversedZ:true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [3, 3, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
    color: [0, 0.1, 0.2, 1],
});

let textureMaterial = new CubeTextureMaterial({
    /** 立方体贴图 JPG 格式*/
    // cube: "/resource/cubeIMG/cubemap/test",
    texture: '/resource/cubeIMG/skycube1/skybox',
});

let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: boxGeometry,
    },
    material: textureMaterial,
    wireFrame: {
        color: [1, 1, 1, 1],
        enable: true,
        // wireFrameOnly: true,
    },
    position: [1, 1, 1],
};
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);
