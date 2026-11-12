import { vec3 } from "wgpu-matrix";
import { E_renderForDC, OrthographicCamera, PerspectiveCamera, DrawCommandGenerator, type IV_DrawCommandGenerator, type IV_DC, eventOfScene, type IV_Scene, type userDefineEventCall, initScene, E_renderPassName, Scene, PlaneGeometry, IV_MeshEntity, Mesh, ColorMaterial } from '@we3d';

let scene = await initScene({
  initConfig: {
    canvas: "render0",
    backgroudColor: [0, 0, 0, 1],
    reversedZ: false,
  },
});
let scene1 = await initScene({
  initConfig: {
    canvas: "render1",
    backgroudColor: [0, 0, 0, 1],
    reversedZ: true,
  },
});

async function initReservedZ(scene: Scene) {
  let radius = 5;
  let Y = 0;
  let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.0001,
    far: 100,
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    update: (scope: any) => {
      const now = Date.now() / 1000;
      scope.Position = vec3.fromValues(Math.sin(now) * radius, Y, Math.cos(now) * radius);
    },
    // controlType:"orbit"
  });
  await scene.add(camera);
  let geometry = new PlaneGeometry({
    width: 3,
    height: 1,
  });

  let redMaterial = new ColorMaterial({
    color: [1, 0, 0, 1]
  });

  let greenMaterial = new ColorMaterial({
    color: [0, 1, 0, 1]
  });
  let redMeshParams: IV_MeshEntity = {
    attributes: {
      geometry: geometry,
    },
    material: redMaterial,
    cullMode: "none",
    position: [-0.5, 0, -0.0003],
  };

  let greenMeshParams: IV_MeshEntity = {
    attributes: {
      geometry: geometry,
    },
    material: greenMaterial,
    cullMode: "none"
  }
  let redPlane = new Mesh(redMeshParams);
  let greenPlane = new Mesh(greenMeshParams);
  await scene.add(redPlane);
  await scene.add(greenPlane);
}
await initReservedZ(scene);
await initReservedZ(scene1);  
