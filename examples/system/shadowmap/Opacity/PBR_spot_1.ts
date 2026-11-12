import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, PointLight, AmbientLight, SphereGeometry, PhongMaterial, DirectionalLight, PlaneGeometry, SpotLight, IV_PBRMaterial, PBRMaterial, WePbrMaterial } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  // reversedZ:true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  name: "defaultCamera",
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [6, 9, -5],
  lookAt: [0, 0, 0],
  controlType: "arcball",
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
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let lightRadius = 4.5;
let lightY = 3;
let light1Entity1 = new Mesh(
  {
    name: "ballLightMesh",
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
    position: [1, 1, 1],
    update: (scope: any) => {
      const now = Date.now() / 1000;
      let pos = [Math.sin(now) * lightRadius, lightY, Math.cos(now) * lightRadius];
      scope.Position = pos;
    }
});

let onelight = new SpotLight({
  name: "spotLight",
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
  angle: 20 * (Math.PI) / 180,
  angleOut: 20 * (Math.PI) / 180,
  shadow: true,
});

await light1Entity1Node.addChild(onelight);
// await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0021

  }
)
// await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});

let ballPBROption: IV_PBRMaterial = {
  name: "PBRMaterial",
  textures: {
    albedo: { texture: { source: "/resource/PBR/marble-speckled-bl/marble-speckled-albedo.png" } },
    normal: { texture: { source: "/resource/PBR/marble-speckled-bl/marble-speckled-normal.png" } },
    metallic: { texture: { source: "/resource/PBR/marble-speckled-bl/marble-speckled-metalness.png" } },
    roughness: { texture: { source: "/resource/PBR/marble-speckled-bl/marble-speckled-roughness.png" } },
  }
}
// let ballpbrMaterial = new PBRMaterial(ballPBROption);
// await  ballpbrMaterial.init(scene);
let ballpbrMaterial = await WePbrMaterial(ballPBROption, scene);

let inputMeshsphere: IV_MeshEntity = {
  name: "sphereMesh",
  attributes: {
    geometry: sphere,
  },
  material: ballpbrMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
  name: "boxMesh",
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
  height: 30
});
let groundMaterial = new PhongMaterial(
  {
    color: [1, 1, 1, 1],
    shininess: 1,
    metalness: 0.0,
    roughness: 1,
  });

let bottomPlane = new Mesh({
  name: "bottomPlaneMesh",
  attributes: {
    geometry: planeGeometry
  },
  material: ballpbrMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(bottomPlane);

// let topPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 15, 0],
//   rotate: [1, 0, 0, Math.PI / 2],
// });
// await scene.add(topPlane);

// let backPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 0, -15],
// });
// await scene.add(backPlane);

// let frontPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 0, 15],

//   rotate: [1, 0, 0, Math.PI],
// });
// await scene.add(frontPlane);

// let leftPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [-15, 0, 0],
//   rotate: [0, 1, 0, Math.PI / 2],//正的,normal 相关
// }
// );
// await scene.add(leftPlane);

// let rightPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [15, 0, 0],
//   rotate: [0, 1, 0, -Math.PI / 2],//负的,normal 相关
// });
// await scene.add(rightPlane);
