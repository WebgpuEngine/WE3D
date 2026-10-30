import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    PointLight,
    AmbientLight,
    SphereGeometry,
    PlaneGeometry,
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
    backgroudColor: [0, 0, 0, 1],
    reversedZ: true,
    renderMode: 'deferRender',
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
    position: [1.5, 8, 0],
    // position: [1.5, 2, -5],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
    radius: 0.1,
    widthSegments: 64,
    heightSegments: 64,
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let light1Entity1 = new Mesh({
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
    position: [0, 2, -1],
    // update: (scope: any) => {
    //   const now = Date.now() / 1000;
    //   let pos = [Math.sin(now) * lightRadius, lightY, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    // }
});

let onelight = new PointLight({
    position: [0, 0, 0],
    // position: [-1, 1, -1],
    intensity: 9,
    // intensity: 20,//没有进行tone mapping 之前
    shadow: true,
});
await light1Entity1Node.addChild(onelight);

let ambientLight = new AmbientLight({
    color: [1, 1, 1],
    intensity: 0.005,
});
await scene.add(ambientLight);
///////////////////////////////////////////////////////////////////////

//实体球
let geometry = new SphereGeometry({
    widthSegments: 128,
    heightSegments: 128,
});
let PBROption: IV_PBRMaterial = {
    textures: {
        albedo: { texture: { source: '/resource/PBR/rustediron/rustediron2_basecolor.png' } },
        normal: { texture: { source: '/resource/PBR/rustediron/rustediron2_normal.png' } },
        metallic: { texture: { source: '/resource/PBR/rustediron/rustediron2_metallic.png' } },
        roughness: { texture: { source: '/resource/PBR/rustediron/rustediron2_roughness.png' } },
    },
};
let pbrMaterial = new PBRMaterial(PBROption);

let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
    attributes: {
        geometry: box,
    },
    material: pbrMaterial,
    position: [0, 0.5, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);

let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: geometry,
    },
    material: pbrMaterial,
};
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

//实体地板
let planeGeometry = new PlaneGeometry({
    width: 10,
    height: 10,
});

let groundMaterialPBROption: IV_PBRMaterial = {
    textures: {
        albedo: { texture: { source: '/resource/PBR/grainy-concrete/grainy-concrete_albedo.png' } },
        normal: {
            texture: { source: '/resource/PBR/grainy-concrete/grainy-concrete_normal-ogl.png' },
        },
        metallic: {
            texture: { source: '/resource/PBR/grainy-concrete/grainy-concrete_metallic.png' },
        },
        roughness: {
            texture: { source: '/resource/PBR/grainy-concrete/grainy-concrete_roughness.png' },
        },
        ao: { texture: { source: '/resource/PBR/grainy-concrete/grainy-concrete_ao.png' } },
    },
};
let groundMaterial = new PBRMaterial(groundMaterialPBROption);
let groundMesh = new Mesh({
    attributes: {
        geometry: planeGeometry,
    },
    material: groundMaterial,
    position: [0, -1, 0],
    rotate: [1, 0, 0, -Math.PI / 2],
});
await scene.add(groundMesh);
