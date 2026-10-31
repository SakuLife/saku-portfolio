"""業種別の見本ページから画像を書き出す。

- images/samples/<名前>.webp … 営業サイトのカード用サムネ（PC 幅のファーストビュー・900px）
- samples/export/<名前>_pc.png … PC 1280px の全体
- samples/export/<名前>_sp.png … スマホ 390px の全体
- samples/export/<名前>_coconala.png … ココナラの出品画像の寸法（1220x1240）。出品画像・相談への1枚目に使う

使い方: python samples/export.py            （全部）
        python samples/export.py rental-house
"""
from __future__ import annotations

import base64
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT / "samples"
EXPORT_DIR = SAMPLES_DIR / "export"
THUMB_DIR = ROOT / "images" / "samples"

# 全体を撮る時は、画面に固定した物（スマホの下の予約ボタン）が途中に写り込むので隠す
HIDE_FIXED = ".fixed-cta{display:none!important}.sample-bar{position:static!important}"

# 見本を足したら1行。title はココナラ画像の見出し
SAMPLES: dict[str, dict[str, str]] = {
    "rental-house": {
        "title": "大家さんの物件紹介ページ",
        "points": "初期費用の自動計算・内見予約・冬の暮らしの説明",
    },
}

COVER_HTML = """<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box}}body{{margin:0;width:1220px;height:1240px;font-family:'Noto Sans JP',sans-serif;
background:linear-gradient(160deg,#eef6f1,#fbf8f2 55%,#f3e6d6);color:#26302b;position:relative;overflow:hidden}}
.top{{padding:64px 70px 0}}
.badge{{display:inline-block;background:#c2410c;color:#fff;font-weight:900;font-size:30px;padding:8px 22px;border-radius:999px}}
h1{{font-size:72px;font-weight:900;line-height:1.25;margin:26px 0 14px;letter-spacing:.01em}}
.pts{{font-size:30px;font-weight:700;color:#2f4a3a;margin:0}}
.pc{{position:absolute;left:70px;top:380px;width:860px;border-radius:18px;overflow:hidden;
box-shadow:0 24px 60px rgba(38,48,43,.25);border:10px solid #26302b;background:#26302b}}
.pc img{{display:block;width:100%}}
.sp{{position:absolute;right:60px;top:500px;width:300px;border-radius:38px;overflow:hidden;
box-shadow:0 24px 60px rgba(38,48,43,.3);border:12px solid #26302b;background:#26302b}}
.sp img{{display:block;width:100%}}
.foot{{position:absolute;left:0;right:0;bottom:0;background:#2f4a3a;color:#fff;font-size:28px;font-weight:700;
padding:22px 70px;display:flex;justify-content:space-between}}
</style></head><body>
<div class="top"><span class="badge">見本・架空の物件です</span>
<h1>{title}</h1><p class="pts">{points}</p></div>
<div class="pc"><img src="data:image/png;base64,{pc}"></div>
<div class="sp"><img src="data:image/png;base64,{sp}"></div>
<div class="foot"><span>パソコンでもスマホでも見やすく</span><span>制作 SakuLife</span></div>
</body></html>"""


def export_one(name: str, meta: dict[str, str], browser) -> list[Path]:
    """1枚の見本から画像を書き出し、書き出したパスを返す。"""
    url = (SAMPLES_DIR / f"{name}.html").as_uri()
    out: list[Path] = []

    pc = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
    pc.goto(url, wait_until="networkidle")
    first_pc = pc.screenshot()  # ファーストビュー（サムネとココナラ画像に使う）
    pc.add_style_tag(content=HIDE_FIXED)
    full_pc = EXPORT_DIR / f"{name}_pc.png"
    pc.screenshot(path=str(full_pc), full_page=True)
    out.append(full_pc)
    thumb = THUMB_DIR / f"{name}.webp"
    # サムネ＝帯とヘッダーを含めたファーストビュー（16:10）
    (EXPORT_DIR / f"_{name}_thumb.png").write_bytes(first_pc)
    pc.close()

    sp = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    sp.goto(url, wait_until="networkidle")
    first_sp = sp.screenshot()
    sp.add_style_tag(content=HIDE_FIXED)
    full_sp = EXPORT_DIR / f"{name}_sp.png"
    sp.screenshot(path=str(full_sp), full_page=True)
    out.append(full_sp)
    sp.close()

    cover = browser.new_page(viewport={"width": 1220, "height": 1240}, device_scale_factor=1)
    cover.set_content(
        COVER_HTML.format(
            title=meta["title"],
            points=meta["points"],
            pc=base64.b64encode(first_pc).decode(),
            sp=base64.b64encode(first_sp).decode(),
        ),
        wait_until="networkidle",
    )
    cover_png = EXPORT_DIR / f"{name}_coconala.png"
    cover.screenshot(path=str(cover_png))
    out.append(cover_png)
    cover.close()

    # webp への変換は Pillow（サムネは幅 900px）
    from PIL import Image

    tmp = EXPORT_DIR / f"_{name}_thumb.png"
    with Image.open(tmp) as im:
        im = im.convert("RGB").resize((900, 563), Image.LANCZOS)
        im.save(thumb, "WEBP", quality=82)
    tmp.unlink()
    out.append(thumb)
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    names = sys.argv[1:] or list(SAMPLES)
    EXPORT_DIR.mkdir(exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        for name in names:
            for path in export_one(name, SAMPLES[name], browser):
                print(path.relative_to(ROOT))
        browser.close()


if __name__ == "__main__":
    main()
