import { commmandType } from "../command/base";
import { CopyCommandT2T } from "../command/copyCommandT2T";
import { E_GBufferNames } from "../gbuffers/base";
import { WeGenerateID } from "../math/baseFunction";
import { I_FeatureModule } from "../organization/featureManager";
import { Clock } from "../scene/clock";
import { E_renderPassName } from "../scene/renderManager";
import { Scene } from "../scene/scene";
import { Atmosphere } from "./atmosphere";

export abstract class AtmosphereRenderBase implements I_FeatureModule {
    UUID: string;
    _manager: any;
    _id: number;
    _isDestroy: boolean;
    scene: Scene;
    device: GPUDevice;
    parent: Atmosphere;
    bindGroupLayout: GPUBindGroupLayout[] = [];
    bindGroups: GPUBindGroup[] = [];
    /**
     * 渲染命令:创建两种模式的渲染命令（跟进finalTarget.NDC变化）
     * 1、ndc渲染命令；
     * 2、afterDefer渲染命令；
     */
    commands: commmandType[] = [];
    rpd!: GPURenderPassDescriptor;
    pipeline!: GPURenderPipeline;
    colorTexture!: GPUTexture;
    depthTexture!: GPUTexture;
    copyColorTexture!: GPUTexture;

    state: boolean = false;

    constructor(parent: Atmosphere) {
        this._id = WeGenerateID();
        this.UUID = this._id.toString();
        this._isDestroy = false;
        this.parent = parent;
        this.scene = parent.scene;
        this.device = parent.scene.device;
        // this.generateCommands();
        // this.initTexture();
    }
    /**
     * 生成渲染命令
     */
    abstract generateCommands(): void;
    /**
     * 获取常量
     * 用于在渲染时判断是否需要更新常量
     * @returns 常量字符串
     */
    abstract getConstants(): Record<string, number> | undefined;
    /**
     * 获取绑定组字符串
     * 用于在渲染时判断是否需要更新绑定组
     * @returns 绑定组字符串
     */
    // abstract getBindGroupString(): string;
    abstract generateBindGroup(): void;

    /**
     *映射纹理
     */
    initTexture() {
        this.colorTexture = this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.color);
        this.depthTexture = this.scene.cameraManager.getDepthTextureByUUID(this.scene.defaultCamera.UUID);
        this.copyColorTexture = this.scene.cameraManager.GBufferManager.GBuffer[this.scene.defaultCamera.UUID].finalRender.color;
    }

    getBindGroups(): GPUBindGroup[] {
        return this.bindGroups;
    }



    copyColorCommand() {
        const size = this.scene.surface.size;
        const copyToColorTexture = new CopyCommandT2T(
            {
                A: this.colorTexture,
                B: this.copyColorTexture,
                size: { width: size.width, height: size.height },
                device: this.device
            }
        );
        return copyToColorTexture;
    }
    getRpd(): GPURenderPassDescriptor {
        this.rpd = {
            label: "atmoshpere render rpd",
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.colorTexture,
                },
            ],
        };
        return this.rpd;
    }
    update(clock?: Clock): void {
        if (this.state == false) {
            if ((this.colorTexture == undefined || this.depthTexture == undefined) &&
                this.scene.cameraManager.getGBufferTextureByUUID(this.scene.defaultCamera.UUID, E_GBufferNames.color)) {
                this.onResize();
                this.generateCommands();
                this.state = true;
            };
        }
        if (this.state == true)
            this.commands.forEach((DC) => {
                if (this.scene.finalTarget.NDC == true) {
                    this.scene.renderManager.push({
                        command: DC,
                        kind: E_renderPassName.ndc,
                    })
                } else {
                    this.scene.renderManager.push({
                        command: DC,
                        kind: E_renderPassName.afterDeferRender,
                    })
                }
            })
    }
    async onResize(): Promise<void> {
        this.initTexture();
        this.getRpd();
        this.generateBindGroup();
        this.commands[0] = this.copyColorCommand();
    }

}