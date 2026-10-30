import { Scene } from '../../scene/scene';
import { Atmosphere } from '../atmosphere';
import {
    I_HillaireAtmosphereLight,
    I_HillaireAtmosphereParams,
    I_HillaireUniforms,
    IV_HillaireAtmosphereLightParams,
} from './baseHillaire';
import { commmandType } from '../../command/base';
import { Mat4, mat4, vec3, Vec3 } from 'wgpu-matrix';
import { PerspectiveCamera } from '../../camera/perspectiveCamera';

import { HillaireRenderWithLut } from './renderWithLut';
import { HillaireRenderWithRayMarching } from './renderWithRayMarching';
import { HillaireLutTransmittance } from './lutTransmittance';
import { HillaireLutMultipleScattering } from './lutMultipleScattering';
import { HillaireLutAP } from './lutAP';
import { HillaireLutSkyView } from './lutSkyView';
import { weVec3 } from '../../base/coreDefine';
import { HillaireShadowMap } from './HillaireShadowMap';

export class AtmosphereHillaire extends Atmosphere {
    /** rayleigh尺度高度 :8km*/
    rayleighScaleHeight = 8.0;
    /** mie尺度高度 :1.2km*/
    mieScaleHeight = 1.2;
    /** 星球半径 :6360km*/
    bottomRadius = 6360.0;
    /** 大气光源参数列表 */
    lights: IV_HillaireAtmosphereLightParams[] = [];
    /** 是否开启太阳阴影地图 */
    sunShadowMap: boolean = false;
    /** 是否开启月亮阴影地图 */
    moonShadowMap: boolean = false;
    /** 太阳     */
    sun: I_HillaireAtmosphereLight = {
        illuminance: [1, 1, 1],
        disk_diameter: 0.04014257279586957,
        direction: [0, 1, 0],
        disk_luminance_scale: 65,
    };
    /**月亮,这和太阳相同，需要根据实际情况调整     */
    moon: I_HillaireAtmosphereLight = {
        illuminance: [1, 1, 1],
        disk_diameter: 0.04014257279586957,
        direction: [0, 1, 0],
        disk_luminance_scale: 65,
    };
    configHillaire: I_HillaireUniforms = {
        inverse_projection: new ArrayBuffer(16), // 逆投影矩阵
        inverse_view: new ArrayBuffer(16), // 逆视图矩阵
        camera_world_position: [0, 1, 0], // 相机世界坐标
        frame_id: 0, // 当前帧ID
        screen_resolution: [0, 0], // 屏幕分辨率
        ray_march_min_spp: 30, // 光线步进最小采样数
        ray_march_max_spp: 14, // 光线步进最大采样数
        sun: this.sun, // 太阳参数
        moon: this.moon, // 月亮参数
    };
    // 大气初始化参数
    atmosphereParams: I_HillaireAtmosphereParams = {
        rayleigh_scattering: [0.005802, 0.013558, 0.0331],
        rayleigh_density_exp_scale: -1.0 / this.rayleighScaleHeight,

        mie_scattering: [0.003996, 0.003996, 0.003996],
        mie_density_exp_scale: -1.0 / this.mieScaleHeight,
        mie_extinction: [0.00444, 0.00444, 0.00444],
        mie_phase_param: 0.8,
        mie_absorption: [0, 0, 0],

        absorption_density_0_layer_height: 25.0,
        absorption_density_0_constant_term: -2 / 3,
        absorption_density_0_linear_term: 1 / 15,

        absorption_density_1_constant_term: 8 / 3,
        absorption_density_1_linear_term: -1 / 15,
        absorption_extinction: [0.00065, 0.001881, 0.000085],

        bottom_radius: this.bottomRadius,
        ground_albedo: [0.4, 0.4, 0.4],
        top_radius: 100.0 + this.bottomRadius,
        planet_center: [0, -this.bottomRadius, 0.0],

        multi_scattering_factor: 1.0,
        FROM_KM_SCALE: 1.0,
        USE_MOON: false,

        mode: 'lut',
        ray_march_min_spp: 30,
        ray_march_max_spp: 14,
    };
    atmosphereBufferSize = 128;
    atmosphereGPUBuffer: GPUBuffer;
    atmosphereCPUBuffer: ArrayBuffer = new ArrayBuffer(this.atmosphereBufferSize);
    // 大气视图
    AtmosphereViews = {
        rayleigh_scattering: new Float32Array(this.atmosphereCPUBuffer, 0, 3),
        rayleigh_density_exp_scale: new Float32Array(this.atmosphereCPUBuffer, 12, 1),
        mie_scattering: new Float32Array(this.atmosphereCPUBuffer, 16, 3),
        mie_density_exp_scale: new Float32Array(this.atmosphereCPUBuffer, 28, 1),
        mie_extinction: new Float32Array(this.atmosphereCPUBuffer, 32, 3),
        mie_phase_param: new Float32Array(this.atmosphereCPUBuffer, 44, 1),
        mie_absorption: new Float32Array(this.atmosphereCPUBuffer, 48, 3),
        absorption_density_0_layer_height: new Float32Array(this.atmosphereCPUBuffer, 60, 1),
        absorption_density_0_constant_term: new Float32Array(this.atmosphereCPUBuffer, 64, 1),
        absorption_density_0_linear_term: new Float32Array(this.atmosphereCPUBuffer, 68, 1),
        absorption_density_1_constant_term: new Float32Array(this.atmosphereCPUBuffer, 72, 1),
        absorption_density_1_linear_term: new Float32Array(this.atmosphereCPUBuffer, 76, 1),
        absorption_extinction: new Float32Array(this.atmosphereCPUBuffer, 80, 3),
        bottom_radius: new Float32Array(this.atmosphereCPUBuffer, 92, 1),
        ground_albedo: new Float32Array(this.atmosphereCPUBuffer, 96, 3),
        top_radius: new Float32Array(this.atmosphereCPUBuffer, 108, 1),
        planet_center: new Float32Array(this.atmosphereCPUBuffer, 112, 3),
        multi_scattering_factor: new Float32Array(this.atmosphereCPUBuffer, 124, 1),
    };
    configBufferSize = 224;
    configGPUBuffer: GPUBuffer;
    configCPUBuffer: ArrayBuffer = new ArrayBuffer(this.configBufferSize);
    configViews: any = {
        inverse_projection: new Float32Array(this.configCPUBuffer, 0, 16),
        inverse_view: new Float32Array(this.configCPUBuffer, 64, 16),
        camera_world_position: new Float32Array(this.configCPUBuffer, 128, 3),
        frame_id: new Float32Array(this.configCPUBuffer, 140, 1),
        screen_resolution: new Float32Array(this.configCPUBuffer, 144, 2),
        ray_march_min_spp: new Float32Array(this.configCPUBuffer, 152, 1),
        ray_march_max_spp: new Float32Array(this.configCPUBuffer, 156, 1),
        sun: {
            illuminance: new Float32Array(this.configCPUBuffer, 160, 3),
            disk_diameter: new Float32Array(this.configCPUBuffer, 172, 1),
            direction: new Float32Array(this.configCPUBuffer, 176, 3),
            disk_luminance_scale: new Float32Array(this.configCPUBuffer, 188, 1),
        },
        moon: {
            illuminance: new Float32Array(this.configCPUBuffer, 192, 3),
            disk_diameter: new Float32Array(this.configCPUBuffer, 204, 1),
            direction: new Float32Array(this.configCPUBuffer, 208, 3),
            disk_luminance_scale: new Float32Array(this.configCPUBuffer, 220, 1),
        },
    };

    /**
     * LUT纹理
     * 包括透射率、多散射、天空视图、AP
     * */
    lutGPUTexture: {
        transTexture: GPUTexture;
        multiScattTexture: GPUTexture;
        skyviewTexture: GPUTexture;
        apTexture: GPUTexture;
    };
    /**
     * LUT命令: 包括渲染的CC和其他辅助命令
     */
    lutCommands: {
        transmittance: commmandType[];
        multiScatt: commmandType[];
        skyview: commmandType[];
        ap: commmandType[];
    } = {
        transmittance: [],
        multiScatt: [],
        skyview: [],
        ap: [],
    };
    renderCommands: {
        rayMarch: commmandType[];
        withLut: commmandType[];
    } = {
        rayMarch: [],
        withLut: [],
    };
    lutTransmittance!: HillaireLutTransmittance;
    lutMultipleScattering!: HillaireLutMultipleScattering;
    lutAP!: HillaireLutAP;
    lutSkyView!: HillaireLutSkyView;

    renderWithLut!: HillaireRenderWithLut;
    renderRayMarch!: HillaireRenderWithRayMarching;
    mode: 'lut' | 'rayMarch' = 'lut';
    frame_id: number = 0;

    sampler: GPUSampler;
    ///////////////////////////////////////////////////////////////////////////////////////////
    //shadow map
    shadowMap!: HillaireShadowMap;
    /** 缺省的阴影纹理 */
    // depthShadowMapTexture: GPUTexture;
    /**
     *
     * @param scene 场景
     * @param inputAtmosphereParams 大气参数
     * @param lights 大气光源参数列表[],
     */
    constructor(
        scene: Scene,
        inputAtmosphereParams?: I_HillaireAtmosphereParams,
        lights?: IV_HillaireAtmosphereLightParams[],
    ) {
        super(scene);
        if (inputAtmosphereParams) {
            const keys = Object.keys(inputAtmosphereParams) as Array<
                keyof I_HillaireAtmosphereParams
            >;
            for (const key of keys) {
                const value = inputAtmosphereParams[key];
                if (value != undefined) {
                    (this.atmosphereParams[key] as typeof value) = value;
                }
            }
            this.mode = inputAtmosphereParams.mode || 'lut';
        }
        if (lights) {
            this.lights = lights;
        } else {
            this.lights = [];
        }
        // if (configHillaire) {
        //     const keys = Object.keys(configHillaire) as Array<keyof I_HillaireUniforms>;
        //     for (const key of keys) {
        //         let value = configHillaire[key];
        //         if (value != undefined) {
        //             (this.configViews[key] as typeof value) = value;
        //         }
        //     }
        // }
        this.shadowMap = new HillaireShadowMap(this.scene, this);

        // this.depthShadowMapTexture = scene.device.createTexture({
        //     label: "defaultHillaireShadowMap-1x1",
        //     size: [1, 1],
        //     format: V_weShadowMapFormat,
        //     usage: GPUTextureUsage.TEXTURE_BINDING,
        // });
        if (this.device) {
            this.atmosphereGPUBuffer = this.scene.device.createBuffer({
                size: this.atmosphereBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.configGPUBuffer = this.scene.device.createBuffer({
                size: this.configBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.lutGPUTexture = {
                transTexture: scene.device.createTexture({
                    label: 'lutTransTexture',
                    size: [256, 64],
                    format: 'rgba16float',
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                multiScattTexture: scene.device.createTexture({
                    label: 'lutMulitScattTexture',
                    size: [32, 32],
                    format: 'rgba16float',
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                skyviewTexture: scene.device.createTexture({
                    label: 'lutSkyviewTexture',
                    size: [192, 108],
                    format: 'rgba16float',
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
                apTexture: scene.device.createTexture({
                    dimension: '3d',
                    label: 'lutAPTexture',
                    size: [32, 32, 32],
                    format: 'rgba16float',
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                }),
            };
            this.sampler = this.scene.device.createSampler({
                label: 'LUT sampler',
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
                addressModeW: 'clamp-to-edge',
                minFilter: 'linear',
                magFilter: 'linear',
                mipmapFilter: 'linear',
                lodMinClamp: 0,
                lodMaxClamp: 32,
                maxAnisotropy: 1,
            });
        } else {
            throw new Error('GPU device is null');
        }

        this.init();
    }
    init() {
        this.initLightsParameter();
        this.updateAtmosphereBuffer();
        this.updateConfigArrayBuffer();
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
        this.lutTransmittance = new HillaireLutTransmittance(this);
        this.lutTransmittance.init();
        this.lutMultipleScattering = new HillaireLutMultipleScattering(this);
        this.lutMultipleScattering.init();
        this.lutSkyView = new HillaireLutSkyView(this);
        this.lutSkyView.init();
        this.lutAP = new HillaireLutAP(this);
        this.lutAP.init();
        if (this.mode == 'lut') {
            console.log('lut mode');
            this.renderWithLut = new HillaireRenderWithLut(this);
        } else {
            console.log('rayMarch mode');
            this.renderRayMarch = new HillaireRenderWithRayMarching(this);
        }
    }

    ///////////////////////////////////////////////////////////////////////////////////
    //update
    ///////////////////////////////////////////////////////////////////////////////////
    updateAtmosphereBuffer() {
        this.AtmosphereViews.rayleigh_density_exp_scale[0] =
            this.atmosphereParams.rayleigh_density_exp_scale!;
        this.AtmosphereViews.rayleigh_scattering.set(this.atmosphereParams.rayleigh_scattering!);

        this.AtmosphereViews.mie_density_exp_scale[0] =
            this.atmosphereParams.mie_density_exp_scale!;
        this.AtmosphereViews.mie_scattering.set(this.atmosphereParams.mie_scattering!);
        this.AtmosphereViews.mie_extinction.set(this.atmosphereParams.mie_extinction!);
        this.AtmosphereViews.mie_phase_param[0] = this.atmosphereParams.mie_phase_param!;
        this.AtmosphereViews.mie_absorption.set(this.atmosphereParams.mie_absorption!);

        this.AtmosphereViews.absorption_density_0_layer_height[0] =
            this.atmosphereParams.absorption_density_0_layer_height!;
        this.AtmosphereViews.absorption_density_0_constant_term[0] =
            this.atmosphereParams.absorption_density_0_constant_term!;
        this.AtmosphereViews.absorption_density_0_linear_term[0] =
            this.atmosphereParams.absorption_density_0_linear_term!;

        this.AtmosphereViews.absorption_density_1_constant_term[0] =
            this.atmosphereParams.absorption_density_1_constant_term!;
        this.AtmosphereViews.absorption_density_1_linear_term[0] =
            this.atmosphereParams.absorption_density_1_linear_term!;
        this.AtmosphereViews.absorption_extinction.set(
            this.atmosphereParams.absorption_extinction!,
        );

        this.AtmosphereViews.bottom_radius[0] = this.atmosphereParams.bottom_radius!;
        this.AtmosphereViews.ground_albedo.set(this.atmosphereParams.ground_albedo!);
        /**
         * 顶部半径，用于计算散射,
         * uv_to_transmittance_lut_params()中是大气层半径，
         * 1、与webgpu-sky-atomsphere中的“atmosphere.ts”的makeEarthAtmosphere（）top_radius不同
         * 2、wgsl：let h_sq = atmosphere.top_radius * atmosphere.top_radius - bottom_radius_sq;
         */
        this.AtmosphereViews.top_radius[0] = this.atmosphereParams.top_radius!;
        this.AtmosphereViews.planet_center.set(this.atmosphereParams.planet_center!);

        this.AtmosphereViews.multi_scattering_factor[0] =
            this.atmosphereParams.multi_scattering_factor!;

        if (this.atmosphereParams.ray_march_max_spp)
            this.configHillaire.ray_march_max_spp = this.atmosphereParams.ray_march_max_spp;
        if (this.atmosphereParams.ray_march_min_spp)
            this.configHillaire.ray_march_min_spp = this.atmosphereParams.ray_march_min_spp;
    }
    /** 更新uniform config 的arraybuffer数值     */
    updateConfigArrayBuffer() {
        //!!!!!!!!!!!!这个是相机的逆投影矩阵，需要替换为实际的逆投影矩阵
        let inverseProjection: Mat4 = mat4.create();
        let projection: Mat4 = mat4.create();
        const cameraWorldPosition: Vec3 = vec3.create();
        let inverseView: Mat4 = mat4.create();
        if (this.scene.defaultCamera) {
            if (this.scene.reversedZ.isReversedZ) {
                projection = mat4.perspectiveReverseZ(
                    // 45.0 * (Math.PI / 180.0), // 45度视场角
                    (this.scene.defaultCamera as PerspectiveCamera).getfov(), // 视场角
                    this.scene.defaultCamera.aspect,
                    this.scene.defaultCamera.Near, //1.0, // 近裁剪面
                    // this.scene.defaultCamera.far, // 远裁剪面,可以缺省
                );
            } else {
                projection = mat4.perspective(
                    // 45.0 * (Math.PI / 180.0), // 45度视场角
                    (this.scene.defaultCamera as PerspectiveCamera).getfov(), // 视场角
                    this.scene.defaultCamera.aspect,
                    this.scene.defaultCamera.Near,
                    (this.scene.defaultCamera as PerspectiveCamera).Far, // 远裁剪面，不可以缺省
                );
            }
            inverseView = this.scene.defaultCamera.viewMatrix;
            cameraWorldPosition.set(this.scene.defaultCamera.Position);
        } else {
            projection = mat4.perspectiveReverseZ(
                45.0 * (Math.PI / 180.0), // 45度视场角
                this.scene.finalTarget.color!.width! / this.scene.finalTarget.color!.height!,
                1.0, // 近裁剪面
                // this.scene.defaultCamera.far, // 远裁剪面,可以缺省
            );
            //NDC的逆视图矩阵
            this.configViews.inverse_view.set([
                0.9982005399352043, -3.469446951953616e-18, -0.059964006479444616, 0,
                0.021123774406648883, 0.9358968236779351, 0.35164032986045496, 0,
                0.05612012319911533, -0.35227423327509005, 0.9342127147189574, 0,
                -8.881784197001256e-16, 1.0000000000000004, 99.99999999999999, 1,
            ]);
            cameraWorldPosition.set([0, 1, 100]);
        }
        inverseProjection = mat4.inverse(projection);

        this.configViews.inverse_projection.set(inverseProjection);
        this.configViews.inverse_view.set(inverseView);
        this.configViews.camera_world_position.set(cameraWorldPosition);

        this.configViews.frame_id.set([this.frame_id++]); //当前帧ID,用于计算时间,在NDC中忽略
        this.configViews.screen_resolution.set([
            this.scene.surface.size.width,
            this.scene.surface.size.height,
        ]); //屏幕分辨率
        this.configViews.ray_march_max_spp.set([this.configHillaire.ray_march_max_spp]); //光线步进最大采样数
        this.configViews.ray_march_min_spp.set([this.configHillaire.ray_march_min_spp]); //光线步进最小采样数
        this.configViews.sun.illuminance.set(this.configHillaire.sun.illuminance); //太阳照度（W/m²）
        this.configViews.sun.disk_diameter.set([this.configHillaire.sun.disk_diameter]); //太阳视直径（弧度）
        this.configViews.sun.direction.set(this.sun.direction); //太阳方向（指向光源）
        this.configViews.sun.disk_luminance_scale.set([
            this.configHillaire.sun.disk_luminance_scale,
        ]); //太阳盘面亮度缩放因子
    }

    initLightsParameter() {
        this.lights.forEach((light, index) => {
            let sun: I_HillaireAtmosphereLight | undefined = undefined;
            if (index == 0) {
                sun = this.sun;
                if (light.directionalLight.Shadow) this.sunShadowMap = true;
            } else if (index == 1) {
                sun = this.moon;
                if (light.directionalLight.Shadow) this.moonShadowMap = true;
            }
            if (sun != undefined) {
                const color: weVec3 = [
                    (light.directionalLight.Color as Vec3)[0],
                    (light.directionalLight.Color as Vec3)[1],
                    (light.directionalLight.Color as Vec3)[2],
                ];
                color[0] *= light.directionalLight.Intensity;
                color[1] *= light.directionalLight.Intensity;
                color[2] *= light.directionalLight.Intensity;
                sun.illuminance = color;

                if (light.disk_diameter) sun.disk_diameter = light.disk_diameter;
                if (light.disk_luminance_scale)
                    sun.disk_luminance_scale = light.disk_luminance_scale;
            }
        });
        this.updateLightsParameter();
    }
    updateLightsParameter() {
        this.lights.forEach((light, index) => {
            let sun: I_HillaireAtmosphereLight | undefined = undefined;
            if (index == 0) sun = this.sun;
            else if (index == 1) sun = this.moon;
            if (sun != undefined)
                sun.direction = [
                    (light.directionalLight.Direction as Vec3)[0],
                    (light.directionalLight.Direction as Vec3)[1],
                    (light.directionalLight.Direction as Vec3)[2],
                ];
        });
    }
    /**
     * 更新配置数组缓冲区，并写入GPUBuffer
     * 2、推送到  render pass
     *    A、render 模式的command 推送；
     *    B、lut 模式的sky view 和 ap 推送（重新生成）；
     */
    update() {
        this.updateLightsParameter();
        this.updateConfigArrayBuffer();
        this.scene.device.queue.writeBuffer(this.atmosphereGPUBuffer, 0, this.atmosphereCPUBuffer);
        this.scene.device.queue.writeBuffer(this.configGPUBuffer, 0, this.configCPUBuffer);
        if (this.mode == 'lut') {
            //todo：更新sky view 和 ap的条件判断
            this.lutSkyView.update();
            this.lutAP.update();
            //更新render pass
            this.renderWithLut.update();
        } else {
            this.renderRayMarch.update();
        }
    }
    /**
     * 场景大小改变时调用
     * 1、renderWithLut 和renderWithRayMarching 使用GBuffers的color texture，所以同步重新创建
     */
    async onResize() {
        console.log('onResize');
        //bind group 1 需要的绑定组
        if (this.mode == 'lut') {
            this.renderWithLut.onResize();
        } else {
            this.renderRayMarch.onResize();
        }
    }
}
