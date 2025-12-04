
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { PointLight } from "../../../../src/we/core/light/pointLight";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { PlaneGeometry } from "../../../../src/we/core/geometry/planeGeomertry";
import { SpotLight } from "../../../../src/we/core/light/SpotLight";
import { IV_PBRMaterial, PBRMaterial } from "../../../../src/we/core/material/PBR/PBRMaterial";

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
    deferRender: "color",
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
  position: [1.5, 8, 0],
  // position: [1.5, 2, -5],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let lightRadius = 1.5;
let lightY = 2;
let light1Entity1 = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
   position: [-2, 1, -1],
    shadow: {
      generate: false,
      accept: false,
    },
    update: (scope: any) => {
      const now = Date.now() / 1000;
      let pos = [Math.sin(now) * lightRadius, lightY, Math.cos(now) * lightRadius];
      scope.Position = pos;
    }
  });
await scene.add(light1Entity1);

let onelight = new PointLight(
  {
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: 9,
    // intensity: 20,//没有进行tone mapping 之前
    shadow: true,

  }
);
// scene.add(onelight);
await light1Entity1.addChild(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.001
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////

//实体球
let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments:128,
});
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: {textureUrl: { source: "/resource/PBR/rustediron/rustediron2_basecolor.png" }},
    normal: { textureUrl: { source: "/resource/PBR/rustediron/rustediron2_normal.png" }},
    metallic: { textureUrl: { source: "/resource/PBR/rustediron/rustediron2_metallic.png" }},
    roughness: { textureUrl: { source: "/resource/PBR/rustediron/rustediron2_roughness.png" }},
  }
}
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
}
let mesh = new Mesh(inputMesh);
await scene.add(mesh);

//实体地板
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});


let groundMaterialPBROption: IV_PBRMaterial = {
  textures: {
    albedo: {textureUrl: { source: "/resource/PBR/grainy-concrete/grainy-concrete_albedo.png" }},
    normal: { textureUrl: { source: "/resource/PBR/grainy-concrete/grainy-concrete_normal-ogl.png" }},
    metallic: { textureUrl: { source: "/resource/PBR/grainy-concrete/grainy-concrete_metallic.png" }},
    roughness: { textureUrl: { source: "/resource/PBR/grainy-concrete/grainy-concrete_roughness.png" }},
    ao: { textureUrl: { source: "/resource/PBR/grainy-concrete/grainy-concrete_ao.png" }},
  }
}
let groundMaterial = new PBRMaterial(groundMaterialPBROption);
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);