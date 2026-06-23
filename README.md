# 工具箱 · tools.littlechin.tw

免費、注重隱私、**純前端**的線上工具包。所有運算都在你的瀏覽器完成，資料不會上傳到任何伺服器。

A free, privacy-first, **100% client-side** web toolbox. Everything runs in your
browser — no backend, no tracking, your data never leaves your device.

## ✨ 特色

- 🧰 **30+ 個工具**，首頁可搜尋、分類、加入最愛
- 🔒 **隱私優先**：無後端、無追蹤，運算全在瀏覽器
- 🕘 **歷史紀錄系統**：工具使用紀錄自動存於 LocalStorage，並有集中的管理頁可查看 / 編輯 / 刪除 / 匯入匯出
- 🌗 深色 / 淺色主題
- 🌐 i18n（繁體中文 / English）
- ⚡ 每個工具都是 lazy-loaded（程式碼分割），只在開啟時才載入

## 🛠️ 技術棧

Vue 3 · Vuetify 4 · TypeScript · Vite · Vue Router · Pinia · vue-i18n

## 🔐 安全設計

- 雜湊（SHA-1/256/384/512）與 HMAC 使用瀏覽器原生 **Web Crypto API**
- 亂數（密碼 / ID）使用 **`crypto.getRandomValues`**（CSPRNG，無 modulo bias）
- Markdown 渲染先經過 **DOMPurify** 淨化，避免 XSS
- 相依套件刻意最小化；MD5、NanoID、UA 解析、圖片壓縮皆為自寫、零相依
- GitHub Actions 的 actions 全部 **pin 到 commit SHA**（供應鏈強化）

## 📦 開發

```bash
pnpm install
pnpm dev        # 本機開發
pnpm build      # 型別檢查 + production build (輸出 dist/)
pnpm preview    # 預覽 build 結果
pnpm typecheck  # 只跑型別檢查
```

需要 Node 22+ 與 pnpm 10。

## 🚀 部署（GitHub Pages）

已設定自動部署：push 到 `main` 會觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
建置並發佈到 GitHub Pages。

首次設定：

1. GitHub repo → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
2. 自訂網域 `tools.littlechin.tw` 已寫在 [`public/CNAME`](public/CNAME)；在 DNS 服務商把
   `tools` 設一筆 **CNAME → `littlechintw.github.io`**。
3. 等 DNS 生效後，在 Pages 設定勾選 **Enforce HTTPS**。

> SPA 路由：workflow 會把 `index.html` 複製成 `404.html`，讓 `/qrcode-generate`
> 這類網址直接開啟或重新整理時也能正確路由。

## ➕ 新增工具

每個工具是 `src/tools/<id>/` 下的獨立資料夾，由 registry 自動探索註冊，**不需修改任何共用檔**。
詳見 [`docs/AUTHORING_TOOLS.md`](docs/AUTHORING_TOOLS.md)，可參考範本 `src/tools/base64/`。

## 📂 專案結構

```
src/
  components/   共用元件 (ToolShell, CopyBtn, FileDrop)
  composables/  useHistory / useClipboard / useLocalized
  layouts/      AppLayout（側邊欄、搜尋、主題、語言）
  locales/      shell 層 i18n 字串
  plugins/      vuetify / i18n 設定
  stores/       history / favorites (Pinia, 持久化於 LocalStorage)
  tools/        每個工具一個資料夾 + registry.ts（自動探索）
  utils/        自寫零相依工具 (md5, nanoid, uaParser)
  views/        HomeView / HistoryView / NotFoundView
```

## 📄 授權

MIT
