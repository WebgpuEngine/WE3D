# S0-B2 · 存量游离导出分类清单

> 生成口径：与 `scripts/check-exports.mjs` 完全一致的解析逻辑。
> 统计：barrel `264` 符号 / src/we 实际 `674` / 游离 `410` 个。

## 分布总览（按来源目录，降序）

| 目录 | 游离导出数 |
|---|---:|
| `src/we/core/command` | 51 |
| `src/we/core/scene` | 33 |
| `src/we/core/resources/gpu` | 29 |
| `src/we/model/gltf` | 29 |
| `src/we/core/entity` | 24 |
| `src/we/core/base` | 22 |
| `src/we/core/atmosphere/hillaire` | 21 |
| `src/we/core/material` | 19 |
| `src/we/core/gbuffers` | 17 |
| `src/we/core/bufferBlock` | 16 |
| `src/we/core/light` | 16 |
| `src/we/core/animation` | 14 |
| `src/we/core/math` | 14 |
| `src/we/core/atmosphere` | 12 |
| `src/we/core/texture` | 12 |
| `src/we/core/SHR` | 10 |
| `src/we/core/organization` | 8 |
| `src/we/core/base/file` | 6 |
| `src/we/core/camera` | 6 |
| `src/we/core/geometry` | 6 |
| `src/we/core/physics` | 5 |
| `src/we/core/control` | 4 |
| `src/we/core/material/standard` | 4 |
| `src/we/model/simple` | 4 |
| `src/we/core/atmosphere/integrate` | 3 |
| `src/we/core/commandInfo` | 3 |
| `src/we/core/entity/animationEntity` | 3 |
| `src/we/core/resources/gpu/__tests__` | 3 |
| `src/we/core/config` | 2 |
| `src/we/core/input` | 2 |
| `src/we/core/model` | 2 |
| `src/we/core/onResize` | 2 |
| `src/we/core/pickup` | 2 |
| `src/we/core/sampler` | 2 |
| `src/we/core/entity/mesh` | 1 |
| `src/we/core/material/phong` | 1 |
| `src/we/core/particle` | 1 |
| `src/we/core/postprocess` | 1 |

## 逐目录清单

### `src/we/core/command`（51）

`BaseCommand`、`BaseDrawCommand`、`CopyCommand`、`DynBindGroupDrawCommand`、`IV_BaseCommand`、`IV_BaseDrawCommand`、`IV_DynBindGroupDrawCommand`、`I_ComputePipelineInitValues`、`I_DrawCommandIDs`、`I_DrawInputValueMaterial`、`I_IndexBufferEntry`、`I_PipelineStructure`、`I_VertexBufferEntry`、`I_bindGroupAndGroupLayout`、`I_drawCallOption`、`I_dynamicTextureEntryForExternal`、`I_dynamicTextureEntryForView`、`I_uniformDynamicPointer`、`T_BindGroupLayout`、`T_BindGroupType`、`T_drawMode`、`T_rpdInfomationOfMSAA`、`T_uniformEntries`、`T_uniformGroupsEntryOfSimple`、`T_uniformOneGroup`、`checkGPUBufferSize`、`cloneBufferSource`、`createIndexBuffer`、`createStorageBuffer`、`createUniformBuffer`、`ensureArrayBufferDivideByFour`、`formatLocationStringOfAttribute`、`getTypedArrayType`、`getWgslValueFormat`、`initVertexPart`、`isArrayBuffer`、`isDrawModeIndexed`、`isDrawModeVertex`、`isDynamicTextureEntryForExternal`、`isDynamicTextureEntryForView`、`isGPUBindGroup`、`isGPUBindGroupEntry`、`isGPUBindGroupLayout`、`isGPUBindGroupLayoutEntry`、`isI_vsAttributeMerge`、`isIndexGPUBufferBundle`、`isUniformBufferPart`、`isUniformGroup`、`isVSGPUBufferBundle`、`stableStringify`、`updataOneUniformBuffer`

### `src/we/core/scene`（33）

`I_SceneBaseUnit`、`I_renderDrawCommand`、`I_renderDrawOfDistancesLine`、`I_renderDrawOfQuad`、`I_renderPassOptions`、`I_transparentDrawCommand`、`RenderManager`、`addChild`、`addUserDefineEvent`、`commandsOfEntity`、`commandsOfShadowOfEntity`、`generateBox`、`generateSphere`、`getBackgroudColor`、`getBindGroupLayoutZeroOfCamera`、`getBindGroupLayoutZeroOfLight`、`getBindGroupZeroOfCamera`、`getBindGroupZeroOfLight`、`getBoundingBox`、`getBoundingSphere`、`getRenderPassDescriptor`、`getRenderPassDescriptorForNDC`、`getRenderPassDescriptorOfTransparent`、`getSystemBindGroupAndBindGroupLayoutForZero`、`getUserDefineEventStateByName`、`isResized`、`refreshSystemBindGroupAndBindGroupLayoutZeroForCamera`、`remove`、`removeFromScene`、`renderCommands`、`renderToSurface`、`setUserDefineEventStateByName`、`updateUserDefineEvent`

### `src/we/core/resources/gpu`（29）

`AssetCache`、`AssetStore`、`DefaultResources`、`DerivedCache`、`IV_ReleasePolicy`、`IV_ReleaseTicket`、`IV_ResourceEntry`、`I_AcquireResult`、`I_AssetStoreOptions`、`I_CompiledMetadata`、`I_FrameClock`、`I_InternalReleaseTicket`、`I_ReflectionSignatureInput`、`I_ReleasableStore`、`I_ResourcesGPUStats`、`I_StoreStats`、`ImmediatePolicy`、`LruPolicy`、`RefCountPolicy`、`ResourceManagerOfGPU`、`SystemCache`、`T_cacheId`、`T_shaderStage`、`computeFinalCodeHash`、`computeReflectionSignature`、`computeShaderModuleKey`、`computeVariantKey`、`disposeOf`、`normalizeKey`

### `src/we/model/gltf`（29）

`E_accessorUseFor`、`I_DependencySink`、`I_accessorFormat`、`I_accessorLike`、`T_accessorBufferSource`、`addNode`、`computeNormalsFromPositionsAndIndices`、`computeNormalsFromPositionsNoIndex`、`convertLineIndexLoopToList`、`convertTriangleIndexFanToList`、`getAccessor`、`getAccessorTypeForGPUVertexFormat`、`getGPUTexture`、`getIndecisArrayOfPrimitive`、`getIndecisOfPrimitive`、`getTexture`、`getVerticesArrayOfPrimitive`、`getVerticesOfPrimitive`、`initGPUTextures`、`initMaterials`、`initSamplers`、`initTextureInfo`、`initTextures`、`loadJSON`、`meshHasMorphTarget`、`meshHasSkins`、`predecodeDracoViaWorker`、`resolveExtensionDependencies`、`saveJSON`

### `src/we/core/entity`（24）

`BaseEntity`、`E_entityType`、`EntityManager`、`I_BaseEntityStep2`、`I_EntityAttributes`、`I_EntityAttributesVertices`、`I_EntityBundleOutput`、`I_ShadowMapValueOfDC`、`I_bundleForInputValueOfDC`、`I_entityInstance`、`I_locationInterpolate`、`I_vsfsBundle`、`checkPointerRebuildTime`、`entityID`、`generateDrawCommandAndTrack`、`generateGPUBindGroupEntries`、`generateGPUBindGroupLayoutDescriptor`、`generateInputValueOfDC`、`geometryBufferOfEntity`、`getBindGroupAndBindGroupLayout`、`getBindingOfBindGroup`、`meshConstantsVS`、`positionArray`、`valuesForCreateDCCC`

### `src/we/core/base`（22）

`E_lifeState`、`SimpleFunction`、`V_layerOfShadowMapTransparnet`、`V_lightNumber`、`V_shadowMapSize`、`V_shadowMapSizeDirection`、`V_textureAlphaZero`、`V_weDepthFormat`、`V_weShadowMapFormat`、`copyTextureToTexture`、`isWeColor3`、`isWeColor4`、`isWeMat3`、`isWeMat4`、`isWeVec2`、`isWeVec3`、`isWeVec4`、`userFN`、`userPromiseFN`、`weColorToColorOfF32`、`weHexColorToColor3`、`weVec2`

### `src/we/core/atmosphere/hillaire`（21）

`HillaireLutAP`、`HillaireLutBase`、`HillaireLutMultipleScattering`、`HillaireLutSkyView`、`HillaireLutTransmittance`、`HillaireRenderWithLut`、`HillaireRenderWithRayMarching`、`HillaireShadowMap`、`IV_HillaireAtmosphereLightParams`、`I_HillaireAtmosphereLight`、`I_HillaireAtmosphereParams`、`I_HillaireUniforms`、`LutUseShadowMap`、`RenderHillaire`、`shaderLutAp`、`shaderLutMulittrans`、`shaderLutSkyview`、`shaderLutTrans`、`shaderRenderWithLUT`、`shaderRenderWithRayMarching`、`shader_three_point_vs`

### `src/we/core/material`（19）

`E_MaterialType`、`E_MaterialUniformKind`、`E_TextureType`、`E_materialTypeForBindGroup`、`IV_BaseMaterial`、`IV_BaseStandardMaterial`、`IV_shaderMaterial`、`I_AlphaTransparentOfMaterial`、`I_BundleOfMaterialForMSAA`、`I_MaterialUniformTextureBundle`、`I_PartBundleOfUniform_TT`、`I_UniformBundleOfMaterial`、`I_alphaMode`、`I_materialBundleOutput`、`MaterialManager`、`T_transparentMode`、`materialAddBindGroupLayoutOfMSAA`、`materialAddBindGroupOfMSAA`、`materialAddGroupBindStringOfMSAA`

### `src/we/core/gbuffers`（17）

`E_GBufferNames`、`GBuffers`、`IV_GBuffer`、`I_GBuffer`、`I_GBufferBundle`、`I_GBufferGroup`、`I_GBufferName`、`I_GBufferStruct`、`I_TransparentGBufferGroup`、`V_ForwardGBufferNames`、`V_MsaaGBufferNames`、`V_TransparentGBufferNames`、`getColorAttachmentTargetsOfBlend`、`getColorAttachmentTargetsOfForward`、`getColorAttachmentTargetsOfMSAA`、`getColorAttachmentTargetsOfMSAAinfo`、`getColorAttachmentTargetsOfToneMapping`

### `src/we/core/bufferBlock`（16）

`BlockPointerCoordinator`、`E_BOLState`、`I_BolRebulidPercent`、`I_BolSize`、`I_BolStrideSizeOfUpdate`、`I_pointerDataParams`、`I_pointerInfoInBOL`、`MemoryBlockManager`、`Pointers`、`T_pointerDataType`、`T_pointerDataView`、`V_BolBufferSize`、`V_BolRebulidPercent`、`V_BolStrideSizeOfUpdate`、`WatchableBufferView`、`isI_pointerStruct`

### `src/we/core/light`（16）

`IV_LightSManager`、`LightsManager`、`ST_shadowMapMatrix_Size`、`ShadowMap`、`lightStructSize`、`lightStructSizeForRenderOfBindGroup`、`lightStructSizeOfShadowMapMVP`、`light_DepthTextureAndMVP`、`light_shadowMapMatrix`、`lights_DMVP`、`maxTextureArrayLayers`、`mergeLightUUID`、`optionShadowMap`、`shadowMapBox`、`splitLightUUID`、`structBaselight`

### `src/we/core/animation`（14）

`AnimationGroupManager`、`AnimationManager`、`IV_Skeleton`、`I_AnimationWeightForMergePlay`、`I_InterpolatoSampler`、`I_InterpolatorBase`、`I_InterpolatorPosition`、`I_InterpolatorQuaternion`、`I_InterpolatorRotation`、`I_InterpolatorScale`、`SkinsManager`、`WeightMixAnimation`、`WeightMixAnimationGroup`、`isI_AnimationPlayParams`

### `src/we/core/math`（14）

`RotationArray`、`WERandomInt`、`clamp`、`computeFaceNormalsArrayFromPositionsAndIndices`、`computeNormalsArrayFromPositionsAndIndices`、`computeNormalsArrayFromPositionsNoIndex`、`convertPositionsWithIndicesToPositionNonIndex`、`generateBox2`、`generateBox2ByArrayBox2s`、`generateBox3`、`generateBox3ByArrayBox3s`、`lerp`、`mod`、`rotate`

### `src/we/core/atmosphere`（12）

`Atmosphere`、`AtmosphereRenderBase`、`I_AtmosphereCloudParams`、`I_AtmosphereHillaire`、`I_AtmospherePLanetParams`、`I_AtmosphereParams`、`I_AtmosphereTextureLUT`、`I_AtomSphereAbsorption`、`I_AtomSphereHillaireAbsorption`、`I_AtomSphereMie`、`I_AtomSphereRayLeigh`、`I_AttomSphereBaseLayerParams`

### `src/we/core/texture`（12）

`CubeArrayTexture`、`IV_CubeArrayTexture`、`IV_Texture`、`I_HDRTexture`、`I_Texture2D`、`I_Texture3D`、`PrefilteredCubmapArray`、`T_modelOfVideo`、`TextureManager`、`isGPUSamplerDescriptor`、`isI_BaseTexture`、`numMipLevels`

### `src/we/core/SHR`（10）

`E_shaderRegisterAlianName`、`I_aliasShaderCode`、`T_SHR_RenderMode`、`WGSL_AliasShaderCode`、`WGSL_Include`、`WGSL_Replace`、`WGSL_ShaderCode`、`WGSL_V_Gbuffers_output`、`WGSL_V_Gbuffers_struct`、`WGSL_reflection_attributes`

### `src/we/core/organization`（8）

`ECSManager`、`E_BVHSpaceType`、`FeatureClass`、`FeatureManager`、`IV_AttachSpaceAttributeToNodeModel`、`I_FeatureModule`、`I_UUID`、`NodeObjectConstructor`

### `src/we/core/base/file`（6）

`I_VideoOption`、`weGetGzipResource`、`weGetImageByUrl`、`weGetImagesByUrl`、`weGetResource`、`weGetVidoeByUrl`

### `src/we/core/camera`（6）

`CameraManager`、`CameraPositionAndInvertVP`、`DeferDrawCommandGenerator`、`IV_CameraManager`、`ToneMappingCommandGenerator`、`cameraRayValues`

### `src/we/core/geometry`（6）

`BaseGeometry`、`IV_Gemetry`、`I_GeometryAttributeGroup`、`I_geometryAttribute`、`I_geometryWireFrameAttribute`、`xyz`

### `src/we/core/physics`（5）

`ColliderBody`、`PhysicBody`、`PhysicalModel`、`RigidBody`、`physicalBody`

### `src/we/core/control`（4）

`IV_OrbitCameraControl`、`InputForCamera`、`InputHandlerForCamera`、`ObjectControl`

### `src/we/core/material/standard`（4）

`BaseStandardMaterial`、`IV_VolumeShaderMaterial`、`IV_VolumeTextureMaterial`、`T_opacityAlphaOperations`

### `src/we/model/simple`（4）

`computeProjectedPlaneUVs`、`computeSurfaceNormals`、`generateNormals`、`mesh`

### `src/we/core/atmosphere/integrate`（3）

`AtmosphereIntegrate`、`RenderIntegrateAtmoSphere`、`shader_atmosphere_wlBXWK`

### `src/we/core/commandInfo`（3）

`I_weComputeStruct`、`I_weCopyStruct`、`I_weDrawStruct`

### `src/we/core/entity/animationEntity`（3）

`AnimationEntity`、`MorphTargetEntity`、`SkinsEntity`

### `src/we/core/resources/gpu/__tests__`（3）

`installWebGPUGlobals`、`makeStubDevice`、`makeStubScene`

### `src/we/core/config`（2）

`getRuntimeAssetsConfig`、`getRuntimeAssetsVersion`

### `src/we/core/input`（2）

`I_PickupIDs`、`InputManager`

### `src/we/core/model`（2）

`I_ModelResMap`、`T_ModelResKind`

### `src/we/core/onResize`（2）

`I_Resize`、`ResizeManager`

### `src/we/core/pickup`（2）

`IV_PickupInitValue`、`pickupManager`

### `src/we/core/sampler`（2）

`Sampler`、`getSampler`

### `src/we/core/entity/mesh`（1）

`createWrieFrame`

### `src/we/core/material/phong`（1）

`WePhongMaterial`

### `src/we/core/particle`（1）

`BaseParticle`

### `src/we/core/postprocess`（1）

`PostProcessManager`

