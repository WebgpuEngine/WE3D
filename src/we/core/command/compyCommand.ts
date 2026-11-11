export abstract class CopyCommand {
    name = 'copy';
    device!: GPUDevice;
    abstract copy(commandEncoder: GPUCommandEncoder): GPUCommandBuffer | void;
}
