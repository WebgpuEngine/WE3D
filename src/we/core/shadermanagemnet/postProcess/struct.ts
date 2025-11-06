
import PP_struct_WGSL from "../../shader/PostProcess/PPstruct.wgsl?raw";
import { I_shaderTemplateAdd } from "../base";
var PP_structCodeFS = PP_struct_WGSL.toString();

export var PP_structFS: I_shaderTemplateAdd = {
    name: "fs",
    code: PP_structCodeFS,
}