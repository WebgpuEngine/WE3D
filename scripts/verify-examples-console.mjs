// 用 Playwright（Chrome/WebGPU）逐页打开 examples 下的 .html，抓取 console error / 未捕获异常，
// 按错误类型分类，输出 JSON 报告。用于验证「相对导入改 @we3d」后浏览器控制台无新增报错。
//
//   node scripts/verify-examples-console.mjs            # 跑全部 examples
//   node scripts/verify-examples-console.mjs --only=base/09_texture   # 只跑某子目录
//
// 分类：
//   module   —— 导入/导出解析类（"does not provide an export" / "is not exported by" / "Failed to resolve import" 等）
//   webgpu   —— WebGPU 适配器/设备相关（环境相关，通常非代码回归）
//   network  —— 资源 404/加载失败（含 gltf/贴图等，通常非导入回归）
//   other    —— 其余运行时错误

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const examplesDir = path.join(root, 'examples');
const BASE = 'http://localhost:5173';
const CONCURRENCY = 4;
const PAGE_WAIT = 2000;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function categorize(text) {
  const t = text || '';
  if (
    /does not provide an export|is not exported by|Failed to resolve import|Cannot find module|not exported|export named|Pre-transform error|Internal server error|Unexpected token|Failed to fetch dynamically imported module/i.test(
      t,
    )
  )
    return 'module';
  if (/gpu|adapter|requestAdapter|WebGPU|navigator\.gpu|device lost|device\.|wgsl/i.test(t)) return 'webgpu';
  if (/Failed to load resource|net::ERR|404 \(|status of 404|Failed to load url/i.test(t)) return 'network';
  return 'other';
}

const files = walk(examplesDir)
  .filter((f) => !only || path.relative(examplesDir, f).replace(/\\/g, '/').startsWith(only))
  .map((f) => path.relative(examplesDir, f).replace(/\\/g, '/'));

console.log(`[verify] 待访问示例页: ${files.length}`);

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--use-webgpu-adapter=swiftshader',
  ],
});

async function visit(rel) {
  const url = `${BASE}/examples/${rel}`;
  const page = await browser.newPage();
  const errors = [];
  const seen = new Set();
  const onMsg = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (seen.has(text)) return;
    seen.add(text);
    if (errors.length < 30) errors.push({ text, cat: categorize(text) });
  };
  const onErr = (err) => {
    const text = err?.message || String(err);
    if (seen.has(text)) return;
    seen.add(text);
    if (errors.length < 30) errors.push({ text, cat: categorize(text) });
  };
  page.on('console', onMsg);
  page.on('pageerror', onErr);
  let navError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(PAGE_WAIT);
  } catch (e) {
    navError = e?.message || String(e);
  }
  await page.close();
  if (navError && errors.length === 0) {
    errors.push({ text: `[navigation] ${navError}`, cat: categorize(navError) });
  }
  return { url, rel, errors };
}

const results = [];
let idx = 0;
async function worker() {
  while (idx < files.length) {
    const i = idx++;
    const r = await visit(files[i]);
    results.push(r);
    const n = r.errors.length;
    const short = r.rel.length > 70 ? '…' + r.rel.slice(-67) : r.rel;
    console.log(`[${results.length}/${files.length}] ${n ? 'ERR(' + n + ')' : 'ok '} ${short}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();

// 汇总
const withErrors = results.filter((r) => r.errors.length > 0);
const byCat = { module: 0, webgpu: 0, network: 0, other: 0 };
const moduleErrors = [];
for (const r of results) {
  for (const e of r.errors) {
    byCat[e.cat] = (byCat[e.cat] || 0) + 1;
    if (e.cat === 'module') moduleErrors.push({ rel: r.rel, text: e.text });
  }
}

const report = {
  total: results.length,
  withErrors: withErrors.length,
  byCat,
  moduleErrors,
  details: results.filter((r) => r.errors.length > 0).map((r) => ({ rel: r.rel, errors: r.errors })),
};
fs.writeFileSync(path.join(root, 'examples-console-report.json'), JSON.stringify(report, null, 2));

console.log('\n=== 汇总 ===');
console.log(`总页数: ${report.total}，有报错页: ${report.withErrors}`);
console.log(`错误计数(分类): ${JSON.stringify(byCat)}`);
console.log(`\n[关键] 模块解析类(迁移相关)错误: ${moduleErrors.length} 条`);
for (const m of moduleErrors) console.log(`  - ${m.rel}\n      ${m.text}`);
console.log(`\n完整报告已写入 examples-console-report.json`);
