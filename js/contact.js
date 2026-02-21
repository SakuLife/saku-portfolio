/**
 * お問い合わせフォーム処理
 * Web3Forms（無料・無制限）を使用
 */

const CONTACT_EMAIL = "sktknsk5509@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    // バリデーション
    const name = form.querySelector('[name="name"]')?.value.trim();
    const email = form.querySelector('[name="email"]')?.value.trim();
    const category = form.querySelector('[name="category"]')?.value;
    const budget = form.querySelector('[name="budget"]')?.value;
    const message = form.querySelector('[name="detail"]')?.value.trim();

    if (!name || !email) {
      showFormMessage("必須項目を入力してください", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showFormMessage("正しいメールアドレスを入力してください", "error");
      return;
    }

    // 送信中
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...';

    try {
      // Web3Forms APIを使用（無料プラン）
      // アクセスキーは https://web3forms.com/ で取得
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: form.dataset.formKey || "YOUR_WEB3FORMS_KEY",
          name: name,
          email: email,
          subject: `【ポートフォリオ】${category || "その他"} - ${name}様からのお問い合わせ`,
          message: `【依頼内容】${category || "未選択"}\n【予算感】${budget || "未選択"}\n\n${message}`,
          from_name: "Saku Portfolio",
          to: CONTACT_EMAIL,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showFormMessage("送信完了しました！2〜3営業日以内にご返信いたします。", "success");
        form.reset();
      } else {
        throw new Error(data.message || "送信に失敗しました");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      // フォールバック: mailto リンク
      showFormMessage(
        `自動送信に失敗しました。<a href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`お問い合わせ: ${category}`)}&body=${encodeURIComponent(`名前: ${name}\nメール: ${email}\n予算: ${budget}\n\n${message}`)}" class="underline text-accent">こちらから直接メール</a>でお問い合わせください。`,
        "error"
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
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

  // 成功メッセージは5秒後に消す
  if (type === "success") {
    setTimeout(() => {
      container.innerHTML = "";
    }, 5000);
  }
}
