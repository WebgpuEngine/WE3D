import type { I_drawMode, I_drawModeIndexed } from './base';

export abstract class BaseCommand {
    abstract update(): GPUCommandBuffer;
    abstract dowhole(): void;
    abstract doWithRPD(commandEncoder: GPUCommandEncoder): void;
    abstract doWithPipeline(option: any): void;
    abstract doDraw(option: any): void;
    abstract drawInstacnce(
        passEncoder: GPURenderPassEncoder,
        drawMode: I_drawMode | I_drawModeIndexed,
    ): void;
    abstract submit(): void;
    abstract destroy(): any;
}
