// 页边 · 动效层：手绘圈注 / 下划线、贴纸描边、星光呼吸、纸屑烟花、Zdog 伪 3D 六角星。
// 全部遵循「克制、慢、手作」调性；在 prefers-reduced-motion 下禁用或退化为静态。
import rough from 'roughjs';
import confetti from 'canvas-confetti';
import * as Zdog from 'zdog';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. rough.js 手绘圈注 / 下划线（首次进入视口，只执行一次） ---------- */

let annotations: { remove(): void }[] = [];
let observers: IntersectionObserver[] = [];
let pending: number[] = [];

// 页面入场动画（page-in）进行中时元素位置仍在移动，等它落定再测量，避免圈注画偏。
function whenSettled(el: Element, fn: () => void) {
  let wait = 0;
  const main = el.closest('main');
  if (main) {
    for (const a of main.getAnimations()) {
      const t = a.currentTime;
      const end = a.effect ? a.effect.getComputedTiming().endTime : undefined;
      if (a.playState === 'running' && typeof t === 'number' && typeof end === 'number' && Number.isFinite(end)) {
        wait = Math.max(wait, end - t + 40);
      }
    }
  }
  pending.push(window.setTimeout(() => { if (el.isConnected) fn(); }, Math.min(wait, 650)));
}

// rough-notation 需要元素已渲染且可见才能测量，用 IntersectionObserver 触发。
function observeOnce(el: HTMLElement, draw: () => void) {
  if (reduce()) return; // 减少动态：不画圈注，保持纯静态文本
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const rect = entry.target.getBoundingClientRect();
      if (entry.isIntersecting && rect.width > 0 && rect.height > 0) {
        io.disconnect();
        whenSettled(entry.target, draw);
      }
    }
  }, { threshold: 0.25 });
  io.observe(el);
  observers.push(io);
}

// 知乎正文引用：蜡笔黄半透明「蜡笔划过」式圈注（rough.js 交叉排线 + 淡入）
function bindBlockquote() {
  document.querySelectorAll<HTMLElement>('.reference blockquote').forEach(el => {
    observeOnce(el, () => {
      try {
        el.style.position = 'relative';
        const r = el.getBoundingClientRect();
        const pad = 10;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${Math.round(r.width + pad * 2)} ${Math.round(r.height + pad * 2)}`);
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;z-index:0;pointer-events:none;`;
        const face = rough.svg(svg);
        svg.appendChild(face.draw(scribble.rectangle(pad, pad, r.width, r.height, {
          fill: 'rgba(240, 201, 122, .38)',
          fillStyle: 'cross-hatch',
          fillWeight: 2.2,
          stroke: 'none',
          roughness: 2.2,
          bowing: 2,
        })));
        el.appendChild(svg);
        svg.style.opacity = '0';
        svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
        annotations.push({ remove: () => svg.remove() });
      } catch { /* noop */ }
    });
  });
}

// 「为什么翻到这一页？」：蜡笔蓝手绘下划线（rough.js 波浪线 + 手写式展开动画）
function bindSummary() {
  document.querySelectorAll<HTMLElement>('.match-reason summary').forEach(el => {
    observeOnce(el, () => {
      try {
        el.style.position = 'relative';
        const r = el.getBoundingClientRect();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${Math.round(r.width + 8)} ${Math.round(r.height + 8)}`);
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;left:-4px;top:-4px;pointer-events:none;';
        const face = rough.svg(svg);
        svg.appendChild(face.draw(scribble.line(4, r.height + 2, r.width + 4, r.height + 2, {
          stroke: '#4A6B9A',
          strokeWidth: 2.6,
          roughness: 1.6,
          bowing: 1.5,
        })));
        el.appendChild(svg);
        const path = svg.querySelector('path');
        const len = (path && path.getTotalLength && path.getTotalLength()) || 1;
        if (path) {
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(len);
          path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 650, easing: 'ease-in-out' });
        }
        annotations.push({ remove: () => svg.remove() });
      } catch { /* noop */ }
    });
  });
}

/* ---------- rough.js 贴纸描边（「认真读过」贴纸，替换 CSS 虚线边框） ---------- */

const scribble = rough.generator({ options: { seed: 7 } }); // generator 创建一次，全程复用

function paintSticker(el: HTMLElement) {
  if (reduce() || el.querySelector('.sticker-scribble')) return; // 减少动态：保留 CSS 虚线边框
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'sticker-scribble');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${Math.round(rect.width + 18)} ${Math.round(rect.height + 18)}`);
  const face = rough.svg(svg); // 每个贴纸一个 SVG 面；画笔（generator）仍复用上面的 scribble
  svg.appendChild(face.draw(scribble.rectangle(9, 9, rect.width, rect.height, {
    stroke: '#4A4B4B', // 页边铅笔灰
    strokeWidth: 1.7,
    roughness: 2.4,
    bowing: 2,
  })));
  el.appendChild(svg);
  el.classList.add('scribbled'); // 隐藏原虚线边框
}

function bindStickers() {
  document.querySelectorAll<HTMLElement>('.sticker').forEach(paintSticker);
}

/* ---------- 3. WAAPI 星光呼吸（3s 循环 scale 1→1.06→1 + rotate ±5°） ---------- */

function bindBreathe() {
  if (reduce()) return; // 减少动态：保持静态
  document.querySelectorAll<HTMLElement>('.empty-drawing svg, .site-header svg.star, .site-header .star svg').forEach(el => {
    el.style.transformOrigin = '50% 50%';
    el.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.06) rotate(5deg)' },
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(1.06) rotate(-5deg)' },
      { transform: 'scale(1) rotate(0deg)' },
    ], { duration: 3000, iterations: Infinity, easing: 'ease-in-out' });
  });
}

/* ---------- 4. canvas-confetti 纸屑烟花（手撕纸片 + 蜡笔星，横向铺满整屏） ---------- */

// 两个不规则的纸片轮廓：flat 渲染时不像发光粒子，而像一把洒开的碎纸
const SCRAP_A = confetti.shapeFromPath({ path: 'M3 1 L24 6 L21 29 L1 22 Z' });
const SCRAP_B = confetti.shapeFromPath({ path: 'M4 0 L21 3 L25 17 L11 26 L0 16 Z' });
const SPARK = confetti.shapeFromText({ text: '✦', scalar: 2 });
const SCRAP_SHAPES = [SCRAP_A, SCRAP_B, SPARK];
const SCRAP_COLORS = ['#F3ECDD', '#E8D9AE', '#D6BE78', '#4A6B9A', '#B85C4A', '#6B8F71'];

// 递出成功：中心一次大爆发 + 左右两门纸炮，纸屑铺满整屏，落得慢、飘得远
export function confettiSend() {
  if (reduce()) return;
  const shared = {
    shapes: SCRAP_SHAPES,
    colors: SCRAP_COLORS,
    flat: true, // 纸片是平的：不翻转、不反光
    scalar: 1.15,
    gravity: 0.72,
    decay: 0.925,
    ticks: 190,
    zIndex: 220, // 高于 toast（100）与揉纸过渡层（200）；dialog 属浏览器顶层，天然更靠上
    disableForReducedMotion: true,
  };
  confetti({ ...shared, particleCount: 90, spread: 360, startVelocity: 58, origin: { x: 0.5, y: 0.42 } });
  confetti({ ...shared, particleCount: 42, spread: 66, angle: 58, startVelocity: 76, drift: 0.8, origin: { x: 0.02, y: 0.86 } });
  confetti({ ...shared, particleCount: 42, spread: 66, angle: 122, startVelocity: 76, drift: -0.8, origin: { x: 0.98, y: 0.86 } });
}

// 留下批注成功：一次中等爆发（蜡笔黄为主），比递出克制
export function confettiReply() {
  if (reduce()) return;
  confetti({
    particleCount: 60,
    spread: 170,
    startVelocity: 42,
    gravity: 0.66,
    decay: 0.92,
    ticks: 150,
    origin: { x: 0.5, y: 0.46 },
    colors: ['#F0C97A', '#E8D9AE', '#F3ECDD', '#D6BE78'],
    shapes: SCRAP_SHAPES,
    flat: true,
    scalar: 1.05,
    zIndex: 220,
    disableForReducedMotion: true,
  });
}

/* ---------- 5. Zdog 伪 3D 六角星（递出成功 toast 左侧小容器，3 秒后淡出） ---------- */

interface ZdogStarState {
  raf: number;
  illo: Zdog.Illustration;
  star: Zdog.Anchor;
  fadeTimer: number;
  endTimer: number;
}
let zdog: ZdogStarState | null = null;

// 六角星：12 个顶点，外径 44 / 内径 20 交替
function starPath(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? 44 : 20;
    const angle = ((-90 + i * 30) * Math.PI) / 180;
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return points;
}

export function showToastStar() {
  const host = document.querySelector<HTMLElement>('#toast-star');
  if (!host) return;
  stopToastStar();
  host.hidden = false;
  host.classList.remove('fading');
  try {
    const illo = new Zdog.Illustration({ element: host, dragRotate: false }); // host 是 <svg> → SVG 渲染器
    const star = new Zdog.Anchor({ addTo: illo });
    const path = starPath();
    new Zdog.Shape({ addTo: star, path, closed: true, fill: false, stroke: 4, color: '#A8823F' }); // 深一点的描边
    new Zdog.Shape({ addTo: star, path, closed: true, fill: true, stroke: 0.5, color: '#F0C97A' }); // 蜡笔黄面
    illo.updateRenderGraph();
    const state: ZdogStarState = { raf: 0, illo, star, fadeTimer: 0, endTimer: 0 };
    zdog = state;
    if (!reduce()) {
      const tick = () => {
        if (zdog !== state) return;
        star.rotate.y += 0.01; // 缓慢旋转（requestAnimationFrame）
        illo.updateRenderGraph();
        state.raf = requestAnimationFrame(tick);
      };
      state.raf = requestAnimationFrame(tick);
    }
    state.fadeTimer = window.setTimeout(() => {
      host.classList.add('fading'); // 3 秒后淡出
      state.endTimer = window.setTimeout(stopToastStar, 800);
    }, 3000);
  } catch { stopToastStar(); }
}

export function stopToastStar() {
  if (zdog) {
    window.cancelAnimationFrame(zdog.raf);
    window.clearTimeout(zdog.fadeTimer);
    window.clearTimeout(zdog.endTimer);
    zdog = null;
  }
  const host = document.querySelector<HTMLElement>('#toast-star');
  if (host) { host.hidden = true; host.classList.remove('fading'); host.replaceChildren(); }
}

/* ---------- 绑定与清理（render() 重渲染前先清掉旧标注，元素尺寸变化后重描） ---------- */

let resizeTimer = 0;
let resizeBound = false;

export function bindEffects() {
  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { if (!reduce()) bindStickers(); }, 250);
    });
  }
  bindBlockquote();
  bindSummary();
  bindStickers();
  bindBreathe();
}

export function fxCleanup() {
  for (const a of annotations) { try { a.remove(); } catch { /* noop */ } }
  annotations = [];
  for (const o of observers) o.disconnect();
  observers = [];
  for (const t of pending) window.clearTimeout(t);
  pending = [];
  document.querySelectorAll('.sticker').forEach(el => {
    el.classList.remove('scribbled');
    el.querySelector('.sticker-scribble')?.remove();
  });
  // 注意：这里不停止 toast 星——它挂在 #app 之外的 #toast 上，随自身计时器淡出。
}
