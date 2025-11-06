import { I_shaderTemplateAdd } from "../base";
import QuadVS_WGSL from "../../shader/quad/quad.vs.wgsl?raw";


export var QuadVS: I_shaderTemplateAdd = {
    name: "vs",
    code: QuadVS_WGSL.toString(),
}