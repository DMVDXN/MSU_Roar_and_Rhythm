import { supabase } from "./supabase.js";

const input = document.getElementById("peopleSearch");
const listEl = document.getElementById("peopleList");
const msgEl = document.getElementById("peopleMsg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function escapeHtml(str) {
  return (str ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function avatarLetter(p) {
  const src = (p.display_name || p.username || "U").trim();
  return (src[0] || "U").toUpperCase();
}

function renderPerson(p) {
  const username = (p.username || "").trim();
  const name = (p.display_name || "User").trim();

  const a = document.createElement("a");
  a.className = "person";
  a.href = `user.html?u=${encodeURIComponent(username)}`;

  a.innerHTML = `
    <div class="person-head">
      <div class="person-avatar">${escapeHtml(avatarLetter(p))}</div>
      <div>
        <p class="person-name">${escapeHtml(name)}</p>
        <div class="person-handle">@${escapeHtml(username)}</div>
      </div>
    </div>
  `;
  return a;
}

async function loadPeople(q) {
  setMsg("Loading...");
  listEl.innerHTML = "";

  const query = (q || "").trim();

  let req = supabase
    .from("profiles")
    .select("id,username,display_name")
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);

  if (query) {
    req = supabase
      .from("profiles")
      .select("id,username,display_name")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .not("username", "is", null)
      .limit(24);
  }

  const { data, error } = await req;

  if (error) {
    setMsg(`Error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    setMsg(query ? "No matches." : "No profiles yet.");
    return;
  }

  setMsg("");
  data.forEach((p) => listEl.appendChild(renderPerson(p)));
}

let t = null;
if (input) {
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => loadPeople(input.value), 250);
  });
}

loadPeople("");
