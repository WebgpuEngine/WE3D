import { describe, it, expect, beforeEach } from 'vitest';
import { FrameStats } from './frameStats';

describe('S0-A2 FrameStats（CPU/DC 统计）', () => {
    let stats: FrameStats;

    beforeEach(() => {
        stats = new FrameStats();
    });

    it('beginFrame 重置本帧计数，endFrame 记录 CPU 帧耗时', () => {
        stats.beginFrame(7);
        stats.incDrawcall();
        stats.incDrawcall(2);
        stats.endFrame(12.5);

        const snap = stats.snapshot();
        expect(snap.frame).toBe(7);
        expect(snap.drawcalls).toBe(3);
        expect(snap.cpuFrameMS).toBe(12.5);

        stats.beginFrame(8);
        expect(stats.snapshot().drawcalls).toBe(0);
        expect(stats.snapshot().frame).toBe(8);
    });

    it('缓存命中/未命中与 MD5 次数按帧累计', () => {
        stats.beginFrame(1);
        stats.incCacheHit();
        stats.incCacheHit();
        stats.incCacheMiss();
        stats.incWGSLMD5();
        stats.incWGSLMD5();
        stats.incWGSLMD5();
        stats.endFrame(1);

        const snap = stats.snapshot();
        expect(snap.cacheHits).toBe(2);
        expect(snap.cacheMisses).toBe(1);
        expect(snap.wgslMD5Count).toBe(3);
    });

    it('compute dispatch 与 uniform 上传字节统计', () => {
        stats.beginFrame(1);
        stats.incComputeDispatch();
        stats.addLightsUploadBytes(640);
        stats.addShadowUploadBytes(320);
        stats.addLightsUploadBytes(64);
        stats.endFrame(1);

        const snap = stats.snapshot();
        expect(snap.computeDispatches).toBe(1);
        expect(snap.lightsUploadBytes).toBe(704);
        expect(snap.shadowUploadBytes).toBe(320);
    });

    it('report 给出最近 N 帧平均，无通过阈值语义', () => {
        for (let f = 1; f <= 3; f++) {
            stats.beginFrame(f);
            stats.incDrawcall(f);
            stats.endFrame(f * 2);
        }
        const r = stats.report(3);
        expect(r.sampleCount).toBe(3);
        expect(r.latest.drawcalls).toBe(3);
        expect(r.average.drawcalls).toBe(2);
        expect(r.average.cpuFrameMS).toBe(4);
    });

    it('reset 清空历史与当前帧', () => {
        stats.beginFrame(1);
        stats.incDrawcall();
        stats.endFrame(1);
        stats.reset();
        expect(stats.report().sampleCount).toBe(0);
        expect(stats.snapshot().drawcalls).toBe(0);
    });
});
