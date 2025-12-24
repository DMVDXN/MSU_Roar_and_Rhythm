import { supabase } from "./supabase.js";

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

function setMsg(text) {
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = text || "";
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
  setTimeout(() => (window.location.href = "login.html"), 900);
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
  setTimeout(() => (window.location.href = "submit.html"), 400);
}

if (signupForm) signupForm.addEventListener("submit", handleSignup);
if (loginForm) loginForm.addEventListener("submit", handleLogin);
