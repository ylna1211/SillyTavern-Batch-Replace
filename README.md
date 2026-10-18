# SillyTavern 批次文字取代（Batch Text Replace）

## 功能

- 在 SillyTavern 的「擴充功能設定」中提供獨立操作介面。
- 只處理目前開啟聊天的訊息 `mes` 文字欄位，涵蓋使用者與角色訊息。
- 一般文字比對，不使用正規表示式。
- 可預覽命中訊息及取代數量。
- 執行前下載修改前的 JSON 訊息備份。
- 不修改發話者名稱、訊息時間、swipe 或其他中繼資料。

## 安裝方式（手動）

1. 先關閉或保留 SillyTavern 執行中皆可；建議安裝前先備份整個 SillyTavern `data` 資料夾。
2. 解壓縮本 ZIP。
3. 將 `SillyTavern-Batch-Replace` 資料夾放到下列其中一個位置：
   - 目前使用者：`SillyTavern/data/<使用者名稱>/extensions/SillyTavern-Batch-Replace/`
   - 所有使用者：`SillyTavern/public/scripts/extensions/third-party/SillyTavern-Batch-Replace/`
4. 確認資料夾內直接有 `manifest.json`、`index.js`、`style.css`，不要多套一層同名資料夾。
5. 重新載入 SillyTavern 網頁。
6. 開啟頂部「擴充功能」面板，找到「批次文字取代」並展開。

## 使用方式

1. 開啟要修正的聊天。
2. 在「尋找文字」輸入錯誤名稱；在「取代為」輸入正確名稱。
3. 按「預覽」，檢查命中訊息和數量。
4. 按「備份並全部取代」，在確認視窗選擇繼續。
5. 確認瀏覽器已下載 `SillyTavern-chat-backup-before-replace-....json`，並檢查聊天內容。

## 重要限制與安全說明

- 這份備份是執行前目前聊天訊息陣列的 JSON 快照，**不是原始 JSONL 聊天檔的逐位元複製，也不是一鍵還原檔**。請另外使用 SillyTavern 的聊天匯出功能或備份 `data` 資料夾。
- 擴充功能透過 SillyTavern 的 `getContext()` 取得聊天資料，並要求 `context.saveChat()` 寫回。如果你的 SillyTavern 版本沒有在 context 提供此方法，插件會取消修改而不繼續。
- 不會更改角色卡名稱、訊息的 `name` 欄位或其他 metadata。
- 文字取代是字串包含比對，例如將「安」取代為「艾」會修改所有 `mes` 文字中出現的「安」，請務必先預覽。
- 如果你使用的版本在儲存後未自動刷新畫面，請手動重新載入頁面並檢查內容。
- 第三方擴充功能可能會因 SillyTavern 更新而需要調整。先在測試聊天中驗證，再操作重要紀錄。

## 檔案

- `manifest.json`：擴充功能資訊
- `index.js`：介面、預覽、備份、取代與儲存流程
- `style.css`：介面樣式
