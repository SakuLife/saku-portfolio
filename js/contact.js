/**
 * お問い合わせフォーム処理
 * mailto:リンクでメール送信（外部サービス不要）
 * Google Formに差し替える場合はフォームのaction属性を変更
 */

const CONTACT_EMAIL = "sktknsk5509@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // バリデーション
    const name = form.querySelector('[name="name"]')?.value.trim();
    const email = form.querySelector('[name="email"]')?.value.trim();
    const category = form.querySelector('[name="category"]')?.value || "未選択";
    const budget = form.querySelector('[name="budget"]')?.value || "未選択";
    const detail = form.querySelector('[name="detail"]')?.value.trim() || "";

    if (!name || !email) {
      showFormMessage("お名前とメールアドレスは必須です", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showFormMessage("正しいメールアドレスを入力してください", "error");
      return;
    }

    // メール本文を組み立て
    const subject = `【ポートフォリオ】${category} - ${name}様からのお問い合わせ`;
    const body = [
      `お名前: ${name}`,
      `メールアドレス: ${email}`,
      `依頼内容: ${category}`,
      `予算感: ${budget}`,
      ``,
      `--- 詳細 ---`,
      detail || "（記載なし）",
    ].join("\n");

    // mailto:リンクを開く
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");

    showFormMessage("メールアプリが開きます。送信ボタンを押してください。", "success");
  });
});

/**
 * メールアドレス検証
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * フォームメッセージ表示
 */
function showFormMessage(message, type) {
  const container = document.getElementById("form-message");
  if (!container) return;

  const bgColor = type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400";
  const icon = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";

  container.innerHTML = `
    <div class="${bgColor} border rounded-xl p-4 flex items-start gap-3 slide-in-result">
      <i class="fas ${icon} mt-0.5"></i>
      <p class="text-sm">${message}</p>
    </div>
  `;

  if (type === "success") {
    setTimeout(() => {
      container.innerHTML = "";
    }, 8000);
  }
}
