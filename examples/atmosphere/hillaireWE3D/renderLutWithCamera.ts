import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall, initScene, Scene, E_renderPassName, AtmosphereHillaire, PerspectiveCamera, IV_PointsEntity, Points } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  toneMapping: E_ToneMappingType.ACES,
  backgroudColor: [1, 1, 1, 1],
  premultipliedAlpha: false,
  reversedZ: false,// 没有默认draw的情况，不能清屏：renderLut 会错.
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
  far: 1000,
  position: [0, 1, 100],//km
  lookAt: [0, 4, 1],
  controlType: "wasd",
});
await scene.add(camera);

// 全透明点

// let mesh = new Points({
//   attributes: {
//     data: {
//       vertices: { position: [0, 0, 0] },
//     },
//   },
//   color: [0, 0, 0, 0],
// });
// console.log(mesh);
// await scene.add(mesh);

//////////////////////////////////////////////////////////////////////////////////////////////////////

// console.log("invert projectionMatrix:", mat4.inverse(scene.defaultCamera.projectionMatrix));
// console.log("invert viewMatrix:", scene.defaultCamera.viewMatrix);
let atmosphereHillaire = new AtmosphereHillaire(
  scene,
  {
    // FROM_KM_SCALE: 1000,
    mode: "rayMarch"
  },

);
  // {
  //   ray_march_min_spp: 30,           // 光线步进最小采样数
  //   ray_march_max_spp: 14,           // 光线步进最大采样数
  // }
atmosphereHillaire.configHillaire.ray_march_max_spp=64;
atmosphereHillaire.configHillaire.ray_march_min_spp=64;

window.atmosphereHillaire = atmosphereHillaire;

////////////////////////////////////////////////////////////
let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    atmosphereHillaire.sun.direction = [0, (Math.sin(timer / 2) + 0.8) / 5, -1];
    // atmosphereHillaire.sun.direction = [0,0, -1];
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
