import { weColor3, weColor4, weVec2, weVec3, weVec4 } from "./coreDefine";

export async function weGetResource(param: string): Promise<any> {

}
export async function weGetImageByUrl(param: string): Promise<ImageBitmap> {
    let response = await fetch(param);
    let imageBitmap = await createImageBitmap(await response.blob());
    return imageBitmap;
}

// export async function weGetImagesByUrl(param: string[]): Promise<ImageBitmap[]> {
//     let all: any[] = [];
//     let allImages: ImageBitmap[] = [];

//     param.map(async (src) => {
//         const response = new Promise((resolve) => {
//             resolve(fetch(src));
//         }).then(
//             async (srcR) => {
//                 return createImageBitmap(await (srcR as Response).blob());
//             },
//             () => {
//                 console.error("获取图片失败", src);
//             }
//         );
//         all.push(response);
//     });

//     await Promise.all(all).then(imgesBitmaps => {
//         allImages.push(...imgesBitmaps);
//     }).catch(err => {
//         throw new Error("获取图片失败", err)
//     });
//     return allImages;
// }
export async function weGetImagesByUrl(param: string[]): Promise<ImageBitmap[]> {
    let allImages: ImageBitmap[] = [];

    for (let perRes of param) {
        let response = await fetch(perRes);
        let imageBitmap = await createImageBitmap(await response.blob());
        allImages.push(imageBitmap);
    }
    return allImages;
}

export interface I_VideoOption {
    loop?: boolean,
    // autoplay?: boolean,//默认必须的
    muted?: boolean,
    controls?: boolean,
    waitFor?: "canplaythrough" | "loadedmetadata",
    model?: "copy" | "External",
}
export async function weGetVidoeByUrl(param: string, options: I_VideoOption): Promise<HTMLVideoElement> {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = param;
    video.muted = options.muted ?? true;
    video.loop = options.loop ?? true;
    await video.play();
    return video;
}

export function isWeColor3(value: any): value is weColor3 {
    return Array.isArray(value) && value.length == 3;
}
export function isWeColor4(value: any): value is weColor4 {
    return Array.isArray(value) && value.length == 4;
}
export function isWeVec2(value: any): value is weVec2 {
    return Array.isArray(value) && value.length == 2;
}
export function isWeVec3(value: any): value is weVec3 {
    return Array.isArray(value) && value.length == 3;
}
export function isWeVec4(value: any): value is weVec4 {
    return Array.isArray(value) && value.length == 4;
}

/**
 * GPUTexture 之间的copy
 * 
 * A、B这个两个GPUTexture在一个frame ，不能同时是GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC，否则会产生同步错误
 * 
 * @param A :GPUTexture
 * @param B :GPUTexture
 * @param size :{ width: number, height: number }
 */
export function copyTextureToTexture(device: GPUDevice, A: GPUTexture, B: GPUTexture, size: { width: number, height: number }) {
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToTexture(
        {
            texture: A
        },
        {
            texture: B,
        },
        [size.width, size.height]
    );
    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);
}