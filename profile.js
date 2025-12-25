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
const inAvatarUrl = document.getElementById("avatar_url");

const statAll = document.getElementById("statAll");
const statPoem = document.getElementById("statPoem");
const statSong = document.getElementById("statSong");
const statImage = document.getElementById("statImage");

const tabBtns = Array.from(document.querySelectorAll(".profile-tabs .tab"));

let currentUser = null;
let currentProfile = null;

let allPosts = [];
let activeTab = "all";

// post editing state
let editingPostId = null;
let postSaving = false;

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

function normalizeWebsite(url) {
  const v = (url || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return "https://" + v;
}

function showWebsite(url) {
  if (!websiteEl) return;
  const v = normalizeWebsite(url);
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

function setBigAvatar(profile, userEmail) {
  if (!avatarBigEl) return;

  const dn = (profile?.display_name || "").trim();
  const un = (profile?.username || "").trim();
  const email = (userEmail || "").trim();
  const url = (profile?.avatar_url || "").trim();

  const nameSource = dn || un || email || "U";
  const letter = (nameSource[0] || "U").toUpperCase();

  if (url) {
    avatarBigEl.textContent = "";
    avatarBigEl.style.backgroundImage = `url("${url}")`;
    avatarBigEl.classList.add("has-img");
  } else {
    avatarBigEl.textContent = letter;
    avatarBigEl.style.backgroundImage = "";
    avatarBigEl.classList.remove("has-img");
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

function cleanUsernameFromEmail(email) {
  const local = (email || "").split("@")[0] || "user";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return cleaned || "user";
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
    setMsg("Profile load failed: " + error.message);
    return null;
  }

  if (data) return data;

  const base = cleanUsernameFromEmail(user.email || "");
  const createPayload = {
    id: user.id,
    display_name: base,
    username: base,
    bio: "",
    website: "",
    avatar_url: "",
    updated_at: new Date().toISOString()
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
  const dn = (profile?.display_name || "").trim();
  const un = (profile?.username || "").trim();
  const bio = (profile?.bio || "").trim();
  const website = (profile?.website || "").trim();

  safeText(displayNameEl, dn || "No display name yet");
  safeText(usernameEl, un ? "@" + un : "@(no username)");
  safeText(emailEl, user?.email || "");
  safeText(bioEl, bio || "No bio yet.");
  showWebsite(website);

  setBigAvatar(profile, user?.email || "");

  if (inDisplayName) inDisplayName.value = dn;
  if (inUsername) inUsername.value = un;
  if (inBio) inBio.value = bio;
  if (inWebsite) inWebsite.value = website;
  if (inAvatarUrl) inAvatarUrl.value = (profile?.avatar_url || "").trim();
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

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

function setActiveTab(tab) {
  activeTab = tab;

  tabBtns.forEach((btn) => {
    const isOn = btn.getAttribute("data-tab") === tab;
    btn.classList.toggle("active", isOn);
    btn.setAttribute("aria-selected", isOn ? "true" : "false");
  });

  // close any open post editor when switching tabs
  editingPostId = null;
  renderFeed();
}

function updateStats(posts) {
  const poemCount = posts.filter((p) => p.type === "poem").length;
  const songCount = posts.filter((p) => p.type === "song").length;
  const imageCount = posts.filter((p) => p.type === "image").length;

  if (statAll) statAll.textContent = String(posts.length);
  if (statPoem) statPoem.textContent = String(poemCount);
  if (statSong) statSong.textContent = String(songCount);
  if (statImage) statImage.textContent = String(imageCount);
}

function getFilteredPosts() {
  if (activeTab === "all") return allPosts;
  return allPosts.filter((p) => p.type === activeTab);
}

function makePostBody(p) {
  if (p.type === "poem") {
    const body = (p.body_text || "").trim();
    return `<div class="profile-body">${escapeHtml(body)}</div>`;
  }

  if (p.type === "song") {
    const u = (p.song_url || "").trim();
    if (!u) return `<div class="profile-body">(No link)</div>`;
    const safe = escapeHtml(u);
    return `
      <div class="profile-body">
        <a class="open-link" href="${safe}" target="_blank" rel="noreferrer">Open link</a>
        <div class="link-line">${safe}</div>
      </div>
    `;
  }

  if (p.type === "image") {
    const u = (p.image_url || "").trim();
    if (!u) return `<div class="profile-body">(No image)</div>`;
    const safe = escapeHtml(u);
    return `
      <div class="profile-body">
        <img class="post-img" src="${safe}" alt="Uploaded artwork">
      </div>
    `;
  }

  return `<div class="profile-body"></div>`;
}

function makeEditForm(p) {
  const id = escapeHtml(p.id);
  const type = p.type || "poem";
  const title = escapeHtml((p.title || "").trim());

  const poemBody = escapeHtml((p.body_text || "").trim());
  const songUrl = escapeHtml((p.song_url || "").trim());
  const imageUrl = escapeHtml((p.image_url || "").trim());

  let typeFields = "";
  if (type === "poem") {
    typeFields = `
      <div class="edit-row">
        <label>Poem text</label>
        <textarea class="edit-input" data-field="body_text" rows="6" placeholder="Write your poem...">${poemBody}</textarea>
      </div>
    `;
  } else if (type === "song") {
    typeFields = `
      <div class="edit-row">
        <label>Song link</label>
        <input class="edit-input" data-field="song_url" type="url" value="${songUrl}" placeholder="https://...">
      </div>
    `;
  } else if (type === "image") {
    typeFields = `
      <div class="edit-row">
        <label>Image URL</label>
        <input class="edit-input" data-field="image_url" type="url" value="${imageUrl}" placeholder="https://...">
      </div>
    `;
  }

  return `
    <div class="post-edit" data-editing="1">
      <div class="edit-row">
        <label>Title</label>
        <input class="edit-input" data-field="title" type="text" value="${title}" maxlength="80" placeholder="Title">
      </div>

      ${typeFields}

      <div class="edit-actions-row">
        <button class="btn btn-solid post-save" type="button" data-action="save-edit" data-id="${id}">
          ${postSaving ? "Saving..." : "Save changes"}
        </button>
        <button class="btn btn-ghost post-cancel" type="button" data-action="cancel-edit" data-id="${id}">
          Cancel
        </button>
        <div class="post-edit-msg" data-edit-msg="${id}"></div>
      </div>
    </div>
  `;
}

function renderPostCard(p) {
  const id = escapeHtml(p.id);
  const title = escapeHtml(p.title || "Untitled");
  const date = formatDate(p.created_at);
  const status = escapeHtml(p.status || "pending");
  const type = escapeHtml(p.type || "");
  const isHidden = !!p.is_hidden;
  const hideLabel = isHidden ? "Unhide" : "Hide";
  const hiddenBadge = isHidden ? '<span class="badge badge-hidden">Hidden</span>' : "";

  const isEditing = String(editingPostId || "") === String(p.id);

  return `
    <article class="profile-post" data-id="${id}">
      <div class="profile-post-top">
        <h3>${title}</h3>
        <div class="post-actions">
          <button class="edit-btn" type="button" data-action="edit" data-id="${id}">Edit</button>
          <button class="hide-btn" type="button" data-action="toggle-hide" data-id="${id}">${hideLabel}</button>
          <button class="delete-btn" type="button" data-action="delete" data-id="${id}">Delete</button>
        </div>
      </div>

      <div class="profile-meta">
        <span>${escapeHtml(date)}</span>
        <span class="badge">${type}</span>
        ${hiddenBadge}
        <span class="badge badge-muted">${status}</span>
      </div>

      ${isEditing ? makeEditForm(p) : makePostBody(p)}
    </article>
  `;
}

function renderFeed() {
  if (!feedEl) return;

  const posts = getFilteredPosts();
  updateStats(allPosts);

  if (!posts.length) {
    feedEl.innerHTML = "";
    if (activeTab === "all") setFeedMsg("No submissions yet.");
    else setFeedMsg("No submissions in this tab yet.");
    return;
  }

  setFeedMsg("");
  feedEl.innerHTML = posts.map(renderPostCard).join("");
}

async function loadMyPosts(user) {
  if (!feedEl) return;

  feedEl.innerHTML = "";
  setMsg("");
  setFeedMsg("Loading your submissions...");

  const { data, error } = await supabase
    .from("posts")
    .select("id, type, title, body_text, song_url, image_url, status, created_at, is_hidden")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("posts select error", error);
    setFeedMsg("Could not load your submissions: " + error.message);
    return;
  }

  allPosts = Array.isArray(data) ? data : [];
  editingPostId = null;
  renderFeed();
}

async function usernameAvailable(username, myId) {
  const u = (username || "").trim();
  if (!u) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", u)
    .neq("id", myId)
    .limit(1);

  if (error) return true;
  return !data || data.length === 0;
}

async function deletePostById(postId) {
  if (!currentUser) return;

  const ok = confirm("Delete this post? This cannot be undone.");
  if (!ok) return;

  setFeedMsg("Deleting...");

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("delete error", error);
    setFeedMsg("Delete failed: " + error.message);
    return;
  }

  allPosts = allPosts.filter((p) => String(p.id) !== String(postId));
  editingPostId = null;
  renderFeed();
  setFeedMsg("Deleted.");
  setTimeout(() => setFeedMsg(""), 900);
}

async function toggleHidden(postId) {
  if (!currentUser) return;

  const post = allPosts.find((p) => String(p.id) === String(postId));
  if (!post) return;

  const nextHidden = !post.is_hidden;
  setFeedMsg(nextHidden ? "Hiding..." : "Making visible...");

  const { data, error } = await supabase
    .from("posts")
    .update({ is_hidden: nextHidden })
    .eq("id", postId)
    .eq("user_id", currentUser.id)
    .select("id, type, title, body_text, song_url, image_url, status, created_at, is_hidden")
    .maybeSingle();

  if (error) {
    console.error("hide toggle error", error);
    setFeedMsg("Update failed: " + error.message);
    return;
  }

  if (data) {
    allPosts = allPosts.map((p) => (String(p.id) === String(postId) ? data : p));
  } else {
    allPosts = allPosts.map((p) => {
      if (String(p.id) !== String(postId)) return p;
      return { ...p, is_hidden: nextHidden };
    });
  }

  renderFeed();
  setFeedMsg(nextHidden ? "Hidden from public pages." : "Visible on public pages.");
  setTimeout(() => setFeedMsg(""), 900);
}

function setInlineEditMsg(postId, text) {
  const el = document.querySelector(`[data-edit-msg="${CSS.escape(String(postId))}"]`);
  if (!el) return;
  el.textContent = text || "";
}

function readEditValuesFromCard(cardEl, type) {
  const titleEl = cardEl.querySelector(`[data-field="title"]`);
  const title = (titleEl?.value || "").trim();

  const payload = { title };

  if (type === "poem") {
    const bodyEl = cardEl.querySelector(`[data-field="body_text"]`);
    payload.body_text = (bodyEl?.value || "").trim();
  } else if (type === "song") {
    const urlEl = cardEl.querySelector(`[data-field="song_url"]`);
    payload.song_url = (urlEl?.value || "").trim();
  } else if (type === "image") {
    const urlEl = cardEl.querySelector(`[data-field="image_url"]`);
    payload.image_url = (urlEl?.value || "").trim();
  }

  return payload;
}

function validatePostUpdate(type, payload) {
  if (!payload.title) return "Title is required.";

  if (type === "poem") {
    if (!payload.body_text) return "Poem text is required.";
  }
  if (type === "song") {
    if (!payload.song_url) return "Song link is required.";
  }
  if (type === "image") {
    if (!payload.image_url) return "Image URL is required.";
  }

  return "";
}

async function savePostEdits(postId, cardEl) {
  if (!currentUser) return;

  const post = allPosts.find((p) => String(p.id) === String(postId));
  if (!post) return;

  const type = post.type || "poem";
  const payload = readEditValuesFromCard(cardEl, type);
  const errText = validatePostUpdate(type, payload);
  if (errText) {
    setInlineEditMsg(postId, errText);
    return;
  }

  setInlineEditMsg(postId, "");
  postSaving = true;
  renderFeed();

  const updatePayload = { title: payload.title };

  if (type === "poem") updatePayload.body_text = payload.body_text;
  if (type === "song") updatePayload.song_url = payload.song_url;
  if (type === "image") updatePayload.image_url = payload.image_url;

  const { data, error } = await supabase
    .from("posts")
    .update(updatePayload)
    .eq("id", postId)
    .eq("user_id", currentUser.id)
    .select("id, type, title, body_text, song_url, image_url, status, created_at, is_hidden")
    .maybeSingle();

  postSaving = false;

  if (error) {
    console.error("update post error", error);
    renderFeed();
    setInlineEditMsg(postId, "Save failed: " + error.message);
    return;
  }

  if (data) {
    allPosts = allPosts.map((p) => (String(p.id) === String(postId) ? data : p));
  } else {
    // fallback if select is blocked by policy
    allPosts = allPosts.map((p) => {
      if (String(p.id) !== String(postId)) return p;
      return { ...p, ...updatePayload };
    });
  }

  editingPostId = null;
  renderFeed();
  setFeedMsg("Updated.");
  setTimeout(() => setFeedMsg(""), 900);
}

editBtn?.addEventListener("click", openEdit);
cancelBtn?.addEventListener("click", closeEdit);

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab") || "all";
    setActiveTab(tab);
  });
});

feedEl?.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.getAttribute("data-action");
  const id = actionEl.getAttribute("data-id");
  if (!id) return;

  if (action === "delete") {
    deletePostById(id);
    return;
  }

  if (action === "toggle-hide") {
    toggleHidden(id);
    return;
  }

  if (action === "edit") {
    editingPostId = String(editingPostId) === String(id) ? null : id;
    postSaving = false;
    renderFeed();
    return;
  }

  if (action === "cancel-edit") {
    editingPostId = null;
    postSaving = false;
    renderFeed();
    return;
  }

  if (action === "save-edit") {
    const cardEl = actionEl.closest(".profile-post");
    if (!cardEl) return;
    savePostEdits(id, cardEl);
  }
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
    const avatar_url = (inAvatarUrl?.value || "").trim();

    if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setFeedMsg("Username must be 3 to 24 characters (letters, numbers, underscore).");
      return;
    }

    const isFree = await usernameAvailable(username, currentUser.id);
    if (!isFree) {
      setFeedMsg("That username is taken. Try another one.");
      return;
    }

    const payload = {
      id: currentUser.id,
      display_name,
      username,
      bio,
      website: normalizeWebsite(website),
      avatar_url,
      updated_at: new Date().toISOString()
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
    setTimeout(() => setMsg(""), 900);
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
