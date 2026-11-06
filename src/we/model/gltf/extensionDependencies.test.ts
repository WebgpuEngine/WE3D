import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getExtensionDependencyKeys,
    registerExtensionDependencyProvider,
    unregisterExtensionDependencyProvider,
    resolveExtensionDependencies,
    type I_DependencySink,
} from './extensionDependencies';

const MESHOPT = 'meshopt.decoder';

function makeSink() {
    const calls: Record<string, unknown>[] = [];
    const sink: I_DependencySink = {
        registerDependencies(deps: Record<string, unknown>) {
            calls.push(deps);
            return sink;
        },
    };
    return { sink, calls };
}

describe('glTF 扩展运行时依赖 · 通用自动解析', () => {
    describe('getExtensionDependencyKeys（从 ALL_EXTENSIONS 自动发现，非硬编码）', () => {
        it('Draco → draco3d.decoder', () => {
            expect(getExtensionDependencyKeys({ extensionsUsed: ['KHR_draco_mesh_compression'] })).toEqual([
                'draco3d.decoder',
            ]);
        });

        it('Meshopt → meshopt.decoder', () => {
            expect(getExtensionDependencyKeys({ extensionsUsed: ['EXT_meshopt_compression'] })).toEqual([
                MESHOPT,
            ]);
        });

        it('无扩展声明 / 纯结构扩展返回空', () => {
            expect(getExtensionDependencyKeys({})).toEqual([]);
            expect(getExtensionDependencyKeys({ extensionsUsed: ['KHR_materials_unlit'] })).toEqual([]);
        });

        it('仅声明在 extensionsRequired 也能识别', () => {
            expect(
                getExtensionDependencyKeys({ extensionsRequired: ['KHR_draco_mesh_compression'] }),
            ).toEqual(['draco3d.decoder']);
        });

        it('多个扩展 / 重复声明去重，顺序稳定', () => {
            const json = {
                extensionsUsed: [
                    'KHR_draco_mesh_compression',
                    'EXT_meshopt_compression',
                    'KHR_draco_mesh_compression',
                ],
                extensionsRequired: ['EXT_meshopt_compression'],
            };
            expect(getExtensionDependencyKeys(json)).toEqual(['draco3d.decoder', MESHOPT]);
        });
    });

    describe('resolveExtensionDependencies', () => {
        beforeEach(() => unregisterExtensionDependencyProvider(MESHOPT));

        it('无依赖资产不调用 registerDependencies', async () => {
            const { sink, calls } = makeSink();
            expect(await resolveExtensionDependencies(sink, {})).toEqual([]);
            expect(calls).toHaveLength(0);
        });

        it('缺 provider 时抛明确错误并给出注册方式', async () => {
            const { sink } = makeSink();
            await expect(
                resolveExtensionDependencies(sink, { extensionsUsed: ['EXT_meshopt_compression'] }),
            ).rejects.toThrow(/meshopt\.decoder[\s\S]*registerExtensionDependencyProvider/);
        });

        it('per-model override 优先，无需全局注册', async () => {
            const { sink, calls } = makeSink();
            const override = vi.fn(async () => 'OVERRIDE');
            const keys = await resolveExtensionDependencies(
                sink,
                { extensionsUsed: ['EXT_meshopt_compression'] },
                { [MESHOPT]: override },
            );
            expect(keys).toEqual([MESHOPT]);
            expect(calls[0]).toEqual({ [MESHOPT]: 'OVERRIDE' });
            expect(override).toHaveBeenCalledTimes(1);
        });

        it('全局 provider 懒加载且同一 key 跨资产只加载一次', async () => {
            const loader = vi.fn(async () => 'MESHOPT_MODULE');
            registerExtensionDependencyProvider(MESHOPT, loader);
            const a = makeSink();
            const b = makeSink();
            await resolveExtensionDependencies(a.sink, {
                extensionsUsed: ['EXT_meshopt_compression'],
            });
            await resolveExtensionDependencies(b.sink, {
                extensionsRequired: ['EXT_meshopt_compression'],
            });
            expect(loader).toHaveBeenCalledTimes(1);
            expect(a.calls[0]).toEqual({ [MESHOPT]: 'MESHOPT_MODULE' });
            expect(b.calls[0]).toEqual({ [MESHOPT]: 'MESHOPT_MODULE' });
        });

        it('重新注册 provider 后缓存失效', async () => {
            const first = vi.fn(async () => 'FIRST');
            registerExtensionDependencyProvider(MESHOPT, first);
            const a = makeSink();
            await resolveExtensionDependencies(a.sink, {
                extensionsUsed: ['EXT_meshopt_compression'],
            });

            const second = vi.fn(async () => 'SECOND');
            registerExtensionDependencyProvider(MESHOPT, second);
            const b = makeSink();
            await resolveExtensionDependencies(b.sink, {
                extensionsUsed: ['EXT_meshopt_compression'],
            });

            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
            expect(b.calls[0]).toEqual({ [MESHOPT]: 'SECOND' });
        });

        it('加载失败会清缓存以便重试', async () => {
            let attempt = 0;
            registerExtensionDependencyProvider(MESHOPT, async () => {
                attempt++;
                if (attempt === 1) throw new Error('load failed');
                return 'RECOVERED';
            });
            const a = makeSink();
            await expect(
                resolveExtensionDependencies(a.sink, { extensionsUsed: ['EXT_meshopt_compression'] }),
            ).rejects.toThrow('load failed');

            const b = makeSink();
            await resolveExtensionDependencies(b.sink, {
                extensionsUsed: ['EXT_meshopt_compression'],
            });
            expect(b.calls[0]).toEqual({ [MESHOPT]: 'RECOVERED' });
        });
    });
});
