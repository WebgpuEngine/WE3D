import { describe, it, expect } from 'vitest';
import { RootGPU } from './root';

class TestRoot extends RootGPU {
    async readyForGPU(): Promise<any> { /* noop */ }
    _destroy(): void { /* noop */ }
    updateSelf(): void { /* noop */ }
}

describe('RootGPU.destroy — P0-1 显存回收', () => {
    it('带 map 字段的资源按 i.key 删除（而非 Map 名字符串）', () => {
        const deletedKeys: any[] = [];
        const fakeMap = {
            delete: (k: any) => { deletedKeys.push(k); return true; },
        };
        const resourcesGPU: any = {
            // map 字段指向的 Map 名（真实属性）
            textureOfString: fakeMap,
            getProperty: (k: string) => resourcesGPU[k],
            delete: () => { /* else 分支，本用例不触发 */ },
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        // 注册一条带 map 的资源：key=真实资源键，map=Map 名
        root.mapList = [{ key: 'realResKey', type: 'textureOfString', map: 'textureOfString' }];

        root.destroy();

        // 必须按真实资源键命中删除，而不是用 Map 名字符串空删（修复前会误删 "textureOfString"）
        expect(deletedKeys).toContain('realResKey');
        expect(deletedKeys).not.toContain('textureOfString');
    });

    it('无 map 字段的资源走 else 分支按 key+type 删除', () => {
        let deleteArgs: any[] = [];
        const resourcesGPU: any = {
            getProperty: () => undefined,
            delete: (key: any, type: any) => { deleteArgs = [key, type]; },
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        root.mapList = [{ key: 'k1', type: 'vertices' }];

        root.destroy();

        expect(deleteArgs).toEqual(['k1', 'vertices']);
    });

    it('destroy() 幂等：重复调用不二次删除', () => {
        const deletedKeys: any[] = [];
        const fakeMap = {
            delete: (k: any) => { deletedKeys.push(k); return true; },
        };
        const resourcesGPU: any = {
            textureOfString: fakeMap,
            getProperty: (k: string) => resourcesGPU[k],
            delete: () => {},
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        root.mapList = [{ key: 'realResKey', type: 'textureOfString', map: 'textureOfString' }];

        root.destroy();
        root.destroy();

        expect(deletedKeys.filter(k => k === 'realResKey')).toHaveLength(1);
    });
});
