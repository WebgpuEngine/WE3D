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
        const resources = { pipeline: new Map<string, unknown>() };
        const scene = {
            device: mockDevice,
            resourcesGPU: resources,
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
        return { resources, generator };
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
        const { resources, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(false), vertex, fragment, []);
        expect(resources.pipeline.size).toBe(2);
    });

    it('depthStencil 完全相同 → 命中缓存，只创建一个 pipeline', () => {
        const { resources, generator } = makeGenerator();
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        generator.initPipeLine(makeValue(true), vertex, fragment, []);
        expect(resources.pipeline.size).toBe(1);
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
        const resources = { pipeline: new Map<string, unknown>() };
        const scene = {
            device: mockDevice,
            resourcesGPU: resources,
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
        return { resources, generator };
    }

    const makeValue = (overrides: Record<string, unknown> = {}) => ({
        label: 'p0-1',
        data: {},
        render: { vertex: { code: 'x', entryPoint: 'vs' }, ...overrides },
    });

    it('仅 bindGroupLayouts 不同 → 不复用，应创建两个 pipeline', () => {
        const { resources, generator } = makeGenerator();
        const vertex = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
        const fragment = { fs: undefined, name: 'fs-md5' };
        generator.initPipeLine(makeValue(), vertex, fragment, [{ label: 'layout-A' }]);
        generator.initPipeLine(makeValue(), vertex, fragment, [{ label: 'layout-B' }]);
        expect(resources.pipeline.size).toBe(2);
    });

    it('仅 fragment.targets 不同 → 不复用，应创建两个 pipeline', () => {
        const { resources, generator } = makeGenerator();
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
        expect(resources.pipeline.size).toBe(2);
    });

    it('仅 vertex.buffers 不同 → 不复用，应创建两个 pipeline', () => {
        const { resources, generator } = makeGenerator();
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
        expect(resources.pipeline.size).toBe(2);
    });

    it('仅 vertex.constants / vertex.entryPoint 不同 → 不复用', () => {
        // constants 不同
        {
            const { resources, generator } = makeGenerator();
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
            expect(resources.pipeline.size).toBe(2);
        }
        // entryPoint 不同
        {
            const { resources, generator } = makeGenerator();
            const vertexA = { vs: { module: {}, entryPoint: 'vs' }, name: 'vs-md5' };
            const vertexB = { vs: { module: {}, entryPoint: 'vsAlt' }, name: 'vs-md5' };
            const fragment = { fs: undefined, name: 'fs-md5' };
            generator.initPipeLine(makeValue(), vertexA, fragment, []);
            generator.initPipeLine(makeValue(), vertexB, fragment, []);
            expect(resources.pipeline.size).toBe(2);
        }
    });

    it('key 快照：完整 descriptor 稳定序列化结果固定（含 targets / buffers 等维度）', () => {
        const { resources, generator } = makeGenerator();
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
        expect([...resources.pipeline.keys()]).toEqual([
            '{"bindGroupLayouts":[],"depthStencil":undefined,"fragment":{"code":"fs-md5","constants":{},"entryPoint":"fs","targets":[{"format":"bgra8unorm"}]},"multisample":undefined,"primitive":undefined,"vertex":{"buffers":[{"arrayStride":12,"attributes":[]}],"code":"vs-md5","constants":{},"entryPoint":"vs"}}',
        ]);
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
        const resources = { pipeline: new Map<string, unknown>() };
        const scene = {
            device: { createPipelineLayout: () => ({}), createRenderPipeline: () => ({}) },
            resourcesGPU: resources,
            MSAA: false,
            clock: {},
            pointers: {},
            depthMode: {},
            finalTarget: { NDC: false },
        };
        const generator = new DrawCommandGenerator({
            scene,
        } as unknown as ConstructorParameters<Ctor>[0]);
        return { generator, resources };
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
        expect(generator.inputDC).toEqual([values]);
        expect(command.label).toBe('c0-order');
        expect(command.pipeline).toBe(pipeline);
        expect(command.bindGroups).toBe(DC_bindGroups);
    });
});
