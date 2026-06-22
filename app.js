/**
 * VidDown — app.js
 * Dùng RapidAPI: Social Media Video Downloader (ugoBoy)
 * Free tier: 500 req/tháng
 * Đăng ký key tại: https://rapidapi.com/ugoBoy/api/social-media-video-downloader
 */

// ── Cấu hình ─────────────────────────────────────────
const RAPIDAPI_KEY = "86e2214a67msh7b7095460860fbcp1409e0jsn6b6d478579ba";

const APIS = [
  {
    name: "Auto Download All-in-One",
    url: "https://auto-download-all-in-one-big.p.rapidapi.com/v1/social/autolink",
    host: "auto-download-all-in-one-big.p.rapidapi.com",
    buildRequest: (videoUrl) => ({
      method: "POST",
      body: { url: videoUrl },
    }),
    parseResponse: parseAutoDownload,
  },
];

// ── State ────────────────────────────────────────────
let selectedDownload = null;

// ── DOM helpers ──────────────────────────────────────
const $ = (id) => document.getElementById(id);
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }
function showError(msg) { const b = $("errorBox"); b.textContent = msg; show(b); }
function clearError() { hide($("errorBox")); }

// ── Input events ─────────────────────────────────────
$("urlInput").addEventListener("input", () => {
  
  clearError();
});

$("urlInput").addEventListener("paste", () => {
  setTimeout(() => {
    const pasted = $("urlInput").value;
    const extracted = extractUrl(pasted);
    if (extracted && extracted !== pasted.trim()) {
      $("urlInput").value = extracted;
      
      showExtractedHint(extracted);
    }
  }, 0);
});

$("urlInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleFetch();
});

async function copyLink() {
  const url = $("urlInput").value.trim();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const btn = $("copyBtn");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round"/></svg>';
    btn.style.color = "#16a34a";
    setTimeout(() => {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M3 11V3h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
      btn.style.color = "";
    }, 1500);
  } catch {}
}

function clearInput() {
  $("urlInput").value = "";
  
  hide($("resultCard"));
  clearError();
  $("urlInput").focus();
}

// ── Trích xuất URL từ đoạn text bất kỳ ──────────────
function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。！？、（）【】""'']+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return null;

  const videoPlatforms = [
    "douyin.com", "v.douyin.com",
    "tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
    "youtube.com", "youtu.be",
    "instagram.com", "facebook.com", "fb.watch",
    "twitter.com", "x.com", "pinterest.com", "vimeo.com",
  ];

  const cleaned = matches.map(u => u.replace(/[.,;!?)\]]+$/, "").trim());
  return cleaned.find(u => {
    try {
      const host = new URL(u).hostname.replace("www.", "");
      return videoPlatforms.some(p => host.includes(p));
    } catch { return false; }
  }) || cleaned[0];
}

function showExtractedHint(url) {
  const hint = document.querySelector(".input-hint");
  const original = hint.textContent;
  hint.style.color = "#16a34a";
  hint.textContent = "✓ Đã tìm thấy link: " + (url.length > 60 ? url.slice(0, 60) + "…" : url);
  setTimeout(() => { hint.style.color = ""; hint.textContent = original; }, 3000);
}

function isValidUrl(url) {
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}

function detectPlatform(url) {
  const map = {
    "douyin.com": "Douyin", "v.douyin.com": "Douyin",
    "tiktok.com": "TikTok", "vm.tiktok.com": "TikTok", "vt.tiktok.com": "TikTok",
    "youtube.com": "YouTube", "youtu.be": "YouTube",
    "instagram.com": "Instagram", "facebook.com": "Facebook", "fb.watch": "Facebook",
    "twitter.com": "Twitter/X", "x.com": "Twitter/X",
    "pinterest.com": "Pinterest", "vimeo.com": "Vimeo",
  };
  try {
    const host = new URL(url).hostname.replace("www.", "");
    for (const [k, v] of Object.entries(map)) if (host.includes(k)) return v;
  } catch {}
  return "Video";
}

// ── Parse response Auto Download All-in-One ──────────
// Response: { success, title, thumbnail, medias: [{url, quality, extension, formattedSize}] }
function parseAutoDownload(data, originalUrl) {
  if (!data.success) throw new Error(data.message || "Không tải được video này.");

  const base = sanitizeFilename(data.title || detectPlatform(originalUrl));
  const formats = [];

  for (const item of (data.medias || [])) {
    if (!item.url) continue;
    const ext = (item.extension || "mp4").toLowerCase();
    const isAudio = ext === "mp3" || ext === "m4a" || ext === "ogg" ||
                    (item.quality || "").toLowerCase().includes("audio");
    const quality = item.quality || (isAudio ? "Audio" : "Video");
    formats.push({
      label: isAudio ? "MP3" : quality,
      desc: isAudio ? "Chỉ âm thanh (MP3)" : `Video ${quality}`,
      size: item.formattedSize || "–",
      type: isAudio ? "audio" : "video",
      url: item.url,
      filename: base + "." + ext,
    });
  }

  if (!formats.length) throw new Error("Không tìm thấy link tải trong kết quả.");

  return {
    title: data.title || "Video",
    thumbnail: data.thumbnail || null,
    formats,
  };
}

function sanitizeFilename(name) {
  return (name || "video").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 60);
}

// ── Kiểm tra API key ─────────────────────────────────
function checkApiKey() {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === "86e2214a67msh7b7095460860fbcp1409e0jsn6b6d478579ba") {
    showError("⚠️ Chưa cấu hình API key. Xem hướng dẫn bên dưới để lấy key miễn phí.");
    show($("setupGuide"));
    return false;
  }
  return true;
}

// ── Gọi API ──────────────────────────────────────────
async function callApi(api, videoUrl) {
  const req = api.buildRequest(videoUrl);
  const fetchUrl = req.params ? api.url + "?" + req.params.toString() : api.url;

  const res = await fetch(fetchUrl, {
    method: req.method || "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": api.host,
      "Content-Type": "application/json",
    },
    body: req.body ? JSON.stringify(req.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 403) throw new Error("API key không hợp lệ hoặc chưa subscribe API này trên RapidAPI.");
  if (res.status === 429) throw new Error("Đã hết quota miễn phí tháng này (500 req/tháng).");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Lỗi server ${res.status}: ${txt.slice(0, 100)}`);
  }

  return await res.json();
}

// ── Main fetch ───────────────────────────────────────
async function handleFetch() {
  let url = $("urlInput").value.trim();

  clearError();
  hide($("resultCard"));
  hide($("loadingBox"));
  hide($("setupGuide"));

  if (!url) { showError("Vui lòng dán link video vào ô tìm kiếm."); return; }
  if (!checkApiKey()) return;

  if (!isValidUrl(url)) {
    const extracted = extractUrl(url);
    if (extracted) { $("urlInput").value = extracted; showExtractedHint(extracted); url = extracted; }
  }

  if (!isValidUrl(url)) {
    showError("Không tìm thấy link hợp lệ trong đoạn text.");
    return;
  }

  $("fetchBtn").disabled = true;
  show($("loadingBox"));

  let lastError = null;
  for (const api of APIS) {
    try {
      const raw = await callApi(api, url);
      const result = api.parseResponse(raw, url);
      renderResult(result, url);
      hide($("loadingBox"));
      $("fetchBtn").disabled = false;
      return;
    } catch (err) {
      lastError = err;
      console.warn(api.name + " failed:", err.message);
    }
  }

  hide($("loadingBox"));
  $("fetchBtn").disabled = false;
  showError("Không tải được: " + (lastError?.message || "Thử lại sau."));
}

// ── Render kết quả ───────────────────────────────────
function renderResult(result, url) {
  selectedDownload = null;
  $("resultPlatform").textContent = detectPlatform(url);
  $("resultTitle").textContent = result.title || "Video";

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
      '<span class="fmt-badge ' + (fmt.type === "audio" ? "badge-audio" : "badge-video") + '">' + fmt.label + "</span>" +
      '<span class="fmt-desc">' + fmt.desc + "</span>" +
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
  btn.textContent = "Đang mở...";

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
