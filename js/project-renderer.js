/**
 * プロジェクトカード描画・フィルター・モーダル機能
 */

// 表示状態管理
let currentCategory = "all";
let displayCount = 12;
const ITEMS_PER_LOAD = 12;

/**
 * プロジェクトカードのHTML生成
 */
function createProjectCard(project) {
  const cat = CATEGORIES[project.category] || CATEGORIES.other;
  const tagsHtml = project.tags
    .slice(0, 5)
    .map((tag) => `<span class="tech-tag">${tag}</span>`)
    .join("");
  const remainingTags =
    project.tags.length > 5
      ? `<span class="tech-tag">+${project.tags.length - 5}</span>`
      : "";

  const imageHtml = project.image
    ? `<img src="${project.image}" alt="${project.title}" class="w-full h-40 object-cover rounded-t-xl">`
    : `<div class="w-full h-40 rounded-t-xl flex items-center justify-center text-5xl" style="background: linear-gradient(135deg, ${cat.color}22, ${cat.color}44)">${cat.icon}</div>`;

  const typeLabel =
    project.type === "python"
      ? '<span class="absolute top-3 right-3 bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">Python</span>'
      : '<span class="absolute top-3 right-3 bg-green-600/80 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">Excel VBA</span>';

  const featuredBadge = project.featured
    ? '<span class="absolute top-3 left-3 bg-yellow-500/90 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">詳細あり</span>'
    : "";

  return `
    <div class="project-card bg-navy-800 border border-navy-700 rounded-xl overflow-hidden cursor-pointer hover:border-accent/50 transition-all duration-300"
         data-project-id="${project.id}"
         onclick="openProjectModal('${project.id}')">
      <div class="relative">
        ${imageHtml}
        ${typeLabel}
        ${featuredBadge}
      </div>
      <div class="p-5">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs px-2 py-0.5 rounded-full" style="background: ${cat.color}22; color: ${cat.color}">${cat.label}</span>
        </div>
        <h3 class="text-white font-bold text-sm mb-2 line-clamp-2">${project.title}</h3>
        <p class="text-gray-400 text-xs mb-3 line-clamp-2">${project.summary}</p>
        <div class="flex flex-wrap gap-1 mb-3">
          ${tagsHtml}${remainingTags}
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-navy-700">
          <span class="text-accent font-bold text-sm">${project.estimatedPrice}</span>
          <span class="text-gray-500 text-xs">${project.priceNote || ""}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * プロジェクトをフィルター・描画
 */
function filterProjects(category) {
  currentCategory = category;
  displayCount = ITEMS_PER_LOAD;
  renderProjects();

  // アクティブタブ更新
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === category);
  });
}

/**
 * プロジェクトグリッドを描画
 */
function renderProjects() {
  const grid = document.getElementById("project-grid");
  const loadMoreBtn = document.getElementById("load-more-btn");
  if (!grid) return;

  // フィルタリング
  const filtered =
    currentCategory === "all"
      ? PROJECTS
      : PROJECTS.filter((p) => p.category === currentCategory);

  // 表示件数制限
  const visible = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  // 描画
  grid.innerHTML = visible.map((p) => createProjectCard(p)).join("");

  // もっと見るボタン
  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? "inline-flex" : "none";
    loadMoreBtn.textContent = `もっと見る（残り${filtered.length - displayCount}件）`;
  }

  // カウント表示
  const countEl = document.getElementById("project-count");
  if (countEl) {
    countEl.textContent = `${filtered.length}件`;
  }
}

/**
 * もっと見る
 */
function loadMoreProjects() {
  displayCount += ITEMS_PER_LOAD;
  renderProjects();
}

/**
 * プロジェクト詳細モーダルを開く
 */
function openProjectModal(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) return;

  const cat = CATEGORIES[project.category] || CATEGORIES.other;
  const tagsHtml = project.tags
    .map((tag) => `<span class="tech-tag">${tag}</span>`)
    .join("");

  const detailHtml = project.detail
    ? `<div class="mb-6">
        <h4 class="text-white font-bold mb-2">詳細説明</h4>
        <p class="text-gray-300 text-sm leading-relaxed">${project.detail}</p>
       </div>`
    : `<div class="mb-6 p-4 rounded-lg bg-navy-900/50 border border-navy-700">
        <p class="text-gray-400 text-sm">詳細説明はお問い合わせください。類似のシステム開発もご相談可能です。</p>
       </div>`;

  const imageHtml = project.image
    ? `<img src="${project.image}" alt="${project.title}" class="w-full h-56 object-cover rounded-xl mb-6">`
    : `<div class="w-full h-56 rounded-xl mb-6 flex items-center justify-center text-7xl" style="background: linear-gradient(135deg, ${cat.color}22, ${cat.color}44)">${cat.icon}</div>`;

  const modal = document.getElementById("project-modal");
  const content = document.getElementById("modal-content");

  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="text-sm px-3 py-1 rounded-full" style="background: ${cat.color}22; color: ${cat.color}">${cat.label}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${project.type === "python" ? "bg-blue-600/80" : "bg-green-600/80"} text-white">
          ${project.type === "python" ? "Python" : "Excel VBA"}
        </span>
      </div>
      <button onclick="closeProjectModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
    </div>
    <h2 class="text-white text-xl font-bold mb-4">${project.title}</h2>
    ${imageHtml}
    <p class="text-gray-300 mb-4">${project.summary}</p>
    ${detailHtml}
    <div class="mb-6">
      <h4 class="text-white font-bold mb-2">使用技術</h4>
      <div class="flex flex-wrap gap-2">${tagsHtml}</div>
    </div>
    <div class="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-accent/30">
      <div>
        <p class="text-gray-400 text-xs">開発目安金額</p>
        <p class="text-accent font-bold text-xl">${project.estimatedPrice}</p>
        <p class="text-gray-500 text-xs">${project.priceNote || ""}</p>
      </div>
      <a href="#contact" onclick="closeProjectModal()" class="bg-accent hover:bg-accent/80 text-white px-6 py-3 rounded-xl font-bold transition-colors">
        相談する
      </a>
    </div>
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

/**
 * モーダルを閉じる
 */
function closeProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

// 初期描画
document.addEventListener("DOMContentLoaded", () => {
  renderProjects();

  // もっと見るボタン
  const loadMoreBtn = document.getElementById("load-more-btn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", loadMoreProjects);
  }

  // モーダル外クリックで閉じる
  const modal = document.getElementById("project-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeProjectModal();
    });
  }

  // ESCキーでモーダルを閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProjectModal();
  });
});
