export function portraitSvg(index = 0): string {
  const hairs = [
    '<path d="M33 45q-3-24 12-21l4-10 7 9 10-6 4 10q13 3 9 22"/>',
    '<path d="M29 69q-6-47 27-46 30 0 26 48M29 39q30 5 39-12"/>',
    '<path d="M31 47q-4-23 23-23 30 0 27 27M33 35l8-10m5 6 5-9m5 8 7-7"/>',
    '<path d="M33 46q-4-24 22-24 26 0 23 26M38 20q6-7 13 0-6 7-13 0M59 20q7-7 14 0-7 7-14 0"/>',
    '<path d="M28 41q1-16 28-16 28 0 29 16M28 41h57M57 25v-8"/>',
    '<path d="M33 45q-4-25 22-25 26 1 24 26M31 48q-4 20-6 40M81 48q4 20 6 40"/>',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 116" fill="none" stroke="#353731" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 104q4-22 27-22t32 23"/><path d="M34 42q-6 33 19 36 26 0 26-35"/>${hairs[index % 6]}<path d="M44 50v3m20-3v3m-11-1-2 9 5 1m-12 6q9 7 18-1"/><path d="M42 84l11 10 11-10M22 108l64-1"/></svg>`;
}
export function portraitMarkup(value: string | null, index = 0): string {
  if (value?.startsWith('data:image/png;base64,')) return `<img src="${value}" alt="保存的自画像" />`;
  return portraitSvg(value?.startsWith('preset:') ? Number(value.slice(7)) : index);
}
export interface PortraitEditor {
  dirty: boolean;
  save: () => string;
  exportPng: () => string;
  clear: () => void;
  preset: (n: number) => void;
  applyImage: (dataUrl: string) => void;
  undo: () => boolean;
  hasStrokes: () => boolean;
  empty: () => boolean;
  destroy: () => void;
}
const BUFFER_W = 840;
const BUFFER_H = 600;
interface Stroke { color: string; width: number; eraser: boolean; points: { x: number; y: number }[] }
export function mountPortrait(canvas: HTMLCanvasElement, saved: string | null, onDirty: (dirty: boolean) => void, onInk?: () => void): PortraitEditor {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('此浏览器不支持画布，请使用预设自画像。');
  const buffer = document.createElement('canvas'); buffer.width = BUFFER_W; buffer.height = BUFFER_H;
  const ink = buffer.getContext('2d')!;
  ink.lineCap = 'round'; ink.lineJoin = 'round';
  let active: number | null = null, last = { x: 0, y: 0 }, loading = 0;
  let color = '#343630', width = 5, eraser = false;
  let strokes: Stroke[] = [];
  let base: CanvasImageSource | null = null;
  let baseRect: [number, number, number, number] | null = null;
  let basePersisted = true;
  function paint() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }
  function redraw() {
    ink.clearRect(0, 0, BUFFER_W, BUFFER_H);
    ink.globalCompositeOperation = 'source-over';
    if (base && baseRect) ink.drawImage(base, ...baseRect);
    for (const stroke of strokes) {
      ink.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
      ink.strokeStyle = stroke.color; ink.fillStyle = stroke.color;
      ink.lineWidth = stroke.eraser ? 32 : stroke.width * 2;
      const points = stroke.points;
      if (points.length) {
        ink.beginPath(); ink.arc(points[0].x, points[0].y, ink.lineWidth / 2, 0, Math.PI * 2); ink.fill();
      }
      if (points.length > 1) {
        ink.beginPath(); ink.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ink.lineTo(points[i].x, points[i].y);
        ink.stroke();
      }
    }
    ink.globalCompositeOperation = 'source-over';
    paint();
  }
  function changed() { editor.dirty = true; onDirty(true); }
  function loadImage(src: string, rect: [number, number, number, number], persisted: boolean, mark: boolean) {
    const token = ++loading;
    strokes = [];
    const image = new Image();
    image.onload = () => {
      if (token !== loading) return;
      base = image; baseRect = rect; basePersisted = persisted;
      redraw(); if (mark) changed();
    };
    image.onerror = () => {
      if (token !== loading) return;
      base = null; baseRect = null; basePersisted = persisted;
      redraw(); if (mark) changed();
    };
    image.src = src;
  }
  function load(value: string | null, mark: boolean) {
    ++loading; strokes = [];
    if (!value) { base = null; baseRect = null; basePersisted = true; redraw(); return; }
    loadImage(value.startsWith('preset:') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(Number(value.slice(7))))}` : value, value.startsWith('preset:') ? [260, 80, 310, 400] : [0, 0, BUFFER_W, BUFFER_H], true, mark);
  }
  function point(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * BUFFER_W / rect.width, y: (e.clientY - rect.top) * BUFFER_H / rect.height };
  }
  function down(e: PointerEvent) {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); active = e.pointerId; canvas.setPointerCapture(e.pointerId);
    last = point(e);
    const stroke: Stroke = { color, width, eraser, points: [{ x: last.x, y: last.y }] };
    strokes.push(stroke);
    ink.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ink.strokeStyle = stroke.color; ink.fillStyle = stroke.color;
    ink.lineWidth = stroke.eraser ? 32 : stroke.width * 2;
    ink.beginPath(); ink.arc(last.x, last.y, ink.lineWidth / 2, 0, Math.PI * 2); ink.fill();
    paint(); changed(); onInk?.();
  }
  function move(e: PointerEvent) {
    if (active !== e.pointerId) return;
    const stroke = strokes[strokes.length - 1]; if (!stroke) return;
    const next = point(e);
    ink.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ink.beginPath(); ink.moveTo(last.x, last.y); ink.lineTo(next.x, next.y); ink.stroke();
    stroke.points.push(next); last = next; paint();
  }
  function end(e: PointerEvent) { if (e.pointerId === active) { active = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } }
  const toolbar = document.querySelector<HTMLElement>('#paint-tools')!;
  function tool(e: Event) {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.color) {
      color = button.dataset.color; eraser = false;
      toolbar.querySelectorAll('[data-color], [data-eraser]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    }
    if (button.dataset.width) {
      width = Number(button.dataset.width);
      toolbar.querySelectorAll('[data-width]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    }
    if (button.hasAttribute('data-eraser')) {
      eraser = true; toolbar.querySelectorAll('[data-color], [data-eraser]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    }
  }
  const observer = new ResizeObserver(paint); observer.observe(canvas);
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
  toolbar.addEventListener('click', tool);
  const editor: PortraitEditor = {
    dirty: false,
    save() {
      const data = buffer.toDataURL('image/png');
      const snapshot = document.createElement('canvas'); snapshot.width = BUFFER_W; snapshot.height = BUFFER_H;
      snapshot.getContext('2d')!.drawImage(buffer, 0, 0);
      base = snapshot; baseRect = [0, 0, BUFFER_W, BUFFER_H]; strokes = []; basePersisted = true;
      editor.dirty = false; onDirty(false);
      return data;
    },
    exportPng() { return buffer.toDataURL('image/png'); },
    clear() { ++loading; strokes = []; base = null; baseRect = null; basePersisted = false; redraw(); changed(); },
    preset(n) { loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(n))}`, [260, 80, 310, 400], false, true); },
    applyImage(dataUrl) { loadImage(dataUrl, [0, 0, BUFFER_W, BUFFER_H], false, true); },
    undo() {
      if (!strokes.length) return false;
      strokes.pop(); active = null;
      redraw();
      editor.dirty = strokes.length > 0 || !basePersisted;
      onDirty(editor.dirty);
      return true;
    },
    hasStrokes() { return strokes.length > 0; },
    empty() { return !base && strokes.length === 0; },
    destroy() { ++loading; observer.disconnect(); toolbar.removeEventListener('click', tool); },
  };
  load(saved, false); return editor;
}
export function rasterizePreset(n: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const buffer = document.createElement('canvas'); buffer.width = BUFFER_W; buffer.height = BUFFER_H;
    const ink = buffer.getContext('2d');
    if (!ink) { reject(new Error('此浏览器不支持画布。')); return; }
    const image = new Image();
    image.onload = () => { ink.drawImage(image, 260, 80, 310, 400); resolve(buffer.toDataURL('image/png')); };
    image.onerror = () => reject(new Error('简笔画模板未能生成。'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(n))}`;
  });
}
