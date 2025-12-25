// profile.js
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

const statAllEl = document.getElementById("statAll");
const statPoemEl = document.getElementById("statPoem");
const statSongEl = document.getElementById("statSong");
const statImageEl = document.getElementById("statImage");

const tabBtns = Array.from(document.querySelectorAll(".profile-tabs .tab"));

let currentUser = null;
let currentProfile = null;

let allPosts = [];
let activeTab = "all"; // all | poem | song | image

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
    websiteEl.style.display = "none";
    websiteEl.textContent = "";
    websiteEl.removeAttribute("href");
    return;
  }

  websiteEl.style.display = "inline-block";
  websiteEl.textContent = v;
  websiteEl.href = v;
}

function setAvatarLetter(displayName, email) {
  if (!avatarBigEl) return;

  const letter =
    ((displayName || "").trim()[0] ||
      (email || "").trim()[0] ||
      "U").toUpperCase();

  avatarBigEl.textContent = letter;
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
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

  if (data) return data;

  // Create one if missing
  const baseUsername =
    (user.email || "user")
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 24) || "user";

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

function renderProfile(user, profile) {
  const dn = (profile.display_name || "").trim();
  const un = (profile.username || "").trim();
  const bio = (profile.bio || "").trim();
  const website = (profile.website || "").trim();

  safeText(displayNameEl, dn || "No display name yet");
  safeText(usernameEl, un ? "@" + un : "@(no username)");
  safeText(emailEl, user.email || "");
  safeText(bioEl, bio || "No bio yet.");
  showWebsite(website);

  setAvatarLetter(dn || un, user.email || "");

  // preload form values
  if (inDisplayName) inDisplayName.value = dn;
  if (inUsername) inUsername.value = un;
  if (inBio) inBio.value = bio;
  if (inWebsite) inWebsite.value = website;
}

function updateStats(posts) {
  const total = posts.length;
  const poems = posts.filter((p) => p.type === "poem").length;
  const songs = posts.filter((p) => p.type === "song").length;
  const images = posts.filter((p) => p.type === "image").length;

  if (statAllEl) statAllEl.textContent = String(total);
  if (statPoemEl) statPoemEl.textContent = String(poems);
  if (statSongEl) statSongEl.textContent = String(songs);
  if (statImageEl) statImageEl.textContent = String(images);
}

function getFilteredPosts() {
  if (activeTab === "all") return allPosts.slice();
  return allPosts.filter((p) => p.type === activeTab);
}

function getHideLabel(status) {
  return status === "hidden" ? "Unhide" : "Hide";
}

function renderPostCard(p) {
  const id = escapeHtml(p.id);
  const title = escapeHtml(p.title || "Untitled");
  const date = formatDate(p.created_at);
  const type = escapeHtml(p.type || "");
  const status = escapeHtml(p.status || "");

  let bodyHtml = "";
  if (p.type === "poem") {
    bodyHtml = `<div class="profile-body">${escapeHtml(p.body_text || "").replaceAll("\n", "<br>")}</div>`;
  } else if (p.type === "song") {
    const u = escapeHtml(p.song_url || "");
    bodyHtml = u
      ? `<div class="profile-body"><a class="open-link" href="${u}" target="_blank" rel="noreferrer">Open link</a></div>`
      : `<div class="profile-body">(no song link)</div>`;
  } else if (p.type === "image") {
    const u = escapeHtml(p.image_url || "");
    bodyHtml = u
      ? `<div class="profile-body"><img class="post-img" src="${u}" alt="Artwork"></div>`
      : `<div class="profile-body">(no image)</div>`;
  }

  const hideLabel = getHideLabel(p.status);

  return `
    <article class="profile-post" data-id="${id}">
      <div class="post-top">
        <div class="post-left">
          <h3>${title}</h3>
          <div class="profile-meta">
            <span>${escapeHtml(date)}</span>
            <span class="badge">${type}</span>
            <span class="badge">${status}</span>
          </div>
        </div>

        <div class="post-actions">
          <button class="btn btn-outline post-edit" type="button" data-action="edit">Edit</button>
          <button class="btn btn-ghost post-hide" type="button" data-action="hide">${escapeHtml(hideLabel)}</button>
          <button class="btn btn-danger post-delete" type="button" data-action="delete">Delete</button>
        </div>
      </div>

      ${bodyHtml}
    </article>
  `;
}

function renderFeed() {
  if (!feedEl) return;

  const posts = getFilteredPosts();

  if (posts.length === 0) {
    feedEl.innerHTML = "";
    setFeedMsg("No submissions in this tab yet.");
    return;
  }

  setFeedMsg("");
  feedEl.innerHTML = posts.map(renderPostCard).join("");
}

async function loadMyPosts(user) {
  if (!feedEl) return;

  feedEl.innerHTML = "";
  setFeedMsg("Loading your submissions...");

  const { data, error } = await supabase
    .from("posts")
    .select("id, type, title, body_text, song_url, image_url, status, created_at, user_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("posts select error", error);
    setFeedMsg("Could not load your submissions: " + error.message);
    return;
  }

  allPosts = data || [];
  updateStats(allPosts);
  renderFeed();
}

function setActiveTab(tab) {
  activeTab = tab;

  tabBtns.forEach((btn) => {
    const isActive = btn.getAttribute("data-tab") === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  renderFeed();
}

function ensurePostModal() {
  if (document.getElementById("postEditModal")) return;

  const modal = document.createElement("div");
  modal.id = "postEditModal";
  modal.className = "post-modal";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="post-modal-backdrop" data-close="1"></div>
    <div class="post-modal-panel" role="dialog" aria-modal="true" aria-label="Edit post">
      <div class="post-modal-header">
        <div class="post-modal-title">Edit post</div>
        <button class="post-modal-close btn btn-ghost" type="button" data-close="1">Close</button>
      </div>

      <form id="postEditForm" class="post-modal-form">
        <div class="field">
          <label for="postTitle">Title</label>
          <input id="postTitle" type="text" maxlength="80" required>
        </div>

        <div class="field" id="poemFieldWrap">
          <label for="postBody">Poem text</label>
          <textarea id="postBody" rows="8"></textarea>
        </div>

        <div class="field" id="songFieldWrap">
          <label for="postSongUrl">Song URL</label>
          <input id="postSongUrl" type="url" maxlength="400">
        </div>

        <div class="field" id="imageFieldWrap">
          <label for="postImageUrl">Image URL</label>
          <input id="postImageUrl" type="url" maxlength="400">
        </div>

        <div class="edit-actions">
          <button id="postSaveBtn" class="btn btn-solid" type="submit">Save changes</button>
        </div>

        <p id="postEditMsg" class="profile-msg"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close='1']")) closePostModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePostModal();
  });
}

let editingPostId = null;
let editingPostType = null;

function openPostModal(post) {
  ensurePostModal();

  const modal = document.getElementById("postEditModal");
  const formEl = document.getElementById("postEditForm");
  const msg = document.getElementById("postEditMsg");

  const titleEl = document.getElementById("postTitle");
  const bodyEl = document.getElementById("postBody");
  const songUrlEl = document.getElementById("postSongUrl");
  const imageUrlEl = document.getElementById("postImageUrl");

  const poemWrap = document.getElementById("poemFieldWrap");
  const songWrap = document.getElementById("songFieldWrap");
  const imageWrap = document.getElementById("imageFieldWrap");

  editingPostId = post.id;
  editingPostType = post.type;

  if (msg) msg.textContent = "";

  if (titleEl) titleEl.value = post.title || "";

  if (poemWrap) poemWrap.style.display = post.type === "poem" ? "block" : "none";
  if (songWrap) songWrap.style.display = post.type === "song" ? "block" : "none";
  if (imageWrap) imageWrap.style.display = post.type === "image" ? "block" : "none";

  if (bodyEl) bodyEl.value = post.body_text || "";
  if (songUrlEl) songUrlEl.value = post.song_url || "";
  if (imageUrlEl) imageUrlEl.value = post.image_url || "";

  if (formEl) {
    formEl.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentUser || !editingPostId) return;

      const payload = {
        title: (titleEl?.value || "").trim(),
      };

      if (editingPostType === "poem") payload.body_text = (bodyEl?.value || "").trim();
      if (editingPostType === "song") payload.song_url = (songUrlEl?.value || "").trim();
      if (editingPostType === "image") payload.image_url = (imageUrlEl?.value || "").trim();

      const { error } = await supabase
        .from("posts")
        .update(payload)
        .eq("id", editingPostId)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("edit post error", error);
        if (msg) msg.textContent = "Save failed: " + error.message;
        return;
      }

      await loadMyPosts(currentUser);
      closePostModal();
    };
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closePostModal() {
  const modal = document.getElementById("postEditModal");
  if (!modal) return;

  editingPostId = null;
  editingPostType = null;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function handleDeletePost(postId) {
  if (!currentUser) return;

  const ok = window.confirm("Delete this post? This cannot be undone.");
  if (!ok) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("delete post error", error);
    setFeedMsg("Delete failed: " + error.message);
    return;
  }

  await loadMyPosts(currentUser);
}

async function handleToggleHide(post) {
  if (!currentUser) return;

  const nextStatus = post.status === "hidden" ? "approved" : "hidden";

  const { error } = await supabase
    .from("posts")
    .update({ status: nextStatus })
    .eq("id", post.id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("hide post error", error);
    setFeedMsg("Hide failed: " + error.message);
    return;
  }

  await loadMyPosts(currentUser);
}

function setupFeedActions() {
  if (!feedEl) return;

  feedEl.addEventListener("click", async (e) => {
    const postEl = e.target.closest(".profile-post");
    if (!postEl) return;

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    const postId = postEl.getAttribute("data-id");
    if (!postId) return;

    const action = actionBtn.getAttribute("data-action");
    const post = allPosts.find((p) => String(p.id) === String(postId));
    if (!post) return;

    if (action === "delete") {
      await handleDeletePost(postId);
      return;
    }

    if (action === "hide") {
      await handleToggleHide(post);
      return;
    }

    if (action === "edit") {
      openPostModal(post);
      return;
    }
  });
}

editBtn?.addEventListener("click", openEdit);
cancelBtn?.addEventListener("click", closeEdit);

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab") || "all";
    setActiveTab(tab);
  });
});

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

    if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setFeedMsg("Username must be 3 to 24 characters (letters, numbers, underscore).");
      return;
    }

    const payload = {
      id: currentUser.id,
      display_name,
      username,
      bio,
      website,
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
  setupFeedActions();

  currentUser = await requireUser();
  if (!currentUser) return;

  currentProfile = await loadProfile(currentUser);
  if (!currentProfile) return;

  renderProfile(currentUser, currentProfile);
  await loadMyPosts(currentUser);

  // default tab
  setActiveTab("all");

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session || !session.user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = session.user;

    currentProfile = await loadProfile(currentUser);
    if (currentProfile) renderProfile(currentUser, currentProfile);

    await loadMyPosts(currentUser);
    setActiveTab(activeTab);
  });
}

init();
