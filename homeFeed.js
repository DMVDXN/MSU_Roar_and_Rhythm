// homeFeed.js
const grid = document.getElementById("homeBubbles");
const bg = document.getElementById("homeBubbleBg");

const MAX_CARDS = 9;
const STORAGE_KEY = "rr_homeFeedState_v1";
const STATE_TTL_MS = 1000 * 60 * 30; // 30 minutes

// Pages to pull from (same-origin)
const SOURCES = [
  { url: "poetry.html", type: "Poetry" },
  { url: "music.html", type: "Music" },
  { url: "art.html", type: "Art" }
];

// Fallback if nothing is marked yet
const DEFAULT_CARDS = [
  {
    type: "Poetry",
    title: "Featured Poetry",
    desc: "Add data-home-card items on poetry.html to replace this.",
    href: "poetry.html"
  },
  {
    type: "Music",
    title: "Featured Music",
    desc: "Add data-home-card items on music.html to replace this.",
    href: "music.html"
  },
  {
    type: "Art",
    title: "Featured Art",
    desc: "Add data-home-card items on art.html to replace this.",
    href: "art.html"
  }
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandomUnique(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function makeBubbleBg(count = 14) {
  if (!bg) return;

  bg.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    const size = Math.floor(rand(28, 120));
    const left = rand(0, 100);
    const top = rand(0, 100);
    const dur = rand(10, 22);
    const delay = rand(0, 8);

    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.left = `${left}%`;
    s.style.top = `${top}%`;
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay = `${delay}s`;

    bg.appendChild(s);
  }
}

function normalizeHref(pageUrl, href) {
  if (!href) return pageUrl;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return href;
  if (href.startsWith("#")) return `${pageUrl}${href}`;
  return href;
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !data.savedAt || !Array.isArray(data.cards)) return null;

    const age = Date.now() - data.savedAt;
    if (age > STATE_TTL_MS) return null;

    return data.cards;
  } catch {
    return null;
  }
}

function saveState(cards) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), cards })
    );
  } catch {
    // ignore storage errors
  }
}

// Pull cards from a page by looking for elements marked with [data-home-card]
async function collectFromPage(source) {
  const res = await fetch(source.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${source.url}`);

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nodes = [...doc.querySelectorAll("[data-home-card]")];

  // If you have nothing marked yet, return empty and fallback will kick in
  if (!nodes.length) return [];

  const cards = nodes.map((el) => {
    const title =
      el.getAttribute("data-title") ||
      el.querySelector("[data-title-el]")?.textContent?.trim() ||
      el.querySelector("h3, h4")?.textContent?.trim() ||
      "Untitled";

    const desc =
      el.getAttribute("data-desc") ||
      el.querySelector("[data-desc-el]")?.textContent?.trim() ||
      el.querySelector("p")?.textContent?.trim() ||
      "";

    const hrefRaw =
      el.getAttribute("data-href") ||
      el.querySelector("a")?.getAttribute("href") ||
      source.url;

    const img =
      el.getAttribute("data-img") ||
      el.querySelector("img")?.getAttribute("src") ||
      "";

    return {
      type: el.getAttribute("data-type") || source.type,
      title,
      desc,
      href: normalizeHref(source.url, hrefRaw),
      img
    };
  });

  return cards;
}

function renderCards(cards) {
  if (!grid) return;

  grid.innerHTML = "";

  cards.forEach((c) => {
    const a = document.createElement("a");
    a.className = "bubble-card";
    a.href = c.href;

    const tilt = typeof c.tilt === "number" ? c.tilt : rand(-2.2, 2.2);
    const floatDelay = typeof c.floatDelay === "number" ? c.floatDelay : rand(0, 2.8);
    const floatDur = typeof c.floatDur === "number" ? c.floatDur : rand(5.5, 9.5);

    a.style.setProperty("--tilt", `${tilt}deg`);
    a.style.setProperty("--floatDelay", `${floatDelay}s`);
    a.style.setProperty("--floatDur", `${floatDur}s`);

    const badge = document.createElement("div");
    badge.className = "bubble-badge";
    badge.textContent = c.type;

    const title = document.createElement("div");
    title.className = "bubble-title";
    title.textContent = c.title;

    const desc = document.createElement("div");
    desc.className = "bubble-desc";
    desc.textContent = c.desc || "";

    a.appendChild(badge);

    if (c.img) {
      const img = document.createElement("img");
      img.className = "bubble-img";
      img.src = c.img;
      img.alt = "";
      img.loading = "lazy";
      a.appendChild(img);
    }

    a.appendChild(title);
    if (c.desc) a.appendChild(desc);

    grid.appendChild(a);
  });
}

async function initHomeFeed() {
  makeBubbleBg();

  const saved = loadState();
  if (saved && saved.length) {
    renderCards(saved);
    return;
  }

  const pool = [];

  for (const s of SOURCES) {
    try {
      const items = await collectFromPage(s);
      pool.push(...items);
    } catch {
      // ignore per-page failures so the homepage still loads
    }
  }

  const finalPool = pool.length ? pool : DEFAULT_CARDS;
  const picks = pickRandomUnique(finalPool, Math.min(MAX_CARDS, finalPool.length));

  const styled = picks.map((c) => ({
    ...c,
    tilt: rand(-2.2, 2.2),
    floatDelay: rand(0, 2.8),
    floatDur: rand(5.5, 9.5)
  }));

  saveState(styled);
  renderCards(styled);
}

initHomeFeed();

// Optional: regenerate background bubbles on resize (kept light)
let resizeTimer = null;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => makeBubbleBg(), 200);
});
