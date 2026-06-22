/**
 * VidDown — app.js
 * Primary:  api.douyin.wtf  — hỗ trợ v.douyin.com short link, không cần key
 * Fallback: tikwm.com       — TikTok/Douyin không watermark
 */

// ── DOM helpers ──────────────────────────────────────
const $ = (id) => document.getElementById(id);
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }
function showError(msg) { const b = $("errorBox"); b.textContent = msg; show(b); }
function clearError() { hide($("errorBox")); }

// ── Nền tảng hỗ trợ ─────────────────────────────────
const SUPPORTED_HOSTS = [
  "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "douyin.com", "v.douyin.com",
];

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
    const host = new URL(url).hostname;
    return host.includes("douyin") ? "Douyin" : "TikTok";
  } catch { return "TikTok"; }
}

// ── Trích xuất URL từ đoạn text bất kỳ ──────────────
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

// ── API 1: douyin.wtf — hỗ trợ short link Douyin ────
async function fetchDouyinWTF(url) {
  const endpoint = "https://api.douyin.wtf/api/hybrid/video_data?url=" +
    encodeURIComponent(url) + "&minimal=false";

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("douyin.wtf lỗi: " + res.status);
  const json = await res.json();

  // Lấy data từ nhiều cấu trúc có thể có
  const d = json?.data?.aweme_detail || json?.aweme_detail || json?.data || json;
  if (!d?.video) throw new Error("douyin.wtf: Không parse được dữ liệu.");

  const base = sanitizeFilename(d.desc || d.share_info?.share_title || "video");
  const formats = [];

  // Video không watermark
  const playUrl = d.video?.play_addr?.url_list?.[0]
    || d.video?.download_addr?.url_list?.[0];
  if (playUrl) formats.push({
    label: "HD", desc: "Video không watermark",
    size: "–", type: "video",
    url: playUrl, filename: base + ".mp4",
  });

  // Video có watermark
  const wmUrl = d.video?.wm_video_url_HQ || d.video?.wm_video_url;
  if (wmUrl && wmUrl !== playUrl) formats.push({
    label: "WM", desc: "Video có watermark",
    size: "–", type: "video",
    url: wmUrl, filename: base + "_wm.mp4",
  });

  // Nhạc
  const musicUrl = d.music?.play_url?.url_list?.[0] || d.music?.play_url?.uri;
  if (musicUrl) formats.push({
    label: "MP3", desc: "Chỉ âm thanh",
    size: "–", type: "audio",
    url: musicUrl, filename: base + ".mp3",
  });

  if (!formats.length) throw new Error("douyin.wtf: Không tìm thấy link tải.");

  return {
    title: d.desc || d.share_info?.share_title || "Video",
    thumbnail: d.video?.origin_cover?.url_list?.[0] || d.video?.cover?.url_list?.[0] || null,
    author: d.author?.nickname || "",
    duration: d.video?.duration ? Math.round(d.video.duration / 1000) : 0,
    formats,
  };
}

// ── API 2: TikWM fallback ────────────────────────────
async function fetchTikWM(url) {
  const res = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url, hd: 1 }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("TikWM lỗi: " + res.status);
  const json = await res.json();
  if (json.code !== 0) throw new Error("TikWM: " + (json.msg || "Lỗi không xác định."));

  const d = json.data;
  const base = sanitizeFilename(d.title || "video");
  const formats = [];

  if (d.hdplay) formats.push({ label: "HD",  desc: "Video HD không watermark", size: formatSize(d.hd_size), type: "video", url: d.hdplay, filename: base + "_hd.mp4" });
  if (d.play)   formats.push({ label: "SD",  desc: "Video không watermark",    size: formatSize(d.size),    type: "video", url: d.play,   filename: base + ".mp4" });
  if (d.wmplay) formats.push({ label: "WM",  desc: "Video có watermark",       size: formatSize(d.wm_size), type: "video", url: d.wmplay, filename: base + "_wm.mp4" });
  if (d.music)  formats.push({ label: "MP3", desc: "Chỉ âm thanh",             size: "–",                   type: "audio", url: d.music,  filename: base + ".mp3" });

  if (!formats.length) throw new Error("TikWM: Không tìm thấy link tải.");

  return {
    title: d.title || "Video",
    thumbnail: d.origin_cover || d.cover || null,
    author: d.author?.nickname || "",
    duration: d.duration || 0,
    formats,
  };
}

// ── Helpers ──────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return "–";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? mb.toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";
}

function sanitizeFilename(name) {
  return (name || "video").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 60);
}

function formatDuration(secs) {
  if (!secs) return "";
  const m = Math.floor(secs / 60), s = secs % 60;
  return "⏱ " + m + ":" + String(s).padStart(2, "0");
}

// ── Main fetch ───────────────────────────────────────
async function handleFetch() {
  let url = $("urlInput").value.trim();

  clearError();
  hide($("resultCard"));
  hide($("loadingBox"));

  if (!url) { showError("Vui lòng dán link TikTok hoặc Douyin."); return; }

  if (!isValidUrl(url)) {
    const extracted = extractUrl(url);
    if (extracted) { $("urlInput").value = extracted; showExtractedHint(extracted); url = extracted; }
  }

  if (!isValidUrl(url)) { showError("Link không hợp lệ."); return; }
  if (!isSupportedUrl(url)) { showError("Chỉ hỗ trợ TikTok và Douyin."); return; }

  $("fetchBtn").disabled = true;
  show($("loadingBox"));

  let result = null;
  const errors = [];

  // Thử douyin.wtf trước (hỗ trợ short link tốt hơn)
  try {
    result = await fetchDouyinWTF(url);
  } catch (e) {
    errors.push("douyin.wtf: " + e.message);
    console.warn(errors[0]);
  }

  // Fallback TikWM
  if (!result) {
    try {
      result = await fetchTikWM(url);
    } catch (e) {
      errors.push("TikWM: " + e.message);
      console.warn(errors[errors.length - 1]);
    }
  }

  hide($("loadingBox"));
  $("fetchBtn").disabled = false;

  if (result) {
    renderResult(result, url);
  } else {
    showError("Không tải được video. " + errors.join(" | "));
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
      '<span class="fmt-badge ' + (fmt.type === "audio" ? "badge-audio" : "badge-video") + '">' + fmt.label + '</span>' +
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
