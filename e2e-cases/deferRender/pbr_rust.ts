import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    SphereGeometry,
    DirectionalLight,
    IV_PBRMaterial,
    PBRMaterial,
    AmbientLight,
    PointLight,
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
    reversedZ: true,
    // AA: {
    //   MSAA: {
    //     enable: true
    //   }
    // },
    renderMode: 'deferRender',
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.0001,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

let dirlight = new DirectionalLight({
    color: [1, 1, 1],
    direction: [1, 1, 1],
    intensity: 0.5,
});
await scene.add(dirlight);

let ambientLight = new AmbientLight({
    color: [1, 1, 1],
    intensity: 0.1,
});
await scene.add(ambientLight);

let geometry = new SphereGeometry({
    widthSegments: 128,
    heightSegments: 128,
});

console.log(geometry);

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let PBROption: IV_PBRMaterial = {
    textures: {
        albedo: { texture: { source: '/resource/PBR/rustediron/rustediron2_basecolor.png' } },
        // albedo:  [1.0, 0.71, 0.29],

        normal: { texture: { source: '/resource/PBR/rustediron/rustediron2_normal.png' } },
        metallic: { texture: { source: '/resource/PBR/rustediron/rustediron2_metallic.png' } },
        // metallic: 0.91,

        roughness: { texture: { source: '/resource/PBR/rustediron/rustediron2_roughness.png' } },
        // roughness: 0.31,
    },
};
let pbrMaterial = new PBRMaterial(PBROption);
////////////////////////////////////////////////////////////////////////
let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: geometry,
    },
    material: pbrMaterial,
};
let mesh = new Mesh(inputMesh);
await scene.add(mesh);
////////////////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
    radius: 0.01,
    widthSegments: 8,
    heightSegments: 8,
});
let lightMaterial = new ColorMaterial({
    color: [1, 1, 1, 1],
});
let meshPointBall = new Mesh({
    attributes: {
        geometry: ballGeometry,
    },
    material: lightMaterial,
});

////////////////////////////////////////////////////////////////////////
let nodeLight1 = await scene.add({
    entity: meshPointBall,
    // update: (scope: any) => {
    //   const now = Date.now() / 500;
    //   let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    // }
});

let onelight = new PointLight({
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: 2.0,
});
await nodeLight1.addChild(onelight);

//20260107 测试正确，无entity可以正确，在merge instance后
// let onelight = new PointLight(
//   {
//     position: [0, 0, 0],
//     // position: [1, 1, 1],
//     intensity: 2.0,
//     update: (scope: any) => {
//       const now = Date.now() / 500;
//       let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
//       scope.Position = pos;
//     }
//   }
// );
// await scene.addChild(onelight);
