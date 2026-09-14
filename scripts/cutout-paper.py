#!/usr/bin/env python3
"""从 IMG_7245.JPG 抠出手工土纸的轮廓，做成页边可用的纸张贴图。

这张照片的背景是纯白，但纸面右半边过曝、色温也偏中性，所以「R-B 色温」和
「固定亮度阈值」两种常见判据都会漏。实测可用的判据是：
  · 背景完全平坦（9x9 局部标准差 0.00），纸面无论过曝与否都有 10+ 的纤维起伏
  · 纸面亮度稳定在 202~208，明显低于纯白背景
于是：亮度 < 249 或 局部起伏 > 2 → 最大连通域 → 闭运算 → 填洞。

照片里纸张卷起处有大片阴影、纸面还有霉点，直接搬过来会显得脏，所以只保留纸的
**轮廓与厚度**：离纸边 9px 以内保留阴影（撕边的立体感），内部暗斑压到两成半，
再整体提到项目纸色。

用法：python3 scripts/cutout-paper.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "素材" / "IMG_7245.JPG"
OUTPUT = PROJECT / "public" / "paper-cut-sheet.webp"

WORK_W = 1400
TARGET_MEAN = 233.0    # 略亮于旧撕边纸（226.5），贴近项目纸色
DARK_GAIN = 0.25       # 内部暗斑（霉点、脏影）压到两成半
LIGHT_GAIN = 0.50      # 内部亮部保留一半
EDGE_DARK_GAIN = 0.75  # 撕边一圈的阴影保留，撑出纸的厚度
EDGE_LIGHT_GAIN = 0.70
EDGE_BAND = 9.0
DEV_RANGE = (-24.0, 12.0)
TARGET_TINT = (231.6, 228.4, 219.6)
PAD_RATIO = 0.012


def paper_mask(gray: np.ndarray) -> np.ndarray:
    """亮度 + 局部起伏判定纸面；背景是纯白且完全平坦，所以两条件取并集不会漏。"""
    mean = ndimage.uniform_filter(gray, 9)
    relief = np.sqrt(np.maximum(ndimage.uniform_filter(gray * gray, 9) - mean * mean, 0.0))
    raw = (gray < 249.0) | (relief > 2.0)
    labels, count = ndimage.label(raw)
    if count == 0:
        return np.zeros_like(raw, bool)
    sizes = ndimage.sum(raw, labels, range(1, count + 1))
    mask = labels == (int(np.argmax(sizes)) + 1)
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3), bool))
    return ndimage.binary_fill_holes(mask)


def main() -> int:
    if not SOURCE.exists():
        print(f"!! 找不到源图：{SOURCE}")
        return 1

    im = Image.open(SOURCE).convert("RGB")
    w, h = im.size
    if w > WORK_W:
        im = im.resize((WORK_W, round(h * WORK_W / w)), Image.LANCZOS)
    gray = np.asarray(im).astype(np.float32).mean(axis=2)

    mask = paper_mask(gray)
    if not mask.any():
        print("!! 没有分割出纸面")
        return 1

    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    pad = round(min(x1 - x0, y1 - y0) * PAD_RATIO)
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(mask.shape[0] - 1, y1 + pad), min(mask.shape[1] - 1, x1 + pad)
    mask = mask[y0:y1 + 1, x0:x1 + 1]
    gray = gray[y0:y1 + 1, x0:x1 + 1]
    print(f"纸面 {x1 - x0 + 1}x{y1 - y0 + 1}（宽高比 {(x1 - x0 + 1) / (y1 - y0 + 1):.2f}）")

    core = ndimage.binary_erosion(mask, iterations=4)
    dev = gray - float(np.median(gray[core]))

    dist = ndimage.distance_transform_edt(mask)
    edge = dist < EDGE_BAND
    gain = np.where(dev < 0, np.where(edge, EDGE_DARK_GAIN, DARK_GAIN), np.where(edge, EDGE_LIGHT_GAIN, LIGHT_GAIN))
    tone = np.clip(np.clip(dev * gain, *DEV_RANGE) + TARGET_MEAN, 0.0, 255.0)

    tint = np.array(TARGET_TINT, dtype=np.float32)
    tint = tint / tint.mean()
    rgb = np.clip(tone[:, :, None] * tint[None, None, :], 0, 255).astype(np.uint8)

    alpha = (ndimage.gaussian_filter(mask.astype(np.float32), 1.0) * 255.0).round().astype(np.uint8)
    img = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUTPUT, "WEBP", quality=86, method=6)

    lum = rgb[core].astype(np.float32).mean(axis=1)
    print(f"OK public/paper-cut-sheet.webp：{img.size[0]}x{img.size[1]}，{OUTPUT.stat().st_size / 1024:.0f} KB")
    print(f"  纸面亮度 {lum.mean():.1f}，起伏 5%~95% {np.percentile(lum, 95) - np.percentile(lum, 5):.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
