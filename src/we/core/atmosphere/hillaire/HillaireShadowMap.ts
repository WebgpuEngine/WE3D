import { mat4 } from "wgpu-matrix";
import { Scene } from "../../scene/scene";
import { AtmosphereHillaire } from "./atmosphereHillaire";
import { V_weShadowMapFormat } from "../../base/coreDefine";

export class HillaireShadowMap {
    scene: Scene;
    device: GPUDevice;
    hillaireAtmosphere: AtmosphereHillaire;

    /** 缺省的阴影纹理 */
    depthShadowMapTexture: GPUTexture;
    defaultShadowMapGPUTextureView: GPUTextureView;

    shadowMapVP: ArrayBuffer = new ArrayBuffer(2 * 16 * 4);
    shadowMapVPView: Float32Array = new Float32Array(this.shadowMapVP);
    gpuBufferShadowMapVP: GPUBuffer;
    shadowCmpSampler: GPUSampler;

    constructor(scene: Scene, hillaireAtmosphere: AtmosphereHillaire) {
        this.scene = scene;
        this.device = scene.device;
        this.hillaireAtmosphere = hillaireAtmosphere;
        this.depthShadowMapTexture = scene.device.createTexture({
            label: "defaultHillaireShadowMap-1x1",
            size: [1, 1],
            format: V_weShadowMapFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING,
        });
        this.defaultShadowMapGPUTextureView = this.depthShadowMapTexture.createView();


        this.shadowMapVP = new ArrayBuffer(2 * 16 * 4);
        this.shadowMapVPView = new Float32Array(this.shadowMapVP);

        this.gpuBufferShadowMapVP = this.scene.device.createBuffer({
            size: this.shadowMapVP.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const matrix = mat4.identity();
        this.shadowMapVPView.set(matrix, 0);
        this.shadowMapVPView.set(matrix, 16);
        this.shadowCmpSampler = this.device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            lodMinClamp: 0,
            lodMaxClamp: 32,
            maxAnisotropy: 1,
            compare: this.scene.reversedZ.isReversedZ ? "greater" : "less"
        });
    }
    /** 更新阴影图VP矩阵，和 bindgroup1 绑定的资源 */
    updateShadowMapVP() {
        if (this.hillaireAtmosphere.sunShadowMap) {//更新VP矩阵的arraybuffer
            this.shadowMapVPView.set(this.hillaireAtmosphere.lights[0].directionalLight.getMVP()[0]);
        }
        if (this.hillaireAtmosphere.moonShadowMap) {//更新VP矩阵的arraybuffer
            this.shadowMapVPView.set(this.hillaireAtmosphere.lights[1].directionalLight.getMVP()[0]);
        }
        //如果使用shadowmap
        if (this.hillaireAtmosphere.sunShadowMap || this.hillaireAtmosphere.moonShadowMap) {
            //更新阴影图VP矩阵的GPUBuffer
            this.scene.device.queue.writeBuffer(this.gpuBufferShadowMapVP, 0, this.shadowMapVP);
            //阴影地图在当前帧中重建了，更新bindgroup1
            // if (this.scene.getShadowMapRebuildTime() !== this.scene.clock.now) {
            //     this.generateBindGroup1();
            // }
        }
    }
    /** 获取指定光源的阴影地图 */
    getShowShadowMap(id: number): GPUTextureView {
        let shadowMap: GPUTextureView = this.defaultShadowMapGPUTextureView;//默认的占位1*1的阴影图
        if (this.hillaireAtmosphere.sunShadowMap && id === 0) {
            // getShadowMapDepthTextureView_ByIdAndMatrixID
            const id = this.hillaireAtmosphere.lights[0].directionalLight.ID;
            shadowMap = this.scene.lightsManager.getShadowMapDepthTextureView_ByIdAndMatrixID(id, 0);
        }
        if (this.hillaireAtmosphere.moonShadowMap && id === 1) {
            // getShadowMapDepthTextureView_ByIdAndMatrixID
            const id = this.hillaireAtmosphere.lights[1].directionalLight.ID;
            shadowMap = this.scene.lightsManager.getShadowMapDepthTextureView_ByIdAndMatrixID(id, 0);
        }
        return shadowMap;
    }
}