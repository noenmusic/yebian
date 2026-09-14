// 最小类型声明：Zdog 未随包附带 .d.ts，仅声明本项目用到的部分。
declare module 'zdog' {
  interface Vector3 { x: number; y: number; z: number }
  interface Vector3Input { x?: number; y?: number; z?: number }
  interface PathPoint { x?: number; y?: number; z?: number }
  interface AnchorOptions { addTo?: Anchor; rotate?: Vector3Input; translate?: Vector3Input; scale?: Vector3Input }
  export class Anchor {
    constructor(options?: AnchorOptions);
    rotate: Vector3;
    translate: Vector3;
    scale: Vector3;
  }
  export interface ShapeOptions extends AnchorOptions {
    path?: PathPoint[];
    closed?: boolean;
    fill?: boolean;
    stroke?: number;
    color?: string;
  }
  export class Shape extends Anchor {
    constructor(options?: ShapeOptions);
  }
  export interface IllustrationOptions { element: Element | string; zoom?: number; dragRotate?: boolean; centered?: boolean }
  export class Illustration extends Anchor {
    constructor(options: IllustrationOptions);
    zoom: number;
    updateRenderGraph(): void;
  }
}
