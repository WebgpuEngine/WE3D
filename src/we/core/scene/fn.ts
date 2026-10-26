import { Points } from "../entity/mesh/points";
import { initSceneConfig } from "./base";
import { Scene } from "./scene";

export async function initScene(config: initSceneConfig) {
    const initValues = config.initConfig;
    // if (config.loadConfig) {
    //     initValues.backgroudColor = config.loadConfig.weRender.backgroudColor;
    //     initValues.premultipliedAlpha = config.loadConfig.surface.premultipliedAlpha;
    //     initValues.surface = config.loadConfig.surface;
    // }
    const scene = new Scene(initValues);
    await scene.init();
    // if (config.loadConfig) {
    //     scene.load(config.loadConfig);
    // }
    if (config.runImmediately === false||config.runImmediately == undefined
        //  || config.loadConfig == undefined
    ) {
        scene.run();
    }
    if (config.initConfig.modeNDC !== true) {
        // 全透明点
        const mesh = new Points({
            name: "全透明点",
            attributes: {
                data: {
                    vertices: { position: [0, 0, 0] },
                },
            },
            color: [0, 0, 0, 0],
        });
        await scene.add(mesh);
    }

    return scene;
}

