// import md5 from 'js-md5'

import { MD5 } from '@we3d';

// 1. 准备 ArrayBuffer
const buffer = new ArrayBuffer(16)
const buffer1 = new ArrayBuffer(16)
// const view = new Uint32Array(buffer)
// view[0] = 100
// view[1] = 200

// 2. 直接传入 ArrayBuffer 计算 MD5 ✅
const hexHash = MD5.hex(buffer)       // 32位十六进制（最常用）
const hexHash1 = MD5.hex(buffer1)       // 32位十六进制（最常用）
const arrayBufferHash = MD5.arrayBuffer(buffer) // 输出 ArrayBuffer
const base64Hash = MD5.base64(buffer) // Base64 格式

console.log(hexHash, hexHash1,  arrayBufferHash, base64Hash)
