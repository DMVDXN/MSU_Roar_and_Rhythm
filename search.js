import { supabase } from "./supabase.js";

const input = document.getElementById("searchInput");
const meta = document.getElementById("searchMeta");
const peopleEl = document.getElementById("peopleResults");
const postsEl = document.getElementById("postResults");
const msgEl = document.getElementById("searchMsg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function escapeHtml(str) {
  return (str ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getQ() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("q") || "").trim();
}

function setQ(q) {
  const params = new URLSearchParams(window.location.search);
  if (q) params.set("q", q);
  else params.delete("q");
  const next = `${window.location.pathname}?${params.toString()}`;
  history.replaceState(null, "", next);
}

function avatarLetter(p) {
  const src = (p.display_name || p.username || "U").trim();
  return (src[0] || "U").toUpperCase();
}

function renderPerson(p) {
  const username = (p.username || "").trim();
  const name = (p.display_name || "User").trim();

  const a = document.createElement("a");
  a.className = "person";
  a.href = `user.html?u=${encodeURIComponent(username)}`;

  a.innerHTML = `
    <div class="person-head">
      <div class="person-avatar">${escapeHtml(avatarLetter(p))}</div>
      <div>
        <p class="person-name">${escapeHtml(name)}</p>
        <div class="person-handle">@${escapeHtml(username)}</div>
      </div>
    </div>
  `;
  return a;
}

function renderPost(p) {
  const title = escapeHtml(p.title || "Untitled");
  const date = p.created_at ? new Date(p.created_at).toLocaleString() : "";
  const type = (p.type || "").trim();

  let body = "";
  if (type === "poem") {
    body = `<div class="body">${escapeHtml(p.body_text || "")}</div>`;
  } else if (type === "song") {
    const url = escapeHtml(p.song_url || "");
    body = url
      ? `<a class="open-link" href="${url}" target="_blank" rel="noopener noreferrer">Open link</a>`
      : `<div class="body">No link provided.</div>`;
  } else if (type === "image") {
    const url = escapeHtml(p.image_url || "");
    body = url ? `<img src="${url}" alt="${title}">` : `<div class="body">No image.</div>`;
  }

  return `
    <div class="post">
      <h3>${title}</h3>
      <div class="meta">${escapeHtml(date)} · ${escapeHtml(type)}</div>
      ${body}
    </div>
  `;
}

async function searchAll(q) {
  peopleEl.innerHTML = "";
  postsEl.innerHTML = "";
  setMsg("");

  const query = (q || "").trim();
  if (meta) meta.textContent = query ? `Results for "${query}"` : "Type something to search.";

  if (!query) return;

  setMsg("Searching...");

  const peopleReq = supabase
    .from("profiles")
    .select("id,username,display_name")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .not("username", "is", null)
    .limit(18);

  const postsReq = supabase
    .from("posts")
    .select("id,title,type,created_at,body_text,song_url,image_url,status")
    .eq("status", "approved")
    .or(`title.ilike.%${query}%,body_text.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(24);

  const [{ data: people, error: peopleErr }, { data: posts, error: postsErr }] = await Promise.all([
    peopleReq,
    postsReq
  ]);

  if (peopleErr || postsErr) {
    setMsg(`Error: ${(peopleErr || postsErr).message}`);
    return;
  }

  if (people && people.length) {
    people.forEach(p => peopleEl.appendChild(renderPerson(p)));
  } else {
    peopleEl.innerHTML = `<p class="search-msg">No people found.</p>`;
  }

  if (posts && posts.length) {
    postsEl.innerHTML = posts.map(renderPost).join("");
  } else {
    postsEl.innerHTML = `<p class="search-msg">No posts found.</p>`;
  }

  setMsg("");
}

function setupSearchBox() {
  const form = document.querySelector(".topbar-search");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    setQ(q);
    searchAll(q);
  });

  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim();
      setQ(q);
      searchAll(q);
    }, 250);
  });
}

const initial = getQ();
if (input) input.value = initial;
setupSearchBox();
searchAll(initial);
