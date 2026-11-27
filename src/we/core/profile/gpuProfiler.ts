/**
 * S0-A1 · GPU timestamp-query profiler（进程内，非公共 API）。
 *
 * 设计约束：
 * 1、WebGPU 规范的 `GPUCommandEncoder.writeTimestamp()` 已移除，时间戳只能通过
 *    `GPURenderPassDescriptor.timestampWrites` / `GPUComputePassDescriptor.timestampWrites`
 *    在 pass 边界写入；因此本 profiler 只提供「pass 描述符注入」与「结果解析」，不改任何绘制逻辑。
 * 2、默认关闭（enabled=false）：注入的描述符与原始描述符完全一致，渲染结果零变化，
 *    既有 GPU 基线不需要重出。只有显式 enable() 且 device 支持
 *    'timestamp-query' feature 时才写入 query。
 * 3、feature 缺失时 enable() 返回 false，所有方法安全降级为 no-op。
 *
 * 双缓冲连续采样（S0 perf-harness 后续项）：
 *   - 两个独立 slot（querySet / resolveBuffer / readBuffer 各自独立）按帧序号交替；
 *   - 本帧 resolve 写入 slot A 并异步发起 mapAsync；
 *   - 下帧写 slot B 时 slot A 的解析已完成，不阻塞当帧 encode/submit；
 *   - read() 返回 Promise（await 可拿到本帧报告，适合单帧测试）；
 *     PerfHarness 帧末只调用不等待，通过 sampleVersion 消费最近一次完成的采样。
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

/** slot 生命周期：idle（可写）→ written（已编码 resolve）→ mapping（mapAsync 中）→ idle。 */
type T_SlotState = 'idle' | 'written' | 'mapping';

interface I_ProfilerSlot {
    querySet: GPUQuerySet;
    resolveBuffer: GPUBuffer;
    readBuffer: GPUBuffer;
    passNames: string[];
    passIndex: number;
    queryCount: number;
    state: T_SlotState;
}

const SLOT_COUNT = 2;

export class GpuProfiler {
    private device: GPUDevice;
    private readonly supported: boolean;
    private readonly maxPass: number;
    private enabledFlag = false;

    private slots: I_ProfilerSlot[] = [];
    private activeSlot: I_ProfilerSlot | null = null;
    private frameIndex = 0;
    private sampleVersionValue = 0;
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
     * 启用 profiler 并创建双缓冲 GPU 资源。feature 不支持时返回 false 且保持 no-op。
     * 重复调用安全（已启用直接返回 true）。
     */
    enable(): boolean {
        if (this.enabledFlag) return true;
        if (!this.supported) return false;

        for (let i = 0; i < SLOT_COUNT; i++) {
            const label = `S0A1-GpuProfiler-${i}`;
            this.slots.push({
                querySet: this.device.createQuerySet({
                    type: 'timestamp',
                    count: this.maxPass * 2,
                    label: `${label}-timestamp`,
                }),
                resolveBuffer: this.device.createBuffer({
                    size: this.maxPass * 2 * 8,
                    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
                    label: `${label}-resolve`,
                }),
                readBuffer: this.device.createBuffer({
                    size: this.maxPass * 2 * 8,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                    label: `${label}-read`,
                }),
                passNames: [],
                passIndex: 0,
                queryCount: 0,
                state: 'idle',
            });
        }
        this.enabledFlag = true;
        this.lastReport = { ...this.lastReport, enabled: true };
        return true;
    }

    /**
     * 每帧开始：按帧序号交替选择 slot 并清空其 pass 记录。
     * 目标 slot 仍在上一次 mapAsync 中时本帧跳过采样（降级保护）。
     */
    beginFrame(): void {
        if (!this.enabledFlag) return;
        const slot = this.slots[this.frameIndex % SLOT_COUNT];
        this.frameIndex++;
        if (slot.state !== 'idle') {
            this.activeSlot = null;
            return;
        }
        slot.passNames = [];
        slot.passIndex = 0;
        slot.queryCount = 0;
        this.activeSlot = slot;
    }

    /**
     * 给 pass 描述符注入 timestampWrites。未启用、slot 忙或超容量时返回原对象（不改动）。
     * 调用方需把返回值传给 beginRenderPass/beginComputePass。
     */
    stampRenderPass<T extends GPURenderPassDescriptor>(descriptor: T, name: string): T {
        const slot = this.activeSlot;
        if (!this.enabledFlag || !slot || slot.passIndex >= this.maxPass) return descriptor;
        const begin = slot.passIndex * 2;
        slot.passNames.push(name);
        slot.passIndex += 1;
        return {
            ...descriptor,
            timestampWrites: {
                querySet: slot.querySet,
                beginningOfPassWriteIndex: begin,
                endOfPassWriteIndex: begin + 1,
            },
        };
    }

    /** 同上，用于 compute pass。 */
    stampComputePass<T extends GPUComputePassDescriptor>(descriptor: T, name: string): T {
        const slot = this.activeSlot;
        if (!this.enabledFlag || !slot || slot.passIndex >= this.maxPass) return descriptor;
        const begin = slot.passIndex * 2;
        slot.passNames.push(name);
        slot.passIndex += 1;
        return {
            ...descriptor,
            timestampWrites: {
                querySet: slot.querySet,
                beginningOfPassWriteIndex: begin,
                endOfPassWriteIndex: begin + 1,
            },
        };
    }

    /**
     * 在 commandEncoder.finish() 之前调用：把当前 slot 的 query 结果解析到其 resolveBuffer 并拷贝到 readBuffer。
     * 无采样或 slot 忙时不编码任何命令。
     */
    resolve(encoder: GPUCommandEncoder): void {
        const slot = this.activeSlot;
        if (!this.enabledFlag || !slot || slot.passIndex === 0) return;
        slot.queryCount = slot.passIndex * 2;
        encoder.resolveQuerySet(slot.querySet, 0, slot.queryCount, slot.resolveBuffer, 0);
        encoder.copyBufferToBuffer(slot.resolveBuffer, 0, slot.readBuffer, 0, slot.queryCount * 8);
        slot.state = 'written';
    }

    /**
     * 在 queue.submit() 之后调用：对当前 slot 发起 mapAsync 并解析到 lastReport。
     * 返回 Promise（await 可拿到本帧报告，适合单帧测试）；PerfHarness 帧末不等待，
     * 下一帧通过 sampleVersion 判断是否有新采样可消费，避免阻塞 requestAnimationFrame。
     */
    async read(): Promise<I_GpuProfilerReport> {
        const slot = this.activeSlot;
        if (!this.enabledFlag || !slot || slot.state !== 'written' || slot.queryCount === 0) {
            return this.lastReport;
        }
        slot.state = 'mapping';
        const byteLength = slot.queryCount * 8;
        try {
            await slot.readBuffer.mapAsync(GPUMapMode.READ, 0, byteLength);
            const range = slot.readBuffer.getMappedRange(0, byteLength);
            const stamps = new BigUint64Array(range);
            const passTimings: I_GpuPassTiming[] = [];
            let totalNS = 0n;
            for (let i = 0; i < slot.passNames.length; i++) {
                const begin = stamps[i * 2];
                const end = stamps[i * 2 + 1];
                // 无效/未写入的 query 可能是 0 或 end<begin；跳过而非产生负数。
                if (end > begin) {
                    const delta = end - begin;
                    totalNS += delta;
                    passTimings.push({ name: slot.passNames[i], ms: Number(delta) / 1e6 });
                }
            }
            this.lastReport = {
                supported: this.supported,
                enabled: true,
                passTimings,
                totalMS: Number(totalNS) / 1e6,
            };
            this.sampleVersionValue++;
        } catch {
            // mapAsync 失败（如 destroy）：保留上一次报告，slot 仍回到 idle。
        } finally {
            try {
                if (slot.readBuffer.mapState === 'mapped') slot.readBuffer.unmap();
            } catch {
                // destroy 后 buffer 已失效，忽略。
            }
            slot.state = 'idle';
        }
        return this.lastReport;
    }

    /** 已完成的采样版本号；调用方据此判断是否有新报告，避免重复消费同一帧。 */
    get sampleVersion(): number {
        return this.sampleVersionValue;
    }

    report(): I_GpuProfilerReport {
        return { ...this.lastReport, passTimings: [...this.lastReport.passTimings] };
    }

    /** 释放双缓冲 GPU 资源；重复调用安全。 */
    destroy(): void {
        for (const slot of this.slots) {
            try {
                if (slot.readBuffer.mapState === 'mapped') slot.readBuffer.unmap();
            } catch {
                // destroy 后 buffer 已失效，忽略。
            }
            slot.querySet.destroy();
            slot.resolveBuffer.destroy();
            slot.readBuffer.destroy();
        }
        this.slots = [];
        this.activeSlot = null;
        this.enabledFlag = false;
        this.frameIndex = 0;
        this.sampleVersionValue = 0;
        this.lastReport = {
            supported: this.supported,
            enabled: false,
            passTimings: [],
            totalMS: 0,
        };
    }
}
