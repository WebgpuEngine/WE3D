
import { I_ShaderTemplate } from "../base";
import { PP_structFS } from "./struct";
import { QuadVS } from "../mesh/quad";


import PP_RedToOne_FS_WGSL from "../../shader/PostProcess/test/redToOne.wgsl?raw"
// "../../shader/PostProcess/test/redToOne.fs.wgsl?raw";
var PP_RedToOneFS = PP_RedToOne_FS_WGSL.toString();

export var SHT_PP_RedToOne: I_ShaderTemplate = {
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
                code: PP_RedToOneFS,
            },
        ],
    }
}
