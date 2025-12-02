# Line Forwarder (版本 A)

這是一個基於 Express 和 LINE Messaging API 的 LINE Bot 應用程式。它的主要功能是將使用者發送的訊息轉發給所有訂閱的管理員，並支援管理員直接回覆使用者。

## 功能特色

- **訊息轉發**：收到使用者訊息後，自動以 **Flex Message** 卡片格式轉發給所有在 Supabase `subscribers` 資料表中標記為啟用的管理員。
- **雙向回覆**：管理員可透過點擊卡片上的「回覆此人」按鈕，鎖定特定使用者進行一對一回覆。
- **訊息紀錄**：將所有收到的訊息內容、發送者資訊儲存至 Supabase `messages` 資料表。
- **查詢 ID**：使用者輸入 `myid` 或 `查ID`，機器人會回覆該使用者的 User ID。
- **本地開發支援**：內建 ngrok 整合，在本地啟動時自動建立 HTTPS 通道，方便測試 Webhook。

## 管理員指令

管理員可使用以下指令來管理對話狀態：

| 指令 | 說明 |
| --- | --- |
| `ta` / `target` | **查詢目標**：顯示目前鎖定的對話對象資料 (含頭像、名稱)。 |
| `clr` / `clear` | **解除鎖定**：清除目前的鎖定狀態，避免誤傳訊息。 |
| `test` / `測試` | **模擬測試**：模擬收到一則來自虛擬使用者的訊息，用於測試轉發與回覆流程。 |

## 安裝與設定

### 1. 安裝相依套件

```bash
npm install
```

### 2. 設定環境變數

請在專案根目錄建立 `.env` 檔案，並填入以下資訊：

```env
CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
CHANNEL_SECRET=你的_LINE_Channel_Secret
SUPABASE_URL=你的_Supabase_URL
SUPABASE_KEY=你的_Supabase_Anon_Key
# NGROK_AUTHTOKEN=你的_Ngrok_Authtoken (選填，若無則使用免費匿名通道)
```

### 3. 資料庫設定 (Supabase)

請在 Supabase 中建立以下兩個資料表：

**subscribers (訂閱者)**

| 欄位名稱 | 類型 | 說明 |
| --- | --- | --- |
| id | bigint | Primary Key |
| user_id | text | LINE User ID |
| is_active | boolean | 是否啟用接收轉發 |
| active_chat_target | text | **(新增)** 目前鎖定的對話目標 User ID |
| created_at | timestamptz | 建立時間 |

**messages (訊息紀錄)**

| 欄位名稱 | 類型 | 說明 |
| --- | --- | --- |
| id | bigint | Primary Key |
| user_id | text | 發送者 LINE User ID |
| user_name | text | 發送者顯示名稱 |
| content | text | 訊息內容 |
| created_at | timestamptz | 建立時間 |

## 啟動專案

### 本地開發

```bash
npm start
```
啟動後，程式會自動嘗試開啟 ngrok 通道，並在 Console 顯示 Webhook URL。請將該 URL 填入 LINE Developers Console 的 Webhook settings 中。

### 正式環境

設定環境變數 `NODE_ENV=production`，程式將不會啟動 ngrok。

## 使用方法

1. **一般使用者**：
   - 發送任意文字訊息，機器人會將其轉發給管理員。
   - 發送 `查ID` 或 `myid` 可查詢自己的 LINE User ID。

2. **管理員**：
   - 收到使用者訊息卡片後，點擊 **「回覆此人」** 按鈕。
   - 機器人確認鎖定後，直接輸入文字即可回覆該使用者。
   - 輸入 `clr` 可解除鎖定狀態。
