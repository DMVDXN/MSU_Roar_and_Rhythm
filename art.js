// art.js
import { supabase } from "./supabase.js";

const gridEl = document.getElementById("grid");
const msgEl = document.getElementById("msg");

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function safeText(v) {
  return (v ?? "").toString();
}

function renderCard(row) {
  const title = safeText(row.title) || "Untitled";
  const created = row.created_at ? new Date(row.created_at).toLocaleString() : "";
  const url = safeText(row.image_url || row.url || row.link);

  const card = document.createElement("div");
  card.className = "card";

  const img = document.createElement("img");
  img.alt = title;
  img.src = url || "";
  card.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";

  const h3 = document.createElement("p");
  h3.className = "card-title";
  h3.textContent = title;
  body.appendChild(h3);

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = created ? `Posted: ${created}` : "";
  body.appendChild(meta);

  card.appendChild(body);
  return card;
}

async function loadArt() {
  setMsg("Loading...");

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, image_url, created_at, status, is_hidden")
    .eq("type", "image")
    .eq("status", "approved")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("");

  if (!data || data.length === 0) {
    setMsg("No approved artwork submissions yet.");
    return;
  }

  gridEl.innerHTML = "";
  data.forEach((row) => gridEl.appendChild(renderCard(row)));
}

loadArt();
