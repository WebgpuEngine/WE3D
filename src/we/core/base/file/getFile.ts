export async function weGetResource(_param: string): Promise<any> {}
export async function weGetImageByUrl(param: string): Promise<ImageBitmap> {
    const response = await fetch(param);
    const imageBitmap = await createImageBitmap(await response.blob());
    return imageBitmap;
}
export async function weGetBinaryByUrl(param: string): Promise<ArrayBuffer> {
    const response = await fetch(param);
    const binary = (await response.blob()).arrayBuffer();
    return binary;
}
export async function weGetBinaryResourceFromGzip(param: string): Promise<ArrayBuffer> {
    const response = await fetch(param);
    // 在解压前判断是否存在传输压缩
    if (response.headers.get('content-encoding') === 'gzip') {
        // 浏览器已自动解压，直接拿原始gz二进制，不再走DecompressionStream
        return await response.arrayBuffer();
    } else {
        // 无传输压缩，手动解压
        if (!response.ok) {
            throw new Error(`资源请求失败，状态码：${response.status} ${response.statusText}`);
        }
        if (!response.body) {
            throw new Error('响应体为空，无二进制流可解压');
        }
        const decompressionStream = new DecompressionStream('gzip');
        const decompressedStream = response.body.pipeThrough(decompressionStream);
        if (!decompressedStream) {
            throw new Error('获取压缩流失败');
        }
        const decompressedArrayBuffer = await new Response(decompressedStream).arrayBuffer();
        return decompressedArrayBuffer;
    }
}

// /**
//  * 拉取gzip二进制文件并流式解压，返回解压后的ArrayBuffer
//  * @param param 资源URL地址
//  * @param opt 配置：signal 中断信号
//  * @returns Promise<ArrayBuffer> 解压完成的二进制
//  */
// export async function weGetGzipResource(
//     param: string,
//     opt: {
//         signal?: AbortSignal; // 支持取消请求
//     } = {}
// ): Promise<ArrayBuffer> {
//     // 1. 浏览器兼容校验
//     if (!window.DecompressionStream || !window.ReadableStream) {
//         throw new Error("当前浏览器不支持Web Streams解压API，请升级浏览器");
//     }

//     let response: Response;
//     try {
//         // 携带中断信号发起请求
//         response = await fetch(param, { signal: opt.signal });
//     } catch (err) {
//         if ((err as DOMException).name === "AbortError") {
//             throw new Error("请求已主动取消");
//         }
//         throw new Error(`网络请求失败: ${(err as Error).message}`);
//     }

//     // 2. 拦截4xx/5xx HTTP错误
//     if (!response.ok) {
//         throw new Error(`资源请求失败，状态码：${response.status} ${response.statusText}`);
//     }

//     // 3. 提前校验body可读流
//     const rawBody = response.body;
//     if (!rawBody) {
//         throw new Error("响应体为空，无二进制流可解压");
//     }

//     // 4. 创建gzip解压管道
//     let decompressedStream: ReadableStream<Uint8Array>;
//     try {
//         const decompressionStream = new DecompressionStream("gzip");
//         decompressedStream = rawBody.pipeThrough(decompressionStream);
//     } catch (err) {
//         throw new Error(`解压流创建失败: ${(err as Error).message}`);
//     }

//     // 5. 流转完整ArrayBuffer返回
//     try {
//         const buffer = await new Response(decompressedStream).arrayBuffer();
//         return buffer;
//     } catch (err) {
//         throw new Error(`gzip解压失败，文件可能不是合法gzip包: ${(err as Error).message}`);
//     }
// }

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
    const allImages: ImageBitmap[] = [];

    for (const perRes of param) {
        const response = await fetch(perRes);
        const imageBitmap = await createImageBitmap(await response.blob());
        allImages.push(imageBitmap);
    }
    return allImages;
}

export interface I_VideoOption {
    loop?: boolean;
    // autoplay?: boolean,//默认必须的
    muted?: boolean;
    controls?: boolean;
    waitFor?: 'canplaythrough' | 'loadedmetadata';
    model?: 'copy' | 'External';
}
export async function weGetVidoeByUrl(
    param: string,
    options: I_VideoOption,
): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = param;
    video.muted = options.muted ?? true;
    video.loop = options.loop ?? true;
    await video.play();
    return video;
}
