// reset-password.js
import { supabase } from "./supabase.js";

const form = document.getElementById("resetPasswordForm");
const msg = document.getElementById("msg");

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

async function waitForRecoverySession() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  if (!hash && !search) {
    return;
  }

  try {
    await supabase.auth.getSession();
  } catch (err) {
    console.error(err);
  }
}

async function handleResetPassword(e) {
  e.preventDefault();

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!newPassword || !confirmPassword) {
    setMsg("Please fill out both password fields.");
    return;
  }

  if (newPassword.length < 6) {
    setMsg("Password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    setMsg("Passwords do not match.");
    return;
  }

  setMsg("Updating password...");

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Password updated. Redirecting to login...");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1200);
}

await waitForRecoverySession();

if (form) {
  form.addEventListener("submit", handleResetPassword);
}