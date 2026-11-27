/**
 * S0 · perf-harness 主控（进程内，非公共 API）。
 *
 * 组合三个采集器：
 *   - FrameStats（render.cpu）
 *   - GpuProfiler（render.gpu，timestamp-query）
 *   - GpuBufferStats（nonRender，显存 / 上传 / CPU 写入）
 *
 * 设计约束：
 * 1、`enabled=false` 时不创建 PerfHarness，链路里 `scene.perfHarness?.xxx` 全部短路；
 * 2、CPU / nonRender 采集为整数自增，零渲染副作用；GPU 采集仅在显式 enable 且
 *    device 支持 'timestamp-query' 时注入 timestampWrites；
 * 3、GpuProfiler 采用双缓冲连续采样：帧末只发起读回不等待，通过 sampleVersion
 *    消费已完成的采样，避免阻塞 requestAnimationFrame。
 */
import { frameStats, I_FrameStatsReport } from './frameStats';
import { GpuProfiler, I_GpuPassTiming } from './gpuProfiler';
import { gpuBufferStats, I_GpuBufferStats } from './gpuBufferStats';

export interface IV_PerfHarnessOptions {
    /** 总开关，默认 false。true 时才创建 PerfHarness。 */
    enabled?: boolean;
    /** 是否启用 GPU timestamp 采样，默认 true（不支持时自动降级）。 */
    gpu?: boolean;
    /** GPU querySet 容量（每个 pass 占 2 个 query），默认 32。 */
    maxPass?: number;
    /** 报告窗口帧数，默认 60。 */
    sampleFrames?: number;
    /** 输出方式，默认 'console'。 */
    output?: 'console' | 'callback' | 'none';
    /** output === 'callback' 时的回调。 */
    onReport?: (report: I_PerfHarnessReport) => void;
    /** 是否挂到 window.__WE3D_PERF__，默认 false。 */
    exposeGlobal?: boolean;
}

export interface I_PerfHarnessReport {
    meta: {
        frame: number;
        sampleCount: number;
        gpuSupported: boolean;
        gpuEnabled: boolean;
    };
    render: {
        cpu: I_FrameStatsReport;
        gpu: {
            passAvg: { name: string; avgMS: number; samples: number }[];
            totalAvgMS: number;
            lastPassTimings: I_GpuPassTiming[];
        };
    };
    nonRender: I_GpuBufferStats;
}

declare global {
    interface Window {
        __WE3D_PERF__?: I_PerfHarnessReport;
    }
}

/** 当前活跃的 PerfHarness：命令类（无 scene 引用）通过它做 stamp 注入。 */
let activePerfHarness: PerfHarness | null = null;

function setActive(harness: PerfHarness): void {
    activePerfHarness = harness;
}

export function getActivePerfHarness(): PerfHarness | null {
    return activePerfHarness;
}

export class PerfHarness {
    private readonly device: GPUDevice;
    private readonly options: Required<Omit<IV_PerfHarnessOptions, 'onReport'>> & {
        onReport?: (report: I_PerfHarnessReport) => void;
    };
    private readonly profiler: GpuProfiler;
    private gpuEnabled = false;

    private gpuHistory: I_GpuPassTiming[][] = [];
    private totalHistory: number[] = [];
    private lastPassTimings: I_GpuPassTiming[] = [];
    private lastGpuSampleVersion = 0;
    private frameCount = 0;
    private lastReportValue: I_PerfHarnessReport | null = null;

    constructor(device: GPUDevice, options: IV_PerfHarnessOptions = {}) {
        this.device = device;
        this.options = {
            enabled: options.enabled ?? false,
            gpu: options.gpu ?? true,
            maxPass: options.maxPass ?? 32,
            sampleFrames: options.sampleFrames ?? 60,
            output: options.output ?? 'console',
            exposeGlobal: options.exposeGlobal ?? false,
            onReport: options.onReport,
        };
        this.profiler = new GpuProfiler(device, { maxPass: this.options.maxPass });

        if (this.options.gpu) {
            this.gpuEnabled = this.profiler.enable();
        }
        setActive(this);
    }

    /** 帧开始：清空 pass 记录。 */
    beginFrame(): void {
        this.profiler.beginFrame();
    }

    /** 给 render pass 描述符注入 timestampWrites（未启用时原样返回）。 */
    stampRenderPass<T extends GPURenderPassDescriptor>(descriptor: T, name: string): T {
        return this.profiler.stampRenderPass(descriptor, name);
    }

    /** 同上，用于 compute pass。 */
    stampComputePass<T extends GPUComputePassDescriptor>(descriptor: T, name: string): T {
        return this.profiler.stampComputePass(descriptor, name);
    }

    /** 在 commandEncoder.finish() 之前调用：解析 query 到可读 buffer。 */
    resolve(encoder: GPUCommandEncoder): void {
        this.profiler.resolve(encoder);
    }

    /**
     * 帧结束：发起本帧 GPU 读回（不等待，避免阻塞 requestAnimationFrame），
     * 只在出现新采样版本时消费一次，并在窗口到点后 emit 报告。
     */
    async collect(): Promise<void> {
        if (this.gpuEnabled) {
            void this.profiler.read();
            const version = this.profiler.sampleVersion;
            if (version > this.lastGpuSampleVersion) {
                this.lastGpuSampleVersion = version;
                const gpuReport = this.profiler.report();
                if (gpuReport.passTimings.length > 0) {
                    this.lastPassTimings = gpuReport.passTimings;
                    this.gpuHistory.push(gpuReport.passTimings);
                    this.totalHistory.push(gpuReport.totalMS);
                }
            }
        }
        this.frameCount += 1;
        if (this.frameCount >= this.options.sampleFrames) {
            const report = this.report();
            this.lastReportValue = report;
            this.emit(report);
            this.resetWindow();
        }
    }

    /** 生成当前聚合报告。 */
    report(): I_PerfHarnessReport {
        const cpu = frameStats.report(this.options.sampleFrames);
        const passAvg = this.aggregatePassAvg();
        const totalAvgMS = this.totalHistory.length
            ? this.totalHistory.reduce((a, b) => a + b, 0) / this.totalHistory.length
            : 0;
        return {
            meta: {
                frame: cpu.latest.frame,
                sampleCount: cpu.sampleCount,
                gpuSupported: this.profiler.isSupported(),
                gpuEnabled: this.gpuEnabled,
            },
            render: {
                cpu,
                gpu: {
                    passAvg,
                    totalAvgMS,
                    lastPassTimings: [...this.lastPassTimings],
                },
            },
            nonRender: gpuBufferStats.snapshot(),
        };
    }

    get lastReport(): I_PerfHarnessReport | null {
        return this.lastReportValue;
    }

    destroy(): void {
        this.profiler.destroy();
        if (activePerfHarness === this) activePerfHarness = null;
    }

    private aggregatePassAvg(): { name: string; avgMS: number; samples: number }[] {
        const map = new Map<string, { sum: number; count: number }>();
        for (const timings of this.gpuHistory) {
            for (const t of timings) {
                const acc = map.get(t.name) ?? { sum: 0, count: 0 };
                acc.sum += t.ms;
                acc.count += 1;
                map.set(t.name, acc);
            }
        }
        return [...map.entries()].map(([name, acc]) => ({
            name,
            avgMS: acc.sum / acc.count,
            samples: acc.count,
        }));
    }

    private resetWindow(): void {
        this.frameCount = 0;
        this.gpuHistory = [];
        this.totalHistory = [];
        this.lastPassTimings = [];
    }

    private emit(report: I_PerfHarnessReport): void {
        if (this.options.output === 'console') {
            this.emitConsole(report);
        }
        if (this.options.output === 'callback' && this.options.onReport) {
            this.options.onReport(report);
        }
        if (this.options.exposeGlobal) {
            window.__WE3D_PERF__ = report;
        }
    }

    private emitConsole(report: I_PerfHarnessReport): void {
        console.group('[WE3D perf-harness]');
        console.log(
            `frame=${report.meta.frame} sampleCount=${report.meta.sampleCount} gpu=${report.meta.gpuSupported}/${report.meta.gpuEnabled}`,
        );
        console.group('render.cpu (average)');
        console.table(report.render.cpu.average);
        console.groupEnd();
        console.group('render.gpu.passAvg');
        console.table(report.render.gpu.passAvg);
        console.groupEnd();
        console.log('render.gpu.totalAvgMS =', report.render.gpu.totalAvgMS);
        console.group('nonRender');
        console.table(report.nonRender.cpu);
        console.table(report.nonRender.gpu);
        console.table(report.nonRender.vram.bolByType);
        console.table(report.nonRender.bufferCount);
        console.groupEnd();
        console.groupEnd();
    }
}
