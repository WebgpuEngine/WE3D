import type { E_renderForDC } from '../base/coreDefine';
import type { IV_DC } from '../command/DrawCommandGenerator';
import type { I_materialBundleOutput } from '../material/base';
import { E_entityType } from './base';
import type { EntityBundleMaterial } from './entityBundleMaterial';

/**
 * mesh 生成DrawCommand的input value
 * 1、透明材质的entity使用
 * 2、shadowmap的entity使用
 * @param type 渲染类型
 * @param UUID camera UUID or light merge UUID
 * @param vsBundle 实体的uniform和shader模板
 * @param vsOnly 是否只渲染顶点
 * @returns IV_DrawCommand
 */
export interface I_bundleForInputValueOfDC {
    vs: {
        code: string;
        entryPoint?: string;
    };
    fs?: I_materialBundleOutput;
    // fs?: {
    //     materialType: E_materialTypeForBindGroup,
    //     code: string,
    //     entryPoint?: string,
    //     aliasName: string,
    // }
}

/**
 * 第 3 期巨型文件拆分（C4）：从 EntityBundleMaterial.generateInputValueOfDC 抽出。
 * 无 this 依赖，全部经 scope 访问；函数体逐字搬移，IV_DC 构造内容不变。
 * scope 用 import type 引入主类，编译后擦除，避免运行时循环依赖。
 */
export function generateInputValueOfDC(
    scope: EntityBundleMaterial,
    renderType: E_renderForDC,
    bundle: I_bundleForInputValueOfDC,
    vsOnly: boolean = false,
): IV_DC {
        // if (scope.boundingBox == undefined)
        //     scope.generateBoxAndSphere();
        let boundingBoxMaxSize = scope.getBoundingBoxMaxSize(); //生成 shader 中的cubeVecUV使用
        if (boundingBoxMaxSize === 0) boundingBoxMaxSize = 1;

        let fragment = undefined;
        if (bundle.fs) {
            fragment = {
                code: bundle.fs.code,
                entryPoint: bundle.fs.entryPoint || 'fs',
                aliasName: bundle.fs.aliasName,
            };
        }
        const valueDC: IV_DC = {
            label: `${scope.kind} ${scope.Name || scope.ID}`,
            data: {
                vertices: scope.attributes.vertices,
                vertexStepMode: scope.attributes.vertexStepMode,
                indices: scope.attributes.indices,
                // uniforms,
            },
            render: {
                vertex: {
                    code: bundle.vs.code,
                    entryPoint: bundle.vs.entryPoint || 'vs',
                    constants: {
                        boundingBoxMaxSize: boundingBoxMaxSize,
                    },
                },
                fragment,
                // drawMode: (UUID: string, kind: E_renderForDC) => { return scope.getDrawModeArrayOfInstances(UUID, kind) },
                primitive: scope._primitive,
            },
            system: {
                // UUID: scope.UUID,
                type: renderType,
                parent: scope,
            },
            IDS: {
                UUID: scope.UUID,
                ID: scope.ID,
                renderID: scope.ID,
            },
        };
        if (bundle.fs) {
            valueDC.system!.material = {
                owner: scope._material,
                type: bundle.fs.materialType,
            };
        }
        if (scope._dynamicAttribute) {
            valueDC.dynamic = {
                vs: true,
            };
        }
        // // 如果是动态材质，需要在DrawCommand中添加dynamic属性,并每帧重新生成bind group
        // if (bundle.fsBundle && bundle.fsBundle.shaderTemplateFinal.material?.dynamic === true) {
        //     if (valueDC.dynamic == undefined)
        //         valueDC.dynamic = { fs: true };
        //     else
        //         valueDC.dynamic.fs = true;
        // }
        if (scope.inputValues.primitive) {
            valueDC.render.primitive = scope.inputValues.primitive;
        } else {
            if (scope.kind == E_entityType.lines) {
                valueDC.render.primitive!.topology = 'line-list';
            }
        }

        if (vsOnly) {
            delete valueDC.render.fragment;
            valueDC.label += ' vsOnly';
        }
        return valueDC;
}
