// engagement.js
import { supabase } from "./supabase.js";

const listEl = document.getElementById("list");
const featuredWrap = document.getElementById("featuredWrap");
const msgEl = document.getElementById("msg");

let currentUserId = null;

function toast(text) {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => {
    msgEl.textContent = "";
  }, 2500);
}

async function refreshUser() {
  const { data } = await supabase.auth.getUser();
  currentUserId = data?.user?.id || null;
}

function ensureLoggedIn() {
  if (currentUserId) return true;
  toast("Please log in to interact with posts.");
  return false;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortUserId(id) {
  const s = String(id || "");
  return s.length >= 8 ? s.slice(0, 8) : s;
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function iconHeart() {
  return `
    <svg class="post-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 21s-7.2-4.35-9.6-8.55C.6 9.1 2.7 5.5 6.6 5.5c2.1 0 3.6 1.2 4.4 2.2.8-1 2.3-2.2 4.4-2.2 3.9 0 6 3.6 4.2 6.95C19.2 16.65 12 21 12 21zm0-2.3c1.9-1.2 6.4-4.4 7.7-6.75 1.2-2.1-.2-4.55-2.9-4.55-1.8 0-3.1 1.2-3.6 2.1l-1.2 2-1.2-2c-.5-.9-1.8-2.1-3.6-2.1-2.7 0-4.1 2.45-2.9 4.55C5.6 14.3 10.1 17.5 12 18.7z"/>
    </svg>
  `;
}

function iconBookmark() {
  return `
    <svg class="post-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 3c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2H7zm0 2h10v13.2l-5-2.1-5 2.1V5z"/>
    </svg>
  `;
}

function iconComment() {
  return `
    <svg class="post-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H9l-5 4v-4H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v10h2v2.2L8.6 16H20V6H4z"/>
    </svg>
  `;
}

function buildActionsBar() {
  const wrap = document.createElement("div");
  wrap.className = "post-actions";
  wrap.innerHTML = `
    <button type="button" class="post-action-btn" data-action="like">
      ${iconHeart()}
      <span class="post-action-label">Like</span>
      <span class="post-action-count" data-count="like">0</span>
    </button>

    <button type="button" class="post-action-btn" data-action="save">
      ${iconBookmark()}
      <span class="post-action-label">Save</span>
      <span class="post-action-count" data-count="save">0</span>
    </button>

    <button type="button" class="post-action-btn" data-action="comment">
      ${iconComment()}
      <span class="post-action-label">Comment</span>
      <span class="post-action-count" data-count="comment">0</span>
    </button>
  `;
  return wrap;
}

async function fetchCounts(postIds) {
  const [likesRes, savesRes, commentsRes] = await Promise.all([
    supabase.from("post_like_counts").select("post_id, like_count").in("post_id", postIds),
    supabase.from("post_save_counts").select("post_id, save_count").in("post_id", postIds),
    supabase.from("post_comment_counts").select("post_id, comment_count").in("post_id", postIds)
  ]);

  const likeMap = new Map();
  const saveMap = new Map();
  const commentMap = new Map();

  (likesRes.data || []).forEach((r) => likeMap.set(r.post_id, r.like_count || 0));
  (savesRes.data || []).forEach((r) => saveMap.set(r.post_id, r.save_count || 0));
  (commentsRes.data || []).forEach((r) => commentMap.set(r.post_id, r.comment_count || 0));

  return { likeMap, saveMap, commentMap };
}

async function fetchMyStates(postIds) {
  if (!currentUserId) return { liked: new Set(), saved: new Set() };

  const [likesRes, savesRes] = await Promise.all([
    supabase.from("post_likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
    supabase.from("post_saves").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
  ]);

  return {
    liked: new Set((likesRes.data || []).map((r) => r.post_id)),
    saved: new Set((savesRes.data || []).map((r) => r.post_id))
  };
}

function updateTargetUI(targetEl, counts, states) {
  const postId = targetEl.getAttribute("data-post-id");
  if (!postId) return;

  const likeBtn = targetEl.querySelector('[data-action="like"]');
  const saveBtn = targetEl.querySelector('[data-action="save"]');

  const likeCountEl = targetEl.querySelector('[data-count="like"]');
  const saveCountEl = targetEl.querySelector('[data-count="save"]');
  const commentCountEl = targetEl.querySelector('[data-count="comment"]');

  if (likeCountEl) likeCountEl.textContent = String(counts.likeMap.get(postId) || 0);
  if (saveCountEl) saveCountEl.textContent = String(counts.saveMap.get(postId) || 0);
  if (commentCountEl) commentCountEl.textContent = String(counts.commentMap.get(postId) || 0);

  if (likeBtn) likeBtn.classList.toggle("is-active", states.liked.has(postId));
  if (saveBtn) saveBtn.classList.toggle("is-active", states.saved.has(postId));
}

async function toggleLike(postId) {
  if (!ensureLoggedIn()) return;

  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
  }
}

async function toggleSave(postId) {
  if (!ensureLoggedIn()) return;

  const { data: existing } = await supabase
    .from("post_saves")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("post_saves").delete().eq("id", existing.id);
  } else {
    await supabase.from("post_saves").insert({ post_id: postId, user_id: currentUserId });
  }
}

function getModalEls() {
  return {
    wrap: document.getElementById("poemModalComments"),
    count: document.getElementById("poemModalCommentsCount"),
    list: document.getElementById("poemModalCommentsList"),
    form: document.getElementById("poemModalCommentForm"),
    input: document.getElementById("poemModalCommentInput"),
    msg: document.getElementById("poemModalCommentMsg"),
    sendBtn: document.getElementById("poemModalCommentSend")
  };
}

async function getNameMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids);

  if (error || !Array.isArray(data)) return map;

  data.forEach((p) => {
    const name = (p.display_name || p.username || "").trim();
    if (name) map.set(p.id, name);
  });

  return map;
}

async function loadInlineComments(postId) {
  const els = getModalEls();
  if (!els.wrap || !els.list) return;

  els.list.innerHTML = `<div class="rr-comment rr-comment-empty">Loading comments...</div>`;

  const { data: comments, error } = await supabase
    .from("post_comments")
    .select("id, body, created_at, user_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    els.list.innerHTML = `<div class="rr-comment rr-comment-empty">Could not load comments.</div>`;
    if (els.count) els.count.textContent = "0";
    return;
  }

  const arr = comments || [];
  if (els.count) els.count.textContent = String(arr.length);

  if (arr.length === 0) {
    els.list.innerHTML = `<div class="rr-comment rr-comment-empty">No comments yet.</div>`;
    return;
  }

  const nameMap = await getNameMap(arr.map((c) => c.user_id));

  els.list.innerHTML = arr
    .map((c) => {
      const name = nameMap.get(c.user_id) || `User: ${shortUserId(c.user_id)}`;
      return `
        <div class="rr-comment">
          <div class="rr-comment-meta">
            <span class="rr-comment-who">${escapeHtml(name)}</span>
            <span class="rr-comment-when">${escapeHtml(formatTime(c.created_at))}</span>
          </div>
          <div class="rr-comment-body">${escapeHtml(c.body)}</div>
        </div>
      `;
    })
    .join("");
}

async function postInlineComment(postId) {
  if (!ensureLoggedIn()) return;

  const els = getModalEls();
  if (!els.input || !els.msg || !els.sendBtn) return;

  const body = (els.input.value || "").trim();
  if (!body) {
    els.msg.textContent = "Write something first.";
    return;
  }

  els.sendBtn.disabled = true;
  els.msg.textContent = "Posting...";

  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    user_id: currentUserId,
    body
  });

  els.sendBtn.disabled = false;

  if (error) {
    els.msg.textContent = "Could not post comment.";
    return;
  }

  els.input.value = "";
  els.msg.textContent = "Posted.";
  await loadInlineComments(postId);
  scheduleRefresh();
}

function scrollToInlineComments() {
  const els = getModalEls();
  if (!els.wrap) return;

  els.wrap.scrollIntoView({ behavior: "smooth", block: "start" });

  window.setTimeout(() => {
    const now = getModalEls();
    if (now.input) now.input.focus();
  }, 250);
}

function ensureTargetBar(targetEl) {
  if (!targetEl) return;

  if (!targetEl.querySelector(".post-actions")) {
    targetEl.appendChild(buildActionsBar());
  }

  if (targetEl.dataset.engagementWired === "1") return;
  targetEl.dataset.engagementWired = "1";

  targetEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const postId = targetEl.getAttribute("data-post-id");
    if (!postId) return;

    const action = btn.getAttribute("data-action");

    if (action === "like") {
      await toggleLike(postId);
      scheduleRefresh();
      return;
    }

    if (action === "save") {
      await toggleSave(postId);
      scheduleRefresh();
      return;
    }

    if (action === "comment") {
      document.dispatchEvent(new CustomEvent("rr:openPost", { detail: { postId } }));
      window.setTimeout(() => {
        scrollToInlineComments();
      }, 250);
      return;
    }
  });
}

function getAllTargets() {
  const nodes = [];
  if (listEl) nodes.push(...listEl.querySelectorAll("[data-post-id]"));
  if (featuredWrap) nodes.push(...featuredWrap.querySelectorAll("[data-post-id]"));

  const modalSlot = document.getElementById("poemModalEngagement");
  if (modalSlot && modalSlot.getAttribute("data-post-id")) nodes.push(modalSlot);

  return nodes;
}

let refreshTimer = null;
function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshEngagement(), 80);
}

async function refreshEngagement() {
  await refreshUser();

  const targets = getAllTargets();
  const postIds = targets.map((t) => t.getAttribute("data-post-id")).filter(Boolean);

  if (postIds.length === 0) return;

  targets.forEach((t) => ensureTargetBar(t));

  const counts = await fetchCounts(postIds);
  const states = await fetchMyStates(postIds);

  targets.forEach((t) => updateTargetUI(t, counts, states));
}

function watchNode(node) {
  if (!node) return;
  const obs = new MutationObserver(() => scheduleRefresh());
  obs.observe(node, { childList: true, subtree: true, attributes: true });
}

document.addEventListener("rr:poemOpened", async (e) => {
  const postId = e?.detail?.postId;
  if (!postId) return;

  await loadInlineComments(String(postId));

  const els = getModalEls();
  if (els.form && els.form.dataset.wired !== "1") {
    els.form.dataset.wired = "1";
    els.form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const wrap = getModalEls().wrap;
      const pid = wrap ? wrap.getAttribute("data-post-id") : "";
      if (!pid) return;
      await postInlineComment(String(pid));
    });
  }
});

await refreshUser();
await refreshEngagement();

watchNode(listEl);
watchNode(featuredWrap);
watchNode(document.body);
