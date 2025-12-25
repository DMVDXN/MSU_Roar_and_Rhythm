import { supabase } from "./supabase.js";

const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");

const featuredWrap = document.getElementById("featuredWrap");

const searchInput = document.querySelector(".search-input");
const clearSearchBtn = document.getElementById("clearSearchBtn");

const sortSel = document.getElementById("sortSel");
const timeSel = document.getElementById("timeSel");
const lenSel = document.getElementById("lenSel");

const viewCardsBtn = document.getElementById("viewCards");
const viewCompactBtn = document.getElementById("viewCompact");

const resultsText = document.getElementById("resultsText");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const autoLoadChk = document.getElementById("autoLoadChk");
const sentinel = document.getElementById("sentinel");

const tagsRow = document.getElementById("tagsRow");
const tagsChips = document.getElementById("tagsChips");

const PAGE_SIZE = 10;

let offset = 0;
let isLoading = false;
let hasMore = true;

let viewMode = "cards";
let selectedTag = null;

let supportsTags = true;
let observer = null;

// Keep a local cache for modal open without refetch
let loadedMap = new Map();

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

function makePreview(bodyText) {
  const text = bodyText || "";
  const lines = text.split("\n");

  const maxLines = 5;
  const maxChars = 280;

  let preview = lines.slice(0, maxLines).join("\n").trim();
  if (preview.length > maxChars) preview = preview.slice(0, maxChars).trim();

  const wasTruncated = text.trim().length > preview.length;
  if (wasTruncated) preview += "\n\nClick to read more";

  return preview;
}

function lengthBucket(bodyText) {
  const text = bodyText || "";
  const lines = text.split("\n").filter((l) => l.trim().length > 0).length;

  if (lines <= 6 || text.length <= 240) return "short";
  if (lines <= 16 || text.length <= 700) return "medium";
  return "long";
}

function matchesLengthFilter(bodyText, filter) {
  if (!filter || filter === "all") return true;
  return lengthBucket(bodyText) === filter;
}

function timeStartISO() {
  const t = timeSel ? timeSel.value : "all";
  if (t === "all") return null;

  const now = new Date();
  let start = new Date(now);

  if (t === "day") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (t === "week") start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (t === "month") start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return start.toISOString();
}

function setResultsBar(loadedCount) {
  if (!resultsText) return;

  const q = (searchInput?.value || "").trim();
  const time = timeSel ? timeSel.value : "all";
  const len = lenSel ? lenSel.value : "all";
  const sort = sortSel ? sortSel.value : "newest";

  const bits = [];
  bits.push(`Showing ${loadedCount}`);

  if (q) bits.push(`matching "${q}"`);
  if (selectedTag) bits.push(`tag: ${selectedTag}`);
  if (time !== "all") bits.push(`time: ${time}`);
  if (len !== "all") bits.push(`length: ${len}`);
  bits.push(`sort: ${sort}`);

  resultsText.textContent = bits.join(" | ");
}

function setView(mode) {
  viewMode = mode;
  if (listEl) listEl.setAttribute("data-view", mode);

  if (viewCardsBtn && viewCompactBtn) {
    if (mode === "cards") {
      viewCardsBtn.classList.add("is-active");
      viewCompactBtn.classList.remove("is-active");
    } else {
      viewCompactBtn.classList.add("is-active");
      viewCardsBtn.classList.remove("is-active");
    }
  }
}

function resetFeed() {
  offset = 0;
  isLoading = false;
  hasMore = true;
  loadedMap = new Map();

  if (listEl) listEl.innerHTML = "";
  setMsg("");

  if (featuredWrap) {
    featuredWrap.style.display = "none";
    featuredWrap.innerHTML = "";
  }

  if (loadMoreBtn) {
    loadMoreBtn.style.display = "inline-flex";
    loadMoreBtn.disabled = false;
  }

  setResultsBar(0);
}

function buildBaseQuery(includeTags) {
  const q = (searchInput?.value || "").trim();
  const startISO = timeStartISO();
  const sort = sortSel ? sortSel.value : "newest";

  let selectCols = "id, title, body_text, created_at";
  if (includeTags) selectCols += ", tags";

  let query = supabase
    .from("posts")
    .select(selectCols)
    .eq("type", "poem")
    .eq("status", "approved");

  if (startISO) query = query.gte("created_at", startISO);

  if (q) {
    const safe = q.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
    query = query.or(`title.ilike.%${safe}%,body_text.ilike.%${safe}%`);
  }

  if (selectedTag && includeTags) {
    query = query.contains("tags", [selectedTag]);
  }

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  if (sort === "newest") query = query.order("created_at", { ascending: false });
  if (sort === "az") query = query.order("title", { ascending: true });

  return query;
}

function renderFeatured(p) {
  if (!featuredWrap) return;

  featuredWrap.style.display = "block";
  featuredWrap.innerHTML = `
    <div class="featured-label">Featured</div>
    <article class="featured-card" data-id="${escapeHtml(p.id)}" role="button" tabindex="0" aria-label="Open poem">
      <h3 class="featured-title">${escapeHtml(p.title || "Untitled")}</h3>
      <div class="featured-meta">${formatDate(p.created_at)}</div>
      <div class="featured-body">${escapeHtml(makePreview(p.body_text || ""))}</div>
      <div class="featured-hint">Click to read</div>
    </article>
  `;
}

function renderCard(p) {
  const id = escapeHtml(p.id);
  const title = escapeHtml(p.title || "Untitled");
  const date = formatDate(p.created_at);
  const preview = makePreview(p.body_text || "");

  return `
    <article class="poem-card" data-id="${id}" role="button" tabindex="0" aria-label="Open poem">
      <h3 class="poem-title">${title}</h3>
      <div class="poem-date">${date}</div>
      <div class="poem-preview">${escapeHtml(preview)}</div>
    </article>
  `;
}

function renderCompactRow(p) {
  const id = escapeHtml(p.id);
  const title = escapeHtml(p.title || "Untitled");
  const date = formatDate(p.created_at);
  const bucket = lengthBucket(p.body_text || "");

  return `
    <div class="compact-row" data-id="${id}" role="button" tabindex="0" aria-label="Open poem">
      <div class="compact-title">${title}</div>
      <div class="compact-meta">
        <span class="compact-date">${date}</span>
        <span class="compact-pill">${bucket}</span>
      </div>
    </div>
  `;
}

function appendPosts(posts, isFirstPage) {
  if (!listEl || !posts || posts.length === 0) return;

  // Save in local cache for modal
  posts.forEach((p) => loadedMap.set(String(p.id), p));

  // Featured logic: only on first page, only when no search/tag/time/len filter
  const q = (searchInput?.value || "").trim();
  const canFeature =
    isFirstPage &&
    !q &&
    !selectedTag &&
    (!timeSel || timeSel.value === "all") &&
    (!lenSel || lenSel.value === "all") &&
    (!sortSel || sortSel.value === "newest");

  if (canFeature && posts.length > 0) {
    renderFeatured(posts[0]);
    posts = posts.slice(1);
  }

  if (viewMode === "compact") {
    listEl.insertAdjacentHTML("beforeend", posts.map(renderCompactRow).join(""));
  } else {
    listEl.insertAdjacentHTML("beforeend", posts.map(renderCard).join(""));
  }
}

async function fetchPage() {
  if (isLoading || !hasMore || !listEl) return;
  isLoading = true;

  if (loadMoreBtn) loadMoreBtn.disabled = true;
  setMsg("Loading...");

  const lenFilter = lenSel ? lenSel.value : "all";

  // We may need to pull multiple DB pages if length filter removes everything
  let collected = [];
  let tries = 0;

  while (collected.length < PAGE_SIZE && tries < 6 && hasMore) {
    tries += 1;

    let query = buildBaseQuery(supportsTags).range(offset, offset + PAGE_SIZE - 1);
    let res = await query;

    if (res.error && supportsTags) {
      supportsTags = false;
      if (tagsRow) tagsRow.style.display = "none";
      selectedTag = null;

      query = buildBaseQuery(false).range(offset, offset + PAGE_SIZE - 1);
      res = await query;
    }

    if (res.error) {
      setMsg("Error: " + res.error.message);
      isLoading = false;
      if (loadMoreBtn) loadMoreBtn.disabled = false;
      return;
    }

    const data = res.data || [];
    offset += data.length;

    if (data.length < PAGE_SIZE) hasMore = false;

    const filtered = data.filter((p) => matchesLengthFilter(p.body_text, lenFilter));
    collected = collected.concat(filtered);

    if (!hasMore) break;
  }

  if (collected.length === 0 && listEl.innerHTML.trim() === "") {
    setMsg("No approved poems yet.");
  } else {
    setMsg("");
  }

  appendPosts(collected.slice(0, PAGE_SIZE), offset <= PAGE_SIZE);

  setResultsBar(loadedMap.size);

  if (!hasMore) {
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.style.display = "inline-flex";
      loadMoreBtn.disabled = false;
    }
  }

  isLoading = false;
}

function ensureModal() {
  if (document.getElementById("poemModal")) return;

  const modal = document.createElement("div");
  modal.id = "poemModal";
  modal.className = "poem-modal";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="poem-modal-backdrop" data-close="1"></div>
    <div class="poem-modal-panel" role="dialog" aria-modal="true" aria-label="Poem">
      <div class="poem-modal-header">
        <div class="poem-modal-title" id="poemModalTitle"></div>
        <button class="poem-modal-close" type="button" data-close="1" aria-label="Close">Close</button>
      </div>
      <div class="poem-modal-meta" id="poemModalMeta"></div>
      <div class="poem-modal-body" id="poemModalBody"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close='1']");
    if (close) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(poem) {
  ensureModal();

  const modal = document.getElementById("poemModal");
  const titleEl = document.getElementById("poemModalTitle");
  const metaEl = document.getElementById("poemModalMeta");
  const bodyEl = document.getElementById("poemModalBody");

  if (titleEl) titleEl.textContent = poem.title || "Untitled";
  if (metaEl) metaEl.textContent = formatDate(poem.created_at);
  if (bodyEl) bodyEl.textContent = poem.body_text || "";

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal() {
  const modal = document.getElementById("poemModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function fetchSingleById(id) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, body_text, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    setMsg("Error opening poem: " + error.message);
    return null;
  }

  return data;
}

async function handleOpenById(id) {
  const cached = loadedMap.get(String(id));
  if (cached && cached.body_text) {
    openModal(cached);
    return;
  }

  const poem = await fetchSingleById(id);
  if (!poem) return;

  loadedMap.set(String(poem.id), poem);
  openModal(poem);
}

function setupClickOpen(container) {
  if (!container) return;

  container.addEventListener("click", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    handleOpenById(el.getAttribute("data-id"));
  });

  container.addEventListener("keydown", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleOpenById(el.getAttribute("data-id"));
  });
}

async function buildTagsChips() {
  if (!supportsTags || !tagsRow || !tagsChips) return;

  const { data, error } = await supabase
    .from("posts")
    .select("tags")
    .eq("type", "poem")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    supportsTags = false;
    tagsRow.style.display = "none";
    selectedTag = null;
    return;
  }

  const set = new Set();
  (data || []).forEach((row) => {
    const tags = row?.tags;
    if (Array.isArray(tags)) tags.forEach((t) => set.add(String(t)));
  });

  const tags = Array.from(set).slice(0, 12);

  if (tags.length === 0) {
    tagsRow.style.display = "none";
    return;
  }

  tagsRow.style.display = "flex";
  tagsChips.innerHTML = `
    <button class="chip ${selectedTag ? "" : "is-active"}" type="button" data-tag="">All</button>
    ${tags
      .map((t) => {
        const active = selectedTag === t ? "is-active" : "";
        return `<button class="chip ${active}" type="button" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
      })
      .join("")}
  `;
}

function setupInfiniteScroll() {
  if (observer) observer.disconnect();
  observer = null;

  if (!autoLoadChk || !autoLoadChk.checked || !sentinel) return;

  observer = new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) fetchPage();
  });

  observer.observe(sentinel);
}

function applyAll() {
  resetFeed();
  buildTagsChips();
  setupInfiniteScroll();
  fetchPage();
}

// Wire events safely
if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => fetchPage());
if (autoLoadChk) autoLoadChk.addEventListener("change", () => setupInfiniteScroll());

if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    applyAll();
  });
}

if (sortSel) sortSel.addEventListener("change", applyAll);
if (timeSel) timeSel.addEventListener("change", applyAll);
if (lenSel) lenSel.addEventListener("change", applyAll);

if (searchInput) {
  let t = null;
  searchInput.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(applyAll, 250);
  });
}

if (viewCardsBtn) {
  viewCardsBtn.addEventListener("click", () => {
    setView("cards");
    applyAll();
  });
}

if (viewCompactBtn) {
  viewCompactBtn.addEventListener("click", () => {
    setView("compact");
    applyAll();
  });
}

if (tagsChips) {
  tagsChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;

    const tag = btn.getAttribute("data-tag");
    selectedTag = tag ? tag : null;

    applyAll();
  });
}

setupClickOpen(listEl);
setupClickOpen(featuredWrap);

setView("cards");
applyAll();
