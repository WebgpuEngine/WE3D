import { describe, it, expect, beforeAll } from 'vitest';
import type { Scene } from '../scene/scene';

// WebGPU 全局在 node 环境缺失；DrawCommandGenerator 的 import 链在模块顶层引用了 GPUTextureUsage 等。
// 在动态 import 前补齐这些数值常量（仅需运行期存在，值不影响缓存 key 测试）。
beforeAll(() => {
    const flags: Record<string, number> = {};
    for (const k of [
        'COPY_SRC',
        'COPY_DST',
        'TEXTURE_BINDING',
        'STORAGE_BINDING',
        'RENDER_ATTACHMENT',
        'TRANSIENT_ATTACHMENT',
        'VERTEX',
        'INDEX',
        'UNIFORM',
        'INDIRECT',
        'QUERY_RESOLVE',
        'MAP_READ',
        'MAP_WRITE',
    ]) {
        flags[k] = 1;
    }
    Object.assign(globalThis, {
        GPUTextureUsage: { ...flags },
        GPUBufferUsage: { ...flags },
        GPUMapMode: { READ: 1, WRITE: 2 },
    });
});

/** 可观察 Store mock：背后用 Map 承接，暴露 peek/acquire，便于断言缓存 key 与命中数。 */
function makeObservableStore<V = unknown>() {
    const map = new Map<string, V>();
    return {
        map,
        get size() {
            return map.size;
        },
        peek: (key: string) => map.get(key),
        acquire: (key: string, factory: () => V) => {
            let value = map.get(key);
            if (value === undefined) {
                value = factory();
                map.set(key, value);
            }
            return { value, ticket: { id: 0, released: false } };
        },
    };
}

describe('DrawCommandGenerator.initPipeLine 缓存 key — P0-3', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    const mockDevice = {
        createPipelineLayout: () => ({}),
        createRenderPipeline: () => ({}),
    } as unknown as GPUDevice;

    function makeGenerator() {
        const pipelines = makeObservableStore();
        const shaderModules = makeObservableStore();
        const scene = {
            device: mockDevice,
            resourcesGPU: { derived: { pipelines, shaderModules } },
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
                depthStencilTT: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAAinfo: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAA: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
            },
        } as unknown as Scene;
        const generator = new DrawCommandGenerator({ scene });
        return { pipelines, generator };
    }

    const vertex = { vs: {}, name: 'vs-md5' };
    const fragment = { fs: undefined, name: 'fs-md5' };

    const makeValue = (depthWriteEnabled: boolean) => ({
        label: 'p0-3',
        data: {},
        render: {
            vertex: { code: 'x', entryPoint: 'vs' },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled,
                depthCompare: 'less',
            },
        },
    });

    it('仅 depthWriteEnabled 不同 → 不误命中，应创建两个 pipeline', () => {
        const { pipelines, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(false), vertex, fragment, []);
        expect(pipelines.size).toBe(2);
    });

    it('depthStencil 完全相同 → 命中缓存，只创建一个 pipeline', () => {
        const { pipelines, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        expect(pipelines.size).toBe(1);
    });
});

describe('DrawCommandGenerator.initPipeLine 缓存 key — P0-1 维度补全', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    const mockDevice = {
        createPipelineLayout: () => ({}),
        createRenderPipeline: () => ({}),
    } as unknown as GPUDevice;

    function makeGenerator() {
        const pipelines = makeObservableStore();
        const shaderModules = makeObservableStore();
        const scene = {
            device: mockDevice,
            resourcesGPU: { derived: { pipelines, shaderModules } },
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
                depthStencilTT: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAAinfo: {
                    format: 'depth24plus',
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                },
                depthStencilMSAA: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                },
            },
        } as unknown as Scene;
        const generator = new DrawCommandGenerator({ scene });
        return { pipelines, generator };
    }

    const makeValue = (overrides: Record<string, unknown> = {}) => ({
        label: 'p0-1',
        data: {},
        render: { vertex: { code: 'x', entryPoint: 'vs' }, ...overrides },
    });

    it('仅 bindGroupLayouts 不同 → 不复用，应创建两个 pipeline', () => {
        const { pipelines, generator } = makeGenerator();
        const vertex = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
        const fragment = { fs: undefined, name: 'fs-md5' };
        generator.initPipeLine(makeValue(), vertex, fragment, [{ label: 'layout-A' }]);
        generator.initPipeLine(makeValue(), vertex, fragment, [{ label: 'layout-B' }]);
        expect(pipelines.size).toBe(2);
    });

    it('仅 fragment.targets 不同 → 不复用，应创建两个 pipeline', () => {
        const { pipelines, generator } = makeGenerator();
        const vertex = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
        const fragmentA = {
            fs: { module: {}, entryPoint: 'fs', targets: [{ format: 'bgra8unorm' }] },
            name: 'fs-md5',
        };
        const fragmentB = {
            fs: { module: {}, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
            name: 'fs-md5',
        };
        generator.initPipeLine(makeValue(), vertex, fragmentA, []);
        generator.initPipeLine(makeValue(), vertex, fragmentB, []);
        expect(pipelines.size).toBe(2);
    });

    it('仅 vertex.buffers 不同 → 不复用，应创建两个 pipeline', () => {
        const { pipelines, generator } = makeGenerator();
        const vertexA = {
            vs: {
                module: {},
                entryPoint: 'vs',
                buffers: [{ arrayStride: 12, attributes: [] }],
            },
            name: 'vs-md5',
        };
        const vertexB = {
            vs: {
                module: {},
                entryPoint: 'vs',
                buffers: [{ arrayStride: 24, attributes: [] }],
            },
            name: 'vs-md5',
        };
        const fragment = { fs: undefined, name: 'fs-md5' };
        generator.initPipeLine(makeValue(), vertexA, fragment, []);
        generator.initPipeLine(makeValue(), vertexB, fragment, []);
        expect(pipelines.size).toBe(2);
    });

    it('仅 vertex.constants / vertex.entryPoint 不同 → 不复用', () => {
        // constants 不同
        {
            const { pipelines, generator } = makeGenerator();
            const vertexA = {
                vs: { module: {}, entryPoint: 'vs', constants: { scale: 1 } },
                name: 'vs-md5',
            };
            const vertexB = {
                vs: { module: {}, entryPoint: 'vs', constants: { scale: 2 } },
                name: 'vs-md5',
            };
            const fragment = { fs: undefined, name: 'fs-md5' };
            generator.initPipeLine(makeValue(), vertexA, fragment, []);
            generator.initPipeLine(makeValue(), vertexB, fragment, []);
            expect(pipelines.size).toBe(2);
        }
        // entryPoint 不同
        {
            const { pipelines, generator } = makeGenerator();
            const vertexA = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
            const vertexB = { vs: { module: {}, entryPoint: 'vsAlt' }, name: 'vs-md5' };
            const fragment = { fs: undefined, name: 'fs-md5' };
            generator.initPipeLine(makeValue(), vertexA, fragment, []);
            generator.initPipeLine(makeValue(), vertexB, fragment, []);
            expect(pipelines.size).toBe(2);
        }
    });

    it('key 快照：完整 descriptor 稳定序列化结果固定（含 targets / buffers 等维度）', () => {
        const { pipelines, generator } = makeGenerator();
        const vertex = {
            vs: {
                module: {},
                entryPoint: 'vs',
                buffers: [{ arrayStride: 12, attributes: [] }],
                constants: {},
            },
            name: 'vs-md5',
        };
        const fragment = {
            fs: {
                module: {},
                entryPoint: 'fs',
                targets: [{ format: 'bgra8unorm' }],
                constants: {},
            },
            name: 'fs-md5',
        };
        generator.initPipeLine(makeValue({ depthStencil: false }), vertex, fragment, []);
        expect([...pipelines.map.keys()]).toEqual([
            '{"bindGroupLayouts":[],"depthStencil":undefined,"fragment":{"code":"fs-md5","constants":{},"entryPoint":"fs","targets":[{"format":"bgra8unorm"}]},"multisample":undefined,"primitive":undefined,"reflectionSignature":"","variantKey":"","vertex":{"buffers":[{"arrayStride":12,"attributes":[]}],"code":"vs-md5","constants":{},"entryPoint":"vs"}}',
        ]);
    });

    it('§2.4 ② 元数据进入 keyObject 可读，且不改变命中语义', () => {
        const { pipelines, generator } = makeGenerator();
        const vertex = {
            vs: { module: {}, entryPoint: 'vs', buffers: [], constants: {} },
            name: 'vs-md5',
            variantKey: 'material.pbr:variant-a',
            reflectionSignature: '{"applied":true,"ndc":false}',
        };
        const fragment = { fs: undefined, name: '' };
        const values = makeValue({ depthStencil: false });

        generator.initPipeLine(values, vertex, fragment, []);
        const key = [...pipelines.map.keys()][0];
        expect(key).toContain('"variantKey":"material.pbr:variant-a"');
        expect(key).toContain('"reflectionSignature":"{\\"applied\\":true,\\"ndc\\":false}"');

        // 同一 descriptor + 同一元数据仍命中同一条目：命中分区未被元数据改变
        generator.initPipeLine(values, vertex, fragment, []);
        expect(pipelines.size).toBe(1);
    });
});

describe('DrawCommandGenerator.initShaderModule — P0-2 targets 拷贝与越界保护', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    function makeGenerator() {
        const scene = {
            device: { createShaderModule: () => ({}) },
            resourcesGPU: {
                derived: {
                    shaderModules: makeObservableStore(),
                    pipelines: makeObservableStore(),
                },
            },
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {},
            finalTarget: { NDC: true },
        } as unknown as Scene;
        const generator = new DrawCommandGenerator({ scene });
        return { generator };
    }

    const blendA = {
        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
    };
    const blendB = {
        color: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
    };

    it('传入同一 targets 数组、两次不同 transparent → 两次 fragment.targets 的 blend 互不影响', () => {
        const { generator } = makeGenerator();
        const sharedTargets = [{ format: 'bgra8unorm' }];
        const makeValue = (transparent: unknown[]) => ({
            label: 'p0-2',
            data: {},
            render: {
                vertex: { code: 'vs', entryPoint: 'vs' },
                fragment: {
                    code: 'fs',
                    entryPoint: 'fs',
                    aliasName: 'fs',
                    targets: sharedTargets,
                },
            },
            transparent,
        });

        const r1 = generator.initShaderModule(makeValue([blendA]), [], [], []);
        const r2 = generator.initShaderModule(makeValue([blendB]), [], [], []);

        // 两次结果各自的 blend 不同
        expect(r1.fragment.targets[0].blend).toBe(blendA);
        expect(r2.fragment.targets[0].blend).toBe(blendB);
        // 调用方原始 targets 未被污染（blend 未写入）
        expect(sharedTargets[0]).not.toHaveProperty('blend');
        // 返回的 targets 是拷贝，非调用方引用，且两次互不共享
        expect(r1.fragment.targets).not.toBe(sharedTargets);
        expect(r2.fragment.targets).not.toBe(sharedTargets);
        expect(r1.fragment.targets).not.toBe(r2.fragment.targets);
    });

    it('transparent 长度超过 targets 长度 → 不越界抛错，仅处理 targets 长度内的项', () => {
        const { generator } = makeGenerator();
        const targets = [{ format: 'bgra8unorm' }];
        const values = {
            label: 'p0-2-overflow',
            data: {},
            render: {
                vertex: { code: 'vs', entryPoint: 'vs' },
                fragment: { code: 'fs', entryPoint: 'fs', aliasName: 'fs', targets },
            },
            transparent: [blendA, blendB],
        };
        const result = generator.initShaderModule(values, [], [], []);
        expect(result.fragment.targets).toHaveLength(1);
        expect(result.fragment.targets[0].blend).toBe(blendA);
    });

    it('§2.4 ② 返回 variantKey / reflectionSignature 元数据（NDC 跳过反射）', () => {
        const { generator } = makeGenerator();
        const makeValues = (vsCode: string) => ({
            label: 'meta',
            data: {},
            render: {
                vertex: { code: vsCode, entryPoint: 'vs' },
                fragment: {
                    code: 'fs',
                    entryPoint: 'fs',
                    aliasName: 'material.color',
                    targets: [{ format: 'bgra8unorm' }],
                },
            },
        });
        const args = ['position'];
        const locations = ['@location(0) position'];

        const a = generator.initShaderModule(makeValues('vs-A'), args, locations, []);
        const b = generator.initShaderModule(makeValues('vs-B'), args, locations, []);
        const a2 = generator.initShaderModule(makeValues('vs-A'), args, locations, []);

        // 可读前缀 + 变种区分 + 稳定复现
        expect(a.variantKey.startsWith('material.color:')).toBe(true);
        expect(a.variantKey).not.toBe(b.variantKey);
        expect(a2.variantKey).toBe(a.variantKey);
        expect(a2.reflectionSignature).toBe(a.reflectionSignature);
        // NDC === true → 跳过反射，applied=false 必须与 true 区分
        expect(a.reflectionSignature).toContain('"applied":false');
        expect(a.reflectionSignature).toContain('"ndc":true');
        expect(a.reflectionSignature).toContain('"names":["position"]');
    });

    it('§2.4 ② material 透传的 variantKey 优先于兜底 hash', () => {
        const { generator } = makeGenerator();
        const values = {
            label: 'meta',
            data: {},
            render: {
                vertex: { code: 'vs-A', entryPoint: 'vs' },
                fragment: {
                    code: 'fs',
                    entryPoint: 'fs',
                    aliasName: 'material.color',
                    variantKey: 'material.color:deadbeef',
                    targets: [{ format: 'bgra8unorm' }],
                },
            },
        };
        const result = generator.initShaderModule(
            values,
            ['position'],
            ['@location(0) position'],
            [],
        );
        expect(result.variantKey).toBe('material.color:deadbeef');
    });
});

/**
 * 第 3 期巨型文件拆分的行为特征基线（C0）：
 * C8 会把类型块 / stableStringify / WGSL 格式表 / initVertexPart 抽到 4 个新模块，
 * 此处固化 WGSL 顶点格式映射表、@location 字符串输出与 generateDrawCommand 的编排顺序。
 */
describe('DrawCommandGenerator 生成结果特征基线（C0）', () => {
    type Ctor = typeof import('./DrawCommandGenerator').DrawCommandGenerator;
    let DrawCommandGenerator: Ctor;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    const WGSL_FORMAT_TABLE: Record<string, string> = {
        float32: 'f32',
        float32x2: 'vec2f',
        float32x3: 'vec3f',
        float32x4: 'vec4f',
        uint32: 'u32',
        uint32x2: 'vec2u',
        uint32x3: 'vec3u',
        uint32x4: 'vec4u',
        uint16: 'u16',
        uint16x2: 'vec2u',
        uint16x4: 'vec4u',
        uint8: 'u32',
        uint8x2: 'vec2u',
        uint8x4: 'vec4u',
        sint32: 'i32',
        sint32x2: 'vec2i',
        sint32x3: 'vec3i',
        sint32x4: 'vec4i',
        sint16: 'i16',
        sint16x2: 'vec2i',
        sint16x4: 'vec4i',
        sint8: 'i32',
        sint8x2: 'vec2i',
        sint8x4: 'vec4i',
        unorm16: 'f32',
        unorm16x2: 'vec2f',
        unorm16x4: 'vec4f',
        snorm16: 'f32',
        snorm16x2: 'vec2f',
        snorm16x4: 'vec4f',
        'unorm10-10-10-2': 'vec4f',
        'unorm8x4-bgra': 'vec4f',
        float16: 'f16',
        float16x2: 'vec2f',
        float16x4: 'vec4f',
    };

    function makeGenerator() {
        const scene = {
            device: { createPipelineLayout: () => ({}), createRenderPipeline: () => ({}) },
            resourcesGPU: {
                derived: {
                    shaderModules: makeObservableStore(),
                    pipelines: makeObservableStore(),
                },
            },
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {},
            finalTarget: { NDC: false },
        };
        const generator = new DrawCommandGenerator({
            scene,
        } as unknown as ConstructorParameters<Ctor>[0]);
        return { generator };
    }

    it('getWgslValueFormat 全量格式映射表固定（35 项）', () => {
        const { generator } = makeGenerator();
        expect(Object.keys(WGSL_FORMAT_TABLE)).toHaveLength(35);
        for (const [format, expected] of Object.entries(WGSL_FORMAT_TABLE)) {
            expect(generator.getWgslValueFormat(format), format).toBe(expected);
        }
        expect(() => generator.getWgslValueFormat('unknown-format')).toThrow(
            '顶点属性格式不能匹配数据',
        );
    });

    it('formatLocationStringOfAttribute 输出固定（含尾随逗号与空格）', () => {
        const { generator } = makeGenerator();
        const values = {} as unknown as Parameters<
            typeof generator.formatLocationStringOfAttribute
        >[0];
        expect(generator.formatLocationStringOfAttribute(values, 3, 'position', 'vec3f')).toBe(
            '@location(3) position : vec3f ,',
        );
        expect(generator.formatLocationStringOfAttribute(values, 0, 'entityID', 'u32')).toBe(
            '@location(0) entityID : u32 ,',
        );
    });

    it('generateDrawCommand 按 顶点→uniform→shaderModule→pipeline 顺序编排并传递中间结果', () => {
        const { generator } = makeGenerator();
        const calls: string[] = [];
        const DC_vertexNames = ['position'];
        const DC_localtions = ['@location(0) position : vec3f ,'];
        const DC_verticesBufferLayout = [{ arrayStride: 12, attributes: [] }];
        const DC_bindGroups = [{ label: 'group0' }];
        const DC_bindGroupLayouts = [{ label: 'layout0' }];
        const vertexState = { module: {}, entryPoint: 'vs' };
        const fragmentState = { module: {}, entryPoint: 'fs' };
        const pipeline = { label: 'pipeline' };

        Object.assign(generator, {
            initVertexPart: () => {
                calls.push('initVertexPart');
                return {
                    DC_vertexBuffers: [],
                    DC_indexBuffer: undefined,
                    DC_vertexNames,
                    DC_localtions,
                    DC_verticesBufferLayout,
                };
            },
            initUniformPart: () => {
                calls.push('initUniformPart');
                return { DC_bindGroups, DC_bindGroupLayouts };
            },
            initShaderModule: (
                _values: unknown,
                names: string[],
                locations: string[],
                layouts: unknown[],
            ) => {
                calls.push('initShaderModule');
                expect(names).toBe(DC_vertexNames);
                expect(locations).toBe(DC_localtions);
                expect(layouts).toBe(DC_verticesBufferLayout);
                return {
                    vertex: vertexState,
                    fragment: fragmentState,
                    vertexName: 'vsHash',
                    fragmentName: 'fsHash',
                };
            },
            initPipeLine: (
                _values: unknown,
                vertex: { vs: unknown; name: string },
                fragment: { fs: unknown; name: string },
                layouts: unknown[],
            ) => {
                calls.push('initPipeLine');
                expect(vertex.vs).toBe(vertexState);
                expect(vertex.name).toBe('vsHash');
                expect(fragment.fs).toBe(fragmentState);
                expect(fragment.name).toBe('fsHash');
                expect(layouts).toBe(DC_bindGroupLayouts);
                return pipeline;
            },
        });

        const values = {
            label: 'c0-order',
            data: { vertices: [], indices: undefined },
            render: { vertex: { code: 'vs' } },
        } as unknown as Parameters<typeof generator.generateDrawCommand>[0];
        const command = generator.generateDrawCommand(values);

        expect(calls).toEqual([
            'initVertexPart',
            'initUniformPart',
            'initShaderModule',
            'initPipeLine',
        ]);
        expect(command.label).toBe('c0-order');
        expect(command.pipeline).toBe(pipeline);
        expect(command.bindGroups).toBe(DC_bindGroups);
    });
});

describe('DrawCommandGenerator.initVertexPart 返回值快照 — §2.1（覆盖 6 组顶点分支）', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
        // node 环境补齐 isVSGPUBufferBundle 所需的 GPUBuffer 全局（仅 instanceof 判断）
        (globalThis as any).GPUBuffer = class MockGPUBuffer {};
    });

    function makeGenerator() {
        const calls: { params: any; owner: unknown }[] = [];
        const createPointer = (params: any, owner?: unknown) => {
            calls.push({ params, owner });
            return {
                name: params.name,
                type: params.type,
                viewType: params.viewType,
                byteLength: params.byteSize,
                owner,
            };
        };
        const bufferCalls: any[] = [];
        const device = {
            createBuffer: (desc: any) => {
                bufferCalls.push(desc);
                return { __mockBuffer: true, ...desc };
            },
            queue: { writeBuffer: () => {} },
        };
        const scene = {
            device,
            MSAA: false,
            clock: {},
            pointers: { createPointer },
            depthMode: {},
            finalTarget: { NDC: false },
        };
        const generator = new DrawCommandGenerator({
            scene,
        } as unknown as ConstructorParameters<typeof DrawCommandGenerator>[0]);
        return { generator, calls, bufferCalls };
    }

    function vertexValues(vertices: Record<string, unknown>, extra: Record<string, unknown> = {}) {
        return {
            label: 'mesh',
            data: { vertices, ...(extra.data ?? {}) },
            ...extra,
        } as unknown as Parameters<typeof DrawCommandGenerator.prototype.initVertexPart>[0];
    }

    it('分支2：Array.isArray(number[])', () => {
        const { generator, calls } = makeGenerator();
        const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0];
        const r = generator.initVertexPart(vertexValues({ position: pos }));

        expect(r.DC_vertexNames).toEqual(['position']);
        expect(r.DC_localtions).toEqual(['@location(0) position : vec3f ,']);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 12,
                attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
            },
        ]);
        expect(r.DC_indexBuffer).toBeUndefined();
        expect(calls).toHaveLength(1);
        expect(calls[0].params).toEqual({
            name: 'position mesh',
            byteSize: 36,
            type: 'VS',
            viewType: 'f32',
            data: { sourceData: { data: pos } },
        });
        expect(calls[0].owner).toBeUndefined();
        expect(r.DC_vertexBuffers[0]).toEqual({
            name: 'position mesh',
            type: 'VS',
            viewType: 'f32',
            byteLength: 36,
            owner: undefined,
        });
    });

    it('分支2：parent 存在时透传 owner 并复用 vertexPointers 缓存', () => {
        const { generator, calls } = makeGenerator();
        const parent = { vertexPointers: {} };
        const pos = [0, 0, 0, 1, 0, 0, 0, 1, 0];
        const mk = () => vertexValues({ position: pos }, { system: { parent } });

        const r1 = generator.initVertexPart(mk());
        const r2 = generator.initVertexPart(mk());

        expect(calls).toHaveLength(1); // 第二次命中缓存，不再 createPointer
        expect(calls[0].owner).toBe(parent); // 分支2 是唯一透传 parent 的 pointer 分支
        expect(r2.DC_vertexBuffers[0]).toBe(r1.DC_vertexBuffers[0]);
    });

    it('分支1：dynamic.vs 数组 → 直接建 GPUBuffer（不经过 pointer）', () => {
        const { generator, calls, bufferCalls } = makeGenerator();
        const r = generator.initVertexPart(
            vertexValues({ position: [0, 0, 0, 1, 0, 0, 0, 1, 0] }, { dynamic: { vs: true } }),
        );

        expect(r.DC_vertexNames).toEqual(['position']);
        expect(r.DC_localtions).toEqual(['@location(0) position : vec3f ,']);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 12,
                attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
            },
        ]);
        expect(calls).toHaveLength(0); // 动态分支不经过 createPointer
        expect(bufferCalls).toHaveLength(1); // 走 createVerticesBuffer
        expect(r.DC_vertexBuffers[0]).toMatchObject({ name: 'position' });
    });

    it('分支3：ArrayBuffer.isView → 按 typed array 推导 viewType/byteSize', () => {
        const { generator, calls } = makeGenerator();
        const data = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        const r = generator.initVertexPart(vertexValues({ position: data }));

        // 注意：分支3（ArrayBuffer.isView）当前不计算 locationString，DC_localtions 为空串，重构需保持该行为不变
        expect(r.DC_localtions).toEqual(['']);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 12,
                attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
            },
        ]);
        expect(calls).toHaveLength(1);
        expect(calls[0].params.viewType).toBe('f32');
        expect(calls[0].params.byteSize).toBe(36);
        expect(calls[0].params.data.sourceData.data).toBe(data);
        expect(calls[0].owner).toBeUndefined(); // 分支3 不传 parent
    });

    it('分支3：joints 使用 Uint32Array → uint32x4', () => {
        const { generator, calls } = makeGenerator();
        const data = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7]);
        const r = generator.initVertexPart(vertexValues({ joints: data }));

        expect(r.DC_localtions).toEqual(['']); // 分支3 不计算 locationString
        expect(r.DC_verticesBufferLayout).toEqual([
            { arrayStride: 16, attributes: [{ shaderLocation: 0, format: 'uint32x4', offset: 0 }] },
        ]);
        expect(calls[0].params.viewType).toBe('u32');
        expect(calls[0].params.byteSize).toBe(32);
    });

    it('分支4：format + data 对象（I_vsAttribute）', () => {
        const { generator, calls } = makeGenerator();
        const data = [0, 0, 0, 1, 0, 0, 0, 1, 0];
        const r = generator.initVertexPart(
            vertexValues({ position: { format: 'float32x3', data } }),
        );

        expect(r.DC_localtions).toEqual(['@location(0) position : vec3f ,']);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 12,
                attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
            },
        ]);
        expect(calls).toHaveLength(1);
        expect(calls[0].params.byteSize).toBe(36);
        expect(calls[0].params.viewType).toBe('f32');
        expect(calls[0].params.data.sourceData.data).toBe(data);
        expect(calls[0].owner).toBeUndefined();
    });

    it('分支5：I_vsAttributeMerge 合并属性', () => {
        const { generator, calls } = makeGenerator();
        const data = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1];
        const r = generator.initVertexPart(
            vertexValues({
                merged: {
                    data,
                    count: 2,
                    arrayStride: 24,
                    mergeAttribute: [
                        { name: 'position', format: 'float32x3', offset: 0 },
                        { name: 'normal', format: 'float32x3', offset: 12 },
                    ],
                },
            }),
        );

        expect(r.DC_vertexNames).toEqual(['merged']);
        expect(r.DC_localtions).toEqual([
            ' @location(0) position : vec3f  , @location(1) normal : vec3f  ,',
        ]);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, format: 'float32x3', offset: 0 },
                    { shaderLocation: 1, format: 'float32x3', offset: 12 },
                ],
            },
        ]);
        expect(calls).toHaveLength(1);
        expect(calls[0].params.byteSize).toBe(48);
        expect(calls[0].params.viewType).toBe('f32');
        expect(calls[0].params.data.sourceData.data).toBe(data);
        expect(calls[0].owner).toBeUndefined();
    });

    it('分支6：I_vsGPUBufferBundle（GPUBuffer）', () => {
        const { generator, calls } = makeGenerator();
        const GPUBufferCtor = (globalThis as any).GPUBuffer;
        const buffer = new GPUBufferCtor();
        const r = generator.initVertexPart(
            vertexValues({
                position: { format: 'float32x3', arrayStride: 12, offset: 0, byteSize: 36, buffer },
            }),
        );

        expect(r.DC_vertexNames).toEqual(['position']);
        expect(r.DC_localtions).toEqual(['@location(0) position : vec3f ,']);
        expect(r.DC_verticesBufferLayout).toEqual([
            {
                arrayStride: 12,
                attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
            },
        ]);
        expect(calls).toHaveLength(0); // GPUBuffer 分支不经过 pointer
        expect(r.DC_vertexBuffers[0]).toEqual({
            name: 'position',
            buffer,
            offset: 0,
            byteSize: 36,
        });
    });
});

describe('DrawCommandGenerator ticket 回传 — P0-3', () => {
    let DrawCommandGenerator: any;

    beforeAll(async () => {
        ({ DrawCommandGenerator } = await import('./DrawCommandGenerator'));
    });

    function makeTicketStore() {
        const map = new Map<string, unknown>();
        let ticketId = 0;
        return {
            map,
            peek: (key: string) => map.get(key),
            acquire: (key: string, factory: () => unknown) => {
                let value = map.get(key);
                if (value === undefined) {
                    value = factory();
                    map.set(key, value);
                }
                return { value, ticket: { id: ++ticketId, released: false } };
            },
        };
    }

    function makeGenerator() {
        const shaderModules = makeTicketStore();
        const pipelines = makeTicketStore();
        const scene = {
            device: {
                createShaderModule: () => ({}),
                createPipelineLayout: () => ({}),
                createRenderPipeline: () => ({}),
            },
            resourcesGPU: { derived: { shaderModules, pipelines } },
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {},
            finalTarget: { NDC: true },
        } as unknown as Scene;
        const generator = new DrawCommandGenerator({ scene });
        return { shaderModules, pipelines, generator };
    }

    const makeShaderValues = (tickets?: { id: number; released: boolean }[]) => ({
        label: 'ticket',
        data: {},
        render: {
            vertex: { code: 'vs-code', entryPoint: 'vs' },
            fragment: {
                code: 'fs-code',
                entryPoint: 'fs',
                aliasName: 'fs',
                targets: [{ format: 'bgra8unorm' }],
            },
        },
        ...(tickets ? { releaseTickets: tickets } : {}),
    });

    const makePipelineValues = (tickets?: { id: number; released: boolean }[]) => ({
        label: 'ticket',
        data: {},
        render: { vertex: { code: 'x', entryPoint: 'vs' }, depthStencil: false },
        ...(tickets ? { releaseTickets: tickets } : {}),
    });

    const vertex = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
    const fragment = { fs: undefined, name: 'fs-md5' };

    it('initShaderModule 回传 VS/FS 两个 ticket', () => {
        const { generator } = makeGenerator();
        const tickets: { id: number; released: boolean }[] = [];
        generator.initShaderModule(makeShaderValues(tickets), [], [], []);
        expect(tickets).toHaveLength(2);
        expect(tickets[0].id).toBe(1);
        expect(tickets[1].id).toBe(2);
    });

    it('initShaderModule 无 releaseTickets 不回传', () => {
        const { generator } = makeGenerator();
        const values = makeShaderValues();
        generator.initShaderModule(values, [], [], []);
        expect(values).not.toHaveProperty('releaseTickets');
    });

    it('initPipeLine entity 链路命中仍 acquire 并回传 ticket', () => {
        const { generator, pipelines } = makeGenerator();
        const tickets: { id: number; released: boolean }[] = [];
        generator.initPipeLine(makePipelineValues(tickets), vertex, fragment, []);
        generator.initPipeLine(makePipelineValues(tickets), vertex, fragment, []);
        expect(pipelines.map.size).toBe(1);
        expect(tickets).toHaveLength(2);
    });

    it('initPipeLine 无 releaseTickets 命中走 peek 不回传', () => {
        const { generator, pipelines } = makeGenerator();
        const values = makePipelineValues();
        generator.initPipeLine(values, vertex, fragment, []);
        generator.initPipeLine(values, vertex, fragment, []);
        expect(pipelines.map.size).toBe(1);
        expect(values).not.toHaveProperty('releaseTickets');
    });
});

describe('generateDrawCommandAndTrack 释放凭证回传 — P0-3', () => {
    let generateDrawCommandAndTrack: any;

    beforeAll(async () => {
        ({ generateDrawCommandAndTrack } = await import('../entity/entityBundleMaterialDC'));
    });

    it('取走 ticket 并 track，随后置空 releaseTickets', () => {
        const tracked: { id: number; released: boolean }[] = [];
        const scope = {
            DCG: {
                generateDrawCommand: (v: {
                    releaseTickets: { id: number; released: boolean }[];
                }) => {
                    v.releaseTickets.push({ id: 7, released: false });
                    return { label: 'dc' };
                },
            },
            track: (ticket: { id: number; released: boolean }) => {
                tracked.push(ticket);
            },
        };
        const valueDC: { releaseTickets?: { id: number; released: boolean }[] } = {};
        const dc = generateDrawCommandAndTrack(scope, valueDC);
        expect(dc).toEqual({ label: 'dc' });
        expect(tracked).toEqual([{ id: 7, released: false }]);
        expect(valueDC.releaseTickets).toBeUndefined();
    });
});
