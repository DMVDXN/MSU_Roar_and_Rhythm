import { supabase } from "./supabase.js";

const msgEl = document.getElementById("profileMsg");
const feedMsgEl = document.getElementById("feedMsg");
const feedEl = document.getElementById("profileFeed");

const displayNameEl = document.getElementById("profileDisplayName");
const usernameEl = document.getElementById("profileUsername");
const emailEl = document.getElementById("profileEmail");
const bioEl = document.getElementById("profileBio");
const websiteEl = document.getElementById("profileWebsite");

const avatarBigEl = document.getElementById("profileAvatarBig");

const editBtn = document.getElementById("editBtn");
const editPanel = document.getElementById("editPanel");
const cancelBtn = document.getElementById("cancelBtn");
const form = document.getElementById("profileForm");
const saveBtn = document.getElementById("saveBtn");

const inDisplayName = document.getElementById("display_name");
const inUsername = document.getElementById("username");
const inBio = document.getElementById("bio");
const inWebsite = document.getElementById("website");

const statAll = document.getElementById("statAll");
const statPoem = document.getElementById("statPoem");
const statSong = document.getElementById("statSong");
const statImage = document.getElementById("statImage");

let allPosts = [];
let activeTab = "all";
let currentUser = null;
let currentProfile = null;

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function setFeedMsg(text) {
  if (feedMsgEl) feedMsgEl.textContent = text || "";
}

function escapeHtml(str) {
  return (str ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeUsername(v) {
  return (v || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function validateUsername(v) {
  const u = normalizeUsername(v);
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 24) return "Username must be 24 characters or less.";
  if (!/^[a-z0-9_]+$/.test(u)) return "Username can only use letters, numbers, underscore.";
  return "";
}

function avatarLetter(profile, email) {
  const src =
    (profile?.display_name || "").trim() ||
    (profile?.username || "").trim() ||
    (email || "").trim();
  return (src[0] || "U").toUpperCase();
}

function showWebsite(url) {
  const u = (url || "").trim();
  if (!websiteEl) return;

  if (!u) {
    websiteEl.style.display = "none";
    websiteEl.href = "#";
    websiteEl.textContent = "";
    return;
  }

  websiteEl.style.display = "inline-block";
  websiteEl.href = u;
  websiteEl.textContent = u.replace(/^https?:\/\//, "");
}

function paintProfileUI(profile, email) {
  const disp = (profile?.display_name || "").trim();
  const uname = (profile?.username || "").trim();
  const bio = (profile?.bio || "").trim();

  if (displayNameEl) displayNameEl.textContent = disp || "My Profile";
  if (usernameEl) usernameEl.textContent = uname ? `@${uname}` : "";
  if (bioEl) bioEl.textContent = bio || "Your submissions and activity live here.";
  if (emailEl) emailEl.textContent = email || "";

  showWebsite(profile?.website || "");

  const letter = avatarLetter(profile, email);
  if (avatarBigEl) avatarBigEl.textContent = letter;

  if (inDisplayName) inDisplayName.value = disp;
  if (inUsername) inUsername.value = uname;
  if (inBio) inBio.value = bio;
  if (inWebsite) inWebsite.value = (profile?.website || "").trim();
}

async function ensureProfile(user) {
  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,website,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) throw readErr;
  if (existing) return existing;

  const email = user.email || "";
  const base = normalizeUsername(email.split("@")[0] || "user") || "user";

  for (let i = 0; i < 6; i++) {
    const candidate =
      i === 0 ? base.slice(0, 24) : `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 24);

    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username: candidate,
        display_name: "",
        bio: "",
        website: ""
      })
      .select("id,username,display_name,bio,website,avatar_url")
      .single();

    if (!insErr) return inserted;
  }

  return {
    id: user.id,
    username: "",
    display_name: "",
    bio: "",
    website: "",
    avatar_url: ""
  };
}

function typeLabel(t) {
  if (t === "poem") return "Poetry";
  if (t === "song") return "Music";
  if (t === "image") return "Art";
  return "Post";
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

function renderFeed(posts) {
  feedEl.innerHTML = "";

  if (!posts.length) {
    setFeedMsg("Nothing here yet.");
    return;
  }

  setFeedMsg("");

  const images = posts.filter(p => p.type === "image");
  const nonImages = posts.filter(p => p.type !== "image");

  if (activeTab === "image" || (activeTab === "all" && images.length)) {
    const grid = document.createElement("div");
    grid.className = "profile-grid";

    images.forEach((p) => {
      const title = escapeHtml(p.title || "Untitled");
      const created = p.created_at ? new Date(p.created_at).toLocaleString() : "";
      const url = escapeHtml(p.image_url || "");

      const card = document.createElement("div");
      card.className = "grid-card";
      card.innerHTML = `
        <img src="${url}" alt="${title}">
        <div class="grid-card-body">
          <p class="grid-title">${title}</p>
          <p class="grid-meta">${escapeHtml(created)}</p>
        </div>
      `;
      grid.appendChild(card);
    });

    feedEl.appendChild(grid);
  }

  nonImages.forEach((p) => {
    const title = escapeHtml(p.title || "Untitled");
    const created = p.created_at ? new Date(p.created_at).toLocaleString() : "";
    const type = `<span class="badge">${escapeHtml(typeLabel(p.type))}</span>`;

    let bodyHtml = "";
    if (p.type === "poem") {
      bodyHtml = `<div class="profile-body">${escapeHtml(p.body_text || "")}</div>`;
    } else if (p.type === "song") {
      const url = escapeHtml(p.song_url || "");
      bodyHtml = url
        ? `<a class="open-link" href="${url}" target="_blank" rel="noopener noreferrer">Open link</a>`
        : `<div class="profile-body">No link provided.</div>`;
    }

    const div = document.createElement("div");
    div.className = "profile-post";
    div.innerHTML = `
      <h3>${title}</h3>
      <div class="profile-meta">
        ${type}
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

function openEdit() {
  if (editPanel) editPanel.style.display = "block";
  setMsg("");
}

function closeEdit() {
  if (editPanel) editPanel.style.display = "none";
  setMsg("");
}

async function loadMyPosts(userId) {
  setFeedMsg("Loading...");

  const { data, error } = await supabase
    .from("posts")
    .select("id,title,type,created_at,body_text,song_url,image_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    setFeedMsg(`Error: ${error.message}`);
    return;
  }

  allPosts = data || [];
  setStats(allPosts);
  applyTab();
}

async function requireUser() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session) {
    window.location.href = "login.html?next=profile.html";
    return null;
  }

  return session.user;
}

async function saveProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  setMsg("");

  if (!saveBtn) {
    setMsg("Save button not found on page.");
    return;
  }

  saveBtn.disabled = true;

  try {
    const nextDisplay = (inDisplayName?.value || "").trim();
    const nextUsernameRaw = (inUsername?.value || "").trim();
    const nextBio = (inBio?.value || "").trim();
    let nextWebsite = (inWebsite?.value || "").trim();

    const normalizedUsername = normalizeUsername(nextUsernameRaw);
    const usernameErr = validateUsername(normalizedUsername);
    if (usernameErr) {
      setMsg(usernameErr);
      return;
    }

    // If they typed a website without https, add it so links work
    if (nextWebsite && !/^https?:\/\//i.test(nextWebsite)) {
      nextWebsite = `https://${nextWebsite}`;
    }

    const { data: saved, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: currentUser.id,
          username: normalizedUsername,
          display_name: nextDisplay,
          bio: nextBio,
          website: nextWebsite,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      )
      .select("id,username,display_name,bio,website,avatar_url")
      .single();

    if (error) {
      if (error.code === "23505") {
        setMsg("That username is taken. Try a different one.");
      } else {
        setMsg(`Error: ${error.message}`);
      }
      return;
    }

    currentProfile = saved;
    paintProfileUI(currentProfile, currentUser.email || "");
    closeEdit();
    setMsg("Saved.");

    setTimeout(() => setMsg(""), 900);
  } catch (err) {
    setMsg(`Error: ${err?.message || err}`);
  } finally {
    saveBtn.disabled = false;
  }
}


setupTabs();

if (editBtn) editBtn.addEventListener("click", openEdit);
if (cancelBtn) cancelBtn.addEventListener("click", closeEdit);
if (form) form.addEventListener("submit", saveProfile);

(async () => {
  try {
    currentUser = await requireUser();
    if (!currentUser) return;

    currentProfile = await ensureProfile(currentUser);
    paintProfileUI(currentProfile, currentUser.email || "");

    await loadMyPosts(currentUser.id);
  } catch (err) {
    setMsg(err?.message || "Error loading profile.");
  }
})();
