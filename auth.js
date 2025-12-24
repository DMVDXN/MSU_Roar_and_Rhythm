import { supabase } from "./supabase.js";

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

function setMsg(text) {
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = text || "";
}

function getNext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "index.html";
}

function setAuthUI(session) {
  const loggedOut = document.getElementById("authLoggedOut");
  const loggedIn = document.getElementById("authLoggedIn");
  const avatar = document.getElementById("profileAvatar");
  const emailEl = document.getElementById("menuEmail");

  const isLoggedIn = !!session;

  if (loggedOut) loggedOut.style.display = isLoggedIn ? "none" : "flex";
  if (loggedIn) loggedIn.style.display = isLoggedIn ? "flex" : "none";

  if (isLoggedIn) {
    const email = session.user?.email || "";
    if (emailEl) emailEl.textContent = email;

    if (avatar) {
      const letter = (email.trim()[0] || "U").toUpperCase();
      avatar.textContent = letter;
    }
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
}

async function initAuthUI() {
  const { data } = await supabase.auth.getSession();
  setAuthUI(data?.session || null);

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthUI(session || null);
  });

  setupMenu();
}

async function handleSignup(e) {
  e.preventDefault();
  setMsg("Creating account...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Account created. You can log in now.");
  const next = encodeURIComponent(getNext());
  setTimeout(() => (window.location.href = `login.html?next=${next}`), 900);
}

async function handleLogin(e) {
  e.preventDefault();
  setMsg("Logging in...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Logged in.");
  const next = getNext();
  setTimeout(() => (window.location.href = next), 350);
}

if (signupForm) signupForm.addEventListener("submit", handleSignup);
if (loginForm) loginForm.addEventListener("submit", handleLogin);

initAuthUI();
