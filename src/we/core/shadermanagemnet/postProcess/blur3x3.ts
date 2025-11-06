
import { I_ShaderTemplate } from "../base";
import { PP_structFS } from "./struct";
import { QuadVS } from "../mesh/quad";


import PP_Blur3x3_FS_WGSL from "../../shader/PostProcess/blur/blur3x3.fs.wgsl?raw";
var PP_Blur3x3FS = PP_Blur3x3_FS_WGSL.toString();

export var SHT_DeferRender: I_ShaderTemplate = {
    entity: {
        add: [
            QuadVS,
        ]
    },
    material: {
        owner: "Blur3x3",
        add: [
            PP_structFS,
            {
                name: "fs",
                code: PP_Blur3x3FS,
            },
        ],
    }
}
