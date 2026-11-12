/**
 * 渲染通道
 * 一顺序：
 * 1、具有内容线顺序
 * 2、具有时间线顺序
 *
 * 二、stage
 * 1、depth,forwar,transparent,sprite,spriteTransparent,defer这些都是world stage的。world starge 隐式=stage0;
 * 2、world stage 是按照camera（一个或多个）进行渲染的。也可以理解为：每个camera都有一个world stage。
 */
export enum E_renderPassName {
    compute = 'compute',
    texture = 'texture',
    material = 'material',
    renderTarget = 'renderTarget',
    /**操作等同于forward，只是没有FS */
    shadowmapOpaque = 'shadowmapOpaque',
    /**
     * 等同于透明渲染，需要按照距离进行排序
     * 1、每个shadowMap的到实体的距离是不同的
     */
    shadowmapTransparent = 'shadowmapTransparent',

    // /**
    //  * 延迟渲染的深度渲染通道
    //  * 1、单像素深度渲染，用于延迟渲染的深度测试（后续使用forward进行正常渲染，单像素模式）
    //  * 2、此模式不能解决GPU编译时间成本、光照与阴影的简单多变种问题
    //  * 3、淘汰
    //  */
    // depth = "depth",
    /**
     * 方式：FS  
     * 用途：
     *      MSAA通道，用于MSAA抗锯齿。
     * 说明：
     *      1、webGPU的MSAA目前（1.0版本）不支持r32unint ,rgba32float。
     *      2、无法进行多采样与非多采样的混合。
     *      3、使用单独的MSAA GBuffer，只输出color和depth。
     *      4、resolve操作：在每个camera的MSAA通道之后，进行resolve操作。（resolve操作在forward之前在MSAA的最后进行）
     *            A、需要调用cameraManager的resolveMSAA方法，进行resolve操作。
     *      5、综上所述，MSAA需要在透明渲染之前完成resolve的单样本的输出
     */
    MSAA = 'MSAA',
    /**
     * 方式：FS
     * 用途：
     *      前向渲染通道，用于正常的渲染。前向渲染通道可以被forward,TO,MSAA info 使用.
     * 说明：
     *      一、按照RPD-->pipeline-->Draw的方案进行渲染。
     *            1、RPD：即每个camera或light+index
     *            2、pipeline：pipeline的队列。
     *            3、Draw：draw命令。
     *                  A、全部是instance draw，即使instance数量为1
     *                  B、可见性剔除也需要考虑，camera + Entity => BVH => instance 实例（可见性剔除后的）。
     *      二、备注（距离方案思考）
     *            1、可以按照距离排序，从近到远绘制，减少overDraw
     *            2、如果按照从近到远排序：
     *              A、排序在renderManager中获取,并同时进行可见性管理调用，得到新的需要绘制的DC队列。
     *                B、队列是全部的DC。
     *            3、还需要考虑instance draw， pipeline 排序等因素。
     *              A、instance draw，按照最近距离原则
     *                B、pipeline 排序，就基本没有了，邻近距离形成pipeline集合的概率 是否有性能提升是其一，可以考虑（均衡over draw 和pipeline 切换的性能成本）。
     */
    forward = 'forward',
    /**
     * 状态：todo
     * 时间：
     *      1、20260414，是否启用需要再考虑，是否有必要，是否会增加复杂性
     * 用途：
     *      延迟渲染之前的quad渲染，用于提升渲染性能。
     * 定位：   
     *      1、提升绘制性能，将需要大量计算的GPU操作，使用quad模式集中处理
     *      2、避免forward中的大量重复计算（减少overDraw）
     *      3、绘制的内容：
     *          FS（是替换、混合等，可以包括color、normal、albedo等）
     *          VS是quad模式（worldPosition来自camera GBuffer的worldPosition）
     * 方式：FS或CS     
     * 
    //  * 二、RPD 和GBuffer
    //  * 1、RPD是与forward通道中的RPD不同，不输出worldPosition buffer
    //  * 2、写入除worldPosition之外的GBuffer。
    //  * 
    //  * 二、draw的内容
    //  * 1、draw的内容是需要在defer通道中进行处理。
    //  * 2、用途： 投影纹理，贴花纹理等，
    //  * 3、可以写入多个GBuffer，color,normal，albedo等。depth视情况而定，原则上不写入。
     */
    beforeDeferRender = 'beforeDeferRender',
    /**
     * 状态：    todo
     * 时间：
     *      1、20260721 定义
     * 用途：
     *      1、延迟渲染之前的quad渲染，用于更改PBR参数。
     *          A、包括normal、albedo等内容的贴花（如：改变法线实现凹凸）等；
     *          B、其他（需要更改PBR参数）大量需要重复像素计算的；比如：下雨方案
     */
    changePbrParamsBeforeDeferRender = 'changePbrParamsBeforeDeferRender',
    /**
     * 延迟通道，统一处理光照与阴影
     */
    defer = 'defer',
    /**
     * 状态：
     *      todo：20260414，可以启用，未实现，需要增加一个renderPass的识别并分配到渲染通道
     * 方式：FS或CS
     * 用途：
     *      1、延迟渲染之后quad渲染，用于提升渲染性能.
     *          A、只进行颜色覆盖，与alpha混合的FS shader。
     *             比如：投影纹理，贴花（不修改PBR参数的）等
     *          B、其他（不更改PBR参数）大量需要重复像素计算的；比如：落雪方案
     *      2、RPD只包括color，进行混合或覆盖像素的操作。
     *      3、没有PBR相关参数的操作。  
     * 说明：
     *      1、在defer之后进行绘制，是不需要更新PBR参数的。
     *      2、在afterDeferRender之前进行绘制，afterDeferRender可能会更高光影效果（比如：天光等）。
     */
    quadAddDrawAfterDeferRender = 'quadAddDrawAfterDeferRender',
    /**
     * 方式：FS或CS 
     * 说明：
     *      1、用于绘制Quad方式的方案.
     *      1、使用的是 commmandType[]队列，不区分相机；
     *      2、其中的命令，都是完整的passEncoder编码开始执行，无聚合优化
     * 用途：
     *      1、大气层
     * 问题：
     
     */
    afterDeferRender = 'afterDeferRender',

    /**
     * 透明层，按距离绘制
     */
    transparent = 'transparent',
    /**
     * 不参与world stage深度测试的，不透明2D精灵通道。（参与深度测试的sprite在正常的forward中）
     * 1、不透明sprite，只为在world其他实体之上的sprite
     * 2、这个通道内，sprite（不透明和透明一致处理），写入GBuffer，alpha！=0，即写入
     * 3、这个通道sprite不具有光照与阴影（至少目前）
     */
    sprite = 'sprite',
    //20260414 取消spriteTransparent通道
    // /**
    //  * 不参与world stage深度测试的，透明2D精灵通道。（参与深度测试的sprite在正常的transparent通道中）
    //  * 1、不透明sprite，只为在world其他实体之上的sprite
    //  * 2、这个通道内，不透明的sprite按照transparent通道的绘规则绘制（开启depthTest，不写入depth）
    //  * 3、这个通道sprite不具有光照与阴影（至少目前）
    //  */
    // spriteTransparent = "spriteTransparent",

    /**
     * 色调映射通道，用于色调映射。
     */
    toneMapping = 'toneMapping',
    /**
     * 后处理通道。
     * 后处理不包括在此之后的绘制的。
     */
    postprocess = 'postprocess',
    /**
     * 其他stage通道,用于UI的绘制。
     * UI 与 stage 的关系
     * 1、这个可以预留的2bit的stage（ID：0-3）。（具体数据在shader/enity/mesh/replace_output.vs.wgsl 中，如果stage数量不够，后期按需调整）
     *      A、stage=0，是world；
     *      B、stage=2，object control （这个可以预留，用于对象的控制，比如选中，拖动，缩放等），快速判断是否需要控制对象
     *      C、stage=3，辅助viewport（比如：三维导航等。三维导航也可以通过其他方式，比如：最后在NDC的空间内绘制一个三维导航器，同时写入深度，写入ID，关闭深度测试）；
     *      D、stage=3，给UI通道；
     * 2、UI的通道与其他工作一样
     * 3、合并UI与world，采用render模式；UI在前，world在后；UI覆盖world，透明的进行Blend
     */
    stage1 = 'stage2',
    stage2 = 'stage3',
    /**
     * UI(最后绘制，在NDC空间，直接绘制，不进行深度测试).
     * UI隐式=stage3
     */
    ui = 'ui',
    // /**
    //  * output通道，
    //  * 考虑方向：
    //  * 1、UI与world的合并
    //  * 2、多viewport或多camera的合并
    //  * 3、可视化工作，单独的纹理可视化，layout的可视化等
    //  */
    // output = "output",

    ndc = 'ndc',
}
