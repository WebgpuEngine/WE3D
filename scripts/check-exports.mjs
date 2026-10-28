#!/usr/bin/env node
// 校验 src/we/index.ts（curated barrel）的正确性，并提示 src/we 中未纳入 barrel 的导出。
// 用法：npm run check:exports
// 行为：barrel 里存在“目标文件不存在/符号不存在”的 re-export 时以非 0 退出；仅提示不阻断。

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const barrelPath = join(root, 'src/we/index.ts');
const weDir = join(root, 'src/we');

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
      if (entry === '@loaders.gl' || entry === 'export') continue;
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

if (missingFromBarrel.length) {
  const preview = missingFromBarrel.slice(0, 60).join(', ');
  console.log(
    `\n⚠️  src/we 有 ${missingFromBarrel.length} 个导出未在 barrel 中（是否补入由人工决定）：\n  ${preview}${
      missingFromBarrel.length > 60 ? ' ...' : ''
    }`
  );
}
