"""サイトと業種別の見本（samples/<型>/）のアイコンを作り、各ページの <head> に読み込みの行を足す。

作る物（置き場ごと）: favicon.ico（16・32・48）／apple-touch-icon.png（180）／icon-192.png／icon-512.png／site.webmanifest
- トップ（リポジトリ直下）＝SakuLife の「S」（favicon.svg と同じ緑）
- 見本＝その架空の店の印（店名の1字・店の色）。🔴 実在の店の印は使わない
何度回しても同じ結果（行は1回だけ足す）。37番の型から見本を写し直したら、もう一度回す:
    python samples/make_icons.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(r"C:\Windows\Fonts")
GOTHIC = FONTS / "YuGothB.ttc"
MINCHO = FONTS / "BIZ-UDMinchoM.ttc"

# 型フォルダ: (印の字, 地の色, 字の色, 字体, 店名)
SAMPLES: dict[str, tuple[str, str, str, Path, str]] = {
    "01_wagashi": ("丘", "#1b1512", "#f1e6d2", MINCHO, "菓子処 丘月庵"),
    "02_cafe": ("ニ", "#3b2a20", "#f6f0e4", GOTHIC, "ニレの木珈琲"),
    "03_bakery": ("ふ", "#efe1c6", "#2b1d14", GOTHIC, "ふくらむ堂"),
    "04_salon": ("IL", "#0d0d0d", "#b39a6b", MINCHO, "hair atelier ILUFE"),
    "05_seitai": ("ほ", "#2f8f8a", "#ffffff", GOTHIC, "整体院 ほどろ"),
    "06_izakaya": ("ひ", "#c2382a", "#fff6ea", MINCHO, "炭火やきとり ひさご屋"),
    "07_yado": ("霧", "#1d2a22", "#b1914f", MINCHO, "森の宿 霧音"),
    "08_kobo": ("た", "#bf5330", "#f2efe8", GOTHIC, "陶房 たまつち"),
    "09_kyoshitsu": ("ぽ", "#ff8fb1", "#ffffff", GOTHIC, "ぽろん音楽教室"),
    "10_shigyo": ("白", "#14213d", "#ffffff", MINCHO, "しろかね行政書士事務所"),
}


def _square(size: int, bg: str | tuple[str, str], fg: str, char: str, font: Path, rounded: bool) -> Image.Image:
    """印を1枚描く。rounded=True はファビコン用（角を透明に）、False は端まで塗る（iOS・Android が自分で角を丸める）"""
    s = size * 4  # 大きく描いて縮める＝縁がなめらか
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    if isinstance(bg, tuple):  # 斜めのグラデーション（SakuLife の緑）
        a, b = (Image.new("RGB", (1, 1), c).getpixel((0, 0)) for c in bg)
        grad = Image.new("RGB", (s, s))
        px = grad.load()
        for y in range(s):
            for x in range(s):
                t = (x + y) / (2 * s - 2)
                px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
        fill_layer = grad.convert("RGBA")
    else:
        fill_layer = Image.new("RGBA", (s, s), bg)
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 6 // 32, fill=255)
    else:
        md.rectangle((0, 0, s, s), fill=255)
    img.paste(fill_layer, (0, 0), mask)
    d = ImageDraw.Draw(img)
    # 端まで塗る版は丸く切り抜かれても欠けないよう、字を小さめに（マスクの安全域）
    box = s * (0.62 if rounded else 0.5)
    fs = int(box)
    f = ImageFont.truetype(str(font), fs)
    l, t, r, b2 = d.textbbox((0, 0), char, font=f)
    scale = box / max(r - l, b2 - t)
    f = ImageFont.truetype(str(font), int(fs * scale))
    l, t, r, b2 = d.textbbox((0, 0), char, font=f)
    d.text(((s - (r - l)) / 2 - l, (s - (b2 - t)) / 2 - t), char, font=f, fill=fg)
    return img.resize((size, size), Image.LANCZOS)


def make_set(out: Path, char: str, bg, fg: str, font: Path, name: str, short: str, theme: str) -> None:
    """1か所ぶんのアイコンと manifest を書く"""
    ico = _square(256, bg, fg, char, font, rounded=True)
    ico.save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    _square(180, bg, fg, char, font, rounded=False).convert("RGB").save(out / "apple-touch-icon.png")
    for n in (192, 512):
        _square(n, bg, fg, char, font, rounded=False).convert("RGB").save(out / f"icon-{n}.png")
    manifest = {
        "name": name,
        "short_name": short,
        "start_url": "./",
        "display": "browser",
        "background_color": theme,
        "theme_color": theme,
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    }
    (out / "site.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def add_tags(html: Path, prefix: str, after: str | None) -> bool:
    """<head> にアイコンの行を足す（改行の流儀はファイルのまま）。足したら True"""
    raw = html.read_bytes().decode("utf-8")
    if "apple-touch-icon" in raw:
        return False
    nl = "\r\n" if "\r\n" in raw else "\n"
    if after:  # 既にある rel="icon" の行の下に、同じ字下げで足す
        i = raw.index(after)
        line_start = raw.rfind("\n", 0, i) + 1
        line = raw[line_start:i]
        indent = line[: len(line) - len(line.lstrip())]
        end = raw.index("\n", i) + 1
        lines = [
            f'<link rel="icon" href="{prefix}favicon.ico" sizes="48x48" />',
            f'<link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png" />',
            f'<link rel="manifest" href="{prefix}site.webmanifest" />',
        ]
        raw = raw[:end] + "".join(indent + x + nl for x in lines) + raw[end:]
    else:  # 見本：</head> の前に足す
        lines = [
            f'<link rel="icon" href="{prefix}favicon.ico" sizes="48x48">',
            f'<link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">',
            f'<link rel="manifest" href="{prefix}site.webmanifest">',
        ]
        i = raw.index("</head>")
        raw = raw[:i] + nl.join(lines) + nl + raw[i:]
    html.write_bytes(raw.encode("utf-8"))
    return True


def main() -> None:
    make_set(ROOT, "S", ("#217346", "#27ae60"), "#ffffff", GOTHIC, "SakuLife｜効率厨さく", "SakuLife", "#06140d")
    root_pages = {
        "index.html": "", "homepage.html": "", "privacy.html": "", "qr.html": "", "v1.html": "",
        "404.html": "/",
        "samples/reform.html": "../", "samples/rental-house.html": "../", "samples/restaurant.html": "../",
        "samples/salon.html": "../", "samples/school.html": "../",
    }
    for rel, prefix in root_pages.items():
        p = ROOT / rel
        changed = add_tags(p, prefix, 'rel="icon"')
        print(f"{'足した' if changed else '済み  '} {rel}")
    for folder, (char, bg, fg, font, name) in SAMPLES.items():
        d = ROOT / "samples" / folder
        theme = bg
        make_set(d, char, bg, fg, font, f"{name}（見本）", name[:12], theme)
        changed = add_tags(d / "index.html", "", None)
        print(f"{'足した' if changed else '済み  '} samples/{folder}/index.html")


if __name__ == "__main__":
    main()
