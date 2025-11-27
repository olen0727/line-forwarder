# Line Forwarder (版本 A)

這是一個基於 Express 和 LINE Messaging API 的 LINE Bot 應用程式。它的主要功能是將使用者發送的訊息轉發給所有訂閱的管理員，並將訊息記錄到 Supabase 資料庫中。

## 功能特色

- **訊息轉發**：收到使用者訊息後，自動轉發給所有在 Supabase `subscribers` 資料表中標記為啟用的使用者。
- **訊息紀錄**：將所有收到的訊息內容、發送者資訊儲存至 Supabase `messages` 資料表。
- **查詢 ID**：使用者輸入 `myid` 或 `查ID`，機器人會回覆該使用者的 User ID。
- **本地開發支援**：內建 ngrok 整合，在本地啟動時自動建立 HTTPS 通道，方便測試 Webhook。

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

1. 將機器人加入好友。
2. 發送任意文字訊息，該訊息會被轉發給管理員（需先在 `subscribers` 表中設定管理員的 LINE User ID）。
3. 發送 `查ID` 或 `myid` 可查詢自己的 LINE User ID。
