/** BOL 状态
 * 1、open：表示可分配内存块
 * 2、close：表示不可分配内存块。
 * 3、released：已释放，不可写。
 * 4、rebuilding：重建中，不可写。
 */
export enum E_BOLState {
    open,
    close,
    released,
    rebuilding,
}
/** buffer 类型
 * 1、static：静态VS，必须有初始化数据,建立后，立即释放，不保存CPU端数据。
 * 2、VS：运行时静态VS。
 * 3、dynamicVS：动态VS。
 * 4、uniform：统一变量。
 * 5、storage：存储变量。
 */
export enum E_BOLBufferType {
    static = 'static',
    VS = 'VS',
    dynamicVS = 'dynamicVS',
    uniform = 'uniform',
    storage = 'storage',
}

/** BOL Buffer 大小定义接口 */
export interface I_BolSize {
    [E_BOLBufferType.static]?: number;
    [E_BOLBufferType.VS]?: number;
    [E_BOLBufferType.dynamicVS]?: number;
    [E_BOLBufferType.uniform]?: number;
    [E_BOLBufferType.storage]?: number;
}
/** BOL Buffer 默认大小
 * 1、这里时默认值
 * 2、可以通过scene的初始化参数进行调整
 */
export const V_BolBufferSize: I_BolSize = {
    [E_BOLBufferType.static]: 1024 * 1024 * 20, //20MB
    [E_BOLBufferType.VS]: 1024 * 1024 * 10, //10MB
    [E_BOLBufferType.dynamicVS]: 1024 * 1024 * 10, //10MB
    /**必须是256Byte的倍数*/
    [E_BOLBufferType.uniform]: 1024 * 1024 * 1, //1MB
    [E_BOLBufferType.storage]: 1024 * 1024 * 10, //10MB
};

/** BOL 重建百分比定义接口 */
export interface I_BolRebulidPercent {
    /** 静态VS，阈值：10M */
    // static: number,
    /** 运行时静态VS，阈值：0.30 */
    VS?: number;
    /** 动态VS重建百分比，阈值：0.30 */
    dynamicVS?: number;
    /** 统一重建百分比，阈值：0.3 */
    uniform?: number;
    /** 存储重建百分比，阈值：0.3 */
    storage?: number;
}
/** BOL 重建百分比默认值
 * 1、这里时默认值
 * 2、可以通过scene的初始化参数进行调整
 */
export const V_BolRebulidPercent: I_BolRebulidPercent = {
    VS: 0.3,
    dynamicVS: 0.3,
    uniform: 0.2,
    storage: 0.1,
};

/** BOL合并更新间距阈值定义接口 */
export interface I_BolStrideSizeOfUpdate {
    /** 静态VS，阈值：10M */
    // static?: number,
    /** 运行时静态VS，阈值：64K*4 */
    VS?: number;
    /** 动态VS，阈值：64K*4 */
    dynamicVS?: number;
    /** 统一变量，阈值：1K */
    uniform?: number;
    /** 存储变量，阈值：64K */
    storage?: number;
}

/** BOL 合并更新间距阈值
 * 1、默认合并更新间距。
 * 2、可以通过scene的初始化参数进行调整。
4 */
export const V_BolStrideSizeOfUpdate: I_BolStrideSizeOfUpdate = {
    /** 这个是不更新的*/
    // static: 10 * 1024 * 1024,
    /** 运行时静态VS，阈值：64K*4 */
    VS: 4 * 64 * 1024,
    /** 动态VS，阈值：64K*4 */
    dynamicVS: 1 * 64 * 1024,
    /** 统一变量，阈值：1K
     * 最小：256Byte
     */
    uniform: 1 * 1024,
    /** 存储变量，阈值：64K */
    storage: 1 * 64 * 1024,
    // storage: 256,
};
