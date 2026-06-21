/**
 * VidDown — app.js
 * Gọi Cobalt API (cobalt.tools) để lấy link tải video.
 * Không cần backend — chạy hoàn toàn trên trình duyệt.
 *
 * Docs: https://github.com/imputnet/cobalt/blob/current/docs/api.md
 */

// ── Cấu hình ────────────────────────────────────────
const COBALT_API = "https://api.cobalt.tools";

// Headers bắt buộc theo Cobalt API v7+
const API_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

// ── State ────────────────────────────────────────────
let selectedUrl = null;   // URL tải trực tiếp của format đang chọn
let currentData = null;   // Kết quả API trả về

// ── DOM helpers ──────────────────────────────────────
const $ = (id) => document.getElementById(id);

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function showError(msg) {
  const box = $("errorBox");
  box.textContent = msg;
  show(box);
}
function clearError() { hide($("errorBox")); }

// ── Input ────────────────────────────────────────────
$("urlInput").addEventListener("input", () => {
  const val = $("urlInput").value.trim();
  $("clearBtn").classList.toggle("visible", val.length > 0);
  clearError();
});

$("urlInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleFetch();
});

function clearInput() {
  $("urlInput").value = "";
  $("clearBtn").classList.remove("visible");
  hide($("resultCard"));
  clearError();
  $("urlInput").focus();
}

// ── Validate URL ─────────────────────────────────────
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function detectPlatform(url) {
  const map = {
    "douyin.com": "Douyin",
    "tiktok.com": "TikTok",
    "vm.tiktok.com": "TikTok",
    "vt.tiktok.com": "TikTok",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "instagram.com": "Instagram",
    "facebook.com": "Facebook",
    "fb.watch": "Facebook",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "pinterest.com": "Pinterest",
    "pin.it": "Pinterest",
    "vimeo.com": "Vimeo",
    "reddit.com": "Reddit",
    "twitch.tv": "Twitch",
  };
  try {
    const host = new URL(url).hostname.replace("www.", "");
    for (const [key, val] of Object.entries(map)) {
      if (host.includes(key)) return val;
    }
  } catch {}
  return "Video";
}

// ── Main fetch ───────────────────────────────────────
async function handleFetch() {
  const url = $("urlInput").value.trim();

  clearError();
  hide($("resultCard"));
  hide($("loadingBox"));

  if (!url) {
    showError("Vui lòng dán link video vào ô tìm kiếm.");
    return;
  }
  if (!isValidUrl(url)) {
    showError("Link không hợp lệ. Hãy kiểm tra lại đường dẫn (phải bắt đầu bằng https://).");
    return;
  }

  $("fetchBtn").disabled = true;
  show($("loadingBox"));

  try {
    // Cobalt API: lấy link tải
    const res = await fetch(COBALT_API, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.code || `Lỗi API: ${res.status}`);
    }

    const data = await res.json();
    currentData = data;
    renderResult(data, url);
  } catch (err) {
    console.error(err);
    let msg = "Không thể phân tích link này. ";
    if (err.message.includes("geo") || err.message.includes("region")) {
      msg += "Video bị giới hạn theo vùng địa lý.";
    } else if (err.message.includes("fetch") || err.message.includes("network")) {
      msg += "Lỗi kết nối mạng. Hãy kiểm tra Internet và thử lại.";
    } else if (err.message.includes("private")) {
      msg += "Video này ở chế độ riêng tư.";
    } else {
      msg += err.message;
    }
    showError(msg);
  } finally {
    hide($("loadingBox"));
    $("fetchBtn").disabled = false;
  }
}

// ── Render kết quả ───────────────────────────────────
function renderResult(data, url) {
  selectedUrl = null;

  const platform = detectPlatform(url);
  $("resultPlatform").textContent = platform;
  $("resultTitle").textContent = data.filename || url;
  $("resultAuthor").textContent = "";
  $("resultDuration").textContent = "";

  // Ảnh thumbnail (nếu Cobalt trả về)
  if (data.thumbnail) {
    const img = document.createElement("img");
    img.src = data.thumbnail;
    img.alt = "Thumbnail";
    img.onerror = () => {}; // giữ icon mặc định nếu lỗi
    $("resultThumb").innerHTML = "";
    $("resultThumb").appendChild(img);
  }

  // Build format list
  const grid = $("formatGrid");
  grid.innerHTML = "";

  const formats = buildFormats(data);
  formats.forEach((fmt, i) => {
    const item = document.createElement("div");
    item.className = "format-item";
    item.dataset.url = fmt.url;
    item.dataset.filename = fmt.filename;
    item.innerHTML = `
      <div class="fmt-radio"></div>
      <span class="fmt-badge ${fmt.type === "audio" ? "badge-audio" : "badge-video"}">${fmt.label}</span>
      <span class="fmt-desc">${fmt.desc}</span>
      <span class="fmt-size">${fmt.size}</span>
    `;
    item.addEventListener("click", () => selectFormat(item, fmt.url, fmt.filename));
    grid.appendChild(item);

    // Tự chọn format đầu tiên
    if (i === 0) item.click();
  });

  $("dlBtn").disabled = false;
  show($("resultCard"));
}

// ── Build danh sách format từ response Cobalt ────────
function buildFormats(data) {
  const formats = [];

  // Cobalt trả về status: "stream" (1 link) hoặc "picker" (nhiều link)
  if (data.status === "stream" || data.status === "redirect") {
    // Link trực tiếp duy nhất
    const isAudio = data.filename?.match(/\.(mp3|ogg|opus|m4a|flac)$/i);
    formats.push({
      label: isAudio ? "MP3" : "MP4",
      desc: isAudio ? "Chỉ âm thanh" : "Video chất lượng tốt nhất",
      size: "–",
      type: isAudio ? "audio" : "video",
      url: data.url,
      filename: data.filename || "video.mp4",
    });
  } else if (data.status === "picker") {
    // Nhiều lựa chọn (ví dụ ảnh/video riêng)
    (data.picker || []).forEach((item, i) => {
      formats.push({
        label: item.type === "audio" ? "Audio" : `Tùy chọn ${i + 1}`,
        desc: item.type === "audio" ? "Chỉ âm thanh" : `Video ${i + 1}`,
        size: "–",
        type: item.type || "video",
        url: item.url,
        filename: item.filename || `video_${i + 1}.mp4`,
      });
    });

    // Thêm audio riêng nếu có
    if (data.audio) {
      formats.push({
        label: "Audio",
        desc: "Chỉ âm thanh (MP3)",
        size: "–",
        type: "audio",
        url: data.audio,
        filename: "audio.mp3",
      });
    }
  } else if (data.status === "tunnel") {
    formats.push({
      label: "MP4",
      desc: "Video (qua Cobalt tunnel)",
      size: "–",
      type: "video",
      url: data.url,
      filename: data.filename || "video.mp4",
    });
  }

  // Fallback nếu không parse được
  if (!formats.length && data.url) {
    formats.push({
      label: "Tải",
      desc: "Chất lượng tốt nhất",
      size: "–",
      type: "video",
      url: data.url,
      filename: data.filename || "video.mp4",
    });
  }

  return formats;
}

// ── Chọn format ──────────────────────────────────────
function selectFormat(el, url, filename) {
  document.querySelectorAll(".format-item").forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  selectedUrl = { url, filename };

  const desc = el.querySelector(".fmt-desc")?.textContent || "";
  $("selectedHint").textContent = `Đã chọn: ${desc}`;
  $("dlBtn").disabled = false;
}

// ── Tải xuống ────────────────────────────────────────
async function handleDownload() {
  if (!selectedUrl) return;

  const btn = $("dlBtn");
  btn.disabled = true;
  btn.textContent = "Đang mở...";

  try {
    // Tạo thẻ <a> ẩn để trigger download
    const a = document.createElement("a");
    a.href = selectedUrl.url;
    a.download = selectedUrl.filename || "video.mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    btn.classList.add("success");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Đã tải!`;

    setTimeout(() => {
      btn.classList.remove("success");
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8M8 10L5 7M8 10l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Tải xuống`;
      btn.disabled = false;
    }, 2500);
  } catch (err) {
    showError("Không thể tải file. Hãy thử mở link trực tiếp.");
    btn.textContent = "Tải xuống";
    btn.disabled = false;
  }
}
