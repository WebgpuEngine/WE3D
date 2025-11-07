
import { I_ShaderTemplate } from "../base";
import { PP_structFS } from "./struct";
import { QuadVS } from "../mesh/quad";


import PP_FXAA_FS_WGSL from "../../shader/PostProcess/AA/FXAA.fs.wgsl?raw";
var PP_FXAAFS = PP_FXAA_FS_WGSL.toString();

export var SHT_PP_FXAA: I_ShaderTemplate = {
    entity: {
        add: [
            QuadVS,
        ]
    },
    material: {
        owner: "PP_FXAA",
        add: [
            PP_structFS,
            {
                name: "fs",
                code: PP_FXAAFS,
            },
        ],
    }
}
