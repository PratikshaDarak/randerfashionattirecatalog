/**
 * Neha Rander's Fashion Attire — Impeccable Digital Lookbook
 * Features:
 * - Auto Daylight/Evening theme synced to India Standard Time (Asia/Kolkata)
 * - Manual override cycle (Auto IST -> Daylight -> Evening)
 * - Multi-select Category Dropdown & All Collections filter
 * - Filmstrip Gallery Lightbox with 2x brushwork zoom & Style Code copy
 * - Zero ordering, cart, or size clutter
 */
(function () {
  "use strict";

  const CONFIG = window.RANDER_CATALOG_CONFIG || {};
  let DATA = window.RANDER_CATALOG_DATA || { categories: [], products: [], heroProductIds: [] };

  const THEME_STORAGE_KEY = "rander_theme_pref";

  const SVG_ICONS = {
    sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>',
    moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    autoSun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"></path></svg>',
    autoMoon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  };

  const state = {
    selectedSlugs: new Set(), // empty Set = All Collections
    dropdownOpen: false,
    searchQuery: "",
    themePref: loadThemePref(), // "auto" | "light" | "dark"
    lightboxItems: [],
    lightboxIndex: -1,
    isZoomed: false,
  };

  const el = {
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIcon: document.getElementById("themeIcon"),
    themeModeLabel: document.getElementById("themeModeLabel"),
    istClock: document.getElementById("istClock"),
    leadStatement: document.getElementById("leadStatement"),
    campaignTriptych: document.getElementById("campaignTriptych"),
    runwayStrip: document.getElementById("runwayStrip"),
    categoryDropdown: document.getElementById("categoryDropdown"),
    catDropdownBtn: document.getElementById("catDropdownBtn"),
    catDropdownLabel: document.getElementById("catDropdownLabel"),
    catDropdownMenu: document.getElementById("catDropdownMenu"),
    catDropdownList: document.getElementById("catDropdownList"),
    catResetBtn: document.getElementById("catResetBtn"),
    catDoneBtn: document.getElementById("catDoneBtn"),
    clearCatsInlineBtn: document.getElementById("clearCatsInlineBtn"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    showingCount: document.getElementById("showingCount"),
    catalogContainer: document.getElementById("catalogContainer"),
    footerYear: document.getElementById("footerYear"),
    lightboxBackdrop: document.getElementById("lightboxBackdrop"),
    lightboxStage: document.getElementById("lightboxStage"),
    lightboxImg: document.getElementById("lightboxImg"),
    lightboxCat: document.getElementById("lightboxCat"),
    lightboxCode: document.getElementById("lightboxCode"),
    lightboxCounter: document.getElementById("lightboxCounter"),
    lightboxFilmstrip: document.getElementById("lightboxFilmstrip"),
    lbCopyCodeBtn: document.getElementById("lbCopyCodeBtn"),
    lbShareLookBtn: document.getElementById("lbShareLookBtn"),
    lightboxClose: document.getElementById("lightboxClose"),
    lightboxPrev: document.getElementById("lightboxPrev"),
    lightboxNext: document.getElementById("lightboxNext"),
    backToTop: document.getElementById("backToTop"),
    toast: document.getElementById("toast"),
  };

  /* ------------------------------------------------------------------------
     IST (Asia/Kolkata) Automatic Light / Dark Theme Engine
     Daylight Atelier: 06:00 – 18:29 IST
     Evening Gallery:  18:30 – 05:59 IST
     ------------------------------------------------------------------------ */
  function loadThemePref() {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      return v === "light" || v === "dark" ? v : "auto";
    } catch {
      return "auto";
    }
  }

  function saveThemePref(pref) {
    try {
      if (pref === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // Ignore storage errors in sandboxed iframes
    }
  }

  function getCurrentIST() {
    const now = new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const hour = Number(parts.find((p) => p.type === "hour").value);
      const minute = Number(parts.find((p) => p.type === "minute").value);
      return { hour, minute, totalMins: hour * 60 + minute };
    } catch {
      const totalMins = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
      return { hour: Math.floor(totalMins / 60), minute: totalMins % 60, totalMins };
    }
  }

  function formatIST12h(hour, minute) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${String(minute).padStart(2, "0")} ${suffix} IST`;
  }

  function resolveISTTheme(ist) {
    const sched = CONFIG.istSchedule || {};
    const dayStart = (sched.dayStartHour ?? 6) * 60 + (sched.dayStartMinute ?? 0);
    const nightStart = (sched.nightStartHour ?? 18) * 60 + (sched.nightStartMinute ?? 30);
    return ist.totalMins >= dayStart && ist.totalMins < nightStart ? "light" : "dark";
  }

  function applyTheme(announce) {
    const ist = getCurrentIST();
    const istTheme = resolveISTTheme(ist);
    const resolved = state.themePref === "auto" ? istTheme : state.themePref;

    document.documentElement.setAttribute("data-theme", resolved);

    if (el.istClock) {
      el.istClock.textContent = formatIST12h(ist.hour, ist.minute);
    }

    if (el.themeIcon && el.themeModeLabel) {
      if (state.themePref === "auto") {
        el.themeIcon.innerHTML = resolved === "light" ? SVG_ICONS.autoSun : SVG_ICONS.autoMoon;
        el.themeModeLabel.textContent = resolved === "light" ? "Auto · Day" : "Auto · Night";
      } else if (state.themePref === "light") {
        el.themeIcon.innerHTML = SVG_ICONS.sun;
        el.themeModeLabel.textContent = "Daylight";
      } else {
        el.themeIcon.innerHTML = SVG_ICONS.moon;
        el.themeModeLabel.textContent = "Evening";
      }
    }

    if (announce) {
      const msg =
        state.themePref === "auto"
          ? `Theme synced to IST (${resolved === "light" ? "Daylight Atelier" : "Evening Gallery"})`
          : state.themePref === "light"
          ? "Switched to Daylight Atelier theme"
          : "Switched to Evening Gallery theme";
      showToast(msg);
    }
  }

  function cycleThemePref() {
    const order = ["auto", "light", "dark"];
    const nextIdx = (order.indexOf(state.themePref) + 1) % order.length;
    state.themePref = order[nextIdx];
    saveThemePref(state.themePref);
    applyTheme(true);
  }

  let istTimer = null;
  function startISTClockSync() {
    applyTheme(false);
    const tick = () => {
      if (!document.hidden) applyTheme(false);
    };
    istTimer = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) applyTheme(false);
    });
  }

  /* ------------------------------------------------------------------------
     Image Resolution & Sandboxed Preview Fallback
     ------------------------------------------------------------------------ */
  const IS_SANDBOXED =
    window.location.protocol === "about:" ||
    window.location.protocol === "blob:" ||
    window.location.protocol === "data:" ||
    window.location.origin === "null";

  function getEmbeddedThumb(productId) {
    return (
      (productId &&
        window.RANDER_EMBEDDED_THUMBS &&
        window.RANDER_EMBEDDED_THUMBS[productId]) ||
      ""
    );
  }

  function resolveImgSrc(productId, url) {
    if (IS_SANDBOXED) {
      const embedded = getEmbeddedThumb(productId);
      if (embedded) return embedded;
    }
    return url;
  }

  function installImageFallback() {
    document.addEventListener(
      "error",
      (e) => {
        const img = e.target;
        if (!img || img.tagName !== "IMG" || img.dataset.fallbackApplied === "1") return;
        const fallback = getEmbeddedThumb(img.dataset.fallbackId);
        if (fallback && img.src !== fallback) {
          img.dataset.fallbackApplied = "1";
          img.src = fallback;
        }
      },
      true
    );
  }

  /* ------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */
  let toastTimer = null;
  function showToast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 2400);
  }

  function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(msg)).catch(() => fallbackCopy(text, msg));
    } else {
      fallbackCopy(text, msg);
    }
  }

  function fallbackCopy(text, msg) {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
      showToast(msg);
    } catch {
      showToast("Copy unavailable in this browser.");
    }
    document.body.removeChild(t);
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCategoryGroups() {
    const bySlug = new Map();
    DATA.categories.forEach((cat) => bySlug.set(cat.slug, { ...cat, items: [] }));
    DATA.products.forEach((p) => {
      const g = bySlug.get(p.categorySlug);
      if (g) g.items.push(p);
    });
    const groups = Array.from(bySlug.values()).filter((g) => g.items.length > 0);
    groups.forEach((g) => g.items.sort((a, b) => a.code.localeCompare(b.code)));
    return groups;
  }

  /* ------------------------------------------------------------------------
     Render Sections
     ------------------------------------------------------------------------ */
  function hydrateChrome() {
    if (CONFIG.leadStatement && el.leadStatement) el.leadStatement.textContent = CONFIG.leadStatement;
    if (el.footerYear) el.footerYear.textContent = new Date().getFullYear();
  }

  function renderCampaignTriptych(groups) {
    if (!el.campaignTriptych) return;
    const allItems = groups.flatMap((g) => g.items);
    const picks = (DATA.heroProductIds || [])
      .map((id) => allItems.find((p) => p.id === id))
      .filter(Boolean);
    const display = picks.length >= 3 ? picks.slice(0, 3) : allItems.slice(0, 3);

    el.campaignTriptych.innerHTML = "";
    display.forEach((item, idx) => {
      const fig = document.createElement("figure");
      fig.className = idx === 0 ? "campaign-plate campaign-plate-lead" : "campaign-plate";
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", `Inspect ${item.category} ${item.code}`);
      fig.innerHTML = `
        <div class="campaign-inner">
          <img
            src="${resolveImgSrc(item.id, item.thumb)}"
            data-fallback-id="${item.id}"
            alt="${esc(item.category)} ${esc(item.code)}"
            loading="${idx === 0 ? "eager" : "lazy"}"
            decoding="async"
          />
          <figcaption class="plate-caption">
            <span class="plate-cat">${esc(item.category)}</span>
            <span class="plate-code">${esc(item.code)}</span>
          </figcaption>
        </div>
      `;
      const open = () => {
        const group = groups.find((g) => g.slug === item.categorySlug);
        const list = group ? group.items : allItems;
        const pos = Math.max(0, list.findIndex((p) => p.id === item.id));
        openLightbox(list, pos);
      };
      fig.addEventListener("click", open);
      fig.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
      el.campaignTriptych.appendChild(fig);
    });
  }

  function renderRunwayStrip(groups) {
    if (!el.runwayStrip) return;
    el.runwayStrip.innerHTML = "";
    groups.forEach((g) => {
      const coverItem = g.items.find((p) => p.thumb === g.cover) || g.items[0];
      const isSelected = state.selectedSlugs.has(g.slug);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `runway-item${isSelected ? " active" : ""}`;
      btn.setAttribute("role", "listitem");
      btn.innerHTML = `
        <div class="runway-frame">
          <img
            src="${resolveImgSrc(coverItem.id, coverItem.thumb)}"
            data-fallback-id="${coverItem.id}"
            alt="${esc(g.name)}"
            loading="lazy"
            decoding="async"
          />
        </div>
        <span class="runway-name">${esc(g.name)}</span>
        <span class="runway-count">${g.items.length} ${g.items.length === 1 ? "look" : "looks"}</span>
      `;
      btn.addEventListener("click", () => selectSingleCategory(g.slug, true));
      el.runwayStrip.appendChild(btn);
    });
  }

  function setDropdownOpen(open) {
    if (!el.categoryDropdown || !el.catDropdownMenu || !el.catDropdownBtn) return;
    state.dropdownOpen = Boolean(open);
    el.categoryDropdown.classList.toggle("open", state.dropdownOpen);
    el.catDropdownMenu.hidden = !state.dropdownOpen;
    el.catDropdownBtn.setAttribute("aria-expanded", String(state.dropdownOpen));
  }

  function syncClearAllBtn() {
    if (!el.clearCatsInlineBtn) return;
    const hasFilters = state.selectedSlugs.size > 0 || state.searchQuery.trim().length > 0;
    el.clearCatsInlineBtn.disabled = !hasFilters;
  }

  function renderCategoryDropdown(groups) {
    if (!el.catDropdownList || !el.catDropdownLabel) return;
    const total = groups.reduce((s, g) => s + g.items.length, 0);
    const isAll = state.selectedSlugs.size === 0;

    if (isAll) {
      el.catDropdownLabel.textContent = `All Collections (${total})`;
    } else {
      const chosen = groups.filter((g) => state.selectedSlugs.has(g.slug));
      const chosenCount = chosen.reduce((s, g) => s + g.items.length, 0);
      if (chosen.length === 1) {
        el.catDropdownLabel.textContent = `${chosen[0].name} (${chosenCount})`;
      } else if (chosen.length === 2) {
        el.catDropdownLabel.textContent = `${chosen[0].name}, ${chosen[1].name} (${chosenCount})`;
      } else {
        el.catDropdownLabel.textContent = `${chosen.length} Collections (${chosenCount})`;
      }
    }

    syncClearAllBtn();

    el.catDropdownList.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "cat-option is-all";
    allBtn.setAttribute("role", "option");
    allBtn.setAttribute("aria-selected", String(isAll));
    allBtn.dataset.slug = "all";
    allBtn.innerHTML = `
      <span class="cat-option-left">
        <span class="cat-checkbox">${isAll ? SVG_ICONS.check : ""}</span>
        <span class="cat-option-name">All Collections</span>
      </span>
      <span class="cat-option-count">${total}</span>
    `;
    allBtn.addEventListener("click", () => selectAllCategories(false));
    el.catDropdownList.appendChild(allBtn);

    groups.forEach((g) => {
      const checked = state.selectedSlugs.has(g.slug);
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "cat-option";
      opt.setAttribute("role", "option");
      opt.setAttribute("aria-selected", String(checked));
      opt.dataset.slug = g.slug;
      opt.innerHTML = `
        <span class="cat-option-left">
          <span class="cat-checkbox">${checked ? SVG_ICONS.check : ""}</span>
          <span class="cat-option-name">${esc(g.name)}</span>
        </span>
        <span class="cat-option-count">${g.items.length}</span>
      `;
      opt.addEventListener("click", () => toggleCategorySlug(g.slug));
      el.catDropdownList.appendChild(opt);
    });
  }

  function renderCatalogChapters(groups) {
    const q = state.searchQuery.trim().toLowerCase();

    const visibleGroups = groups
      .filter((g) => state.selectedSlugs.size === 0 || state.selectedSlugs.has(g.slug))
      .map((g) => {
        const items = q
          ? g.items.filter((item) =>
              `${item.code} ${item.category} ${item.title || ""}`.toLowerCase().includes(q)
            )
          : g.items;
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);

    const shownTotal = visibleGroups.reduce((s, g) => s + g.items.length, 0);
    el.showingCount.textContent = `${shownTotal} ${shownTotal === 1 ? "look" : "looks"}`;

    el.catalogContainer.innerHTML = "";
    if (!visibleGroups.length) {
      el.catalogContainer.innerHTML = `
        <div class="empty-state">
          <p>No looks match "${esc(state.searchQuery.trim())}". Try another category name or style code.</p>
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();

    visibleGroups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "category-chapter";
      section.id = `line-${group.slug}`;

      const head = document.createElement("div");
      head.className = "chapter-head";
      head.innerHTML = `
        <h2 class="chapter-title">${esc(group.name)}</h2>
        <span class="chapter-count">${group.items.length} ${group.items.length === 1 ? "Look" : "Looks"}</span>
      `;
      section.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "look-grid mode-lookbook";

      group.items.forEach((item, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const isLeadSpread = idx === 0 && group.items.length >= 4;

        const card = document.createElement("article");
        card.className = `look-card${isLeadSpread ? " lead-spread" : ""}`;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Inspect ${group.name} ${item.code}`);

        card.innerHTML = `
          <div class="look-frame">
            <img
              src="${resolveImgSrc(item.id, item.thumb)}"
              data-fallback-id="${item.id}"
              alt="${esc(group.name)} — Look ${num}"
              loading="lazy"
              decoding="async"
            />
            <div class="look-reveal-bar">Inspect Brushwork</div>
          </div>
          <div class="look-meta">
            <div class="look-meta-text">
              <div class="look-cat-title">${esc(group.name)}</div>
              <div class="look-code">${esc(item.code)}</div>
            </div>
            <button type="button" class="copy-code-btn" data-copy-code="${esc(item.code)}" title="Copy style code">
              Copy
            </button>
          </div>
        `;

        card.addEventListener("click", (e) => {
          const copyBtn = e.target.closest("[data-copy-code]");
          if (copyBtn) {
            e.stopPropagation();
            copyText(copyBtn.dataset.copyCode, `Copied style code ${copyBtn.dataset.copyCode}`);
            return;
          }
          openLightbox(group.items, idx);
        });
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLightbox(group.items, idx);
          }
        });

        grid.appendChild(card);
      });

      section.appendChild(grid);
      frag.appendChild(section);
    });

    el.catalogContainer.appendChild(frag);
  }

  function renderAll() {
    const groups = getCategoryGroups();
    hydrateChrome(groups);
    renderCampaignTriptych(groups);
    renderRunwayStrip(groups);
    renderCategoryDropdown(groups);
    renderCatalogChapters(groups);
  }

  function syncUrlHash() {
    if (IS_SANDBOXED) return;
    try {
      const slugs = Array.from(state.selectedSlugs);
      const nextHash = slugs.length ? `#cat=${slugs.map(encodeURIComponent).join(",")}` : "";
      history.replaceState(null, "", window.location.pathname + window.location.search + nextHash);
    } catch {
      // Ignore SecurityError in sandboxed or restricted history contexts
    }
  }

  function refreshFilteredViews(groups) {
    renderRunwayStrip(groups);
    renderCategoryDropdown(groups);
    renderCatalogChapters(groups);
  }

  function toggleCategorySlug(slug) {
    const groups = getCategoryGroups();
    if (state.selectedSlugs.has(slug)) {
      state.selectedSlugs.delete(slug);
    } else {
      state.selectedSlugs.add(slug);
    }
    if (groups.length > 0 && state.selectedSlugs.size >= groups.length) {
      state.selectedSlugs.clear();
    }
    syncUrlHash();
    refreshFilteredViews(groups);
  }

  function selectAllCategories(shouldScroll) {
    state.selectedSlugs.clear();
    syncUrlHash();
    refreshFilteredViews(getCategoryGroups());
    if (shouldScroll) {
      const target = document.getElementById("lookbook");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function selectSingleCategory(slug, shouldScroll) {
    setDropdownOpen(false);
    state.selectedSlugs = new Set([slug]);
    syncUrlHash();
    refreshFilteredViews(getCategoryGroups());
    if (shouldScroll) {
      const target = document.getElementById(`line-${slug}`) || document.getElementById("lookbook");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  /* ------------------------------------------------------------------------
     Gallery Filmstrip Lightbox
     ------------------------------------------------------------------------ */
  function openLightbox(items, idx) {
    state.lightboxItems = items;
    state.lightboxIndex = idx;
    renderFilmstrip();
    showLightboxItem();
    el.lightboxBackdrop.hidden = false;
    requestAnimationFrame(() => el.lightboxBackdrop.classList.add("open"));
    document.body.style.overflow = "hidden";
  }

  function renderFilmstrip() {
    el.lightboxFilmstrip.innerHTML = "";
    state.lightboxItems.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `film-thumb${idx === state.lightboxIndex ? " active" : ""}`;
      btn.setAttribute("aria-label", `View ${item.code}`);
      btn.innerHTML = `<img src="${resolveImgSrc(item.id, item.thumb)}" data-fallback-id="${item.id}" alt="${esc(item.code)}" />`;
      btn.addEventListener("click", () => {
        state.lightboxIndex = idx;
        showLightboxItem();
      });
      el.lightboxFilmstrip.appendChild(btn);
    });
  }

  function showLightboxItem() {
    const item = state.lightboxItems[state.lightboxIndex];
    if (!item) return;

    setZoom(false);
    delete el.lightboxImg.dataset.fallbackApplied;
    el.lightboxImg.dataset.fallbackId = item.id;
    el.lightboxImg.src = resolveImgSrc(item.id, item.full);
    el.lightboxImg.alt = `${item.category} ${item.code}`;
    el.lightboxCat.textContent = item.category;
    el.lightboxCode.textContent = item.code;
    el.lightboxCounter.textContent = `${state.lightboxIndex + 1} / ${state.lightboxItems.length}`;

    const thumbs = el.lightboxFilmstrip.querySelectorAll(".film-thumb");
    thumbs.forEach((t, i) => {
      const active = i === state.lightboxIndex;
      t.classList.toggle("active", active);
      if (active) t.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  function closeLightbox() {
    el.lightboxBackdrop.classList.remove("open");
    setZoom(false);
    document.body.style.overflow = "";
    setTimeout(() => {
      if (!el.lightboxBackdrop.classList.contains("open")) {
        el.lightboxBackdrop.hidden = true;
        if (pendingCatalogData) {
          const queued = pendingCatalogData;
          pendingCatalogData = null;
          applyRefreshedCatalog(queued, false);
        }
      }
    }, 240);
  }

  function stepLightbox(delta) {
    if (!state.lightboxItems.length) return;
    state.lightboxIndex =
      (state.lightboxIndex + delta + state.lightboxItems.length) % state.lightboxItems.length;
    showLightboxItem();
  }

  function setZoom(z) {
    state.isZoomed = z;
    el.lightboxStage.classList.toggle("zoomed", z);
    if (!z) el.lightboxImg.style.transformOrigin = "center center";
  }

  /* ------------------------------------------------------------------------
     Automatic 5-Minute Live Catalog Refresh (Google Drive & Hosted JSON)
     - Polls every CONFIG.refreshIntervalMs (default: 5 minutes = 300,000 ms)
     - Uses Google Apps Script live Drive feed when CONFIG.appsScriptUrl is set,
       or falls back to polling hosted catalog-data.json (cache-busted)
     - Only re-renders when additions/removals/changes are detected
     - Defers DOM re-render while Lightbox is open so browsing is uninterrupted
     ------------------------------------------------------------------------ */
  const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
  let lastCatalogFingerprint = "";
  let lastRefreshAttemptAt = 0;
  let refreshInFlight = false;
  let pendingCatalogData = null;

  function computeCatalogFingerprint(dataset) {
    if (!dataset || !Array.isArray(dataset.products)) return "";
    const cats = (dataset.categories || []).map((c) => `${c.slug}:${c.name}:${c.count || 0}`).join("|");
    const items = dataset.products.map((p) => `${p.id}:${p.categorySlug}:${p.thumb || ""}`).join("|");
    return `${cats}##${items}`;
  }

  function applyRefreshedCatalog(nextData, isInitial) {
    const nextFp = computeCatalogFingerprint(nextData);
    if (!nextFp || nextFp === lastCatalogFingerprint) return false;

    if (el.lightboxBackdrop && !el.lightboxBackdrop.hidden) {
      pendingCatalogData = nextData;
      return true;
    }

    DATA = nextData;
    lastCatalogFingerprint = nextFp;
    pendingCatalogData = null;

    const validSlugs = new Set((DATA.categories || []).map((c) => c.slug));
    state.selectedSlugs.forEach((slug) => {
      if (!validSlugs.has(slug)) state.selectedSlugs.delete(slug);
    });

    renderAll();
    if (!isInitial) {
      showToast("Catalog refreshed with latest Drive updates");
    }
    return true;
  }

  function parseAppsScriptCatalog(json) {
    if (!json || !Array.isArray(json.categories) || !json.categories.length) return null;
    const categories = [];
    const products = [];

    json.categories.forEach((rawCat, catIdx) => {
      const photos = Array.isArray(rawCat.photos) ? rawCat.photos : [];
      if (!photos.length) return;
      const name = String(rawCat.rawName || "Collection").trim();
      const slug =
        name.toLowerCase().replace(/[\u2018\u2019]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
        `cat-${catIdx + 1}`;
      const codePrefix = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || `C${catIdx + 1}`;

      const items = photos.map((photo, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const code = `RFA-${codePrefix}-${num}`;
        return {
          id: photo.fileId ? `drv-${photo.fileId}` : code,
          code,
          category: name,
          categorySlug: slug,
          thumb: photo.thumb || `https://lh3.googleusercontent.com/d/${photo.fileId}=w720`,
          full: photo.full || `https://lh3.googleusercontent.com/d/${photo.fileId}=w1600`,
        };
      });

      categories.push({ name, slug, count: items.length, cover: items[0].thumb });
      products.push(...items);
    });

    if (!products.length) return null;
    return {
      generatedAt: json.syncedAt || new Date().toISOString(),
      categories,
      heroProductIds: categories
        .slice(0, 3)
        .map((c) => products.find((p) => p.categorySlug === c.slug)?.id)
        .filter(Boolean),
      products,
    };
  }

  async function refreshCatalogFromSource(isInitial) {
    if (refreshInFlight) return;
    refreshInFlight = true;
    lastRefreshAttemptAt = Date.now();

    try {
      const appsUrl = (CONFIG.appsScriptUrl || "").trim();
      if (appsUrl) {
        const sep = appsUrl.includes("?") ? "&" : "?";
        const res = await fetch(`${appsUrl}${sep}_t=${Date.now()}`, {
          redirect: "follow",
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const nextData = parseAppsScriptCatalog(json);
        if (nextData) applyRefreshedCatalog(nextData, isInitial);
        return;
      }

      // On hosted static site (Cloudflare / GitHub Pages), poll catalog-data.json for 5-min Drive sync updates
      if (IS_SANDBOXED || window.location.protocol === "file:") return;
      const res = await fetch(`catalog-data.json?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json && Array.isArray(json.categories) && Array.isArray(json.products) && json.products.length) {
        applyRefreshedCatalog(json, isInitial);
      }
    } catch (err) {
      if (isInitial) {
        console.warn("Live catalog refresh skipped; displaying synced catalog.", err);
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function startAutoCatalogRefresh() {
    lastCatalogFingerprint = computeCatalogFingerprint(DATA);
    const intervalMs = Math.max(60 * 1000, Number(CONFIG.refreshIntervalMs) || DEFAULT_REFRESH_MS);

    refreshCatalogFromSource(true);

    setInterval(() => {
      if (!document.hidden) {
        refreshCatalogFromSource(false);
      }
    }, intervalMs);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - lastRefreshAttemptAt >= intervalMs) {
        refreshCatalogFromSource(false);
      }
    });
  }

  function applyHash() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    if (raw.startsWith("look=")) {
      const code = decodeURIComponent(raw.slice(5));
      for (const g of getCategoryGroups()) {
        const idx = g.items.findIndex((p) => p.code === code || p.id === code);
        if (idx >= 0) {
          openLightbox(g.items, idx);
          return;
        }
      }
    } else if (raw.startsWith("cat=")) {
      const validSlugs = new Set(DATA.categories.map((c) => c.slug));
      const parts = raw
        .slice(4)
        .split(",")
        .map((s) => {
          try {
            return decodeURIComponent(s).trim();
          } catch {
            return s.trim();
          }
        })
        .filter((slug) => validSlugs.has(slug));
      state.selectedSlugs = new Set(parts);
      if (DATA.categories.length > 0 && state.selectedSlugs.size >= DATA.categories.length) {
        state.selectedSlugs.clear();
      }
    }
  }

  /* ------------------------------------------------------------------------
     Smart Native-App Deep Linking (Instagram)
     - Android: intent:// URI opens installed app directly to profile,
                or falls back automatically to Google Play Store.
     - iOS:     Native URL scheme opens installed app directly to profile,
                with visibility-aware fallback to Apple App Store.
     - Desktop: Opens instagram.com profile link in a new tab.
     ------------------------------------------------------------------------ */
  const STORE_URLS = {
    instagramAndroid: "https://play.google.com/store/apps/details?id=com.instagram.android",
    instagramIOS: "https://apps.apple.com/app/instagram/id389801252",
  };

  function getMobilePlatform() {
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return { isAndroid, isIOS };
  }

  function normalizeInstagramUsername(raw) {
    return String(raw || "")
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@+/, "")
      .replace(/\/.*$/, "")
      .trim();
  }

  function launchIOSAppWithStoreFallback(nativeUrl, storeUrl) {
    let appOpened = false;

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onAppSwitch);
      window.removeEventListener("blur", onAppSwitch);
    };

    const onAppSwitch = () => {
      appOpened = true;
      clearTimeout(timer);
      cleanup();
    };

    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === "hidden") {
        onAppSwitch();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onAppSwitch);
    window.addEventListener("blur", onAppSwitch);

    const timer = setTimeout(() => {
      cleanup();
      if (!appOpened && !document.hidden) {
        window.location.href = storeUrl;
      }
    }, 1500);

    window.location.href = nativeUrl;
  }

  function buildSocialTargets() {
    const social = CONFIG.social || {};
    const igUser = normalizeInstagramUsername(social.instagramUsername);

    return {
      instagram: {
        configured: Boolean(igUser),
        webUrl: igUser ? `https://www.instagram.com/${encodeURIComponent(igUser)}/` : STORE_URLS.instagramIOS,
        androidIntent: igUser
          ? `intent://instagram.com/_u/${encodeURIComponent(igUser)}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(STORE_URLS.instagramAndroid)};end`
          : STORE_URLS.instagramAndroid,
        iosScheme: igUser ? `instagram://user?username=${encodeURIComponent(igUser)}` : "",
        iosStore: STORE_URLS.instagramIOS,
        androidStore: STORE_URLS.instagramAndroid,
      },
    };
  }

  function bindSocialLinks() {
    const targets = buildSocialTargets();
    const links = document.querySelectorAll("[data-social]");

    links.forEach((link) => {
      const kind = link.dataset.social;
      const target = targets[kind];
      if (!target) return;

      link.href = target.configured ? target.webUrl : "#";

      link.addEventListener("click", (e) => {
        const current = buildSocialTargets()[kind];
        if (!current || !current.configured) {
          e.preventDefault();
          showToast("Set your Instagram username in config.js to activate this link");
          return;
        }

        const { isAndroid, isIOS } = getMobilePlatform();
        if (isAndroid) {
          e.preventDefault();
          window.location.href = current.androidIntent;
        } else if (isIOS) {
          e.preventDefault();
          launchIOSAppWithStoreFallback(current.iosScheme, current.iosStore);
        }
        // Desktop browsers follow the native <a href="https://www.instagram.com/..." target="_blank"> link
      });
    });
  }

  function bindEvents() {
    el.themeToggleBtn.addEventListener("click", cycleThemePref);

    if (el.catDropdownBtn) {
      el.catDropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setDropdownOpen(!state.dropdownOpen);
      });
    }

    if (el.catDropdownMenu) {
      el.catDropdownMenu.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    if (el.catResetBtn) {
      el.catResetBtn.addEventListener("click", () => {
        selectAllCategories(false);
      });
    }

    if (el.catDoneBtn) {
      el.catDoneBtn.addEventListener("click", () => {
        setDropdownOpen(false);
      });
    }

    if (el.clearCatsInlineBtn) {
      el.clearCatsInlineBtn.addEventListener("click", () => {
        setDropdownOpen(false);
        if (state.searchQuery) {
          el.searchInput.value = "";
          state.searchQuery = "";
          el.searchClear.classList.remove("visible");
        }
        selectAllCategories(false);
      });
    }

    document.addEventListener("click", (e) => {
      if (state.dropdownOpen && el.categoryDropdown && !el.categoryDropdown.contains(e.target)) {
        setDropdownOpen(false);
      }
    });

    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      el.searchClear.classList.toggle("visible", state.searchQuery.length > 0);
      syncClearAllBtn();
      renderCatalogChapters(getCategoryGroups());
    });

    el.searchClear.addEventListener("click", () => {
      el.searchInput.value = "";
      state.searchQuery = "";
      el.searchClear.classList.remove("visible");
      syncClearAllBtn();
      renderCatalogChapters(getCategoryGroups());
      el.searchInput.focus();
    });

    bindSocialLinks();

    el.lightboxClose.addEventListener("click", closeLightbox);
    el.lightboxBackdrop.addEventListener("click", (e) => {
      if (e.target === el.lightboxBackdrop || e.target === el.lightboxBackdrop.querySelector(".lightbox-center")) {
        closeLightbox();
      }
    });
    el.lightboxPrev.addEventListener("click", (e) => { e.stopPropagation(); stepLightbox(-1); });
    el.lightboxNext.addEventListener("click", (e) => { e.stopPropagation(); stepLightbox(1); });

    el.lbCopyCodeBtn.addEventListener("click", () => {
      const item = state.lightboxItems[state.lightboxIndex];
      if (item) copyText(item.code, `Copied style code ${item.code}`);
    });

    el.lbShareLookBtn.addEventListener("click", () => {
      const item = state.lightboxItems[state.lightboxIndex];
      if (!item) return;
      const base = window.location.href.split("#")[0];
      copyText(`${base}#look=${encodeURIComponent(item.code)}`, `Copied direct link to ${item.code}`);
    });

    el.lightboxStage.addEventListener("click", (e) => {
      setZoom(!state.isZoomed);
      if (state.isZoomed) updateOrigin(e);
    });
    el.lightboxStage.addEventListener("mousemove", (e) => {
      if (state.isZoomed) updateOrigin(e);
    });

    function updateOrigin(e) {
      const r = el.lightboxStage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      el.lightboxImg.style.transformOrigin = `${x}% ${y}%`;
    }

    let touchX = 0;
    el.lightboxStage.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].screenX; }, { passive: true });
    el.lightboxStage.addEventListener("touchend", (e) => {
      if (state.isZoomed) return;
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 48) stepLightbox(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", (e) => {
      if (!el.lightboxBackdrop.hidden) {
        if (e.key === "Escape") closeLightbox();
        else if (e.key === "ArrowLeft") stepLightbox(-1);
        else if (e.key === "ArrowRight") stepLightbox(1);
        return;
      }
      if (e.key === "Escape" && state.dropdownOpen) {
        setDropdownOpen(false);
        if (el.catDropdownBtn) el.catDropdownBtn.focus();
      }
    });

    const toolbarEl = document.getElementById("lookbook");
    const sentinelEl = document.getElementById("toolbarSentinel");
    const spacerEl = document.getElementById("toolbarSpacer");

    function updatePinnedToolbar() {
      el.backToTop.classList.toggle("visible", window.scrollY > 480);
      if (!toolbarEl || !sentinelEl || !spacerEl) return;
      const shouldPin = sentinelEl.getBoundingClientRect().top <= 0;
      const alreadyPinned = toolbarEl.classList.contains("is-pinned");
      if (shouldPin && !alreadyPinned) {
        spacerEl.style.height = `${toolbarEl.offsetHeight}px`;
        toolbarEl.classList.add("is-pinned");
      } else if (!shouldPin && alreadyPinned) {
        toolbarEl.classList.remove("is-pinned");
        spacerEl.style.height = "0px";
      }
    }

    window.addEventListener("scroll", updatePinnedToolbar, { passive: true });
    window.addEventListener("resize", () => {
      if (toolbarEl && spacerEl && toolbarEl.classList.contains("is-pinned")) {
        spacerEl.style.height = `${toolbarEl.offsetHeight}px`;
      }
    }, { passive: true });
    updatePinnedToolbar();
    el.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ------------------------------------------------------------------------
     Living Hand-Painted Brushstroke Canvas (Multi-Bristle Dry-Brush Engine)
     ------------------------------------------------------------------------ */
  const AtelierBrush = (function () {
    const PIGMENTS = {
      light: {
        terracotta: [176, 82, 54],
        marigold:   [204, 146, 48],
        botanical:  [92, 134, 86],
        indigo:     [62, 92, 134],
      },
      dark: {
        terracotta: [224, 118, 86],
        marigold:   [234, 178, 78],
        botanical:  [136, 186, 128],
        indigo:     [122, 162, 218],
      },
    };

    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let activePigment = "terracotta";
    let reducedMotion = false;
    let rafId = null;
    let scrollY = 0;
    let strokes = [];
    let liveTrail = [];
    let lastPtr = null;

    function isDark() {
      return document.documentElement.getAttribute("data-theme") === "dark";
    }

    function getRGB(name) {
      const pal = isDark() ? PIGMENTS.dark : PIGMENTS.light;
      return pal[name] || pal.terracotta;
    }

    // Seeded pseudo-random so each brushstroke has natural organic bristle variation
    function mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function buildStroke(spec) {
      const rand = mulberry32(spec.seed);
      const bristleCount = spec.bristles || 22;
      const bristles = [];
      for (let i = 0; i < bristleCount; i++) {
        const ratio = bristleCount > 1 ? i / (bristleCount - 1) - 0.5 : 0;
        const edgeFade = 1 - Math.abs(ratio * 1.85);
        bristles.push({
          offset: ratio * spec.brushWidth + (rand() - 0.5) * 3.5,
          width: (1.2 + rand() * 3.1) * Math.max(0.45, edgeFade + 0.3),
          startT: rand() * 0.08,
          endT: 0.84 + rand() * 0.16,
          alphaFactor: (0.28 + rand() * 0.72) * Math.max(0.25, edgeFade + 0.35),
          wobbleAmp: (rand() - 0.5) * 6,
          wobbleFreq: 1.5 + rand() * 2.5,
        });
      }

      // Subtle dry-brush pigment flecks along the stroke edge
      const flecks = [];
      for (let f = 0; f < 5; f++) {
        flecks.push({
          t: 0.12 + rand() * 0.78,
          offset: (rand() - 0.5) * spec.brushWidth * 1.45,
          rx: 1.2 + rand() * 2.8,
          ry: 0.8 + rand() * 1.7,
          rot: rand() * Math.PI,
          alpha: 0.4 + rand() * 0.5,
        });
      }

      return {
        ...spec,
        bristles,
        flecks,
        progress: reducedMotion ? 1 : 0,
        bornAt: performance.now() + (spec.delay || 0),
        duration: spec.duration || 1150,
        driftPhase: rand() * Math.PI * 2,
      };
    }

    function cubicPoint(p0, p1, p2, p3, t) {
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;
      return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
      };
    }

    function cubicTangent(p0, p1, p2, p3, t) {
      const u = 1 - t;
      return {
        x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
        y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
      };
    }

    function createInitialStrokes() {
      const w = width || 1440;
      const h = height || 900;
      return [
        // Sweeping upper-left studio terracotta arc behind opening statement
        buildStroke({
          seed: 101,
          pigment: "terracotta",
          brushWidth: Math.min(76, w * 0.065),
          baseAlpha: 0.085,
          parallax: 0.1,
          delay: 60,
          duration: 1200,
          p0: { x: -w * 0.05, y: h * 0.14 },
          p1: { x: w * 0.14, y: h * 0.04 },
          p2: { x: w * 0.30, y: h * 0.24 },
          p3: { x: w * 0.44, y: h * 0.13 },
        }),
        // Graceful marigold ochre sweep down the far-right gallery margin
        buildStroke({
          seed: 204,
          pigment: "marigold",
          brushWidth: Math.min(88, w * 0.075),
          baseAlpha: 0.09,
          parallax: 0.15,
          delay: 260,
          duration: 1350,
          p0: { x: w * 0.86, y: h * 0.06 },
          p1: { x: w * 1.03, y: h * 0.28 },
          p2: { x: w * 0.78, y: h * 0.56 },
          p3: { x: w * 0.99, y: h * 0.84 },
        }),
        // Soft botanical sage wash in lower-left margin
        buildStroke({
          seed: 317,
          pigment: "botanical",
          brushWidth: Math.min(68, w * 0.06),
          baseAlpha: 0.075,
          parallax: 0.12,
          delay: 460,
          duration: 1250,
          p0: { x: -w * 0.04, y: h * 0.76 },
          p1: { x: w * 0.12, y: h * 0.65 },
          p2: { x: w * 0.24, y: h * 0.88 },
          p3: { x: w * 0.39, y: h * 0.79 },
        }),
        // Delicate peacock indigo dry-brush flourish mid-left
        buildStroke({
          seed: 429,
          pigment: "indigo",
          brushWidth: Math.min(50, w * 0.045),
          baseAlpha: 0.065,
          parallax: 0.08,
          delay: 640,
          duration: 1150,
          p0: { x: w * 0.02, y: h * 0.46 },
          p1: { x: w * 0.11, y: h * 0.40 },
          p2: { x: w * 0.18, y: h * 0.52 },
          p3: { x: w * 0.29, y: h * 0.45 },
        }),
      ];
    }

    function paintInteractiveSweep(pigmentName) {
      activePigment = pigmentName;
      const w = width || 1440;
      const h = height || 900;
      const seed = Math.floor(Math.random() * 90000) + 1000;
      const fromLeft = strokes.length % 2 === 0;
      const yBand = 0.16 + ((strokes.length * 0.23) % 0.66);

      const newStroke = buildStroke({
        seed,
        pigment: pigmentName,
        brushWidth: Math.min(82, w * 0.07),
        baseAlpha: 0.1,
        parallax: 0.11,
        delay: 0,
        duration: 920,
        p0: { x: fromLeft ? -w * 0.04 : w * 1.04, y: h * yBand },
        p1: { x: fromLeft ? w * 0.22 : w * 0.76, y: h * (yBand - 0.1) },
        p2: { x: fromLeft ? w * 0.42 : w * 0.56, y: h * (yBand + 0.12) },
        p3: { x: fromLeft ? w * 0.62 : w * 0.36, y: h * (yBand + 0.02) },
      });

      strokes.push(newStroke);
      // Keep canvas refined and uncluttered (max 7 background strokes)
      if (strokes.length > 7) strokes.shift();
      ensureRunning();
    }

    function drawSingleStroke(s, now) {
      const elapsed = now - s.bornAt;
      if (elapsed < 0 && !reducedMotion) return true;

      if (!reducedMotion && s.progress < 1) {
        const raw = Math.min(1, elapsed / s.duration);
        // Exponential ease-out (Impeccable animate.md)
        s.progress = 1 - Math.pow(1 - raw, 3);
      }

      const [r, g, b] = getRGB(s.pigment);
      const darkBoost = isDark() ? 1.38 : 1.0;
      const yShift = -(scrollY * s.parallax) % (height * 1.2);
      const breathe = reducedMotion ? 0 : Math.sin(now * 0.00045 + s.driftPhase) * 3.5;

      const p0 = { x: s.p0.x, y: s.p0.y + yShift + breathe };
      const p1 = { x: s.p1.x, y: s.p1.y + yShift - breathe * 0.6 };
      const p2 = { x: s.p2.x, y: s.p2.y + yShift + breathe * 0.7 };
      const p3 = { x: s.p3.x, y: s.p3.y + yShift };

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const steps = 28;
      for (const br of s.bristles) {
        const maxT = Math.min(br.endT, s.progress);
        if (maxT <= br.startT) continue;

        ctx.beginPath();
        let started = false;
        for (let k = 0; k <= steps; k++) {
          const t = br.startT + ((maxT - br.startT) * k) / steps;
          const pt = cubicPoint(p0, p1, p2, p3, t);
          const tan = cubicTangent(p0, p1, p2, p3, t);
          const len = Math.hypot(tan.x, tan.y) || 1;
          const nx = -tan.y / len;
          const ny = tan.x / len;
          const pressure = Math.sin(t * Math.PI); // Natural flat-brush pressure taper
          const wobble = Math.sin(t * Math.PI * br.wobbleFreq) * br.wobbleAmp;
          const off = (br.offset + wobble) * (0.45 + 0.55 * pressure);
          const x = pt.x + nx * off;
          const y = pt.y + ny * off;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        const alpha = Math.min(0.22, s.baseAlpha * br.alphaFactor * darkBoost);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(4)})`;
        ctx.lineWidth = br.width;
        ctx.stroke();
      }

      // Dry-brush pigment flecks
      for (const fl of s.flecks) {
        if (fl.t > s.progress) continue;
        const pt = cubicPoint(p0, p1, p2, p3, fl.t);
        const tan = cubicTangent(p0, p1, p2, p3, fl.t);
        const len = Math.hypot(tan.x, tan.y) || 1;
        const x = pt.x + (-tan.y / len) * fl.offset;
        const y = pt.y + (tan.x / len) * fl.offset;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fl.rot);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(s.baseAlpha * fl.alpha * darkBoost).toFixed(4)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, fl.rx, fl.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      return s.progress < 1;
    }

    function drawLiveCursorTrail(now) {
      if (!liveTrail.length) return false;
      const maxAge = 1250;
      const [r, g, b] = getRGB(activePigment);
      const darkBoost = isDark() ? 1.45 : 1.0;

      liveTrail = liveTrail.filter((seg) => now - seg.ts < maxAge);
      for (const seg of liveTrail) {
        const life = 1 - (now - seg.ts) / maxAge;
        const easeAlpha = life * life * 0.085 * darkBoost;
        ctx.lineCap = "round";
        for (let bIdx = -2; bIdx <= 2; bIdx++) {
          const off = bIdx * 3.2;
          ctx.beginPath();
          ctx.moveTo(seg.x1 + seg.nx * off, seg.y1 + seg.ny * off);
          ctx.lineTo(seg.x2 + seg.nx * off, seg.y2 + seg.ny * off);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(easeAlpha * (1 - Math.abs(bIdx) * 0.22)).toFixed(4)})`;
          ctx.lineWidth = 2.4 - Math.abs(bIdx) * 0.35;
          ctx.stroke();
        }
      }
      return liveTrail.length > 0;
    }

    function renderFrame(now) {
      rafId = null;
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      let stillAnimating = false;
      for (const s of strokes) {
        if (drawSingleStroke(s, now)) stillAnimating = true;
      }
      if (drawLiveCursorTrail(now)) stillAnimating = true;

      // Gentle ambient breathing motion while visible and motion allowed
      if (!reducedMotion && !document.hidden && (stillAnimating || liveTrail.length > 0)) {
        rafId = requestAnimationFrame(renderFrame);
      } else if (!reducedMotion && !document.hidden) {
        // Low-frequency gentle breathing pass every ~60ms instead of burning 60fps when idle
        rafId = setTimeout(() => {
          rafId = requestAnimationFrame(renderFrame);
        }, 65);
      }
    }

    function ensureRunning() {
      if (!ctx) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        clearTimeout(rafId);
        rafId = null;
      }
      rafId = requestAnimationFrame(renderFrame);
    }

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      strokes = createInitialStrokes();
      ensureRunning();
    }

    function init() {
      canvas = document.getElementById("atelierCanvas");
      if (!canvas || !canvas.getContext) return;
      ctx = canvas.getContext("2d");
      reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollY = window.scrollY || 0;
      resize();

      window.addEventListener("resize", () => {
        resize();
      }, { passive: true });

      window.addEventListener("scroll", () => {
        scrollY = window.scrollY || 0;
        if (reducedMotion) ensureRunning();
      }, { passive: true });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) ensureRunning();
      });

      // Subtle dry-brush pointer trail on desktop (skipped for reduced-motion & touch)
      if (!reducedMotion) {
        window.addEventListener("pointermove", (e) => {
          if (e.pointerType !== "mouse") return;
          const x = e.clientX;
          const y = e.clientY;
          if (lastPtr) {
            const dx = x - lastPtr.x;
            const dy = y - lastPtr.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 14 && dist < 140) {
              liveTrail.push({
                x1: lastPtr.x,
                y1: lastPtr.y,
                x2: x,
                y2: y,
                nx: -dy / dist,
                ny: dx / dist,
                ts: performance.now(),
              });
              if (liveTrail.length > 28) liveTrail.shift();
              ensureRunning();
              lastPtr = { x, y };
            } else if (dist >= 140) {
              lastPtr = { x, y };
            }
          } else {
            lastPtr = { x, y };
          }
        }, { passive: true });
      }

      // Wire Studio Pigment Swatch dabs
      document.querySelectorAll(".pigment-dab").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pigment = btn.dataset.pigment || "terracotta";
          document.querySelectorAll(".pigment-dab").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          paintInteractiveSweep(pigment);
        });
      });
    }

    return { init, redraw: ensureRunning };
  })();

  function init() {
    installImageFallback();
    startISTClockSync();
    applyHash();
    renderAll();
    bindEvents();
    AtelierBrush.init();
    // Re-tint brushstroke canvas immediately whenever user cycles IST/Light/Dark theme
    el.themeToggleBtn.addEventListener("click", () => AtelierBrush.redraw());
    startAutoCatalogRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
