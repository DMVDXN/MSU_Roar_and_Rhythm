import { supabase } from "./supabase.js";

const msgEl = document.getElementById("userMsg");
const feedEl = document.getElementById("userFeed");

const nameEl = document.getElementById("userName");
const handleEl = document.getElementById("userHandle");
const bioEl = document.getElementById("userBio");
const avatarEl = document.getElementById("userAvatar");
const siteEl = document.getElementById("userWebsite");

let userId = null;
let allPosts = [];
let activeTab = "all";

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function escapeHtml(str) {
  return (str ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getUsernameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("u") || "").trim().toLowerCase();
}

function showWebsite(url) {
  const u = (url || "").trim();
  if (!siteEl) return;

  if (!u) {
    siteEl.style.display = "none";
    siteEl.href = "#";
    siteEl.textContent = "";
    return;
  }

  siteEl.style.display = "inline-block";
  siteEl.href = u;
  siteEl.textContent = u.replace(/^https?:\/\//, "");
}

function renderPost(p) {
  const title = escapeHtml(p.title || "Untitled");
  const date = p.created_at ? new Date(p.created_at).toLocaleString() : "";
  const type = p.type || "";

  let body = "";
  if (type === "poem") {
    body = `<div class="body">${escapeHtml(p.body_text || "")}</div>`;
  } else if (type === "song") {
    const url = escapeHtml(p.song_url || "");
    body = url ? `<a class="open-link" href="${url}" target="_blank" rel="noopener noreferrer">Open link</a>` : `<div class="body">No link provided.</div>`;
  } else if (type === "image") {
    const url = escapeHtml(p.image_url || "");
    body = url ? `<img src="${url}" alt="${title}">` : `<div class="body">No image.</div>`;
  }

  return `
    <div class="post">
      <h3>${title}</h3>
      <div class="meta">${escapeHtml(date)}</div>
      ${body}
    </div>
  `;
}

function applyTab() {
  const filtered = activeTab === "all" ? allPosts : allPosts.filter(p => p.type === activeTab);
  if (!filtered.length) {
    feedEl.innerHTML = "";
    setMsg("Nothing to show.");
    return;
  }
  setMsg("");
  feedEl.innerHTML = filtered.map(renderPost).join("");
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.getAttribute("data-tab") || "all";
      applyTab();
    });
  });
}

async function loadProfileByUsername(username) {
  setMsg("Loading...");
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,website")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    setMsg(`Error: ${error.message}`);
    return null;
  }
  if (!data) {
    setMsg("User not found.");
    return null;
  }

  const name = (data.display_name || "User").trim();
  const handle = (data.username || "").trim();
  const bio = (data.bio || "").trim();

  document.title = `${handle ? "@" + handle : "User"} - Roar & Rhythm`;

  if (nameEl) nameEl.textContent = name;
  if (handleEl) handleEl.textContent = handle ? `@${handle}` : "";
  if (bioEl) bioEl.textContent = bio;
  showWebsite(data.website || "");

  const letter = (name[0] || handle[0] || "U").toUpperCase();
  if (avatarEl) avatarEl.textContent = letter;

  return data;
}

async function loadApprovedPostsForUser(id) {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,type,created_at,body_text,song_url,image_url,status,user_id")
    .eq("user_id", id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    setMsg(`Error: ${error.message}`);
    return;
  }

  allPosts = data || [];
  applyTab();
}

setupTabs();

(async () => {
  const username = getUsernameFromUrl();
  if (!username) {
    setMsg("Missing username in URL.");
    return;
  }

  const profile = await loadProfileByUsername(username);
  if (!profile) return;

  userId = profile.id;
  await loadApprovedPostsForUser(userId);
})();
