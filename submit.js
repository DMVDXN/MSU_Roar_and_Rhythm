import { supabase } from "./supabase.js";

const form = document.getElementById("submitForm");
const typeEl = document.getElementById("type");
const titleEl = document.getElementById("title");

const poemFields = document.getElementById("poemFields");
const songFields = document.getElementById("songFields");
const imageFields = document.getElementById("imageFields");

const bodyEl = document.getElementById("body_text");
const songUrlEl = document.getElementById("song_url");
const imageEl = document.getElementById("image_file");

const msg = document.getElementById("msg");
const submitBtn = document.getElementById("submitBtn");

function setMsg(text) {
  msg.textContent = text;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Submitting..." : "Submit";
}

function showFields(type) {
  poemFields.style.display = type === "poem" ? "block" : "none";
  songFields.style.display = type === "song" ? "block" : "none";
  imageFields.style.display = type === "image" ? "block" : "none";
  setMsg("");
}

showFields(typeEl.value);
typeEl.addEventListener("change", () => showFields(typeEl.value));

function getFileExt(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "png";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  setMsg("");

  try {
    const type = typeEl.value;
    const title = titleEl.value.trim();

    if (!title) {
      setMsg("Please add a title.");
      return;
    }

    let body_text = null;
    let song_url = null;
    let image_url = null;

    if (type === "poem") {
      body_text = (bodyEl.value || "").trim();
      if (!body_text) {
        setMsg("Please paste your poem.");
        return;
      }
    }

    if (type === "song") {
      song_url = (songUrlEl.value || "").trim();
      if (!song_url) {
        setMsg("Please paste a song link.");
        return;
      }
    }

    if (type === "image") {
      const file = imageEl.files && imageEl.files[0];
      if (!file) {
        setMsg("Please choose an image file.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMsg("Image too large. Max 5MB.");
        return;
      }

      const ext = getFileExt(file.name);
      const filename = `${crypto.randomUUID()}.${ext}`;
      const path = `uploads/${filename}`;

      const { error: uploadError } = await supabase
        .storage
        .from("images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setMsg(`Upload failed: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage.from("images").getPublicUrl(path);
      image_url = data.publicUrl;
    }

    const { error: insertError } = await supabase
      .from("posts")
      .insert([
        {
          type,
          title,
          body_text,
          song_url,
          image_url,
          status: "pending",
        },
      ]);

    if (insertError) {
      setMsg(`Submit failed: ${insertError.message}`);
      return;
    }

    form.reset();
    typeEl.value = "poem";
    showFields("poem");
    setMsg("Submitted. Your post is pending approval.");
  } finally {
    setLoading(false);
  }
});
