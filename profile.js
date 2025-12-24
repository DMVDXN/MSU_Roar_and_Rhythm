import { supabase } from "./supabase.js";

const msgEl = document.getElementById("profileMsg");
const feedEl = document.getElementById("profileFeed");

const nameEl = document.getElementById("profileName");
const emailEl = document.getElementById("profileEmail");
const avatarBigEl = document.getElementById("profileAvatarBig");

const statAll = document.getElementById("statAll");
const statPoem = document.getElementById("statPoem");
const statSong = document.getElementById("statSong");
const statImage = document.getElementById("statImage");

let allPosts = [];
let activeTab = "all";

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function escapeHtml(str) {
  return (str ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function badgeHtml(status) {
  const s = (status || "").toString().toLowerCase();
  let cls = "badge";
  if (s === "approved") cls += " approved";
  else if (s === "pending") cls += " pending";
  else if (s === "rejected") cls += " rejected";
  return `<span class="${cls}">${escapeHtml(s || "unknown")}</span>`;
}

function typeLabel(t) {
  if (t === "poem") return "Poetry";
  if (t === "song") return "Music";
  if (t === "image") return "Art";
  return "Post";
}

function renderFeed(posts) {
  feedEl.innerHTML = "";

  if (!posts.length) {
    setMsg("Nothing here yet.");
    return;
  }

  setMsg("");

  const images = posts.filter(p => p.type === "image");
  const nonImages = posts.filter(p => p.type !== "image");

  if (activeTab === "image" || (activeTab === "all" && images.length)) {
    const grid = document.createElement("div");
    grid.className = "profile-grid";

    images.forEach((p) => {
      const title = escapeHtml(p.title || "Untitled");
      const created = p.created_at ? new Date(p.created_at).toLocaleString() : "";
      const url = escapeHtml(p.image_url || "");
      const status = badgeHtml(p.status);

      const card = document.createElement("div");
      card.className = "grid-card";
      card.innerHTML = `
        <img src="${url}" alt="${title}">
        <div class="grid-card-body">
          <p class="grid-title">${title}</p>
          <p class="grid-meta">${status} <span style="margin-left:8px;">${escapeHtml(created)}</span></p>
        </div>
      `;
      grid.appendChild(card);
    });

    feedEl.appendChild(grid);
  }

  nonImages.forEach((p) => {
    const title = escapeHtml(p.title || "Untitled");
    const created = p.created_at ? new Date(p.created_at).toLocaleString() : "";
    const status = badgeHtml(p.status);
    const type = `<span class="badge">${escapeHtml(typeLabel(p.type))}</span>`;

    let bodyHtml = "";
    if (p.type === "poem") {
      bodyHtml = `<div class="profile-body">${escapeHtml(p.body_text || "")}</div>`;
    } else if (p.type === "song") {
      const url = escapeHtml(p.song_url || "");
      bodyHtml = url
        ? `<a class="open-link" href="${url}" target="_blank" rel="noopener noreferrer">Open link</a>`
        : `<div class="profile-body">No link provided.</div>`;
    } else {
      bodyHtml = `<div class="profile-body"></div>`;
    }

    const div = document.createElement("div");
    div.className = "profile-post";
    div.innerHTML = `
      <h3>${title}</h3>
      <div class="profile-meta">
        ${type}
        ${status}
        <span>${escapeHtml(created)}</span>
      </div>
      ${bodyHtml}
    `;
    feedEl.appendChild(div);
  });
}

function applyTab() {
  const filtered =
    activeTab === "all"
      ? allPosts
      : allPosts.filter((p) => p.type === activeTab);

  renderFeed(filtered);
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      activeTab = btn.getAttribute("data-tab") || "all";
      applyTab();
    });
  });
}

function setStats(posts) {
  const poem = posts.filter(p => p.type === "poem").length;
  const song = posts.filter(p => p.type === "song").length;
  const image = posts.filter(p => p.type === "image").length;

  if (statAll) statAll.textContent = String(posts.length);
  if (statPoem) statPoem.textContent = String(poem);
  if (statSong) statSong.textContent = String(song);
  if (statImage) statImage.textContent = String(image);
}

async function requireUser() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session) {
    window.location.href = "login.html?next=profile.html";
    return null;
  }

  const email = session.user?.email || "";
  if (emailEl) emailEl.textContent = email;

  const letter = (email.trim()[0] || "U").toUpperCase();
  if (avatarBigEl) avatarBigEl.textContent = letter;

  if (nameEl) nameEl.textContent = "My Profile";

  return session.user;
}

async function loadMyPosts(userId) {
  setMsg("Loading...");

  const { data, error } = await supabase
    .from("posts")
    .select("id,title,type,status,created_at,body_text,song_url,image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    setMsg(`Error: ${error.message}`);
    return;
  }

  allPosts = data || [];
  setStats(allPosts);
  applyTab();
}

setupTabs();

(async () => {
  const user = await requireUser();
  if (!user) return;
  await loadMyPosts(user.id);
})();
