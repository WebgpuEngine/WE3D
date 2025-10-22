
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { TextureMaterial } from "../../../../src/we/core/material/standard/textureMaterial";
import { CubeTextureMaterial } from "../../../../src/we/core/material/standard/cubeTextureMaterial";

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
  AA: {
    MSAA: {
      enable: true
    }
  },
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
  near: 0.01,
  far: 100,
  position: [3, 3, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);





let boxGeometry = new BoxGeometry();



let textureMaterial = new CubeTextureMaterial({
  textures: {
    /** 立方体贴图 JPG 格式*/
    // cube: "/examples/resource/cubeIMG/cubemap/test",
    cube: "/examples/resource/cubeIMG/skycube1/skybox",
  },
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: textureMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  },
  position: [1, 1, 1],
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

