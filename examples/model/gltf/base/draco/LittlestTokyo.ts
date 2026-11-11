import { PerspectiveCamera, E_ToneMappingType, IV_Scene, initScene, createGLTFModel, DirectionalLight, AmbientLight, FXAA, PointLight } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0.5, 0.5, 0.5, 1.],
  premultipliedAlpha: true,
  reversedZ: true,
  toneMapping: E_ToneMappingType.ACES,
  renderMode:"deferRender",
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;
let oneDirlight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 1],
  intensity: 2,
  shadow: false,
});
await scene.add(oneDirlight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: .950
  }
)
await scene.add(ambientLight);
let fxaa = new FXAA({ scene });
// fxaa.setShowEdges(1);

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 1,
  far: 1000,
  position: [3, 3, 80],
  lookAt: [0, 0, 0],
  controlType: "orbit",

});
await scene.add(camera);

let gltf = await createGLTFModel({
  name: "LittlestTokyo",
  scene: scene,
  url: "/models/gltf/model/LittlestTokyo/LittlestTokyo.glb"
},
  {
    beforeGltfInit: (gltf, dataLoader) => {
      // dataLoader.gltfJson.materials![0].occlusionTexture=undefined;//移除occlusionTexture,normal,也感觉不对
      // dataLoader.gltfJson.materials![1].occlusionTexture=undefined;//移除occlusionTexture,修正铁的ao过重
      // dataLoader.gltfJson.materials![7].occlusionTexture=undefined;//移除occlusionTexture,修正透明的ao混乱
      // dataLoader.gltfJson.materials![12].occlusionTexture=undefined;//移除occlusionTexture,修正植物花ao混乱
      // dataLoader.gltfJson.materials![1].occlusionTexture!.strength = .032;//改变AO强度
    }
  }
);
window.gltf = gltf;
window.gltfInstance = await scene.add(gltf, {
  position: [2, 1, 0],
  scale: [0.1, 0.1, 0.1],
  // rotate: [1, 0, 0, Math.PI/2],
});

window.gltfInstance.AnimationGroup[0].play("loop");
