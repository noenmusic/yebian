// 页边音效：直接引用桌面 页边/sounds/ 里的用户素材（vite 打包进 assets，单文件时由 inline.mjs 内联）。
// 只读取、不修改原始文件。所有声音都由点击手势触发，符合浏览器自动播放策略；
// 音频不可用或解码失败时静默降级，不打断任何交互。
// 注意：vite 的 import.meta.glob 只接受静态字符串字面量，所以三个目录分开写。
const clicks = Object.values(
  import.meta.glob('../sounds/点击/*.wav', { eager: true, query: '?url', import: 'default' }),
) as string[];
const flips = Object.values(
  import.meta.glob('../sounds/翻页/*.wav', { eager: true, query: '?url', import: 'default' }),
) as string[];
const fireworks = Object.values(
  import.meta.glob('../sounds/烟花彩蛋/*.wav', { eager: true, query: '?url', import: 'default' }),
) as string[];

const pick = (list: string[]): string | null => (list.length ? list[Math.floor(Math.random() * list.length)] : null);

const cache = new Map<string, HTMLAudioElement>();
// 输出音量：线性增益，默认 -6.0 dB（≈0.5），可在页脚滑块里调整
let gain = 0.5;
export function setVolume(v: number) {
  gain = Math.min(1, Math.max(0, v));
  for (const el of cache.values()) el.volume = gain;
}
function play(url: string | null | undefined) {
  if (!url) return;
  try {
    let el = cache.get(url);
    if (!el) { el = new Audio(url); el.preload = 'auto'; cache.set(url, el); }
    el.volume = gain;
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch { /* 静默降级 */ }
}

/** 按钮点击：点击文件夹里的声音 */
export const clickSound = () => play(pick(clicks));
/** 递出纸条：翻页文件夹里 6 个随机选一个 */
export const flipSound = () => play(pick(flips));
/** 烟花彩蛋动画：两个随机选一个 */
export const fireworkSound = () => play(pick(fireworks));
