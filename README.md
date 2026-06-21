# VidDown 🎵

Tải video từ **Douyin, TikTok, YouTube, Instagram, Facebook** và 20+ nền tảng khác — không cần backend, không watermark.

> Sử dụng [Cobalt API](https://cobalt.tools) — mã nguồn mở, miễn phí.

---

## 🚀 Deploy lên GitHub Pages (5 phút)

### Bước 1 — Tạo repository

1. Vào [github.com/new](https://github.com/new)
2. Đặt tên repo, ví dụ: `viddown`
3. Chọn **Public**
4. Nhấn **Create repository**

### Bước 2 — Upload code

**Cách A — Kéo thả (dễ nhất):**
1. Mở repo vừa tạo
2. Nhấn **Add file → Upload files**
3. Kéo 3 file (`index.html`, `style.css`, `app.js`) vào
4. Nhấn **Commit changes**

**Cách B — Dùng Git:**
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TEN_BAN/viddown.git
git push -u origin main
```

### Bước 3 — Bật GitHub Pages

1. Vào **Settings** → **Pages**
2. Source: chọn **Deploy from a branch**
3. Branch: **main** / **(root)**
4. Nhấn **Save**

Sau ~1 phút, web sẽ live tại:
```
https://TEN_BAN.github.io/viddown/
```

---

## 📁 Cấu trúc

```
viddown/
├── index.html   ← Giao diện chính
├── style.css    ← CSS
├── app.js       ← Logic + gọi Cobalt API
└── README.md
```

---

## 🔧 Cobalt API

Project dùng [Cobalt](https://github.com/imputnet/cobalt) — dịch vụ mã nguồn mở.

**Instance công cộng mặc định:** `https://api.cobalt.tools`

Nếu muốn dùng instance riêng (tự host hoặc của cộng đồng), đổi dòng này trong `app.js`:
```js
const COBALT_API = "https://api.cobalt.tools";
```

Danh sách instance cộng đồng: [instances.cobalt.best](https://instances.cobalt.best)

---

## ✅ Nền tảng hỗ trợ

| Nền tảng | Không watermark | Chất lượng cao |
|---|---|---|
| Douyin (抖音) | ✅ | ✅ |
| TikTok | ✅ | ✅ |
| YouTube | – | ✅ |
| Instagram Reels | – | ✅ |
| Facebook | – | ✅ |
| Twitter/X | – | ✅ |
| Pinterest | – | ✅ |
| Vimeo | – | ✅ |

---

## ⚠️ Lưu ý

- Chỉ dùng cho **mục đích cá nhân**
- Không tải lại hay phân phối video có bản quyền
- Một số video Douyin bị chặn theo vùng địa lý (cần VPN)
