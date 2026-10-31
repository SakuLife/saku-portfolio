"""業種別の見本を、手紙に入れる A4 カラーの印刷用 PDF にする（本社 10-31・37番の設計の③）。

- 写真やイラストの所は「ここにお店の写真が入ります」の枠に置き換えて撮る（店の写真・ロゴは載せない）
- 右下に「見本です（お店の公式サイトではありません）」
- 出力: samples/export/letter_A4_<名前>.pdf（1枚ずつ）と samples/export/letter_A4_all.pdf（5枚まとめ）
  どれも git では追わない（作り直せる・見本はどこにも公開しない方針）

使い方: python samples/print_letter.py            （全部）
        python samples/print_letter.py salon
"""
from __future__ import annotations

import base64
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from export import EXPORT_DIR, HIDE_FIXED, HIDE_NAME, SAMPLES, SAMPLES_DIR

# 紙で目立たせる「できること」（export.py の points を箇条書きにした物）
FEATURES: dict[str, list[str]] = {
    "rental-house": ["入居日を選ぶと、初期費用がその場で出る", "灯油・除雪・水抜きなど、冬の暮らしを先に説明", "スマホから内見の予約"],
    "restaurant": ["メニューを種類とアレルギーで絞り込み", "テイクアウトの予約（いっぱいの時間は選べない）", "営業日カレンダーと、今日の営業"],
    "salon": ["メニューを選ぶと、料金と時間が出る", "その時間が入る空き枠だけから予約", "スタッフも選べる"],
    "school": ["3つの質問で、合うコースを診断", "兄弟割まで入れた月謝の計算", "無料体験の申し込み"],
    "reform": ["施工例を、前と後で見比べ", "場所と広さで、金額の目安が出る", "写真をつけて見積りを依頼"],
}

# 「できること」の下の1行。無い物は「写真・メニュー・料金は、お店のものに…」
NOTES: dict[str, str] = {
    "rental-house": "写真・間取り・家賃は、物件のものに入れ替えて公開します。",
    "school": "写真・コース・月謝は、教室のものに入れ替えて公開します。",
    "reform": "施工例の写真・料金の目安は、お店のものに入れ替えて公開します。",
}

# 写真・イラストの所を枠にする。物件は「物件の写真」、ほかは「お店の写真」
PHOTO_JS = """(word) => {
  const frame = (el, text, small) => {
    el.innerHTML = '';
    el.style.background = '#f4f1ea';
    el.style.border = '3px dashed #b9b2a5';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.color = '#7a7266';
    el.style.fontWeight = '700';
    el.style.textAlign = 'center';
    el.style.fontSize = small ? '12px' : '22px';
    el.textContent = text;
  };
  document.querySelectorAll('.hero-art').forEach(el => { el.style.aspectRatio = '640 / 440'; frame(el, 'ここに' + word + 'の写真が入ります', false); });
  document.querySelectorAll('.shot-art').forEach(el => frame(el, 'ここに' + word + 'の写真が入ります', true));
  document.querySelectorAll('.dish-art').forEach(el => frame(el, '写真', true));
  document.querySelectorAll('.ba').forEach(el => frame(el, 'ここに工事の前と後の写真が入ります', false));
}"""

PAGE_HTML = """<section class="sheet">
<div class="top"><span class="badge">見本・架空の{what}です</span>
<h1>{title}</h1>
<p class="lead">もしホームページを作るなら、こうなります。パソコンでもスマホでも見やすい形です。</p></div>
<div class="pc"><img src="data:image/png;base64,{pc}"></div>
<div class="sp"><img src="data:image/png;base64,{sp}"></div>
<div class="feat"><p class="feat-h">このページでできること</p><ul>{feats}</ul>
<p class="feat-note">{note}</p></div>
<div class="foot"><span class="maker">SakuLife</span><span class="notice">見本です（お店の公式サイトではありません）</span></div>
</section>"""

DOC_HTML = """<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=swap" rel="stylesheet">
<style>
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: 'Noto Sans JP', sans-serif; color: #26302b; }}
.sheet {{ width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always;
  background: linear-gradient(165deg, #eef6f1, #fbf8f2 55%, #f3e6d6); }}
.sheet:last-child {{ page-break-after: auto; }}
.top {{ padding: 14mm 14mm 0; }}
.badge {{ display: inline-block; background: #c2410c; color: #fff; font-weight: 900; font-size: 13pt; padding: 1.2mm 5mm; border-radius: 99px; }}
h1 {{ font-size: 26pt; font-weight: 900; margin: 4mm 0 2mm; letter-spacing: .01em; }}
.lead {{ font-size: 11.5pt; font-weight: 700; color: #2f4a3a; margin: 0; }}
.pc {{ position: absolute; left: 14mm; top: 56mm; width: 140mm; border: 2.5mm solid #26302b; border-radius: 4mm;
  overflow: hidden; background: #26302b; box-shadow: 0 3mm 8mm rgba(38,48,43,.25); }}
.pc img, .sp img {{ display: block; width: 100%; }}
.sp {{ position: absolute; right: 14mm; top: 92mm; width: 46mm; border: 2.5mm solid #26302b; border-radius: 7mm;
  overflow: hidden; background: #26302b; box-shadow: 0 3mm 8mm rgba(38,48,43,.3); }}
.feat {{ position: absolute; left: 14mm; right: 14mm; top: 210mm; background: rgba(255,255,255,.85);
  border: .4mm solid #d8d2c4; border-radius: 4mm; padding: 6mm 8mm; }}
.feat-h {{ margin: 0 0 2mm; font-weight: 900; font-size: 13pt; color: #2f4a3a; }}
.feat ul {{ margin: 0; padding-left: 5mm; font-size: 13pt; font-weight: 700; line-height: 1.8; }}
.feat-note {{ margin: 2.5mm 0 0; font-size: 10pt; color: #56625b; }}
.foot {{ position: absolute; left: 0; right: 0; bottom: 0; height: 18mm; background: #2f4a3a; color: #fff;
  display: flex; align-items: center; justify-content: space-between; padding: 0 14mm; }}
.maker {{ font-size: 12pt; font-weight: 700; }}
.notice {{ font-size: 12pt; font-weight: 900; background: #fff; color: #c2410c; padding: 1.5mm 4mm; border-radius: 2mm; }}
</style></head><body>{pages}</body></html>"""


def shoot(browser, url: str, word: str, *, mobile: bool) -> bytes:
    """写真の所を枠にしてから、上の方を撮って返す。"""
    if mobile:
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    else:
        page = browser.new_page(viewport={"width": 1280, "height": 1000}, device_scale_factor=2)
    page.goto(url, wait_until="networkidle")
    page.add_style_tag(content=HIDE_FIXED + HIDE_NAME)
    page.evaluate(PHOTO_JS, word)
    shot = page.screenshot()
    page.close()
    return shot


def sheet(browser, name: str) -> str:
    """1枚分の HTML を返す。"""
    meta = SAMPLES[name]
    url = (SAMPLES_DIR / f"{name}.html").as_uri()
    word = "物件" if name == "rental-house" else "お店"
    pc = shoot(browser, url, word, mobile=False)
    sp = shoot(browser, url, word, mobile=True)
    return PAGE_HTML.format(
        what=meta["what"],
        title=meta["title"],
        pc=base64.b64encode(pc).decode(),
        sp=base64.b64encode(sp).decode(),
        feats="".join(f"<li>{f}</li>" for f in FEATURES[name]),
        note=NOTES.get(name, "写真・メニュー・料金は、お店のものに入れ替えて公開します。"),
    )


def to_pdf(browser, pages: list[str], path: Path) -> None:
    page = browser.new_page()
    page.set_content(DOC_HTML.format(pages="".join(pages)), wait_until="networkidle")
    page.pdf(path=str(path), format="A4", print_background=True, prefer_css_page_size=True)
    page.close()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    names = sys.argv[1:] or list(SAMPLES)
    EXPORT_DIR.mkdir(exist_ok=True)
    root = SAMPLES_DIR.parent
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        sheets = {n: sheet(browser, n) for n in names}
        for n, html in sheets.items():
            out = EXPORT_DIR / f"letter_A4_{n}.pdf"
            to_pdf(browser, [html], out)
            print(out.relative_to(root))
        if len(names) > 1:
            out = EXPORT_DIR / "letter_A4_all.pdf"
            to_pdf(browser, list(sheets.values()), out)
            print(out.relative_to(root))
        browser.close()


if __name__ == "__main__":
    main()
