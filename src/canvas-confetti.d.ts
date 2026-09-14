// 最小类型声明：canvas-confetti 未随包附带 .d.ts，仅声明本项目用到的部分。
declare module 'canvas-confetti' {
  export interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: unknown[];
    scalar?: number;
    flat?: boolean;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }
  export interface ConfettiFn {
    (options?: ConfettiOptions): Promise<null> | null;
    reset(): void;
    shapeFromPath(options: { path: string; matrix?: DOMMatrix }): unknown;
    shapeFromText(options: { text: string; scalar?: number; color?: string; fontFamily?: string }): unknown;
  }
  const confetti: ConfettiFn;
  export default confetti;
}
