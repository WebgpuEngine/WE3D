/**
 * S0-A1 · GPU timestamp-query profiler（进程内，非公共 API）。
 *
 * 设计约束：
 * 1、WebGPU 规范的 `GPUCommandEncoder.writeTimestamp()` 已移除，时间戳只能通过
 *    `GPURenderPassDescriptor.timestampWrites` / `GPUComputePassDescriptor.timestampWrites`
 *    在 pass 边界写入；因此本 profiler 只提供「pass 描述符注入」与「结果解析」，不改任何绘制逻辑。
 * 2、默认关闭（enabled=false）：注入的描述符与原始描述符完全一致，渲染结果零变化，
 *    既有 89/90 张 GPU 基线不需要重出。只有显式 enable() 且 device 支持
 *    'timestamp-query' feature 时才写入 query。
 * 3、feature 缺失时 enable() 返回 false，所有方法安全降级为 no-op。
 *
 * 性能对照口径按 §十 D3 推迟到 demo 对比阶段；本模块只产出「可复现的度量」，不设阈值。
 */

export interface I_GpuPassTiming {
    /** 调用方给的 pass 名（如 E_renderPassName 字符串） */
    name: string;
    /** GPU 耗时（毫秒）= (end - begin) 纳秒 / 1e6 */
    ms: number;
}

export interface I_GpuProfilerReport {
    /** device 是否支持 timestamp-query feature */
    supported: boolean;
    /** 是否已启用并产生过有效采样 */
    enabled: boolean;
    passTimings: I_GpuPassTiming[];
    /** 所有已采样 pass 的耗时之和（毫秒） */
    totalMS: number;
}

export interface IV_GpuProfilerOptions {
    /** querySet 容量：每个 pass 占 2 个 query（begin/end）。默认 32 pass。 */
    maxPass?: number;
}

export class GpuProfiler {
    private device: GPUDevice;
    private readonly supported: boolean;
    private readonly maxPass: number;
    private enabledFlag: boolean = false;

    private querySet: GPUQuerySet | null = null;
    private resolveBuffer: GPUBuffer | null = null;
    private readBuffer: GPUBuffer | null = null;

    private passNames: string[] = [];
    private passIndex: number = 0;
    private reading: boolean = false;
    private lastReport: I_GpuProfilerReport;

    constructor(device: GPUDevice, options: IV_GpuProfilerOptions = {}) {
        this.device = device;
        this.supported = device.features.has('timestamp-query');
        this.maxPass = Math.max(1, options.maxPass ?? 32);
        this.lastReport = {
            supported: this.supported,
            enabled: false,
            passTimings: [],
            totalMS: 0,
        };
    }

    /** device 是否支持 timestamp-query feature。 */
    isSupported(): boolean {
        return this.supported;
    }

    isEnabled(): boolean {
        return this.enabledFlag;
    }

    /**
     * 启用 profiler 并创建 GPU 资源。feature 不支持时返回 false 且保持 no-op。
     * 重复调用安全（已启用直接返回 true）。
     */
    enable(): boolean {
        if (this.enabledFlag) return true;
        if (!this.supported) return false;

        this.querySet = this.device.createQuerySet({
            type: 'timestamp',
            count: this.maxPass * 2,
            label: 'S0A1-GpuProfiler-timestamp',
        });
        this.resolveBuffer = this.device.createBuffer({
            size: this.maxPass * 2 * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
            label: 'S0A1-GpuProfiler-resolve',
        });
        this.readBuffer = this.device.createBuffer({
            size: this.maxPass * 2 * 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            label: 'S0A1-GpuProfiler-read',
        });
        this.enabledFlag = true;
        this.lastReport = { ...this.lastReport, enabled: true };
        return true;
    }

    /** 每帧开始：清空 pass 记录。 */
    beginFrame(): void {
        this.passNames = [];
        this.passIndex = 0;
    }

    /**
     * 给 pass 描述符注入 timestampWrites。未启用或超容量时返回原对象（不改动）。
     * 调用方需把返回值传给 beginRenderPass/beginComputePass。
     */
    stampRenderPass<T extends GPURenderPassDescriptor>(descriptor: T, name: string): T {
        if (!this.enabledFlag || !this.querySet || this.passIndex >= this.maxPass)
            return descriptor;
        const begin = this.passIndex * 2;
        this.passNames.push(name);
        this.passIndex += 1;
        return {
            ...descriptor,
            timestampWrites: {
                querySet: this.querySet,
                beginningOfPassWriteIndex: begin,
                endOfPassWriteIndex: begin + 1,
            },
        };
    }

    /** 同上，用于 compute pass。 */
    stampComputePass<T extends GPUComputePassDescriptor>(descriptor: T, name: string): T {
        if (!this.enabledFlag || !this.querySet || this.passIndex >= this.maxPass)
            return descriptor;
        const begin = this.passIndex * 2;
        this.passNames.push(name);
        this.passIndex += 1;
        return {
            ...descriptor,
            timestampWrites: {
                querySet: this.querySet,
                beginningOfPassWriteIndex: begin,
                endOfPassWriteIndex: begin + 1,
            },
        };
    }

    /**
     * 在 commandEncoder.finish() 之前调用：把 query 结果解析到 resolveBuffer 并拷贝到本地可读 buffer。
     * 上一次 read() 尚未完成时会跳过本帧采样，避免 MAP_READ 与 GPU 写入冲突。
     */
    resolve(encoder: GPUCommandEncoder): void {
        if (!this.enabledFlag || !this.querySet || !this.resolveBuffer || !this.readBuffer) return;
        if (this.reading || this.passIndex === 0) return;
        const queryCount = this.passIndex * 2;
        encoder.resolveQuerySet(this.querySet, 0, queryCount, this.resolveBuffer, 0);
        encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readBuffer, 0, queryCount * 8);
        this.reading = true;
    }

    /**
     * 在 queue.submit() 之后调用：异步读回并更新报告。
     * 未采样或正在读时返回上一次报告（安全 no-op）。
     */
    async read(): Promise<I_GpuProfilerReport> {
        if (!this.enabledFlag || !this.readBuffer || !this.reading) return this.lastReport;
        const queryCount = this.passIndex * 2;
        await this.readBuffer.mapAsync(GPUMapMode.READ, 0, queryCount * 8);
        try {
            const range = this.readBuffer.getMappedRange(0, queryCount * 8);
            const stamps = new BigUint64Array(range);
            const passTimings: I_GpuPassTiming[] = [];
            let totalNS = 0n;
            for (let i = 0; i < this.passNames.length; i++) {
                const begin = stamps[i * 2];
                const end = stamps[i * 2 + 1];
                // 无效/未写入的 query 可能是 0 或 end<begin；跳过而非产生负数。
                if (end > begin) {
                    const delta = end - begin;
                    totalNS += delta;
                    passTimings.push({ name: this.passNames[i], ms: Number(delta) / 1e6 });
                }
            }
            this.lastReport = {
                supported: this.supported,
                enabled: true,
                passTimings,
                totalMS: Number(totalNS) / 1e6,
            };
        } finally {
            this.readBuffer.unmap();
            this.reading = false;
        }
        return this.lastReport;
    }

    report(): I_GpuProfilerReport {
        return { ...this.lastReport, passTimings: [...this.lastReport.passTimings] };
    }

    /** 释放 GPU 资源；重复调用安全。 */
    destroy(): void {
        this.querySet?.destroy();
        this.resolveBuffer?.destroy();
        this.readBuffer?.destroy();
        this.querySet = null;
        this.resolveBuffer = null;
        this.readBuffer = null;
        this.enabledFlag = false;
        this.lastReport = {
            supported: this.supported,
            enabled: false,
            passTimings: [],
            totalMS: 0,
        };
    }
}
