// forgot-password.js
import { supabase } from "./supabase.js";

const form = document.getElementById("forgotPasswordForm");
const msg = document.getElementById("msg");

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function getResetRedirectUrl() {
  return "https://msu-roar-and-rhythm.vercel.app/reset-password.html";
}

async function handleForgotPassword(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  if (!email) {
    setMsg("Please enter your email.");
    return;
  }

  setMsg("Sending reset link...");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getResetRedirectUrl()
  });

  if (error) {
    setMsg(error.message);
    return;
  }

  setMsg("Password reset email sent. Check your inbox.");
}

if (form) {
  form.addEventListener("submit", handleForgotPassword);
}