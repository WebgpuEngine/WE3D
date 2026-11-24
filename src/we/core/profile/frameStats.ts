/**
 * S0-A2 · CPU / drawcall 帧统计收集器（进程内，非公共 API）。
 *
 * 职责：在主循环与渲染计数点之间提供一个轻量、零渲染副作用的计数容器。
 * 只负责「可复现地度量」，不设通过阈值——性能对照口径按 §十 D3 推迟到 demo 对比阶段。
 */

export interface I_FrameStatsSnapshot {
    /** 帧号（来自 Clock.frame） */
    frame: number;
    /** CPU 帧墙钟耗时（ms）：主循环从进入 perFrameRun 到 cleanUp 结束 */
    cpuFrameMS: number;
    /** 本帧 drawcall 数（non-indexed + indexed） */
    drawcalls: number;
    /** 本帧 compute dispatch 数 */
    computeDispatches: number;
    /** 缓存 acquire 命中数（shaderModules / pipelines 等所有 GPU 缓存） */
    cacheHits: number;
    /** 缓存 acquire 未命中数（触发 factory 真实创建） */
    cacheMisses: number;
    /** 本帧 WGSL 最终代码 MD5 计算次数 */
    wgslMD5Count: number;
    /** 本帧灯光 uniform 上传字节数 */
    lightsUploadBytes: number;
    /** 本帧阴影 uniform 上传字节数 */
    shadowUploadBytes: number;
}

export interface I_FrameStatsReport {
    latest: I_FrameStatsSnapshot;
    sampleCount: number;
    /** 最近 N 帧的算术平均（无阈值，仅记录） */
    average: I_FrameStatsSnapshot;
}

const emptySnapshot = (): I_FrameStatsSnapshot => ({
    frame: 0,
    cpuFrameMS: 0,
    drawcalls: 0,
    computeDispatches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    wgslMD5Count: 0,
    lightsUploadBytes: 0,
    shadowUploadBytes: 0,
});

const MAX_HISTORY = 120;

export class FrameStats {
    private current: I_FrameStatsSnapshot = emptySnapshot();
    private history: I_FrameStatsSnapshot[] = [];

    /** 帧开始：重置本帧计数。frame 来自 Clock.frame。 */
    beginFrame(frame: number): void {
        this.current = emptySnapshot();
        this.current.frame = frame;
    }

    /** 帧结束：记录 CPU 墙钟耗时并把本帧快照入历史。 */
    endFrame(cpuFrameMS: number): void {
        this.current.cpuFrameMS = cpuFrameMS;
        this.history.push({ ...this.current });
        if (this.history.length > MAX_HISTORY) this.history.shift();
    }

    incDrawcall(count: number = 1): void {
        this.current.drawcalls += count;
    }

    incComputeDispatch(count: number = 1): void {
        this.current.computeDispatches += count;
    }

    incCacheHit(count: number = 1): void {
        this.current.cacheHits += count;
    }

    incCacheMiss(count: number = 1): void {
        this.current.cacheMisses += count;
    }

    incWGSLMD5(count: number = 1): void {
        this.current.wgslMD5Count += count;
    }

    addLightsUploadBytes(bytes: number): void {
        this.current.lightsUploadBytes += bytes;
    }

    addShadowUploadBytes(bytes: number): void {
        this.current.shadowUploadBytes += bytes;
    }

    snapshot(): I_FrameStatsSnapshot {
        return { ...this.current };
    }

    /** 取最近 N 帧报告（不设阈值）。 */
    report(lastN: number = 10): I_FrameStatsReport {
        const samples = this.history.slice(-Math.max(1, lastN));
        const latest = samples.length ? { ...samples[samples.length - 1] } : this.snapshot();
        const acc = emptySnapshot();
        for (const s of samples) {
            acc.cpuFrameMS += s.cpuFrameMS;
            acc.drawcalls += s.drawcalls;
            acc.computeDispatches += s.computeDispatches;
            acc.cacheHits += s.cacheHits;
            acc.cacheMisses += s.cacheMisses;
            acc.wgslMD5Count += s.wgslMD5Count;
            acc.lightsUploadBytes += s.lightsUploadBytes;
            acc.shadowUploadBytes += s.shadowUploadBytes;
        }
        const n = samples.length || 1;
        const average: I_FrameStatsSnapshot = {
            frame: latest.frame,
            cpuFrameMS: acc.cpuFrameMS / n,
            drawcalls: acc.drawcalls / n,
            computeDispatches: acc.computeDispatches / n,
            cacheHits: acc.cacheHits / n,
            cacheMisses: acc.cacheMisses / n,
            wgslMD5Count: acc.wgslMD5Count / n,
            lightsUploadBytes: acc.lightsUploadBytes / n,
            shadowUploadBytes: acc.shadowUploadBytes / n,
        };
        return { latest, sampleCount: samples.length, average };
    }

    /** 清空历史与当前帧（测试与 harness 用）。 */
    reset(): void {
        this.current = emptySnapshot();
        this.history = [];
    }
}

/** 进程内单例：生产代码在计数点直接引用，避免把容器穿透到各层构造函数。 */
export const frameStats = new FrameStats();
