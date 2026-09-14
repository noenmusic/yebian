#!/usr/bin/env python3
"""页边 · 手写字体子集化

把站酷庆科黄油体（OFL，可商用）按项目实际用字裁成一个 woff2，
避免出现「有的字不在字体里、回落到宋体」的混排。

用字来源：
  1. src/**.ts 与 index.html 里出现的所有字符（界面文案 + 演示纸条）
  2. ASCII 可见字符与常用中文标点
  3. GB2312 一级汉字（3755 个常用字）——用户自己敲进输入框的句子也走这个字体，
     所以不能只收录源码里出现过的字

用法：
  python3 scripts/subset-font.py            # 生成 public/fonts/zcool-qingke-huangyou-subset.woff2
  python3 scripts/subset-font.py --check    # 只检查当前子集是否覆盖项目用字，不重写文件
  python3 scripts/subset-font.py --slim     # 不收录 GB2312 一级汉字（文件更小，但用户输入易回落）

字源文件：assets/fonts-src/ZCOOLQingKeHuangYou-Regular.ttf
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
SRC_FONT = PROJECT / "assets" / "fonts-src" / "ZCOOLQingKeHuangYou-Regular.ttf"
FONT_DIR = PROJECT / "public" / "fonts"
OUT_WOFF2 = FONT_DIR / "zcool-qingke-huangyou-subset.woff2"
OUT_CHARS = FONT_DIR / "subset-chars.txt"

# 不参与取字的文件后缀（测试用例里有 😀 这类非界面字符）
SKIP_SUFFIXES = (".test.ts",)

# 字体本身就没有这些符号，它们只能回落，属正常
ARROW_LIKE = "←→↗↻⤢·"

PUNCT = (
    "、。《》「」『』【】（）〔〕［］—…·～！？；：，．“”‘’"
    "％＆＃＠｜－－＋＝／＼＜＞\u3000"
)


def load_source_chars() -> tuple[set[str], int]:
    """界面源码里出现的所有非空白字符，以及扫描到的文件数"""
    targets: list[Path] = [PROJECT / "index.html"]
    targets += [
        p
        for p in sorted((PROJECT / "src").rglob("*"))
        if p.is_file() and not p.name.endswith(SKIP_SUFFIXES)
    ]
    chars: set[str] = set()
    counted = 0
    for path in targets:
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        chars |= set(text)
        counted += 1
    return {c for c in chars if c.strip()}, counted


def gb2312_level1() -> set[str]:
    """GB2312 一级汉字（3755 个常用字，覆盖日常书写约 99.7%）"""
    out: set[str] = set()
    for cp in range(0x4E00, 0xA000):
        ch = chr(cp)
        try:
            raw = ch.encode("gb2312")
        except UnicodeEncodeError:
            continue
        if len(raw) == 2 and 0xB0 <= raw[0] <= 0xD7 and not (raw[0] == 0xD7 and raw[1] > 0xF9):
            out.add(ch)
    return out


def main() -> int:
    argv = sys.argv[1:]
    check_only = "--check" in argv
    slim = "--slim" in argv

    try:
        from fontTools.subset import Options, Subsetter
        from fontTools.ttLib import TTFont
    except ImportError:
        print("!! 缺少 fontTools，无法子集化字体。")
        print("   安装：python3 -m pip install fonttools brotli")
        print("   已跳过硬刷新字体，现有 woff2 保持不变。")
        return 0

    wanted, scanned = load_source_chars()
    print(f"扫描 {scanned} 个文件，得到界面用字 {len(wanted)} 个")

    if check_only:
        if not OUT_WOFF2.exists():
            print("!! 子集不存在，请先运行 npm run fonts")
            return 1
        have = set(TTFont(OUT_WOFF2).getBestCmap())
        allowed = set(map(chr, TTFont(SRC_FONT).getBestCmap())) if SRC_FONT.exists() else None
        # 字体本身就没有的字形（箭头等）不算缺失，它们只能回落
        missing = sorted(
            c for c in wanted if ord(c) not in have and (allowed is None or c in allowed)
        )
        if missing:
            print(f"!! 子集缺少 {len(missing)} 个界面用字：{''.join(missing)}")
            print("   请运行 npm run fonts 重新生成。")
            return 1
        print("✓ 当前子集覆盖全部界面用字")
        return 0

    if not SRC_FONT.exists():
        print(f"!! 找不到字体源文件：{SRC_FONT}")
        print(
            "   可从 cdn.jsdelivr.net/gh/google/fonts@main/ofl/zcoolqingkehuangyou/"
            "ZCOOLQingKeHuangYou-Regular.ttf 下载后放到该路径。"
        )
        return 1

    source = TTFont(SRC_FONT)
    cmap = source.getBestCmap()

    absent = sorted(c for c in wanted if ord(c) not in cmap)
    if absent:
        print(f"字体不含以下 {len(absent)} 个符号，将回落到系统字体：{''.join(absent)}")

    allowed = set(map(chr, cmap))
    charset = {c for c in wanted if c in allowed}
    charset |= {chr(i) for i in range(32, 127)}
    charset |= {c for c in PUNCT if c in allowed}
    if not slim:
        common = gb2312_level1() & allowed
        charset |= common
        print(f"计入 GB2312 一级汉字 {len(common)} 个（输入框里的句子也用手写体）")
    charset &= allowed

    options = Options()
    options.hinting = False  # 屏幕显示用不到 hinting，去掉可省不少体积
    options.layout_features = []
    options.notdef_outline = False
    options.drop_tables += ["DSIG"]

    subsetter = Subsetter(options=options)
    subsetter.populate(text="".join(sorted(charset)))
    subsetter.subset(source)
    source.flavor = "woff2"
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    source.save(OUT_WOFF2)
    OUT_CHARS.write_text("".join(sorted(charset)), encoding="utf-8")

    have = set(TTFont(OUT_WOFF2).getBestCmap())
    still = sorted(c for c in wanted if ord(c) not in have and ord(c) in cmap)
    size_kb = OUT_WOFF2.stat().st_size / 1024
    print(
        f"✓ public/fonts/zcool-qingke-huangyou-subset.woff2：{len(have)} 个字形，{size_kb:.0f} KB"
        f"（内联进单文件后约 {size_kb * 4 / 3:.0f} KB）"
    )
    if still:
        print(f"!! 生成结果仍缺 {len(still)} 个界面用字：{''.join(still)}")
        return 1
    print("✓ 界面用字已全部覆盖")
    return 0


if __name__ == "__main__":
    sys.exit(main())
