import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, SHT_replaceGBufferMSAA_FSOutput, SHT_replaceGBufferMSAAinfo_FSOutput, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer, WGSL_st_transparentbuffer } from "../base"
import { SHT_replaceTT_FSOutput, SHT_TT, TTPF_FS } from "./TT";
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
            // {//使用SHT_replaceGBufferFSOutput代替
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            },
            {//判断alpha的code
                name: "if alpha",
                replace: "$fsIfAlpha",           //判断alpha
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "if(output.color.a<1.0)\n{\n    discard;\n}",
            }
        ],
    }
}


/** 颜色材质, 不透明, 合并到VS中 */
export var SHT_materialColorFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: colorFS,
            },
        ],
        replace: [
            // {//SHT_replaceGBufferMSAA_FSOutput
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_MSAA_gbuffer_output
            // },
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            },
            {//判断alpha的code
                name: "if alpha",
                replace: "$fsIfAlpha",           //判断alpha
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "if(output.color.a<1.0)\n{\n    discard;\n}",
            }
        ],
    }
}
/** 颜色材质, 不透明, 合并到VS中 */
export var SHT_materialColorFS_MSAA_info_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: colorFS,
            },
        ],
        replace: [
            // {//SHT_replaceGBufferMSAAinfo_FSOutput
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
            // },
            SHT_replaceGBufferMSAAinfo_FSOutput,                                            // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //取消设置颜色
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
            {//判断alpha的code
                name: "if alpha",
                replace: "$fsIfAlpha",           //判断alpha
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",                                      //  MSAA infor 不输出 color
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
            // {
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分

            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}


import colorTTP_FSWGSL from "../../shader/material/color/colorTTP.fs.wgsl?raw";
var colorTTP_FS = colorTTP_FSWGSL.toString();
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
                replace: "$Color",                                     //材质的主体代码,
                replaceType: E_shaderTemplateReplaceType.replaceCode,  //` output.color = vec4f(${this.red}, ${this.green}, ${this.blue}, ${this.alpha});
                replaceCode: colorTTP_FS,
            },

            SHT_replaceTT_FSOutput,             // replace: "$fsOutput",   ！！！！！！！

            //replace 按照模板有时候是需要顺序的，这里就需要
            {
                name: "colorFS set color",
                replace: "$OutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ]
    }
}

// import colorTTPF_FSWGSL from "../../shader/transparent/TTPF.fs.wgsl?raw";
// // import colorTTPF_FSWGSL from "../../shader/material/color/colorTTPF.fs.wgsl?raw";
// var TTPF_FS = colorTTPF_FSWGSL.toString();

/** 颜色材质, 不透明, 合并到VS中 
 * 1、使用TTPF的shader，在其中使用材质的输出逻辑替换
 * 2、basecolor的逻辑比较简单，只有一个color=vec4f()。其他的材质需要按需处理
*/
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
                code: TTPF_FS,
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
                replaceType: E_shaderTemplateReplaceType.value,                //color = vec4f(red, green, blue, alpha);
            }
        ],
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
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: " output.color = fsInput.fsPosition;\n "
            }
        ],
    }
}