import type { eventOfScene, userDefineEventCall } from './base';
import type { Scene } from './scene';

/**
 * 第 3 期巨型文件拆分（C6）：Scene 的自定义事件与窗口状态方法。
 * scope 用 import type 引入主类（编译后擦除，无运行时环），所有读写作用于 scope 本体。
 * 函数体逐字搬移，仅把代码行里的 this. 改为 scope.；注释文本保持原样。
 */

/**
 * 用户自定义的更新
 * 比如：
 *  订阅，触发、MQ、WW等
 */
export function updateUserDefineEvent(scope: Scene, event: eventOfScene) {
    for (const i of scope.userDefineUpdateArray) {
        if (i.state && i.event == event) {
            i.call(scope);
        }
    }
}

/**增加用户自定义 */
export function addUserDefineEvent(scope: Scene, call: userDefineEventCall) {
    scope.userDefineUpdateArray.push(call);
}

/**设置用户自定义call function的状态 */
export function setUserDefineEventStateByName(scope: Scene, name: string, state: boolean) {
    for (const i of scope.userDefineUpdateArray) {
        if (i.name == name) {
            i.state = state;
            break;
        }
    }
}

/**获取用户字自定义 call function的状态 */
export function getUserDefineEventStateByName(
    scope: Scene,
    name: string,
    state: boolean,
): { name: string; state: boolean } {
    for (const i of scope.userDefineUpdateArray) {
        if (i.name == name) {
            i.state = state;
            return { name, state };
        }
    }
    return { name: 'false', state: false };
}

/**当前帧是否resize 了窗口大小*/
export function isResized(scope: Scene): boolean {
    return scope.flags.reSize.status;
}
