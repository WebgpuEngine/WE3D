import { describe, it, expect, beforeAll } from 'vitest';

// node 环境缺失的全局：
// 1) inputManager 导入链（→ scene → GPU 常量）在模块顶层引用 GPUTextureUsage 等；
// 2) InputManager.init() 会 addEventListener 到 document/canvas/window。
beforeAll(() => {
    const num = 1;
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
        flags[k] = num;
    }
    (globalThis as any).GPUTextureUsage = { ...flags };
    (globalThis as any).GPUBufferUsage = { ...flags };
    (globalThis as any).GPUMapMode = { READ: 1, WRITE: 2 };

    (globalThis as any).document = { addEventListener: () => {} };
    (globalThis as any).window = { addEventListener: () => {} };
});

function makeScene() {
    return {
        device: undefined,
        canvas: { addEventListener: () => {}, focus: () => {} },
    } as any;
}

describe('InputManager — P0-2 intercept 优先级', () => {
    let InputManager: any;
    let E_InputEvent: any;
    let E_InputPriority: any;

    beforeAll(async () => {
        InputManager = (await import('./inputManager')).InputManager;
        const base = await import('./base');
        E_InputEvent = base.E_InputEvent;
        E_InputPriority = base.E_InputPriority;
    });

    it('intercept 层返回 true 时，应阻断 broadcastEnd 层（当前 bug：不阻断）', () => {
        const manager = new InputManager(makeScene());
        const calls: string[] = [];

        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.intercept].push({
            receiveInput: () => {
                calls.push('intercept');
                return true;
            },
        });
        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.broadcastEnd].push({
            receiveInput: () => {
                calls.push('broadcastEnd');
                return false;
            },
        });

        manager.keyDown({} as KeyboardEvent);

        expect(calls).toEqual(['intercept']);
    });

    it('intercept 层返回 false 时，broadcastEnd 层仍被调用', () => {
        const manager = new InputManager(makeScene());
        const calls: string[] = [];

        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.intercept].push({
            receiveInput: () => {
                calls.push('intercept');
                return false;
            },
        });
        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.broadcastEnd].push({
            receiveInput: () => {
                calls.push('broadcastEnd');
                return false;
            },
        });

        manager.keyDown({} as KeyboardEvent);

        expect(calls).toEqual(['intercept', 'broadcastEnd']);
    });

    it('广播顺序为 broadcastStart → intercept → broadcastEnd', () => {
        const manager = new InputManager(makeScene());
        const calls: string[] = [];

        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.broadcastStart].push({
            receiveInput: () => {
                calls.push('broadcastStart');
                return false;
            },
        });
        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.intercept].push({
            receiveInput: () => {
                calls.push('intercept');
                return false;
            },
        });
        manager.registerEventList[E_InputEvent.keydown][E_InputPriority.broadcastEnd].push({
            receiveInput: () => {
                calls.push('broadcastEnd');
                return false;
            },
        });

        manager.keyDown({} as KeyboardEvent);

        expect(calls).toEqual(['broadcastStart', 'intercept', 'broadcastEnd']);
    });
});
