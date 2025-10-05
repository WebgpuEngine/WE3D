import { E_shaderTemplateReplaceType, I_shaderTemplateAdd, I_shaderTemplateReplace } from "../base";


import transparent_c4d4WGSL from "../../shader/transparent/c4d4.fs.wgsl?raw";
export var WGSL_transparent_c4d4 = transparent_c4d4WGSL.toString();

import st_transparentbufferWGSL from "../../shader/gbuffers/st_transgparentbuffer.fs.wgsl?raw";
export var WGSL_st_transparentbuffer = st_transparentbufferWGSL.toString();

import replace_transparentbufferWGSL from "../../shader/gbuffers/replace_transparentgbuffer_output.fs.wgsl?raw";
export var WGSL_replace_transparentbuffer = replace_transparentbufferWGSL.toString();



export var SHT_replaceTT_FSOutput: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",           //
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_transparentbuffer
}

export var SHT_TT: I_shaderTemplateAdd =
{
    name: "TT",
    code: WGSL_transparent_c4d4,
}