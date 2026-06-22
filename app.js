/**
 * VidDown — app.js
 * Tải video TikTok & Douyin không watermark
 * Dùng TikWM API — miễn phí, không cần key
 */

// ── DOM helpers ──────────────────────────────────────
const $ = (id) => document.getElementById(id);
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }
function showError(msg) { const b = $("errorBox"); b.textContent = msg; show(b); }
function clearError() { hide($("errorBox")); }

// ── Nền tảng hỗ trợ ─────────────────────────────────
const SUPPORTED = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "douyin.com", "v.douyin.com"];

function isSupportedUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return SUPPORTED.some(p => host.includes(p));
  } catch { return false; }
}

function isValidUrl(url) {
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname;
    if (host.includes("douyin")) return "Douyin";
    return "TikTok";
  } catch { return "TikTok"; }
}

// ── Trích xuất URL từ đoạn text bất kỳ ──────────────
function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、（）【】""'']+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  const cleaned = matches.map(u => u.replace(/[.,;!?)\]]+$/, "").trim());
  return cleaned.find(u => { try { return SUPPORTED.some(p => new URL(u).hostname.includes(p)); } catch { return false; } })
    || cleaned[0];
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

// ── Resolve Douyin short link ─────────────────────────
// v.douyin.com là link rút gọn, cần lấy URL thật trước khi gọi TikWM
async function resolveDouyinShortUrl(url) {
  const isShort = /v\.douyin\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(url);
  if (!isShort) return url;

  // Dùng allorigins.win để bypass CORS và follow redirect
  const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    // allorigins trả về URL cuối cùng sau redirect trong contents hoặc status.url
    const finalUrl = json?.status?.url || "";
    // Tìm URL douyin.com hoặc tiktok.com dài trong response
    const match = (finalUrl + (json?.contents || "")).match(
      /https?:\/\/(?:www\.)?(?:douyin\.com\/video\/\d+|tiktok\.com\/@[^/]+\/video\/\d+)/
    );
    if (match) return match[0];
  } catch (e) {
    console.warn("Không resolve được short URL, thử gửi thẳng:", e.message);
  }
  return url; // fallback: gửi nguyên link gốc
}

// ── Gọi TikWM API ────────────────────────────────────
async function fetchTikWM(url) {
  // Resolve short link trước
  const resolvedUrl = await resolveDouyinShortUrl(url);
  console.log("URL gửi TikWM:", resolvedUrl);

  const res = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url: resolvedUrl, hd: 1 }).toString(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("Lỗi kết nối TikWM: " + res.status);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.msg || "Không tải được. Thử copy link đầy đủ từ trình duyệt.");
  return json.data;
}

function formatSize(bytes) {
  if (!bytes) return "–";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? mb.toFixed(1) + " MB" : (bytes / 1024).toFixed(0) + " KB";
}

function sanitizeFilename(name) {
  return (name || "video").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 60);
}

// ── Main fetch ───────────────────────────────────────
async function handleFetch() {
  let url = $("urlInput").value.trim();

  clearError();
  hide($("resultCard"));
  hide($("loadingBox"));
  hide($("setupGuide"));

  if (!url) { showError("Vui lòng dán link TikTok hoặc Douyin vào ô tìm kiếm."); return; }

  // Trích xuất URL nếu paste cả đoạn text
  if (!isValidUrl(url)) {
    const extracted = extractUrl(url);
    if (extracted) { $("urlInput").value = extracted; showExtractedHint(extracted); url = extracted; }
  }

  if (!isValidUrl(url)) { showError("Link không hợp lệ."); return; }

  if (!isSupportedUrl(url)) {
    showError("Chỉ hỗ trợ TikTok và Douyin. Vui lòng dán link từ tiktok.com hoặc douyin.com.");
    return;
  }

  $("fetchBtn").disabled = true;
  show($("loadingBox"));

  try {
    const data = await fetchTikWM(url);
    renderResult(data, url);
  } catch (err) {
    console.error(err);
    showError(err.message || "Không tải được. Thử lại sau.");
  } finally {
    hide($("loadingBox"));
    $("fetchBtn").disabled = false;
  }
}

// ── Render kết quả ───────────────────────────────────
let selectedDownload = null;

function renderResult(d, url) {
  selectedDownload = null;

  $("resultPlatform").textContent = detectPlatform(url);
  $("resultTitle").textContent = d.title || "Video";
  $("resultAuthor").textContent = d.author?.nickname ? "👤 " + d.author.nickname : "";
  $("resultDuration").textContent = d.duration ? "⏱ " + formatDuration(d.duration) : "";

  // Thumbnail
  const thumb = d.origin_cover || d.cover;
  if (thumb) {
    const img = document.createElement("img");
    img.src = thumb;
    img.alt = "Thumbnail";
    img.onerror = () => {};
    $("resultThumb").innerHTML = "";
    $("resultThumb").appendChild(img);
  }

  // Build formats
  const base = sanitizeFilename(d.title || "video");
  const formats = [];

  if (d.hdplay) formats.push({ label: "HD", desc: "Video HD không watermark", size: formatSize(d.hd_size), type: "video", url: d.hdplay, filename: base + "_hd.mp4" });
  if (d.play)   formats.push({ label: "SD", desc: "Video không watermark",    size: formatSize(d.size),    type: "video", url: d.play,   filename: base + ".mp4" });
  if (d.wmplay) formats.push({ label: "WM", desc: "Video có watermark",       size: formatSize(d.wm_size), type: "video", url: d.wmplay, filename: base + "_wm.mp4" });
  if (d.music)  formats.push({ label: "MP3", desc: "Chỉ âm thanh",            size: formatSize(d.music_info?.size), type: "audio", url: d.music, filename: base + ".mp3" });

  const grid = $("formatGrid");
  grid.innerHTML = "";
  formats.forEach((fmt, i) => {
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

function formatDuration(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return m + ":" + String(s).padStart(2, "0");
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
