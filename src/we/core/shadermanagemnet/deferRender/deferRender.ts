
import { I_ShaderTemplate, SHT_addMathBase, SHT_addMathRandom, SHT_addPCSS, SHT_ScenOfCamera } from "../base";
import { SHT_add_PBR_function } from "../material/pbrMaterial";


import DeferRenderFS_WGSL from "../../shader/defer/deferRender.fs.wgsl?raw";
var DeferRenderFS = DeferRenderFS_WGSL.toString();

import QuadVS_WGSL from "../../shader/quad/quad.vs.wgsl?raw";
import { SHT_add_Phong_function } from "../material/phongMaterial";
/**Defer PBR light and shadow shader template */
export var SHT_DeferRender: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "vs",
                code: QuadVS_WGSL.toString(),
            }
        ]
    },
    material: {
        owner: "Defer DC, cameraManager",
        add: [
            SHT_addMathBase,
            SHT_addMathRandom,
            SHT_addPCSS,
            SHT_add_PBR_function,
            SHT_add_Phong_function,
            {
                name: "fs",
                code: DeferRenderFS,
            },


        ],
    }
}
