import { describe, it, expect } from 'vitest';
import { RootGPU } from './root';
import type { IV_ReleaseTicket } from '../resources/gpu/types';

class TestRoot extends RootGPU {
    async readyForGPU(): Promise<any> {
        /* noop */
    }
    _destroy(): void {
        /* noop */
    }
    updateSelf(): void {
        /* noop */
    }
}

function makeTicket(id: number): IV_ReleaseTicket {
    return { id, released: false };
}

describe('RootGPU.destroy — P0-1 显存回收（ticket 释放申请）', () => {
    it('destroy() 对每个 track 的 ticket 提交一次释放申请', () => {
        const released: number[] = [];
        const resourcesGPU: any = {
            requestRelease: (ticket: IV_ReleaseTicket) => {
                released.push(ticket.id);
            },
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        root.track(makeTicket(1));
        root.track(makeTicket(2));

        root.destroy();

        expect(released).toEqual([1, 2]);
    });

    it('destroy() 后清空凭证，不再持有引用', () => {
        const released: number[] = [];
        const resourcesGPU: any = {
            requestRelease: (ticket: IV_ReleaseTicket) => {
                released.push(ticket.id);
            },
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        root.track(makeTicket(1));

        root.destroy();

        expect(released).toHaveLength(1);
        expect(root._tickets).toHaveLength(0);
    });

    it('destroy() 幂等：重复调用不二次提交释放', () => {
        const released: number[] = [];
        const resourcesGPU: any = {
            requestRelease: (ticket: IV_ReleaseTicket) => {
                released.push(ticket.id);
            },
        };

        const root = new TestRoot();
        root.resourcesGPU = resourcesGPU;
        root.track(makeTicket(1));

        root.destroy();
        root.destroy();

        expect(released).toHaveLength(1);
    });
});
