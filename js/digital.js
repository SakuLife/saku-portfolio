/* digital.js ─ 営業サイトの動き（2026-11-03 作り直し）。中身の文字は触らない＝見た目と動きだけ。
   - ヒーローの点と線（canvas）・最初の登場（GSAP）・数字のカウント・小さな端末の打鍵
   - 読み進みバー・ヘッダーの影・カードのカーソルの光・カードの順番の出方（ScrollTrigger）
   GSAP が読めない／動きを控える設定の時は、全部そのまま表示する。 */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap && !reduce) document.documentElement.classList.add('js-motion');

  // ---------- 読み進みバー・ヘッダー ----------
  const bar = document.getElementById('scroll-bar');
  const header = document.getElementById('header');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    if (header) header.classList.toggle('is-scrolled', scrollY > 40);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- カードのカーソルの光 ----------
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.card-hover');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // ---------- ヒーローの点と線（データが流れる網）----------
  const cv = document.getElementById('hx-net');
  if (cv && cv.getContext) {
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, pts = [], raf = 0, visible = true;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        gold: Math.random() < .12,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < 130 * 130) {
            ctx.strokeStyle = `rgba(94,230,160,${(1 - Math.sqrt(d) / 130) * .22})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < 170) {
          ctx.strokeStyle = `rgba(245,200,100,${(1 - md / 170) * .45})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = a.gold ? 'rgba(245,200,100,.85)' : 'rgba(94,230,160,.75)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.gold ? 1.8 : 1.4, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); draw(); });
    cv.parentElement.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    cv.parentElement.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    // 画面の外に出たら止める（電池と CPU を食わない）
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting; cancelAnimationFrame(raf); if (visible) draw();
    }).observe(cv);
  }

  // ---------- 小さな端末の打鍵（飾り・aria-hidden）----------
  const typeEl = document.getElementById('hx-type');
  if (typeEl) {
    const lines = ['excel --auto-sum', 'ai.write("note")', 'reserve.sync()', 'shift.build()', 'invoice --pdf --send'];
    let li = 0, ci = 0, del = false;
    const tick = () => {
      const s = lines[li];
      if (reduce) { typeEl.textContent = s; return; }
      typeEl.textContent = s.slice(0, ci);
      if (!del && ci < s.length) { ci++; setTimeout(tick, 70); }
      else if (!del) { del = true; setTimeout(tick, 1500); }
      else if (ci > 0) { ci--; setTimeout(tick, 28); }
      else { del = false; li = (li + 1) % lines.length; setTimeout(tick, 350); }
    };
    tick();
  }

  if (!hasGsap || reduce) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // ---------- ヒーローの登場 ----------
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('.hx-avatar-wrap', { opacity: 1, scale: 1, duration: 1.1 }, 0)
    .to('[data-hx]', { opacity: 1, y: 0, duration: .8, stagger: .09 }, .1)
    .from('.hx-tag', { opacity: 0, y: 10, duration: .5, stagger: .12 }, .7)
    .from('.hx-term', { opacity: 0, y: 16, duration: .6 }, .9);

  // 数字のカウント（最後は元の数字ぴったり）
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), o = { v: 0 };
    tl.to(o, { v: end, duration: 1.4, ease: 'power2.out',
      onUpdate: () => { el.textContent = o.v.toFixed(dec); },
      onComplete: () => { el.textContent = el.dataset.count; } }, .5);
  });

  // キャラがマウスの方へ少し傾く
  const av = document.querySelector('[data-hx-avatar]');
  if (av && matchMedia('(pointer: fine)').matches) {
    const qx = gsap.quickTo(av, 'rotationY', { duration: .8, ease: 'power3' });
    const qy = gsap.quickTo(av, 'rotationX', { duration: .8, ease: 'power3' });
    gsap.set(av, { transformPerspective: 900 });
    document.querySelector('.hx').addEventListener('pointermove', (e) => {
      qx((e.clientX / innerWidth - .5) * 12); qy(-(e.clientY / innerHeight - .5) * 10);
    });
  }
  // スクロールでヒーローの中身がゆっくり上へ
  gsap.to('.hx-avatar-wrap', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hx', start: 'top top', end: 'bottom top', scrub: true } });

  // ---------- 節ごとのカードを順番に出す ----------
  // （節そのものの出方は index.html の .fade-in-section のまま。カードは中身が JS で入るので少し待ってから）
  requestAnimationFrame(() => setTimeout(() => {
    const groups = ['#industry-grid', '#sample-grid', '#shop-grid', '#lineup-grid', '#link-grid', '#made .grid', '#works .grid', '#pricing .grid', '#services .grid', '#flow .grid'];
    groups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((g) => {
        const items = Array.from(g.children);
        if (!items.length) return;
        gsap.from(items, {
          opacity: 0, y: 26, duration: .7, ease: 'power3.out', stagger: .07,
          scrollTrigger: { trigger: g, start: 'top 85%', once: true },
          clearProps: 'opacity,transform',
        });
      });
    });
    ScrollTrigger.refresh();
  }, 60));
})();
