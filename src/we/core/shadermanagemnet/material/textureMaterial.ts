import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateReplace, WGSL_replace_gbuffer_output, WGSL_st_Guffer, WGSL_st_transparentbuffer } from "../base"
import { SHT_replaceTT_FSOutput, SHT_TT, TTPF_FS } from "./TT";

////////////////////////////////////////////////////////////////////////////////
//material
import textureFSWGSL from "../../shader/material/texture/texture.fs.wgsl?raw";
var textureFS = textureFSWGSL.toString();
export var SHT_materialTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "TextureMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: textureFS,
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
                name: "alpha",
                replace: "$materialColorRule",                      //alpha 的判断规则，alpha==0，alpha>alphaTest ,opacity <1.0
                replaceType: E_shaderTemplateReplaceType.value,     //output.color = vec4f(red, green, blue, alpha);
            }
        ],

    }
}
var replaceAlpha_TT_TTP_TTPF: I_shaderTemplateReplace = {
    name: "alpha",
    replace: "$materialColorRule",                      //alpha 的判断规则，alpha==0，alpha <= alphaTest ,opacity <1.0
    replaceType: E_shaderTemplateReplaceType.value,

}
var replaceOpacityPercent_TT_TTP_TTPF: I_shaderTemplateReplace = {
    name: "opacityPercent",                             // alpha判断需要在此之前
    replace: "$opacityPercent",                         // 根据是否使用opacity透明度判断，是否输出；opacity : 0.0-1.0; 
    replaceType: E_shaderTemplateReplaceType.value,
}

import textureTT_FSWGSL from "../../shader/material/texture/textureTT.fs.wgsl?raw";
var textureTT_FS = textureTT_FSWGSL.toString();
export var SHT_materialTexture_TT_FS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "TextureMaterial",
        add: [

            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: textureTT_FS,
            },

        ],
        replace: [
            {
                name: "replace_gbuffer_output",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            // //TT,TTP,TTPF相同的replace
            replaceAlpha_TT_TTP_TTPF,
            replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}

import textureTTP_FSWGSL from "../../shader/material/texture/textureTTP.fs.wgsl?raw";
var textureTTP_FS = textureTTP_FSWGSL.toString();
export var SHT_materialTexture_TTP_FS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "TextureMaterial",
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
                replaceCode: textureTTP_FS,
            },

            SHT_replaceTT_FSOutput,             // replace: "$fsOutput",   ！！！！！！！

            //TT,TTP,TTPF相同的replace
            replaceAlpha_TT_TTP_TTPF,
            replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}
import textureTTPF_FSWGSL from "../../shader/material/texture/textureTTPF.fs.wgsl?raw";
var textureTTPF_FS = textureTTPF_FSWGSL.toString();
export var SHT_materialTexture_TTPF_FS_mergeToVS: I_ShaderTemplate = {
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
            {
                name: "fsOutputColor",
                replace: "$fsOutputColor",           // replace target :  color
                /**
                * color = vec4f(red, green, blue, alpha);
                * 根据材质输出color，blend使用
                * 图像纹理需要uniform texture，采样器
                */
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: textureTTPF_FS,
            },
            //TT,TTP,TTPF相同的replace
            replaceAlpha_TT_TTP_TTPF,
            replaceOpacityPercent_TT_TTP_TTPF,
        ],
    }
}