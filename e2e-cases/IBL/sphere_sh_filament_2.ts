import {
    PerspectiveCamera,
    IV_MeshEntity,
    Mesh,
    BoxGeometry,
    SphereGeometry,
    IBL,
    IV_PBRMaterial,
    PBRMaterial,
    CubeTextureMaterial,
    IV_Scene,
    initScene,
    PrefilteredCubemap,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        DC: any;
        ibl: any;
    }
}
let input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
    renderMode: 'forwardRender',
    // reversedZ:true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;
let ibl = new IBL(scene, {
    enable: true,
    // use_ibl: 1,
    ibl:
        // [
        {
            sh: [
                0.892405390739441, 0.822372555732727, 0.742882370948792, 0.363260120153427,
                0.287812232971191, 0.308403253555298, 0.402881264686584, 0.481065690517426,
                0.550189137458801, -0.088714323937893, -0.093073576688766, -0.096587993204594,
                -0.029264636337757, -0.042779047042131, -0.05032455176115, 0.168970569968224,
                0.236878886818886, 0.300929397344589, 0.163660973310471, 0.184374451637268,
                0.200629562139511, -0.203119948506355, -0.214579626917839, -0.220290645956993,
                -0.009975957684219, -0.002223560353741, 0.01626948826015,
            ],
            prefilteredCubeMap: '/IBL/pine_attic_2k/ktx1/output_ibl.ktx',
        },
    // ],
    shAlreadyPreMultiplyConst: true,
});
await ibl.init();
window.ibl = ibl;
console.log(ibl);

let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 500,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
    controlType: 'orbit',
});
await scene.add(camera);

// let onelight = new DirectionalLight({
//   color: [1, 1, 1],
//   direction: [0, 1, 0],
//   intensity: 1,

// });
// await scene.add(onelight);

// let ambientLight = new AmbientLight(
//   {
//     color: [1, 1, 1],
//     intensity: 0.0000006
//   }
// )
// await scene.add(ambientLight);

let sphereGeometry = new SphereGeometry({
    widthSegments: 128,
    heightSegments: 128,
});

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let PBROption: IV_PBRMaterial = {
    textures: {
        albedo: { value: [0.1, 0.5, 0.7, 1.0] },
        metallic: { value: 0.6 },
        roughness: { value: 0.3 },
    },
};
let pbrMaterial = new PBRMaterial(PBROption);

let inputSphereMesh: IV_MeshEntity = {
    attributes: {
        geometry: sphereGeometry,
    },
    material: pbrMaterial,
    // wireFrame: {
    //   color: [1, 1, 1, 1],
    //   enable: true,
    //   // wireFrameOnly: true,
    // }
};
let sphereMesh = new Mesh(inputSphereMesh);
// console.log(mesh);
await scene.add(sphereMesh);

let ktxTexture = new PrefilteredCubemap(
    {
        source: '/IBL/pine_attic_2k/ktx1/output_skybox.ktx',
        // format: "rgba32float",
    },
    scene.device,
    scene,
);
await ktxTexture.init();

let textureMaterial = new CubeTextureMaterial({
    texture: ktxTexture,
    cubeType: 'sky',
});

let boxGeometry = new BoxGeometry();
let inputSkyMeshEntity: IV_MeshEntity = {
    attributes: {
        geometry: boxGeometry,
    },
    material: textureMaterial,
    // wireFrame: {
    //   color: [1, 1, 1, 1],
    //   enable: true,
    //   // wireFrameOnly: true,
    // },
    primitive: {
        cullMode: 'none',
    },
    // position: [0, 0, 3],
    scale: [400, 400, 400],
};
let skyMesh = new Mesh(inputSkyMeshEntity);
console.log(skyMesh);
await scene.add(skyMesh);
