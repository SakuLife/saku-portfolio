/**
 * Cloudflare Worker - Gemini API プロキシ
 *
 * デプロイ手順:
 * 1. npm install -g wrangler
 * 2. wrangler login
 * 3. wrangler secret put GEMINI_API_KEY（APIキーを入力）
 * 4. wrangler deploy
 *
 * wrangler.toml の設定:
 * name = "saku-portfolio-ai"
 * main = "index.js"
 * compatibility_date = "2024-01-01"
 */

// プロジェクトカタログ（Geminiへの入力用）
const PROJECT_CATALOG = `
## 提供サービスカタログ

### YouTube自動化システム
1. 2chまとめ動画全自動生成（GPT-4/DALL-E/TTS/MoviePy）¥150,000〜
2. 漢字クイズ動画Bot（Gemini/VOICEVOX/YouTube API）¥150,000〜
3. 偉人名言AI動画（Claude/GPT-4/DALL-E/VOICEVOX）¥200,000〜
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
`;

const SYSTEM_PROMPT = `あなたは業務自動化の専門コンサルタントです。
ユーザーの相談内容に基づいて、以下のサービスカタログから最適なシステム・サービスを3〜5件推薦してください。

${PROJECT_CATALOG}

## 回答ルール
- 必ずJSON形式で回答してください
- 各推薦に対して、id（カタログ番号）、title、reason（なぜおすすめか・ユーザーの課題解決にどう役立つか）、matchScore（0-98の整数）を含めてください
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

// レート制限用のKVマップ（メモリ内・Worker再起動でリセット）
const rateLimitMap = new Map();

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/recommend" && request.method === "POST") {
      return handleRecommend(request, env);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function handleRecommend(request, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // レート制限（IP単位: 10回/分）
  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const rateKey = `rate:${clientIP}`;
  const rateData = rateLimitMap.get(rateKey) || { count: 0, resetAt: now + 60000 };

  if (now > rateData.resetAt) {
    rateData.count = 0;
    rateData.resetAt = now + 60000;
  }

  if (rateData.count >= 10) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait a minute." }),
      { status: 429, headers: corsHeaders }
    );
  }

  rateData.count++;
  rateLimitMap.set(rateKey, rateData);

  try {
    const body = await request.json();
    const query = body.query?.trim();

    if (!query || query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid query" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Gemini API呼び出し
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM_PROMPT}\n\nユーザーの相談: ${query}` }],
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

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error("Gemini API failed");
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), { headers: corsHeaders });
  } catch (error) {
    console.error("Handler error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
