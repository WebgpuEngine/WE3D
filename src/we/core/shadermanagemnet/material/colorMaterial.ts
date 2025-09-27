////////////////////////////////////////////////////////////////////////////////
//material
import colorFSWGSL from "../../shader/material/color/color.fs.wgsl?raw";
var colorFS = colorFSWGSL.toString();

import colorTransparentFSWGSL from "../../shader/material/color/colorTransparent.fs.wgsl?raw";
var colorTransparentFS = colorTransparentFSWGSL.toString();

import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer } from "../base"

/** 颜色材质, 不透明, 合并到VS中 */
export var SHT_materialColorFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_Guffer,
        },
        {
            name: "fs",
            code: colorFS,
        },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}
/** 颜色材质, 透明, 合并到VS中 */
export var SHT_materialColorTransparentFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fs",
                code: colorTransparentFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            }
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ]
    }
}


/** 位置颜色材质, 合并到VS中 */
export var SHT_materialOneCubeFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PositionColorMaterial",
        add: [
            {
                name: "fs",
                code: colorFS,
            },
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            }
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: " output.color = fsInput.fsPosition;\n "
            }
        ],
    }
}