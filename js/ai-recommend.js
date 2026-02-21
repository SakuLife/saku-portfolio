/**
 * Gemini AI推薦機能
 * Cloudflare Worker経由でGemini APIにリクエスト
 */

// Cloudflare WorkerのURL（デプロイ後に設定）
const AI_API_URL = "YOUR_CLOUDFLARE_WORKER_URL";

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
  python: ["python", "パイソン", "自動化", "api", "スクレイピング", "bot"],
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
 * Gemini APIにリクエスト（Cloudflare Worker経由）
 */
async function callGeminiAPI(query) {
  if (AI_API_URL === "YOUR_CLOUDFLARE_WORKER_URL") {
    // Worker未設定時はローカルマッチングにフォールバック
    return { source: "local", recommendations: localRecommend(query) };
  }

  try {
    const response = await fetch(`${AI_API_URL}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    return { source: "gemini", recommendations: data.recommendations };
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
        <p class="text-gray-300">申し訳ありません。「${escapeHtml(query)}」に直接マッチする実績は見つかりませんでした。</p>
        <p class="text-gray-400 text-sm mt-2">お問い合わせいただければ、ご要望に合わせたカスタム開発のご提案が可能です。</p>
        <a href="#contact" class="inline-block mt-3 bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-lg text-sm transition-colors">お問い合わせする</a>
      </div>
    `;
    return;
  }

  const sourceLabel =
    results.source === "gemini"
      ? '<span class="text-xs text-accent">✨ Gemini AIが分析しました</span>'
      : '<span class="text-xs text-gray-500">📋 キーワードマッチングの結果です</span>';

  const cardsHtml = results.recommendations
    .map((rec, index) => {
      const project = PROJECTS.find((p) => p.id === rec.id);
      if (!project) return "";
      const cat = CATEGORIES[project.category] || CATEGORIES.other;

      return `
      <div class="slide-in-result bg-navy-800 border border-navy-700 rounded-xl p-4 hover:border-accent/50 transition-all cursor-pointer"
           style="animation-delay: ${index * 100}ms"
           onclick="openProjectModal('${project.id}')">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${cat.icon}</span>
            <div>
              <h4 class="text-white font-bold text-sm">${project.title}</h4>
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: ${cat.color}22; color: ${cat.color}">${cat.label}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-accent font-bold text-lg">${rec.matchScore}%</div>
            <div class="text-gray-500 text-xs">マッチ度</div>
          </div>
        </div>
        <p class="text-gray-400 text-xs mb-2">${rec.reason}</p>
        <div class="flex items-center justify-between">
          <span class="text-accent text-sm font-bold">${project.estimatedPrice}</span>
          <span class="text-gray-500 text-xs">詳細を見る →</span>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = `
    <div class="ai-bubble ai-message slide-in-result mb-4">
      <p class="text-gray-300 mb-2">「${escapeHtml(query)}」に関連する実績を${results.recommendations.length}件見つけました。</p>
      ${sourceLabel}
    </div>
    <div class="grid gap-3">
      ${cardsHtml}
    </div>
    <div class="mt-4 text-center">
      <p class="text-gray-500 text-xs mb-2">ぴったりのものが見つからない場合も、カスタム開発が可能です</p>
      <a href="#contact" class="inline-block bg-accent hover:bg-accent/80 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">
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
      <p class="text-gray-400 text-sm mt-2">分析中...</p>
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
      submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>AIに提案してもらう';
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
