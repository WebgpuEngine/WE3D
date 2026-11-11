import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, SphereGeometry, PhongMaterial, DirectionalLight, IV_PBRMaterial, PBRMaterial, PlaneGeometry, AmbientLight, PointLight } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  reversedZ:true,
  renderMode: "MSAARender",
   
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
  near: 0.0001,
  far: 100,
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let dirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, 1],
  intensity: 0.25,

});
await scene.add(dirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.000001
  }
)
await scene.add(ambientLight);

let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments:128,
});

console.log(geometry)

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { texture: { source: "/resource/PBR/rustediron/rustediron2_basecolor.png" }},
    // albedo:  [1.0, 0.71, 0.29],
    normal: { texture: { source: "/resource/PBR/rustediron/rustediron2_normal.png" }},
    metallic: { texture: { source: "/resource/PBR/rustediron/rustediron2_metallic.png" }},
    // metallic: 0.91,

    roughness: { texture: { source: "/resource/PBR/rustediron/rustediron2_roughness.png" }},
    // roughness: 0.31,
    
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

////////////////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
  radius: 0.01,
  widthSegments: 8,
  heightSegments: 8
});
let lightMaterial = new ColorMaterial(
  {
    color: [1, 1, 1, 1]
  });
let meshPointBall = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
  });

////////////////////////////////////////////////////////////////////////
let lightRadius = 1.65;
let lightZ = 0;
let nodeLight1 = await scene.add(
  {
    entity: meshPointBall,
    update: (scope: any) => {
      const now = Date.now() / 500;
      let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
      scope.Position = pos;
    }
  }
);

let onelight = new PointLight(
  {
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: 2.0,
  }
);
await nodeLight1.addChild(onelight);
