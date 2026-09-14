// 纸条匹配的底图：用户相册里抠好的实物素材（叶子 / 蓝莓 / 年轮 / 牛奶瓶 / CD / 报纸 / 枫叶……）。
// 处理口径统一：抠出主体 → 裁到主体外框 → 缩到最长边占画布 84% → 居中放进 384×384 透明画布 → 量化压缩。
// 于是每张素材在界面上占的视觉体量一致，可以互换摆放。
// 注意：这里必须写成字面量路径——单文件构建（scripts/inline.mjs）靠扫描引号里的绝对路径来内联资源，
// 用模板字符串拼出来的名字它看不见，打包后会 404。
export const STICKERS = [
  '/stickers/sticker-01.png',
  '/stickers/sticker-02.png',
  '/stickers/sticker-03.png',
  '/stickers/sticker-04.png',
  '/stickers/sticker-05.png',
  '/stickers/sticker-06.png',
  '/stickers/sticker-07.png',
  '/stickers/sticker-08.png',
  '/stickers/sticker-09.png',
  '/stickers/sticker-10.png',
  '/stickers/sticker-11.png',
  '/stickers/sticker-12.png',
];

// 发牌：每次进站点洗一副（Fisher–Yates），按需一张张发下去。
// 同一副牌内天然互不重复，所以八张纸条挨着翻不会撞素材；发完再洗，并避开与上一张相邻重复。
let deck: string[] = [];
let deckAt = 0;
let lastDealt = '';

function shuffleDeck(avoid: string) {
  deck = STICKERS.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (avoid && deck[0] === avoid && deck.length > 1) [deck[0], deck[1]] = [deck[1], deck[0]];
  deckAt = 0;
}

function deal(): string {
  if (deckAt >= deck.length) shuffleDeck(lastDealt);
  lastDealt = deck[deckAt++];
  return lastDealt;
}

// 写一行页左下角：一次访问一枚，页面重渲染不跳变
let leftPick: string | null = null;
export function spotSticker(): string {
  if (!leftPick) leftPick = deal();
  return leftPick;
}

// 匹配纸条右下角：按纸条固定（翻回来还是那一枚），但每张纸条各发一枚不同的。
const dealt = new Map<string, string>();
export function cardSticker(key: string): string {
  let url = dealt.get(key);
  if (!url) { url = deal(); dealt.set(key, url); }
  return url;
}
