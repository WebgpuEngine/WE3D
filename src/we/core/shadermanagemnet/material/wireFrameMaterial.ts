////////////////////////////////////////////////////////////////////////////////
//material
import wireFrameFSWGSL from "../../shader/material/wirframe/wireFrame.fs.wgsl?raw";
var wireFrameFS = wireFrameFSWGSL.toString();



import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, SHT_replaceGBufferMSAA_FSOutput, SHT_replaceGBufferMSAAinfo_FSOutput, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer } from "../base"

/**不透明 */
export var SHT_WireFrameFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_Guffer,
        },
        {
            name: "fs",
            code: wireFrameFS,
        },

        ],
        replace: [
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
/**不透明 */
export var SHT_WireFrameFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_MSAA_Guffer,
        },
        {
            name: "fs",
            code: wireFrameFS,
        },

        ],
        replace: [
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //output.color = vec4f(red, green, blue, alpha);
            }
        ],
    }
}
/**不透明 */
export var SHT_WireFrameFS_MSAAinfo_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [{
            name: "fsOnput",
            code: WGSL_st_MSAAinfo_Guffer,
        },
        {
            name: "fs",
            code: wireFrameFS,
        },

        ],
        replace: [
            SHT_replaceGBufferMSAAinfo_FSOutput,                                            // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //取消设置颜色
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
        ],
    }
}