import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_st_Guffer, WGSL_st_transparentbuffer } from "../base"
import { SHT_replaceTT_FSOutput, SHT_TT, WGSL_transparent_c4d4 } from "./TT";
////////////////////////////////////////////////////////////////////////////////
//material

import colorFSWGSL from "../../shader/material/color/color.fs.wgsl?raw";
var colorFS = colorFSWGSL.toString();

/** 颜色材质, 不透明, 合并到VS中 */
export var SHT_materialColorFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
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

import colorTTPF_FSWGSL from "../../shader/material/color/colorTTPF.fs.wgsl?raw";
var colorTTPF_FS = colorTTPF_FSWGSL.toString();

/** 颜色材质, 不透明, 合并到VS中 */
export var SHT_materialColor_TTPF_FS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: colorTTPF_FS,
            },
        ],
        replace: [
            // {
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            {
                name: "fsOutputColor",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}

import colorTTFSWGSL from "../../shader/material/color/colorTT.fs.wgsl?raw";
var colorTTFS = colorTTFSWGSL.toString();

/**colorTT: 颜色材质, 透明, 合并到VS中 */
export var SHT_materialColor_TT_FS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: colorTTFS,
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


import colorTPFSWGSL from "../../shader/material/color/colorTTP.fs.wgsl?raw";
var colorTPFS = colorTPFSWGSL.toString();

/**colorTP: 像素级别 */
export var SHT_materialColor_TTP_FS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            SHT_TT,
            {
                name: "fsOnput",
                code: WGSL_st_transparentbuffer,
            }
        ],
        replace: [
            {
                name: "Color",
                replace: "$Color",                                     //材质的主体代码
                replaceType: E_shaderTemplateReplaceType.replaceCode,  //` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha});
                replaceCode: colorTPFS,
            },
            SHT_replaceTT_FSOutput,
            //replace 按照模板有时候是需要顺序的，这里就需要
            {
                name: "colorFS set color",
                replace: "$OutputColor",           //
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