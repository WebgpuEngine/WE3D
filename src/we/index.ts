// WE3D 引擎公共 API 入口（curated barrel）
// 唯一公开边界：外部应只从此处导入；内部模块直接深层导入不在兼容性承诺内。
// 维护约定：新增公共 API 时在此追加；`npm run check:exports` 会提示遗漏。
// 注意：value 与 type 必须分开导出（interface / type 只能 `export type`，否则 lib 打包会报 not exported）。

// scene
export type { IV_Scene } from "./core/scene/base";
export { E_ToneMappingType } from "./core/scene/base";
export type { initSceneConfig, userDefineEventCall } from "./core/scene/base";
export { Scene } from "./core/scene/scene";
export { Clock } from "./core/scene/clock";
export { initScene } from "./core/scene/fn";

// organization
export { RootGPU } from "./core/organization/root";
export { NodeSpace } from "./core/organization/nodeSpace";
export type { IV_NodeSpace, T_worldRelationTransmit } from "./core/organization/nodeSpace";
export { NodeObject, newNode } from "./core/organization/nodeObject";
export type { NodeObjectJSON, IV_Node } from "./core/organization/nodeObject";

// animation
export { AnimationGroup } from "./core/animation/animationGroup";
export type { IV_AnimationGroupValue } from "./core/animation/animationGroup";
export { E_InterpolationModes, E_AnimationType, E_AnimationTargetType, E_PlayState, E_AnimationPlayType } from "./core/animation/base";
export type { I_AnimationPlayParams, I_AnimationSampler, I_AnimationRunTimer } from "./core/animation/base";
export { BaseAnimation } from "./core/animation/BaseAnimation";
export type { IV_AnimationValue } from "./core/animation/BaseAnimation";
export { Interpolator } from "./core/animation/interpolator";
export type { IV_Interpolator } from "./core/animation/interpolator";
export { KeyFrameAnimation } from "./core/animation/keyFrame";
export { MorphTargetAnimation } from "./core/animation/morphTarget";
export { Skeleton } from "./core/animation/skeleton";
export { SkinAnimation } from "./core/animation/skin";
export type { IV_SkinAnimationValue } from "./core/animation/skin";

// base
export type { I_Update, weColor3, weColor4, weVec3, weVec4, weMat4, weMat3, TypedArray, weHexColor } from "./core/base/coreDefine";
export { weGetBinaryResourceFromGzip } from "./core/base/file/getFile";

// camera
export { BaseCamera } from "./core/camera/baseCamera";
export type { I_BaseCameraValue } from "./core/camera/baseCamera";
export { OrthographicCamera } from "./core/camera/orthographicCamera";
export type { IV_OrthographicCamera } from "./core/camera/orthographicCamera";
export { PerspectiveCamera } from "./core/camera/perspectiveCamera";
export type { IV_PerspectiveCamera } from "./core/camera/perspectiveCamera";

// command
export type { commmandType, I_drawMode, I_drawModeIndexed, I_viewport } from "./core/command/base";
export { ComputeCommand } from "./core/command/ComputeCommand";
export type { IV_ComputeCommand } from "./core/command/ComputeCommand";
export { CopyCommandT2T } from "./core/command/copyCommandT2T";
export type { optionCopyT2T } from "./core/command/copyCommandT2T";
export { DrawCommand } from "./core/command/DrawCommand";
export type { IV_DrawCommand } from "./core/command/DrawCommand";
export { DrawCommandGenerator } from "./core/command/DrawCommandGenerator";
export type { I_vsAttribute, I_baseGPUBufferBundle, I_vsGPUBufferBundle, I_indexGPUBufferBundle, I_vsAttributeMerge, T_vsAttribute, T_indexAttribute, IV_DC } from "./core/command/DrawCommandGenerator";
export { SimpleDrawCommand } from "./core/command/SimpleDrawCommand";
export type { IV_SimpleDrawCommand } from "./core/command/SimpleDrawCommand";

// control
export type { cameracCntrolType } from "./core/control/base";
export { ArcballCameraControl } from "./core/control/arcballCameraControl";
export { CamreaControl } from "./core/control/cameracControl";
export type { IV_CamreaControl } from "./core/control/cameracControl";
export { OrbitCameraControl } from "./core/control/OrbitCameraControl";
export { WASDCameraControl } from "./core/control/wasdCameraControl";

// entity
export type { IV_BaseEntity } from "./core/entity/base";
export { Mesh } from "./core/entity/mesh/mesh";
export type { IV_MeshEntity } from "./core/entity/mesh/mesh";
export { Lines } from "./core/entity/mesh/lines";
export type { IV_LinesEntity } from "./core/entity/mesh/lines";
export { Points } from "./core/entity/mesh/points";
export type { IV_PointsEntity, T_PointEmulate } from "./core/entity/mesh/points";
export { OneColoeCube } from "./core/entity/mesh/oneColorCube";
export { Sprite } from "./core/entity/sprite/sprite";
export type { IV_Sprite } from "./core/entity/sprite/sprite";
export { LinesMorphTarget } from "./core/entity/animationEntity/linesOfMorphTarget";
export { LinesSkins } from "./core/entity/animationEntity/linesOfSkins";
export { MeshMorphTarget } from "./core/entity/animationEntity/meshOfMorphTarget";
export { MeshSkins } from "./core/entity/animationEntity/meshOfSkins";

// geometry
export { BoxGeometry } from "./core/geometry/boxGeometry";
export type { optionBoxGemetry } from "./core/geometry/boxGeometry";
export { CircleGeometry } from "./core/geometry/circleGeometry";
export type { optionCircleGeometry } from "./core/geometry/circleGeometry";
export { ConeGeometry } from "./core/geometry/coneGeometry";
export type { optionConeGeometry } from "./core/geometry/coneGeometry";
export { CylinderGeometry } from "./core/geometry/cylinderGeometry";
export type { optionCylinderGeometry } from "./core/geometry/cylinderGeometry";
export { DodecahedronGeometry } from "./core/geometry/DodecahedronGeometry";
export { IcosahedronGeometry } from "./core/geometry/IcosahedronGeometry";
export { LatheGeometry } from "./core/geometry/LatheGeometry";
export type { IV_LatheGeometryGemetry } from "./core/geometry/LatheGeometry";
export { OctahedronGeometry } from "./core/geometry/OctahedronGeometry";
export { OneColorCube } from "./core/geometry/oneColorCube";
export { PlaneGeometry } from "./core/geometry/planeGeomertry";
export type { optionPlaneGeometry } from "./core/geometry/planeGeomertry";
export { PolyhedronGeometry } from "./core/geometry/polyhedronGeometry";
export type { optionPolyhedronGeometry } from "./core/geometry/polyhedronGeometry";
export { RingGeometry } from "./core/geometry/ringGeometry";
export type { optionRingGeometry } from "./core/geometry/ringGeometry";
export { SphereGeometry } from "./core/geometry/sphereGeometry";
export type { optionSphereGeometry } from "./core/geometry/sphereGeometry";
export { TetrahedronGeometry } from "./core/geometry/terahedronGeometry";
export { TorusGeometry } from "./core/geometry/torusGeometry";
export type { optionTorusGeometry } from "./core/geometry/torusGeometry";

// input
export { E_InputEvent, E_InputPriority, E_InputControlType } from "./core/input/base";
export type { I_InputRegisterPriorityLayer } from "./core/input/base";
export { BaseInputControl } from "./core/input/baseInputControl";

// light
export { E_lightType, BaseLight } from "./core/light/baseLight";
export type { I_optionBaseLight } from "./core/light/baseLight";
export { AmbientLight } from "./core/light/ambientLight";
export type { IV_AmbientLight } from "./core/light/ambientLight";
export { DirectionalLight } from "./core/light/DirectionalLight";
export type { IV_DirectionalLight } from "./core/light/DirectionalLight";
export { PointLight } from "./core/light/pointLight";
export type { IV_PointLight } from "./core/light/pointLight";
export { SpotLight } from "./core/light/SpotLight";
export type { IV_SpotLight } from "./core/light/SpotLight";

// ibl
export { IBL } from "./core/ibl/ibl";
export type { IV_IBL } from "./core/ibl/ibl";

// material
export { BaseMaterial } from "./core/material/baseMaterial";
export { ColorMaterial } from "./core/material/standard/colorMaterial";
export type { I_ColorMaterial } from "./core/material/standard/colorMaterial";
export { CubeTextureMaterial } from "./core/material/standard/cubeTextureMaterial";
export type { IV_CubeTextureMaterial } from "./core/material/standard/cubeTextureMaterial";
export { TextureMaterial } from "./core/material/standard/textureMaterial";
export type { IV_TextureMaterial } from "./core/material/standard/textureMaterial";
export { VertexColorMaterial } from "./core/material/standard/vertexColorMaterial";
export type { IV_VertexColorMaterial } from "./core/material/standard/vertexColorMaterial";
export { VideoMaterial } from "./core/material/standard/videoMaterial";
export type { IV_VideoMaterial } from "./core/material/standard/videoMaterial";
export { WireFrameMaterial } from "./core/material/standard/wireFrameMaterial";
export { PBRMaterial } from "./core/material/PBR/PBRMaterial";
export type { IV_PBRMaterial, I_TextureForPBR } from "./core/material/PBR/PBRMaterial";
export { PhongMaterial } from "./core/material/phong/phongMaterial";
export type { IV_PhongMaterial } from "./core/material/phong/phongMaterial";

// math
export type { Rotation } from "./core/math/baseDefine";
export { WeGenerateID, WeGenerateUUID } from "./core/math/baseFunction";
export { computeAABB } from "./core/math/Box";
export type { Box2, Box3, boundingBox } from "./core/math/Box";
export { generateSphereFromBox3, computeBoundingSphere } from "./core/math/sphere";
export type { Sphere, boundingSphere } from "./core/math/sphere";

// model
export { BaseModel } from "./core/model/BaseModel";
export type { I_Model } from "./core/model/BaseModel";
export { ModelDataLoader } from "./core/model/ModelDataLoader";

// pickup
export type { IV_Pickup, T_PickupFunction, I_PickupMouseKeyEvent } from "./core/pickup/base";
export { Pickup } from "./core/pickup/pickup";
export type { I_PickupedMouseKey } from "./core/pickup/pickup";

// postprocess
export { BasePostProcess } from "./core/postprocess/basePostProcess";
export type { IV_PostProcess } from "./core/postprocess/basePostProcess";
export { FXAA } from "./core/postprocess/FXAA";
export type { I_FXAAValues } from "./core/postprocess/FXAA";
export { Blur3x3 } from "./core/postprocess/blur3x3";
export { PP_RedToOne } from "./core/postprocess/RedToOne";

// texture
export { E_TextureChannel } from "./core/texture/base";
export type { I_BaseTexture, T_textureSourceType, I_BaseSampler, I_mipmap } from "./core/texture/base";
export { BaseTexture } from "./core/texture/baseTexture";
export { PrefilteredCubemap } from "./core/texture/prefilteredCubemap";
export type { I_PrefilteredCubmap } from "./core/texture/prefilteredCubemap";
export { CubeTexture } from "./core/texture/cubeTexxture";
export type { IV_CubeTexture } from "./core/texture/cubeTexxture";
export { DefaultCubeTexture } from "./core/texture/defaultCubeTexture";
export { DefaultTexture } from "./core/texture/defaultTexture";
export { Texture } from "./core/texture/texture";
export { VideoTexture } from "./core/texture/videoTexture";
export type { IV_OptionVideoTexture, T_VIdeoSourceType } from "./core/texture/videoTexture";
export { HDRTexture } from "./core/texture/HDRTexture";
export { Texture2D } from "./core/texture/texture2D";
