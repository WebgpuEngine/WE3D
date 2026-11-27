#!/usr/bin/env node
// 校验 src/we/index.ts（curated barrel）的正确性，并对 src/we 中未纳入 barrel 的导出做 ratchet 门禁。
// 用法：npm run check:exports        —— barrel 校验 + 导出 ratchet（新增游离导出硬失败）
//       npm run exports:baseline     —— 显式登记当前存量游离导出（基线只能手工刷新收紧）
// 行为：
//   1) barrel 里存在“目标文件不存在/符号不存在”的 re-export 时以非 0 退出；
//   2) src/we 中「未入 barrel 且不在基线内」的新增导出硬失败；基线内存量仅提示不阻断。

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const barrelPath = join(root, 'src/we/index.ts');
const weDir = join(root, 'src/we');
const baselinePath = join(root, 'scripts/export-baseline.json');
const UPDATE = process.argv.includes('--update');

const IDENT = /^[A-Za-z_$][\w$]*$/;

// 提取一个 TS 文件内容里所有“导出的符号名”（含 re-export；排除 default）。
function collectExports(content) {
  const symbols = new Set();
  // export class / interface / function / const / let / var / type / enum / abstract class
  const declRe =
    /export\s+(?:(?:abstract|default|async)\s+)*(?:class|interface|function|const|let|var|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(content))) symbols.add(m[1]);
  // export { a, b as c } [from "..."]
  const braceRe = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((m = braceRe.exec(content))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (IDENT.test(name)) symbols.add(name);
    }
  }
  symbols.delete('default');
  return symbols;
}

// 解析 barrel 的 re-export 列表：[{ symbol, from }]
function parseBarrel(content) {
  const out = [];
  const re = /export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (IDENT.test(name)) out.push({ symbol: name, from: m[2] });
    }
  }
  return out;
}

// 递归列出 src/we 下的 .ts 文件（排除约定目录/文件）。
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'export') continue;
      walk(p, acc);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.todo') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.backup') &&
      !entry.includes(' copy.ts')
    ) {
      acc.push(p);
    }
  }
  return acc;
}

const barrelExports = parseBarrel(readFileSync(barrelPath, 'utf8'));
const barrelSymbols = new Set(barrelExports.map((x) => x.symbol));

// 1) 校验 barrel 每个 re-export 的目标文件与符号是否真实存在
const errors = [];
for (const { symbol, from } of barrelExports) {
  const target = resolve(dirname(barrelPath), from + '.ts');
  if (!existsSync(target)) {
    errors.push(`[缺失文件] "${symbol}" ← ${from}.ts 不存在`);
    continue;
  }
  if (!collectExports(readFileSync(target, 'utf8')).has(symbol)) {
    errors.push(`[缺失符号] "${symbol}" 不在 ${from}.ts 的导出中`);
  }
}

// 2) 全量对比：src/we 实际导出中，未纳入 barrel 的符号（仅提示）
const allExports = new Set();
for (const f of walk(weDir)) {
  for (const s of collectExports(readFileSync(f, 'utf8'))) allExports.add(s);
}
const missingFromBarrel = [...allExports].filter((s) => !barrelSymbols.has(s)).sort();

console.log(`barrel 导出符号数：${barrelSymbols.size}`);
console.log(`src/we 实际导出符号数：${allExports.size}`);

if (errors.length) {
  console.log('\n❌ barrel 校验失败：');
  for (const e of errors) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('✅ barrel 校验通过（所有 re-export 目标存在且符号正确）');
}

// 显式登记存量游离导出基线（仿 quality:baseline，基线只能手工刷新收紧）
if (UPDATE) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString().slice(0, 10),
        scope: 'src/we 中未纳入 src/we/index.ts barrel 的导出符号（存量基线，用于 ratchet 阻断新增）',
        missingFromBarrel,
      },
      null,
      4,
    ) + '\n',
  );
  console.log(`\n✅ 已写入导出基线：${missingFromBarrel.length} 个存量游离导出 → scripts/export-baseline.json`);
  process.exit(0);
}

// ratchet：新增游离导出硬失败；存量（基线内）仅提示不阻断
let newExports = [];
if (existsSync(baselinePath)) {
  const baseline = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).missingFromBarrel ?? []);
  newExports = missingFromBarrel.filter((s) => !baseline.has(s));
} else {
  console.error('\n❌ 导出基线不存在，请先运行 npm run exports:baseline 登记存量游离导出。');
  process.exit(1);
}

if (newExports.length) {
  console.error(`\n❌ 导出 ratchet 阻断：新增 ${newExports.length} 个未入 barrel 的导出：`);
  for (const s of newExports) console.error('  - ' + s);
  console.error(
    '  若是合理的新公共 API，请补入 src/we/index.ts；若是内部符号，请移入内部路径或不要导出，再运行 npm run exports:baseline 收紧基线。',
  );
  process.exitCode = 1;
} else {
  console.log(`\n✅ 导出 ratchet 通过（${missingFromBarrel.length} 个存量游离导出均在基线内，无新增）`);
}

if (missingFromBarrel.length) {
  const preview = missingFromBarrel.slice(0, 20).join(', ');
  console.log(
    `\nℹ️  存量游离导出（${missingFromBarrel.length} 个，是否补入 barrel 由人工决定）：\n  ${preview}${
      missingFromBarrel.length > 20 ? ' ...' : ''
    }`
  );
}
