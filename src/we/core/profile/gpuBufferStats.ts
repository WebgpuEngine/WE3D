/**
 * S0-A3 · nonRender GPUBuffer 统计收集器（进程内，非公共 API）。
 *
 * 职责：收集渲染路径之外的显存 / 上传开销，用于 perf-harness 的非渲染侧诊断。
 * 1、只做整数自增 / 自减，零渲染副作用；
 * 2、CPU 侧（pointer 写入）与 GPU 侧（BOL writeBuffer / gltf 上传）分开统计；
 * 3、VRAM 侧按 BOL 类型与 gltf 分别累计，供碎片率与上传带宽分析。
 *
 * 与 frameStats 一样，本模块是进程内单例，计数点直接 import `gpuBufferStats`，
 * 不把容器穿透到各层构造函数。
 */
import { E_BOLBufferType } from '../bufferBlock/base';

/** 单个 BOL 类型的显存占用 */
export interface I_GpuBufferStatsBolType {
    type: E_BOLBufferType;
    /** 预分配总字节（BOL.size.total） */
    total: number;
    /** 已分配字节 */
    used: number;
    /** 空闲字节 */
    free: number;
    /** 已释放（碎片）字节 */
    released: number;
}

export interface I_GpuBufferStats {
    /** CPU 侧：pointer 写入 cpuBuffer 的字节与次数 */
    cpu: { writeBytes: number; writeCalls: number };
    /** GPU 侧：queue.writeBuffer 上传字节与分片数；BOL 重建次数与重写字节 */
    gpu: { uploadBytes: number; uploadCalls: number; rebuildCount: number; rebuildBytes: number };
    vram: {
        /** 按 BOL 类型聚合的显存 */
        bolByType: I_GpuBufferStatsBolType[];
        /** BOL 预分配总字节 */
        bolTotal: number;
        /** gltf 创建的 buffer 字节 */
        gltf: number;
        /** BOL + gltf 总字节 */
        total: number;
    };
    bufferCount: { bol: number; gltf: number; total: number };
}

export class GpuBufferStats {
    private cpu = { writeBytes: 0, writeCalls: 0 };
    private gpu = { uploadBytes: 0, uploadCalls: 0, rebuildCount: 0, rebuildBytes: 0 };
    private bolByType = new Map<E_BOLBufferType, I_GpuBufferStatsBolType>();
    private bolTotal = 0;
    private gltfBytes = 0;
    private bolCount = 0;
    private gltfCount = 0;

    /** 帧开始：重置 cpu / gpu 每帧计数（Scene.run 调用）。 */
    beginFrame(): void {
        this.cpu.writeBytes = 0;
        this.cpu.writeCalls = 0;
        this.gpu.uploadBytes = 0;
        this.gpu.uploadCalls = 0;
        this.gpu.rebuildCount = 0;
        this.gpu.rebuildBytes = 0;
    }

    /** CPU 侧写入：pointers.updatePointerData 写入 cpuBuffer。 */
    addCpuWrite(bytes: number): void {
        if (bytes <= 0) return;
        this.cpu.writeBytes += bytes;
        this.cpu.writeCalls += 1;
    }

    /** GPU 侧上传：BOL.update 的 queue.writeBuffer（分片各自累加）。 */
    addGpuUpload(bytes: number): void {
        if (bytes <= 0) return;
        this.gpu.uploadBytes += bytes;
        this.gpu.uploadCalls += 1;
    }

    /** BOL 重建：记录重建次数与重写字节。 */
    incRebuild(bytes: number): void {
        if (bytes <= 0) return;
        this.gpu.rebuildCount += 1;
        this.gpu.rebuildBytes += bytes;
    }

    /** BOL 初始化：按类型累加预分配字节。 */
    incBol(type: E_BOLBufferType, bytes: number): void {
        if (bytes <= 0) return;
        let entry = this.bolByType.get(type);
        if (!entry) {
            entry = { type, total: 0, used: 0, free: 0, released: 0 };
            this.bolByType.set(type, entry);
        }
        entry.total += bytes;
        entry.free += bytes;
        this.bolTotal += bytes;
        this.bolCount += 1;
    }

    /** BOL 销毁：按类型扣减预分配字节。 */
    decBol(type: E_BOLBufferType, bytes: number): void {
        if (bytes <= 0) return;
        const entry = this.bolByType.get(type);
        if (!entry) return;
        entry.total = Math.max(0, entry.total - bytes);
        entry.free = Math.max(0, entry.free - bytes);
        this.bolTotal = Math.max(0, this.bolTotal - bytes);
        this.bolCount = Math.max(0, this.bolCount - 1);
    }

    /** gltf 创建 GPUBuffer：累加字节与数量。 */
    incGltf(bytes: number): void {
        if (bytes <= 0) return;
        this.gltfBytes += bytes;
        this.gltfCount += 1;
    }

    /** 当前快照（PerfHarness 报告时读取）。 */
    snapshot(): I_GpuBufferStats {
        return {
            cpu: { ...this.cpu },
            gpu: { ...this.gpu },
            vram: {
                bolByType: [...this.bolByType.values()].map((e) => ({ ...e })),
                bolTotal: this.bolTotal,
                gltf: this.gltfBytes,
                total: this.bolTotal + this.gltfBytes,
            },
            bufferCount: {
                bol: this.bolCount,
                gltf: this.gltfCount,
                total: this.bolCount + this.gltfCount,
            },
        };
    }
}

/** 进程内单例：计数点直接引用。 */
export const gpuBufferStats = new GpuBufferStats();
