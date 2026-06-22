/**
 * VidDown — app.js
 * Primary:  instagram-downloader-download-instagram-videos-stories1 (RapidAPI)
 *           → hỗ trợ TikTok, Douyin, Instagram, Facebook, YouTube, Twitter, Pinterest...
 * Fallback: TikWM — TikTok/Douyin không watermark
 */

// ── Cấu hình ─────────────────────────────────────────
const RAPIDAPI_KEY  = "86e2214a67msh7b7095460860fbcp1409e0jsn6b6d478579ba";
const ALLINONE_HOST = "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com";
const ALLINONE_URL  = "https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/";

// ── Nền tảng hỗ trợ ─────────────────────────────────
const SUPPORTED_HOSTS = [
  "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "douyin.com", "v.douyin.com",
  "instagram.com",
  "facebook.com", "fb.watch",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com",
  "pinterest.com", "pin.it",
  "xiaohongshu.com", "xhslink.com",
];

const PLATFORM_MAP = {
  "douyin.com": "Douyin", "v.douyin.com": "Douyin",
  "tiktok.com": "TikTok", "vm.tiktok.com": "TikTok", "vt.tiktok.com": "TikTok",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook", "fb.watch": "Facebook",
  "youtube.com": "YouTube", "youtu.be": "YouTube",
  "twitter.com": "Twitter/X", "x.com": "Twitter/X",
  "pinterest.com": "Pinterest", "pin.it": "Pinterest",
  "xiaohongshu.com": "Xiaohongshu", "xhslink.com": "Xiaohongshu",
};

function isSupportedUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return SUPPORTED_HOSTS.some(p => host.includes(p));
  } catch { return false; }
}

function isValidUrl(url) {
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    for (const [k, v] of Object.entries(PLATFORM_MAP)) {
      if (host.includes(k)) return v;
    }
  } catch {}
  return "Video";
}

// ── Trích xuất URL từ đoạn text ──────────────────────
function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、（）【】""'']+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  const cleaned = matches.map(u => u.replace(/[.,;!?)\]]+$/, "").trim());
  return (
    cleaned.find(u => { try { return SUPPORTED_HOSTS.some(p => new URL(u).hostname.includes(p)); } catch { return false; } })
    || cleaned[0]
  );
}

function showExtractedHint(url) {
  const hint = document.querySelector(".input-hint");
  const original = hint.textContent;
  hint.style.color = "#16a34a";
  hint.textContent = "✓ Đã tìm thấy link: " + (url.length > 55 ? url.slice(0, 55) + "…" : url);
  setTimeout(() => { hint.style.color = ""; hint.textContent = original; }, 3000);
}

// ── DOM helpers ──────────────────────────────────────
const $ = (id) => document.getElementById(id);
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }
function showError(msg) { const b = $("errorBox"); b.textContent = msg; show(b); }
function clearError() { hide($("errorBox")); }

// ── Input events ─────────────────────────────────────
$("urlInput").addEventListener("input", () => {
  updatePasteBtn($("urlInput").value.trim().length > 0);
  clearError();
});

$("urlInput").addEventListener("paste", () => {
  setTimeout(() => {
    const pasted = $("urlInput").value;
    const extracted = extractUrl(pasted);
    if (extracted && extracted !== pasted.trim()) {
      $("urlInput").value = extracted;
      updatePasteBtn(true);
      showExtractedHint(extracted);
    }
  }, 0);
});

$("urlInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleFetch();
});

// ── Nút paste/clear toggle ───────────────────────────
async function togglePaste() {
  const input = $("urlInput");
  if (input.value.trim()) {
    input.value = "";
    hide($("resultCard"));
    clearError();
    updatePasteBtn(false);
    input.focus();
  } else {
    try {
      let text = "";
      if (navigator.clipboard && window.isSecureContext) {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        const extracted = extractUrl(text) || text.trim();
        input.value = extracted;
        updatePasteBtn(true);
        if (isValidUrl(extracted)) handleFetch();
      } else {
        input.focus();
      }
    } catch { input.focus(); }
  }
}

function updatePasteBtn(hasValue) {
  const btn = $("pasteBtn");
  if (!btn) return;
  $("iconPaste").style.display = hasValue ? "none" : "";
  $("iconClear").style.display = hasValue ? "" : "none";
  btn.classList.toggle("is-clear", hasValue);
  btn.title = hasValue ? "Xóa link" : "Dán link";
}

function clearInput() {
  $("urlInput").value = "";
  hide($("resultCard"));
  clearError();
  updatePasteBtn(false);
  $("urlInput").focus();
}

// ── Helpers ──────────────────────────────────────────
function sanitizeFilename(name) {
  return (name || "video").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 60);
}

function formatSize(bytes) {
  if (!bytes) return "–";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? mb.toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";
}

function formatDuration(secs) {
  if (!secs) return "";
  const m = Math.floor(secs / 60), s = secs % 60;
  return "⏱ " + m + ":" + String(s).padStart(2, "0");
}

// ── API 1: All-In-One (RapidAPI) ─────────────────────
// Hỗ trợ: Instagram, Facebook, YouTube, TikTok, Pinterest, Twitter...
async function fetchAllInOne(url) {
  const apiUrl = ALLINONE_URL + "?url=" + encodeURIComponent(url);
  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": ALLINONE_HOST,
    },
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 403) throw new Error("API key không hợp lệ.");
  if (res.status === 429) throw new Error("Hết quota tháng này (500 req/tháng).");
  if (!res.ok) throw new Error("Lỗi server: " + res.status);

  const json = await res.json();

  // Parse nhiều cấu trúc response khác nhau
  const base = sanitizeFilename(json.title || json.filename || detectPlatform(url));
  const formats = [];

  // Cấu trúc 1: { media: [{url, quality, type}] }
  const mediaList = json.media || json.medias || json.links || json.result || [];
  if (Array.isArray(mediaList) && mediaList.length) {
    for (const item of mediaList) {
      const itemUrl = item.url || item.link || item.src;
      if (!itemUrl) continue;
      const quality = item.quality || item.resolution || item.type || "Video";
      const isAudio = quality.toLowerCase().includes("audio") || quality.toLowerCase().includes("mp3")
        || (item.type || "").toLowerCase().includes("audio");
      formats.push({
        label: isAudio ? "MP3" : (quality.length < 10 ? quality : "Video"),
        desc: isAudio ? "Chỉ âm thanh" : "Video " + quality,
        size: item.size ? formatSize(item.size) : (item.formattedSize || "–"),
        type: isAudio ? "audio" : "video",
        url: itemUrl,
        filename: base + (isAudio ? ".mp3" : ".mp4"),
      });
    }
  }

  // Cấu trúc 2: link trực tiếp
  if (!formats.length) {
    const direct = json.url || json.download_url || json.video_url || json.src;
    if (direct) {
      formats.push({
        label: "MP4", desc: "Video",
        size: "–", type: "video",
        url: direct, filename: base + ".mp4",
      });
    }
  }

  // Cấu trúc 3: { UserInfo: {...}, data: [...] }
  if (!formats.length && json.UserInfo) {
    throw new Error("API trả về thông tin user, không phải video. Thử link video cụ thể.");
  }

  if (!formats.length) throw new Error("Không parse được link tải từ response.");

  return {
    title: json.title || json.filename || detectPlatform(url),
    thumbnail: json.thumbnail || json.thumb || json.cover || null,
    author: json.author || json.uploader || "",
    duration: json.duration || 0,
    formats,
  };
}

// ── API 2: TikWM (TikTok/Douyin fallback) ────────────
async function fetchTikWM(url) {
  const res = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url, hd: 1 }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("TikWM lỗi: " + res.status);
  const json = await res.json();
  if (json.code !== 0) throw new Error("TikWM: " + (json.msg || "Lỗi."));

  const d = json.data;
  const base = sanitizeFilename(d.title || "video");
  const formats = [];

  if (d.hdplay) formats.push({ label: "HD",  desc: "Video HD không watermark", size: formatSize(d.hd_size), type: "video", url: d.hdplay, filename: base + "_hd.mp4" });
  if (d.play)   formats.push({ label: "SD",  desc: "Video không watermark",    size: formatSize(d.size),    type: "video", url: d.play,   filename: base + ".mp4" });
  if (d.wmplay) formats.push({ label: "WM",  desc: "Video có watermark",       size: formatSize(d.wm_size), type: "video", url: d.wmplay, filename: base + "_wm.mp4" });
  if (d.music)  formats.push({ label: "MP3", desc: "Chỉ âm thanh",             size: "–",                   type: "audio", url: d.music,  filename: base + ".mp3" });

  if (!formats.length) throw new Error("TikWM: Không tìm thấy link.");

  return {
    title: d.title || "Video",
    thumbnail: d.origin_cover || d.cover || null,
    author: d.author?.nickname || "",
    duration: d.duration || 0,
    formats,
  };
}

// ── Main fetch ───────────────────────────────────────
async function handleFetch() {
  let url = $("urlInput").value.trim();

  clearError();
  hide($("resultCard"));
  hide($("loadingBox"));

  if (!url) { showError("Vui lòng dán link video vào ô tìm kiếm."); return; }

  if (!isValidUrl(url)) {
    const extracted = extractUrl(url);
    if (extracted) { $("urlInput").value = extracted; showExtractedHint(extracted); url = extracted; }
  }

  if (!isValidUrl(url)) { showError("Link không hợp lệ."); return; }
  if (!isSupportedUrl(url)) {
    showError("Nền tảng chưa được hỗ trợ. Thử: TikTok, Douyin, Instagram, Facebook, YouTube, Twitter, Pinterest.");
    return;
  }

  $("fetchBtn").disabled = true;
  show($("loadingBox"));

  const isTikTok = /tiktok\.com|douyin\.com|v\.douyin\.com/.test(url);
  let result = null;
  const errors = [];

  // TikTok/Douyin: thử TikWM trước (không watermark tốt hơn)
  if (isTikTok) {
    try {
      result = await fetchTikWM(url);
    } catch (e) {
      errors.push("TikWM: " + e.message);
      console.warn(errors[errors.length - 1]);
    }
  }

  // All-In-One RapidAPI (tất cả platform)
  if (!result) {
    try {
      result = await fetchAllInOne(url);
    } catch (e) {
      errors.push("AllInOne: " + e.message);
      console.warn(errors[errors.length - 1]);
    }
  }

  hide($("loadingBox"));
  $("fetchBtn").disabled = false;

  if (result) {
    renderResult(result, url);
  } else {
    showError("Không tải được. " + errors.join(" | "));
  }
}

// ── Render kết quả ───────────────────────────────────
let selectedDownload = null;

function renderResult(result, url) {
  selectedDownload = null;
  $("resultPlatform").textContent = detectPlatform(url);
  $("resultTitle").textContent = result.title || "Video";
  $("resultAuthor").textContent = result.author ? "👤 " + result.author : "";
  $("resultDuration").textContent = formatDuration(result.duration);

  if (result.thumbnail) {
    const img = document.createElement("img");
    img.src = result.thumbnail;
    img.alt = "Thumbnail";
    img.onerror = () => {};
    $("resultThumb").innerHTML = "";
    $("resultThumb").appendChild(img);
  }

  const grid = $("formatGrid");
  grid.innerHTML = "";
  result.formats.forEach((fmt, i) => {
    const item = document.createElement("div");
    item.className = "format-item";
    item.innerHTML =
      '<div class="fmt-radio"></div>' +
      '<span class="fmt-badge ' + (fmt.type === "audio" ? "badge-audio" : fmt.type === "image" ? "badge-image" : "badge-video") + '">' + fmt.label + '</span>' +
      '<span class="fmt-desc">' + fmt.desc + '</span>' +
      '<span class="fmt-size">' + fmt.size + '</span>';
    item.addEventListener("click", () => selectFormat(item, fmt));
    grid.appendChild(item);
    if (i === 0) item.click();
  });

  show($("resultCard"));
}

function selectFormat(el, fmt) {
  document.querySelectorAll(".format-item").forEach(i => i.classList.remove("active"));
  el.classList.add("active");
  selectedDownload = fmt;
  $("selectedHint").textContent = "Đã chọn: " + fmt.desc;
  $("dlBtn").disabled = false;
}

// ── Tải xuống ────────────────────────────────────────
function handleDownload() {
  if (!selectedDownload) return;
  const btn = $("dlBtn");
  btn.disabled = true;

  const a = document.createElement("a");
  a.href = selectedDownload.url;
  a.download = selectedDownload.filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  btn.classList.add("success");
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Đã tải!';
  setTimeout(() => {
    btn.classList.remove("success");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M8 10L5 7M8 10l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tải xuống';
    btn.disabled = false;
  }, 2500);
}
