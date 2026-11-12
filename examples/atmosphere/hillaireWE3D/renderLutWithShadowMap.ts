import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall, initScene, Scene, E_renderPassName, AtmosphereHillaire, PerspectiveCamera, IV_MeshEntity, Mesh, SphereGeometry, AmbientLight, DirectionalLight, IV_PBRMaterial, PBRMaterial, PlaneGeometry } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  toneMapping: E_ToneMappingType.ACES,
  backgroudColor: [0., 0., 0., 0.],
  premultipliedAlpha: false,
  reversedZ: true,
  // modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;
let camera = new PerspectiveCamera({
  fov: 45.0 * (Math.PI / 180.0),
  aspect: scene.aspect,
  near: 0.1,
  far: 100000,
  position: [15, 10, 50],//km
  // position: [0, 1, 100],//km
  lookAt: [0.0, 0.4, 1],
  isLookAtGlobal: true,
  controlType: "wasd",
});
await scene.add(camera);

//////////////////////////////////////////////////////////////////////
// light
let timer = 0;
let dirLight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,
  shadow: true,
  update: (light: DirectionalLight) => {
    timer += 0.016667;
    light.Direction = [0, (Math.sin(timer / 2) + 0.8) / 4, -1];
  }
});
await scene.add(dirLight);
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0006
  }
)
// await scene.add(ambientLight);
//////////////////////////////////////////////////////////////////////
// scene
// ground
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});
// let groundMaterial = new PhongMaterial({
//   color: [1, 1, 1, 1],
//   roughness: 1,
//   metalness: 0.1,
//   shininess: 32
// });

let pbrGroundMaterial = new PBRMaterial({
  textures: {
    albedo: { value: [.50, .50, .50, 1] },
    metallic: { value: 0.1 },
    roughness: { value: 0.91 },
  }
});
let groundMesh = new Mesh({
  attributes: { geometry: planeGeometry, },
  material: pbrGroundMaterial,
});
let groundEntity = await scene.add({
  entity: groundMesh,
  position: [0, 0, 0],
  rotate: [1, 0, 0, -Math.PI / 2],
  scale: [10, 1, 10],

});
groundEntity.Name = "ground"

// sphere
let geometry = new SphereGeometry({
  widthSegments: 32,
  heightSegments: 32,
});
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { value: [1.0, 0.71, 0.29, 1] },
    metallic: { value: 0.3 },
    roughness: { value: 0.7 },
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
// console.log(mesh);
await scene.add({
  entity: mesh,
  position: [1, 5, 0],
  scale: [2, 2, 2],
});
await scene.add({
  entity: mesh,
  position: [6, 5, 0],
  scale: [2, 2, 2],
});

////////////////////////////////////////////////////////////
// atmosphere
let atmosphereHillaire = new AtmosphereHillaire(
  scene,
  {
    // FROM_KM_SCALE:  1000,
    // mode: "rayMarch",
    // ray_march_min_spp: 64,
    // ray_march_max_spp: 48,
  },
  [
    {
      directionalLight: dirLight,
    }
  ]
);
console.log(atmosphereHillaire);
window.atmosphereHillaire = atmosphereHillaire;

scene.run();
