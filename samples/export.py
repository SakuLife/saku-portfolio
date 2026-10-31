"""業種別の見本ページから画像を書き出す。

- images/samples/<名前>.webp … 営業サイトのカード用サムネ（PC 幅のファーストビュー・900px）
- samples/export/<名前>_pc.png … PC 1280px の全体
- samples/export/<名前>_sp.png … スマホ 390px の全体
- samples/export/<名前>_coconala.png … 出品画像の寸法（1220x1240）。直接の相談・クラウドワークス用
- samples/export/<名前>_coconala_noname.png … 同じ寸法で、屋号「制作 SakuLife」と見本一覧へのリンクを外した版。
  ココナラ用（ココナラのアカウントでは屋号を出さない・外への誘導に読める物を載せない）

使い方: python samples/export.py            （全部）
        python samples/export.py rental-house
"""
from __future__ import annotations

import base64
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT / "samples"
EXPORT_DIR = SAMPLES_DIR / "export"
THUMB_DIR = ROOT / "images" / "samples"

# 全体を撮る時は、画面に固定した物（スマホの下の予約ボタン）が途中に写り込むので隠す
HIDE_FIXED = ".fixed-cta{display:none!important}.sample-bar{position:static!important}"
# 屋号なし版：帯の「SakuLife の制作見本一覧へ」を消す（「見本・架空」の文は残す）
HIDE_NAME = ".sample-bar a{display:none!important}"

# 見本を足したら1行。title＝見出し、points＝できること、what＝「見本・架空の○○です」の○○
SAMPLES: dict[str, dict[str, str]] = {
    "rental-house": {"title": "大家さんの物件紹介ページ", "points": "初期費用の自動計算・内見予約・冬の暮らしの説明", "what": "物件"},
    "restaurant": {"title": "飲食店のホームページ", "points": "メニューの絞り込み・テイクアウト予約・営業日カレンダー", "what": "店"},
    "salon": {"title": "美容サロンのホームページ", "points": "メニューの料金と時間の計算・空き時間から予約", "what": "店"},
    "school": {"title": "習い事教室のホームページ", "points": "3つの質問でコース診断・月謝の計算・無料体験の申し込み", "what": "教室"},
    "reform": {"title": "リフォーム・職人のホームページ", "points": "ビフォー・アフター・かんたん見積り・写真つきの依頼", "what": "会社"},
}

COVER_HTML = """<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box}}body{{margin:0;width:1220px;height:1240px;font-family:'Noto Sans JP',sans-serif;
background:linear-gradient(160deg,#eef6f1,#fbf8f2 55%,#f3e6d6);color:#26302b;position:relative;overflow:hidden}}
.top{{padding:64px 70px 0}}
.badge{{display:inline-block;background:#c2410c;color:#fff;font-weight:900;font-size:30px;padding:8px 22px;border-radius:999px}}
h1{{font-size:{h1}px;font-weight:900;line-height:1.25;margin:26px 0 14px;letter-spacing:.01em;white-space:nowrap}}
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
<div class="top"><span class="badge">見本・架空の{what}です</span>
<h1>{title}</h1><p class="pts">{points}</p></div>
<div class="pc"><img src="data:image/png;base64,{pc}"></div>
<div class="sp"><img src="data:image/png;base64,{sp}"></div>
<div class="foot"><span>パソコンでもスマホでも見やすく</span>{maker}</div>
</body></html>"""


def shoot(browser, url: str, *, mobile: bool, css: str = "", full: Path | None = None) -> bytes:
    """ファーストビューを撮って返す。full を渡すと、固定物を隠して全体も保存する。"""
    if mobile:
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    else:
        page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
    page.goto(url, wait_until="networkidle")
    if css:
        page.add_style_tag(content=css)
    first = page.screenshot()
    if full:
        page.add_style_tag(content=HIDE_FIXED)
        page.screenshot(path=str(full), full_page=True)
    page.close()
    return first


def cover(browser, meta: dict[str, str], pc: bytes, sp: bytes, path: Path, *, maker: bool) -> None:
    """1220x1240 の出品画像を作る。maker=False で屋号を外す。"""
    page = browser.new_page(viewport={"width": 1220, "height": 1240}, device_scale_factor=1)
    page.set_content(
        COVER_HTML.format(
            title=meta["title"],
            points=meta["points"],
            what=meta["what"],
            h1=72 if len(meta["title"]) <= 13 else 60,  # 長い題も1行に収める
            pc=base64.b64encode(pc).decode(),
            sp=base64.b64encode(sp).decode(),
            maker="<span>制作 SakuLife</span>" if maker else "",
        ),
        wait_until="networkidle",
    )
    page.screenshot(path=str(path))
    page.close()


def export_one(name: str, meta: dict[str, str], browser) -> list[Path]:
    """1枚の見本から画像を書き出し、書き出したパスを返す。"""
    url = (SAMPLES_DIR / f"{name}.html").as_uri()
    full_pc = EXPORT_DIR / f"{name}_pc.png"
    full_sp = EXPORT_DIR / f"{name}_sp.png"
    pc = shoot(browser, url, mobile=False, full=full_pc)
    sp = shoot(browser, url, mobile=True, full=full_sp)
    pc_nn = shoot(browser, url, mobile=False, css=HIDE_NAME)
    sp_nn = shoot(browser, url, mobile=True, css=HIDE_NAME)

    cov = EXPORT_DIR / f"{name}_coconala.png"
    cov_nn = EXPORT_DIR / f"{name}_coconala_noname.png"
    cover(browser, meta, pc, sp, cov, maker=True)
    cover(browser, meta, pc_nn, sp_nn, cov_nn, maker=False)

    # サムネ＝帯とヘッダーを含めたファーストビュー（16:10・幅900px の webp）
    thumb = THUMB_DIR / f"{name}.webp"
    with Image.open(BytesIO(pc)) as im:
        im.convert("RGB").resize((900, 563), Image.LANCZOS).save(thumb, "WEBP", quality=82)
    return [full_pc, full_sp, cov, cov_nn, thumb]


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
