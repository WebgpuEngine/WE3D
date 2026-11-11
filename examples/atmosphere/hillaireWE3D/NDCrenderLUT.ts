import { E_ToneMappingType, eventOfScene, IV_Scene, userDefineEventCall, initScene, Scene, E_renderPassName, AtmosphereHillaire, PerspectiveCamera } from '@we3d';

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
  reversedZ: false,
  modeNDC: true,
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

let atmosphereHillaire = new AtmosphereHillaire(
  scene,
  {
    // mode: "rayMarch"
  },);
// atmosphereHillaire.generateTransmittanceLUT();
// atmosphereHillaire.generateMultipleScatteringLUT();
// atmosphereHillaire.generateSkyViewLUT();
// atmosphereHillaire.generateApLUT();
// Object.values(atmosphereHillaire.lutCommands).forEach((item) => {
//   item.forEach((DC) => {
//     DC.submit();
//   })
// })

// atmosphereHillaire.renderWithLut();
// atmosphereHillaire.renderWithRayMarching();

////////////////////////////////////////////////////////////
let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    // atmosphereHillaire.update();

    // atmosphereHillaire.update();
    // atmosphereHillaire.lutCommands.skyview.forEach((DC) => {
    //   DC.submit();
    // });
    // atmosphereHillaire.lutCommands.ap.forEach((DC) => {
    //   DC.submit();
    // });
    // // atmosphereHillaire.renderCommands.rayMarch.forEach((DC) => {
    // atmosphereHillaire.renderCommands.withLut.forEach((DC) => {
    //   scope.renderManager.push({
    //     command: DC,
    //     kind: E_renderPassName.ndc,
    //   })
    // })
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
