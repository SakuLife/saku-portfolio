/**
 * Gemini AI推薦機能
 * ブラウザから直接Gemini APIを呼び出し
 */

// キーは中央シークレットへ移管（ブラウザ直書きは漏洩するため廃止）。
// 空のままだと callGeminiAPI は localRecommend() フォールバックで動作する。
// もしフロントでGeminiを使う場合は、リファラ制限をかけた専用キーをここに入れること。
const GEMINI_API_KEY = "";

// Geminiに渡すシステムプロンプト
const AI_SYSTEM_PROMPT = `あなたは業務自動化の専門コンサルタントです。
ユーザーの相談内容に基づいて、以下のサービスカタログから最適なシステム・サービスを3〜5件推薦してください。

## 提供サービスカタログ

### YouTube自動化システム
1. 2chまとめ動画全自動生成（GPT/DALL-E/TTS/MoviePy）¥150,000〜
2. 漢字クイズ動画Bot（Gemini/VOICEVOX/YouTube API）¥150,000〜
3. 偉人名言AI動画（Claude/GPT/DALL-E/VOICEVOX）¥200,000〜
4. YouTube切り抜きショート自動化（faster-whisper/Gemini/ffmpeg/FastAPI）¥200,000〜
5. 睡眠音楽チャンネル自動運用（Suno AI/ffmpeg/YouTube API）¥150,000〜
6. Veo 3 YouTubeショート自動化 ¥100,000〜
7. 心に響く短編動画自動生成 ¥100,000〜
8. YouTubeデータ収集・解析ツール（Whisper文字起こし）¥80,000〜

### EC・物販自動化
9. eBayリサーチ支援（eBay/楽天/Amazon API連携+利益計算）¥150,000〜
10. SUZURIステッカー自動出品（トレンド分析+AI画像生成）¥120,000〜
11. Printify商品量産バッチツール ¥60,000〜
12. バーコードスキャン在庫管理システム ¥40,000〜
13. 楽天/Yahoo商品検品システム（助ネコCSV連携）¥40,000〜

### SNS・メッセージ自動化
14. Threads予約投稿WebApp（FastAPI/Supabase/Cloud Run）¥100,000〜
15. LINE毎朝自動メッセージ ¥30,000〜
16. Instagram投稿管理マクロ ¥15,000〜

### Excel VBA業務自動化
17. 成績表マクロ（最大2000人対応）¥40,000〜
18. 400件メール一括送信システム ¥30,000〜
19. Outlook連携メール処理（6バージョン改良済）¥30,000〜
20. 不動産DX地主リスト管理 ¥50,000〜
21. 棚割表配信システム ¥50,000〜
22. パレート図自動生成（製造業向け）¥20,000〜
23. クリニック夜間シフト表 ¥25,000〜
24. コールセンターオペレーター管理 ¥20,000〜
25. 審査進捗管理ダッシュボード ¥25,000〜
26. 部品表版数管理 ¥30,000〜
27. PDF化+メール自動送信 ¥20,000〜
28. 日報伝票システム ¥25,000〜
29. 給与総額集計、事業所税計算、買掛金管理、支給控除チェック 各¥10,000〜¥25,000
30. その他Excel VBA多数（座席表、カレンダー、名簿管理等）¥5,000〜

## 回答ルール
- 必ずJSON形式で回答してください
- 各推薦に対して、id（プロジェクトID）、title、reason（なぜおすすめか）、matchScore（0-98の整数）を含めてください
- matchScoreは、ユーザーの要望との適合度を表します
- 完全一致の既存システムがない場合でも、カスタマイズ可能なシステムを提案してください
- 回答は日本語で

## 回答形式（必ずこのJSON形式のみ）
{"recommendations":[{"id":"プロジェクトID","title":"タイトル","reason":"推薦理由","matchScore":85}]}

プロジェクトIDは以下を使用:
2ch-video, kanji-quiz, greatman-words, cutout-short, sleep-music, youtube-data-factory,
ebay-research, suzuri-shop, printify-etsy,
threads-scheduler, line-daily-message, excel-instagram-manager,
excel-attendance, excel-clinic-shift, excel-callcenter-shift, excel-cleaning-shift,
excel-pdf-email, excel-version-up, excel-calendar, excel-daily-report, excel-rice-price, excel-garbage-format, excel-image-insert, excel-shelf-layout,
excel-business-tax, excel-salary-total, excel-accounts-payable, excel-payroll-check,
excel-grade-report, excel-seat-chart, excel-timetable, excel-individual-report,
excel-realestate-calendar, excel-realestate-dx, excel-realestate-docs,
excel-gmail-auto, excel-bulk-email, excel-outlook-system, excel-inquiry-transfer,
excel-pareto, excel-boxplot, excel-keyword-rank,
excel-progress, excel-inventory, excel-inspection,
auto-blog, comfyui-batch, excel-prompt-manager`;

// フォールバック: クライアントサイドの簡易マッチング
const KEYWORD_MAP = {
  youtube: ["youtube", "動画", "ユーチューブ", "投稿", "チャンネル", "ショート", "切り抜き", "音楽", "台本", "撮影", "編集"],
  ec: ["ec", "物販", "出品", "商品", "在庫", "ebay", "楽天", "amazon", "etsy", "suzuri", "printify", "ステッカー", "検品", "仕入", "転売", "せどり"],
  sns: ["sns", "threads", "line", "instagram", "投稿", "予約", "メッセージ", "通知"],
  shift: ["シフト", "勤怠", "出退勤", "スタッフ", "オペレーター", "夜勤", "超勤", "勤務"],
  document: ["帳票", "書類", "pdf", "カレンダー", "日報", "伝票", "版数", "棚割", "画像挿入", "請求書", "納品書", "見積"],
  accounting: ["経理", "給与", "税", "買掛", "支給", "控除", "集計", "精算", "売上", "経費"],
  education: ["学校", "成績", "座席", "時間割", "生徒", "児童", "教育", "賞状", "名簿", "先生", "授業"],
  realestate: ["不動産", "物件", "地主", "借地", "賃貸", "管理", "契約"],
  email: ["メール", "gmail", "outlook", "送信", "一括", "転記", "問い合わせ"],
  data: ["分析", "データ", "グラフ", "パレート", "統計", "レポート", "seo", "順位", "可視化"],
};

// 技術キーワード → type マッチング
const TECH_KEYWORDS = {
  excel: ["excel", "エクセル", "vba", "マクロ", "関数", "スプレッドシート"],
  python: ["python", "パイソン", "api", "スクレイピング", "bot"],
};

/**
 * クライアントサイドの簡易マッチング（フォールバック用）
 */
function localRecommend(query) {
  const queryLower = query.toLowerCase();
  const scores = {};

  // キーワードマッチでカテゴリスコアを計算
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    scores[category] = 0;
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        scores[category] += 10;
      }
    }
  }

  // 技術キーワードマッチ（excel/pythonどちらを求めているか）
  let techPreference = null;
  for (const [tech, keywords] of Object.entries(TECH_KEYWORDS)) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        techPreference = tech;
        break;
      }
    }
  }

  // クエリ内の単語でプロジェクトのsummary/titleとマッチング
  const projectScores = PROJECTS.map((project) => {
    let score = scores[project.category] || 0;
    const text = `${project.title} ${project.summary} ${project.tags.join(" ")}`.toLowerCase();

    // 技術指定がマッチすればボーナス
    if (techPreference === "excel" && project.type === "excel") score += 8;
    if (techPreference === "python" && project.type === "python") score += 8;

    // クエリの各単語をチェック
    const words = queryLower.split(/[\s、,。.]+/).filter((w) => w.length > 1);
    for (const word of words) {
      if (text.includes(word)) score += 5;
    }

    // featured案件はボーナス
    if (project.featured) score += 2;

    return { project, score };
  });

  // スコア順にソートして上位5件を返す
  return projectScores
    .filter((ps) => ps.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((ps) => ({
      id: ps.project.id,
      title: ps.project.title,
      reason: `「${ps.project.summary}」が、お探しの内容に近いと思われます。`,
      matchScore: Math.min(Math.round((ps.score / 20) * 100), 98),
    }));
}

/**
 * Gemini APIに直接リクエスト
 */
async function callGeminiAPI(query) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    return { source: "local", recommendations: localRecommend(query) };
  }

  try {
    const response = await fetch(
      // バージョン直書きは提供終了で404になる（gemini-2.0-flashは停止済み）。-latestは現行世代に自動追従
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${AI_SYSTEM_PROMPT}\n\nユーザーの相談: ${query}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini API error");

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response");

    const parsed = JSON.parse(text);
    return { source: "gemini", recommendations: parsed.recommendations || [] };
  } catch (error) {
    console.warn("Gemini API failed, falling back to local:", error);
    return { source: "local", recommendations: localRecommend(query) };
  }
}

/**
 * AI推薦結果をレンダリング
 */
function renderRecommendations(results, query) {
  const container = document.getElementById("ai-results");
  if (!container) return;

  if (results.recommendations.length === 0) {
    container.innerHTML = `
      <div class="ai-bubble ai-message slide-in-result">
        <p class="text-gray-600">申し訳ありません。「${escapeHtml(query)}」に直接マッチする実績は見つかりませんでした。</p>
        <p class="text-gray-500 text-sm mt-2">お問い合わせいただければ、ご要望に合わせたカスタム開発のご提案が可能です。</p>
        <a href="#contact" class="inline-block mt-3 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg text-sm transition-colors">お問い合わせする</a>
      </div>
    `;
    return;
  }

  const sourceLabel =
    results.source === "gemini"
      ? '<span class="text-xs text-primary">✨ AIが分析しました</span>'
      : '<span class="text-xs text-gray-400">📋 キーワードで検索しました</span>';

  const cardsHtml = results.recommendations
    .map((rec, index) => {
      const project = PROJECTS.find((p) => p.id === rec.id);
      if (!project) return "";
      const cat = CATEGORIES[project.category] || CATEGORIES.other;

      return `
      <div class="slide-in-result bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/50 transition-all cursor-pointer"
           style="animation-delay: ${index * 100}ms"
           onclick="openProjectModal('${project.id}')">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${cat.icon}</span>
            <div>
              <h4 class="text-gray-800 font-bold text-sm">${project.title}</h4>
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: ${cat.color}22; color: ${cat.color}">${cat.label}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-primary font-bold text-lg">${rec.matchScore}%</div>
            <div class="text-gray-400 text-xs">マッチ度</div>
          </div>
        </div>
        <p class="text-gray-500 text-xs mb-2">${rec.reason}</p>
        <div class="flex items-center justify-between">
          <span class="text-primary text-sm font-bold">${project.estimatedPrice}</span>
          <span class="text-gray-400 text-xs">詳細を見る →</span>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="ai-bubble ai-message slide-in-result mb-4">
      <p class="text-gray-600 mb-2">「${escapeHtml(query)}」に関連する実績を${results.recommendations.length}件見つけました。</p>
      ${sourceLabel}
    </div>
    <div class="grid gap-3">
      ${cardsHtml}
    </div>
    <div class="mt-4 text-center">
      <p class="text-gray-400 text-xs mb-2">ぴったりのものが見つからない場合も、カスタム開発が可能です</p>
      <a href="#contact" class="inline-block bg-primary hover:bg-primary-light text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">
        お問い合わせする
      </a>
    </div>
  `;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * AI推薦を実行
 */
async function submitAIQuery() {
  const input = document.getElementById("ai-input");
  const resultsContainer = document.getElementById("ai-results");
  const submitBtn = document.getElementById("ai-submit-btn");
  if (!input || !resultsContainer) return;

  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }

  // ユーザーの入力を吹き出しで表示
  resultsContainer.innerHTML = `
    <div class="ai-bubble user-message slide-in-result mb-4">
      <p class="text-white text-sm">${escapeHtml(query)}</p>
    </div>
    <div class="ai-bubble ai-message">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <p class="text-gray-500 text-sm mt-2">分析中...</p>
    </div>
  `;

  // ボタンを無効化
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "分析中...";
  }

  try {
    const results = await callGeminiAPI(query);
    renderRecommendations(results, query);
  } catch (error) {
    resultsContainer.innerHTML = `
      <div class="ai-bubble ai-message slide-in-result">
        <p class="text-red-400">エラーが発生しました。もう一度お試しください。</p>
      </div>
    `;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-search mr-2"></i>検索する';
    }
  }
}

// イベントリスナー
document.addEventListener("DOMContentLoaded", () => {
  // 送信ボタン
  const submitBtn = document.getElementById("ai-submit-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitAIQuery);
  }

  // Enter送信（Shift+Enterは改行）
  const input = document.getElementById("ai-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitAIQuery();
      }
    });
  }

  // 例文ボタン（HTMLの data-text 属性を使用）
  document.querySelectorAll(".ai-example-btn[data-text]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (input) {
        input.value = btn.dataset.text || btn.textContent;
        input.focus();
      }
    });
  });
});
