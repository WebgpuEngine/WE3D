
import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, VideoMaterial, PlaneGeometry } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
  // reversedZ:true,
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
  position: [0, 0, 1],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);



let video_1 = document.getElementById("video") as HTMLVideoElement;



let colorMaterial = new VideoMaterial({
  textures: {
    video: video_1,
  }
});

let boxGeometry = new BoxGeometry();
let planeGeometry = new PlaneGeometry({
  width: 0.544,
  height: 0.960
});
let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

// 视频是动态内容，e2e 截图比对需固定到某一帧：播放到指定时间后暂停
async function freezeVideoAt(timeSec: number) {
  let v: HTMLVideoElement | undefined;
  for (let i = 0; i < 200; i++) {
    const vt = (colorMaterial.textures as any)["video"]?.video;
    if (vt instanceof HTMLVideoElement) { v = vt; break; }
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!v) return;
  const stop = () => { try { v!.currentTime = timeSec; } catch { /* ignore */ } v!.pause(); };
  if (v.readyState >= 1) stop();
  else v.addEventListener("loadedmetadata", stop, { once: true });
  v.addEventListener("seeked", () => v!.pause(), { once: true });
}
freezeVideoAt(0.1);

