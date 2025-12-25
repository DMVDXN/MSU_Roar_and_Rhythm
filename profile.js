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
const avatarFallbackEl = document.getElementById("profileAvatarFallback");

const editBtn = document.getElementById("editBtn");
const editPanel = document.getElementById("editPanel");
const cancelBtn = document.getElementById("cancelBtn");
const form = document.getElementById("profileForm");
const saveBtn = document.getElementById("saveBtn");

const inDisplayName = document.getElementById("display_name");
const inUsername = document.getElementById("username");
const inBio = document.getElementById("bio");
const inWebsite = document.getElementById("website");
const inAvatarUrl = document.getElementById("avatar_url");

let currentUser = null;
let currentProfile = null;

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function setFeedMsg(text) {
  if (feedMsgEl) feedMsgEl.textContent = text || "";
}

function setSaving(isSaving) {
  if (!saveBtn) return;
  saveBtn.disabled = isSaving;
  saveBtn.textContent = isSaving ? "Saving..." : "Save";
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(el, value) {
  if (!el) return;
  el.textContent = value || "";
}

function showWebsite(url) {
  if (!websiteEl) return;
  const v = (url || "").trim();
  if (!v) {
    websiteEl.textContent = "";
    websiteEl.removeAttribute("href");
    return;
  }
  websiteEl.textContent = v;
  websiteEl.href = v;
}

function setAvatar(avatarUrl, displayName, email) {
  const url = (avatarUrl || "").trim();
  const fallbackLetter =
    ((displayName || "").trim()[0] ||
      (email || "").trim()[0] ||
      "U").toUpperCase();

  if (avatarFallbackEl) avatarFallbackEl.textContent = fallbackLetter;

  if (!avatarBigEl) return;

  if (url) {
    avatarBigEl.src = url;
    avatarBigEl.style.display = "block";
    if (avatarFallbackEl) avatarFallbackEl.style.display = "none";
    avatarBigEl.onerror = () => {
      avatarBigEl.removeAttribute("src");
      avatarBigEl.style.display = "none";
      if (avatarFallbackEl) avatarFallbackEl.style.display = "flex";
    };
  } else {
    avatarBigEl.removeAttribute("src");
    avatarBigEl.style.display = "none";
    if (avatarFallbackEl) avatarFallbackEl.style.display = "flex";
  }
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    setMsg("Auth error: " + error.message);
    return null;
  }

  if (!data || !data.user) {
    window.location.href = "login.html";
    return null;
  }

  return data.user;
}

async function loadProfile(user) {
  setMsg("");
  setFeedMsg("");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, bio, website, avatar_url, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("profiles select error", error);
    setMsg(
      "Profile load failed. Make sure you have a 'profiles' table with columns: id, display_name, username, bio, website, avatar_url."
    );
    return null;
  }

  // If no row yet, create one so updates always work
  if (!data) {
    const baseUsername =
      (user.email || "user").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "user";

    const createPayload = {
      id: user.id,
      display_name: "",
      username: baseUsername,
      bio: "",
      website: "",
      avatar_url: "",
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: createErr } = await supabase
      .from("profiles")
      .upsert(createPayload, { onConflict: "id" })
      .select("id, display_name, username, bio, website, avatar_url, updated_at")
      .single();

    if (createErr) {
      console.error("profiles upsert create error", createErr);
      setMsg("Could not create profile row: " + createErr.message);
      return null;
    }

    return created;
  }

  return data;
}

function renderProfile(user, profile) {
  const dn = (profile.display_name || "").trim();
  const un = (profile.username || "").trim();
  const bio = (profile.bio || "").trim();
  const website = (profile.website || "").trim();
  const avatarUrl = (profile.avatar_url || "").trim();

  safeText(displayNameEl, dn || "No display name yet");
  safeText(usernameEl, un ? "@" + un : "@(no username)");
  safeText(emailEl, user.email || "");

  safeText(bioEl, bio || "No bio yet.");
  showWebsite(website);

  setAvatar(avatarUrl, dn, user.email || "");

  // preload form values (so edit always reflects current profile)
  if (inDisplayName) inDisplayName.value = dn;
  if (inUsername) inUsername.value = un;
  if (inBio) inBio.value = bio;
  if (inWebsite) inWebsite.value = website;
  if (inAvatarUrl) inAvatarUrl.value = avatarUrl;
}

function openEdit() {
  if (!editPanel) return;
  editPanel.style.display = "block";
  setFeedMsg("");
}

function closeEdit() {
  if (!editPanel) return;
  editPanel.style.display = "none";
  setFeedMsg("");
}

function renderPost(p) {
  const title = escapeHtml(p.title || "");
  const date = p.created_at ? new Date(p.created_at).toLocaleString() : "";
  const status = escapeHtml(p.status || "");
  const type = escapeHtml(p.type || "");

  let body = "";
  if (p.type === "poem" && p.body_text) {
    body = `<div class="body">${escapeHtml(p.body_text).replaceAll("\n", "<br>")}</div>`;
  }
  if (p.type === "song" && p.song_url) {
    const u = escapeHtml(p.song_url);
    body = `<div class="body"><a href="${u}" target="_blank" rel="noreferrer">${u}</a></div>`;
  }
  if (p.type === "image" && p.image_url) {
    const u = escapeHtml(p.image_url);
    body = `<div class="body"><img class="post-img" src="${u}" alt="Uploaded artwork"></div>`;
  }

  return `
    <div class="post">
      <h3>${title}</h3>
      <div class="meta">${date} <span class="pill">${type}</span> <span class="pill pill-muted">${status}</span></div>
      ${body}
    </div>
  `;
}

async function loadMyPosts(user) {
  if (!feedEl) return;

  feedEl.innerHTML = "";
  setMsg("");
  setFeedMsg("Loading your submissions...");

  const { data, error } = await supabase
    .from("posts")
    .select("id, type, title, body_text, song_url, image_url, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("posts select error", error);
    setFeedMsg("Could not load your submissions: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    setFeedMsg("No submissions yet.");
    return;
  }

  setFeedMsg("");
  feedEl.innerHTML = data.map(renderPost).join("");
}

editBtn?.addEventListener("click", openEdit);
cancelBtn?.addEventListener("click", closeEdit);

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  setSaving(true);
  setFeedMsg("");

  try {
    const display_name = (inDisplayName?.value || "").trim();
    const username = (inUsername?.value || "").trim();
    const bio = (inBio?.value || "").trim();
    const website = (inWebsite?.value || "").trim();
    const avatar_url = (inAvatarUrl?.value || "").trim();

    if (username && !/^[a-zA-Z0-9_]{3,40}$/.test(username)) {
      setFeedMsg("Username must be 3 to 40 characters (letters, numbers, underscore).");
      return;
    }

    const payload = {
      id: currentUser.id,
      display_name,
      username,
      bio,
      website,
      avatar_url,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, display_name, username, bio, website, avatar_url, updated_at")
      .single();

    if (error) {
      console.error("profiles upsert error", error);
      setFeedMsg("Save failed: " + error.message);
      return;
    }

    currentProfile = data;
    renderProfile(currentUser, currentProfile);
    closeEdit();
    setMsg("Saved.");
  } catch (err) {
    console.error("save exception", err);
    setFeedMsg("Save failed. Check console for details.");
  } finally {
    setSaving(false);
  }
});

async function init() {
  currentUser = await requireUser();
  if (!currentUser) return;

  currentProfile = await loadProfile(currentUser);
  if (!currentProfile) return;

  renderProfile(currentUser, currentProfile);
  await loadMyPosts(currentUser);

  // keep page in sync if session changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session || !session.user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = session.user;
    currentProfile = await loadProfile(currentUser);
    if (currentProfile) renderProfile(currentUser, currentProfile);
    await loadMyPosts(currentUser);
  });
}

init();
