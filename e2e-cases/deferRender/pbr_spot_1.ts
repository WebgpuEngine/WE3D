import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    AmbientLight,
    SphereGeometry,
    PhongMaterial,
    PlaneGeometry,
    SpotLight,
    IV_PBRMaterial,
    PBRMaterial,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        DC: any;
    }
}
let input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [1, 1, 1, 1],
    // reversedZ:true,
    renderMode: 'deferRender',
    // toneMapping:E_ToneMappingType.linearToSRGB,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let camera = new PerspectiveCamera({
    name: 'defaultCamera',
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [6, 9, -5],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 2.0,
//   }
// );
let ballGeometry = new SphereGeometry({
    radius: 0.1,
    widthSegments: 64,
    heightSegments: 64,
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let light1Entity1 = new Mesh({
    name: 'ballLightMesh',
    attributes: {
        geometry: ballGeometry,
    },
    material: lightMaterial,
    shadow: {
        generate: false,
        accept: false,
    },
});
let light1Entity1Node = await scene.add({
    entity: light1Entity1,
    position: [3, 3, 3],
    // update: (scope: any) => {
    //   const now = Date.now() / 1000;
    //   let pos = [Math.sin(now) * lightRadius, lightY, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    //   // console.log(pos);
    // }
});

let onelight = new SpotLight({
    name: 'spotLight',
    // direction: [-1, -1, -1],
    // direction: [-1.0, 1.0, -1.0],
    direction: [0, 0, 0],
    isLookAt: true,
    position: [0, 0, 0],
    // position: [3, 3, 3],
    intensity: 35.0,
    // intensity: 55.0,//没有进行tone mapping 之前
    // angle: 25 / 180 * Math.PI,
    // angleOut: 30 / 180 * Math.PI,
    angle: (20 * Math.PI) / 180,
    angleOut: (20 * Math.PI) / 180,
    shadow: true,
});

await light1Entity1Node.addChild(onelight);
// await scene.add(onelight);

let ambientLight = new AmbientLight({
    color: [1, 1, 1],
    intensity: 0.001,
});
await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////
let sphere = new SphereGeometry({
    widthSegments: 128,
    heightSegments: 128,
});

let ballPBROption: IV_PBRMaterial = {
    name: 'PBRMaterial',
    textures: {
        albedo: {
            texture: { source: '/resource/PBR/marble-speckled-bl/marble-speckled-albedo.png' },
        },
        normal: {
            texture: { source: '/resource/PBR/marble-speckled-bl/marble-speckled-normal.png' },
        },
        metallic: {
            texture: { source: '/resource/PBR/marble-speckled-bl/marble-speckled-metalness.png' },
        },
        roughness: {
            texture: { source: '/resource/PBR/marble-speckled-bl/marble-speckled-roughness.png' },
        },
    },
};
let ballpbrMaterial = new PBRMaterial(ballPBROption);
let inputMeshsphere: IV_MeshEntity = {
    name: 'sphereMesh',
    attributes: {
        geometry: sphere,
    },
    material: ballpbrMaterial,
    // wireFrame: {
    //   color: [1, 1, 1, 1],
    //   enable: true,
    //   // wireFrameOnly: true,
    // }
};
let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
    name: 'boxMesh',
    attributes: {
        geometry: box,
    },
    material: ballpbrMaterial,
    position: [0, 0.5, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);

/////////////////////////////////////////////////////////
// 6个plane
let planeGeometry = new PlaneGeometry({
    width: 30,
    height: 30,
});
let groundMaterial = new PhongMaterial({
    color: [1, 1, 1, 1],
    shininess: 1,
    metalness: 0.0,
    roughness: 1,
});

let bottomPlane = new Mesh({
    name: 'bottomPlaneMesh',
    attributes: {
        geometry: planeGeometry,
    },
    material: ballpbrMaterial,
    position: [0, -1, 0],
    rotate: [1, 0, 0, -Math.PI / 2],
});
await scene.add(bottomPlane);
