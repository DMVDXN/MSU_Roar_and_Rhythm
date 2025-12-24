import { supabase } from "./supabase.js";

const list = document.getElementById("list");
const msg = document.getElementById("msg");

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderPost(p) {
  const title = escapeHtml(p.title || "");
  const body = escapeHtml(p.body_text || "").replaceAll("\n", "<br>");
  const date = p.created_at ? new Date(p.created_at).toLocaleString() : "";

  return `
    <div class="post">
      <h3>${title}</h3>
      <div class="meta">${date}</div>
      <div class="body">${body}</div>
    </div>
  `;
}

async function loadPoems() {
  msg.textContent = "Loading...";
  list.innerHTML = "";

  const { data, error } = await supabase
    .from("posts")
    .select("id,title,body_text,created_at")
    .eq("type", "poem")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    msg.textContent = `Error: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    msg.textContent = "No approved poems yet.";
    return;
  }

  msg.textContent = "";
  list.innerHTML = data.map(renderPost).join("");
}

loadPoems();
