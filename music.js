// music.js
import { supabase } from "./supabase.js";

const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function safeText(v) {
  return (v ?? "").toString();
}

function renderItem(row) {
  const title = safeText(row.title);
  const created = row.created_at ? new Date(row.created_at).toLocaleString() : "";
  const url = safeText(row.song_url || row.url || row.link);

  const div = document.createElement("div");
  div.className = "post";

  const h3 = document.createElement("h3");
  h3.textContent = title || "Untitled";
  div.appendChild(h3);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = created ? `Posted: ${created}` : "";
  div.appendChild(meta);

  if (url) {
    const a = document.createElement("a");
    a.className = "song-link";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Open link";
    div.appendChild(a);
  } else {
    const p = document.createElement("div");
    p.className = "body";
    p.textContent = "No link provided.";
    div.appendChild(p);
  }

  return div;
}

async function loadMusic() {
  setMsg("Loading...");

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("type", "song")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("");

  if (!data || data.length === 0) {
    setMsg("No approved music submissions yet.");
    return;
  }

  listEl.innerHTML = "";
  data.forEach((row) => listEl.appendChild(renderItem(row)));
}

loadMusic();
