import { AmbientLight, PerspectiveCamera, DirectionalLight, E_ToneMappingType, IV_Scene, initScene, PointLight } from '@we3d';

import { vec3, vec4 } from "wgpu-matrix";

export async function initWe() {
    let input: IV_Scene = {
        canvas: "render",
        backgroudColor: [0, 0., 0., 0.],
        reversedZ: true,
        // AA:{
        //     MSAA: {
        //         enable: true,
        //     }
        // },
        // toneMapping: E_ToneMappingType.linear,
        // toneMapping: E_ToneMappingType.acesToSRGB,
        toneMapping: E_ToneMappingType.linearToSRGB,
        renderMode: "deferRender"
    };
    let scene = await initScene({ initConfig: input, });
    window.scene = scene;

    let onelight = new DirectionalLight({
        color: [1, 1, 1],
        direction: [0, 1, 1],
        intensity: 0.8,
        // shadow: true,
    });
    await scene.add(onelight);

    let camera = new PerspectiveCamera({
        fov: (Math.PI) / 4,
        aspect: scene.aspect,
        near: 0.1,
        far: 300,
        position: [3, 3, 3],
        lookAt: [0, 0, 0],
        controlType: "orbit",
        update: (scope) => {
            let lookOfCamera = camera.LookAt;
            let position = camera.Position;
            let dir = vec3.normalize(vec3.sub(position, lookOfCamera));
            if (dir) {
                onelight.Direction = [dir[0], dir[1], dir[2]];
            }
        }
    });
    await scene.add(camera);

    // let onelightOfPoint = new PointLight({
    //     color: [1, 1, 1],
    //     position: [0, 3, 3],
    //     intensity: 5,
    //     shadow: false,
    // });
    // await camera.add(onelightOfPoint);

    let ambientLight = new AmbientLight(
        {
            color: [1, 1, 1],
            intensity: 0.1
        }
    )
    await scene.add(ambientLight);
    return scene;
}
