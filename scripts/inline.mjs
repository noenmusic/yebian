// 把 vite build 产物内联成单个 HTML，便于双击直接打开（file:// 下无需服务器）。
// 用法：node scripts/inline.mjs [输出路径...]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const targets = process.argv.slice(2);
if (targets.length === 0) targets.push(resolve(root, '页边.html'));

let html = await readFile(resolve(dist, 'index.html'), 'utf8');

const cssHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map(m => m[1]);
for (const href of cssHrefs) {
  let css = await readFile(resolve(dist, href.replace(/^\//, '')), 'utf8');
  // 把 CSS 里的本地图片（如背景纹理）内联成 data URI，保证单文件离线可用。
  css = css.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (match, _quote, path) => {
    const file = resolve(dist, path.replace(/^\//, ''));
    if (!existsSync(file)) return match;
    const ext = extname(file).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : ext === '.ttf' ? 'font/ttf' : ext === '.otf' ? 'font/otf' : 'application/octet-stream';
    return `url("data:${mime};base64,${readFileSync(file).toString('base64')}")`;
  });
  // 用函数形式替换：产物中可能包含 $& 等字符，字符串替换会按特殊模式解释，导致残留或内容损坏。
  html = html.replace(new RegExp(`<link[^>]+href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`), () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}

const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1]);
for (const src of scriptSrcs) {
  let js = await readFile(resolve(dist, src.replace(/^\//, '')), 'utf8');
  // JS 里以 "/" 开头的本地资源字符串（含子目录，例如运行时模板图片、音效）内联成 data URI，保证单文件离线可用。
  js = js.replace(/"(\/[^"]*\.(?:png|jpe?g|webp|gif|svg|woff2?|ttf|otf|wav|m4a|mp3))"/g, (match, path) => {
    // 产物里带空格的资源名是百分号编码的，先解码再落盘查文件
    const file = resolve(dist, decodeURIComponent(path).replace(/^\//, ''));
    if (!existsSync(file)) return match;
    const ext = extname(file).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.svg' ? 'image/svg+xml' : ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : ext === '.ttf' ? 'font/ttf' : ext === '.otf' ? 'font/otf' : ext === '.wav' ? 'audio/wav' : ext === '.m4a' ? 'audio/mp4' : ext === '.mp3' ? 'audio/mpeg' : 'application/octet-stream';
    return `"data:${mime};base64,${readFileSync(file).toString('base64')}"`;
  });
  html = html.replace(new RegExp(`<script[^>]+src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`), () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}

const leftovers = html.match(/(?:src|href)="\/(?!\/)[^"]*"/g);
if (leftovers) {
  console.error('警告：仍有未内联的绝对路径引用：', leftovers);
  process.exitCode = 1;
}

for (const target of targets) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
  console.log(`已生成单文件：${target}（${(Buffer.byteLength(html) / 1024).toFixed(0)} KB）`);
}
