/*auth.js*/
import { supabase } from "./supabase.js";

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

function setMsg(text) {
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = text || "";
}

function getNext(defaultPath = "submit.html") {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || defaultPath;
}

function cleanUsernameFromEmail(email) {
  const local = (email || "").split("@")[0] || "user";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return cleaned || "user";
}

function randomSuffix() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function ensureProfile(user) {
  if (!user) return null;

  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,website,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) return null;
  if (existing) return existing;

  const email = user.email || "";
  const base = cleanUsernameFromEmail(email);

  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}${randomSuffix()}`.slice(0, 24);

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

  return null;
}

function setHeaderUI(session, profile) {
  const loggedOutBlock = document.getElementById("authLoggedOut");
  const loggedInBlock = document.getElementById("authLoggedIn");

  const navLogin = document.getElementById("navLogin");
  const navSignup = document.getElementById("navSignup");
  const navProfile = document.getElementById("navProfile");
  const navLogout = document.getElementById("navLogout");

  const isLoggedIn = !!session;

  if (loggedOutBlock) loggedOutBlock.style.display = isLoggedIn ? "none" : "flex";
  if (loggedInBlock) loggedInBlock.style.display = isLoggedIn ? "flex" : "none";

  if (navLogin) navLogin.style.display = isLoggedIn ? "none" : "inline-flex";
  if (navSignup) navSignup.style.display = isLoggedIn ? "none" : "inline-flex";
  if (navProfile) navProfile.style.display = isLoggedIn ? "inline-flex" : "none";
  if (navLogout) navLogout.style.display = isLoggedIn ? "inline-flex" : "none";

  const email = session?.user?.email || "";
  const menuEmail = document.getElementById("menuEmail");
  if (menuEmail) menuEmail.textContent = email;

  const avatar = document.getElementById("profileAvatar");
  if (avatar) {
    const nameSource =
      (profile?.display_name || "").trim() ||
      (profile?.username || "").trim() ||
      email.trim();

    const letter = (nameSource[0] || "U").toUpperCase();
    avatar.textContent = letter;
  }
}

function setupMenu() {
  const btn = document.getElementById("menuBtn");
  const panel = document.getElementById("menuPanel");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!btn || !panel) return;

  function openMenu() {
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.classList.contains("open")) closeMenu();
    else openMenu();
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "index.html";
    });
  }

  const navLogout = document.getElementById("navLogout");
  if (navLogout) {
    navLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = "index.html";
    });
  }
}

async function initHeader() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session || null;

  let profile = null;
  if (session?.user) {
    profile = await ensureProfile(session.user);
  }

  setHeaderUI(session, profile);

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    let p = null;
    if (newSession?.user) p = await ensureProfile(newSession.user);
    setHeaderUI(newSession, p);
  });

  setupMenu();
}

async function handleSignup(e) {
  e.preventDefault();
  setMsg("Creating account...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    setMsg(error.message);
    return;
  }

  if (data?.session?.user) {
    await ensureProfile(data.session.user);
  }

  setMsg("Account created. You can log in now.");
  const next = encodeURIComponent(getNext("submit.html"));
  setTimeout(() => (window.location.href = `login.html?next=${next}`), 900);
}

async function handleLogin(e) {
  e.preventDefault();
  setMsg("Logging in...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMsg(error.message);
    return;
  }

  if (data?.user) {
    await ensureProfile(data.user);
  }

  setMsg("Logged in.");
  const next = getNext("submit.html");
  setTimeout(() => (window.location.href = next), 350);
}

if (signupForm) signupForm.addEventListener("submit", handleSignup);
if (loginForm) loginForm.addEventListener("submit", handleLogin);

initHeader();

function setupGlobalSearchRedirect() {
  const forms = document.querySelectorAll("form.topbar-search");

  forms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input[type='search'], .search-input");
      const q = (input?.value || "").trim();
      if (!q) return;
      window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    });
  });
}

// call it once when auth.js loads
setupGlobalSearchRedirect();

