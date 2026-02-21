/**
 * メイン: ナビゲーション・アニメーション・カウンター
 */

document.addEventListener("DOMContentLoaded", () => {
  initScrollAnimations();
  initCounterAnimations();
  initSmoothScroll();
  initHeaderScroll();
  initMobileMenu();
});

/**
 * スクロール連動フェードインアニメーション
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );

  document.querySelectorAll(".fade-in-up").forEach((el) => {
    observer.observe(el);
  });
}

/**
 * 数字カウントアップアニメーション
 */
function initCounterAnimations() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((counter) => observer.observe(counter));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || "";
  const duration = 2000;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // イージング（ease-out）
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    el.textContent = current + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * スムーズスクロール（ナビリンク）
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      const headerHeight = document.querySelector("header")?.offsetHeight || 80;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - headerHeight;

      window.scrollTo({ top: targetPos, behavior: "smooth" });

      // モバイルメニューを閉じる
      closeMobileMenu();
    });
  });
}

/**
 * ヘッダーのスクロール時シャドウ
 */
function initHeaderScroll() {
  const header = document.querySelector("header");
  if (!header) return;

  let lastScroll = 0;

  window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;

    if (currentScroll > 50) {
      header.classList.add("shadow-lg", "shadow-black/20");
      header.style.backdropFilter = "blur(12px)";
    } else {
      header.classList.remove("shadow-lg", "shadow-black/20");
      header.style.backdropFilter = "blur(8px)";
    }

    lastScroll = currentScroll;
  });
}

/**
 * モバイルメニュー
 */
function initMobileMenu() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const menu = document.getElementById("mobile-menu");
  const overlay = document.getElementById("mobile-menu-overlay");

  if (!menuBtn || !menu) return;

  menuBtn.addEventListener("click", () => {
    const isOpen = menu.classList.contains("active");
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  if (overlay) {
    overlay.addEventListener("click", closeMobileMenu);
  }
}

function openMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const overlay = document.getElementById("mobile-menu-overlay");
  const btn = document.getElementById("mobile-menu-btn");

  if (menu) menu.classList.add("active");
  if (overlay) overlay.classList.add("active");
  if (btn) btn.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const overlay = document.getElementById("mobile-menu-overlay");
  const btn = document.getElementById("mobile-menu-btn");

  if (menu) menu.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  if (btn) btn.classList.remove("active");
  document.body.style.overflow = "";
}
