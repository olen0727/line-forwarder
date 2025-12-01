// line-forwarder 版本 A

const express = require('express');
const line = require('@line/bot-sdk');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const app = express();

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('LINE Bot Server is running!');
});


// Webhook 路由設定，用來接收 LINE 事件
app.post('/callback', line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

// 處理事件的函式，邏輯都在這裡
async function handleEvent(event) {
    // 處理 Postback 事件 (按鈕點擊)
    if (event.type === 'postback') {
        return handlePostback(event);
    }

    if (event.type !== 'message' || event.message.type !== 'text') {
        // 如果不是文字訊息，直接忽略不處理
        return Promise.resolve(null);
    }

    const originalMessage = event.message.text;
    const senderId = event.source.userId;

    // === 新增功能：查詢 ID 指令 ===
    if (originalMessage.toLowerCase() === 'myid' || originalMessage === '查ID') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `您的 User ID 是：\n${senderId}`
        });
    }

    // 從 Supabase 取得所有啟用的訂閱者 (管理員)
    const { data: subscribers, error: subError } = await supabase
        .from('subscribers')
        .select('*') // 取得所有欄位，包含 active_chat_target
        .eq('is_active', true);

    if (subError || !subscribers) {
        console.error('Error fetching subscribers:', subError);
        return Promise.resolve(null);
    }

    // 檢查發送者是否為管理員
    const adminSender = subscribers.find(sub => sub.user_id === senderId);

    if (adminSender) {
        // === 管理員發送訊息 ===
        const targetUserId = adminSender.active_chat_target;

        if (!targetUserId) {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '⚠️ 您尚未鎖定回覆對象。\n請先點擊使用者訊息下方的「回覆此人」按鈕。'
            });
        }

        // 轉發訊息給目標使用者
        return client.pushMessage(targetUserId, {
            type: 'text',
            text: originalMessage
        }).then(() => {
            // 為了不干擾管理員，這裡可以選擇不回覆，或者回覆一個簡單的確認
            // 這裡選擇不回覆，讓對話看起來像直接聊天
            return Promise.resolve(null);
        }).catch(err => {
            console.error('Error forwarding to user:', err);
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '❌ 傳送失敗，該使用者可能已封鎖機器人。'
            });
        });

    } else {
        // === 一般使用者發送訊息 ===

        // 1. 試著取得使用者個人資料
        let senderName = 'Unknown User';
        try {
            const profile = await client.getProfile(senderId);
            senderName = profile.displayName;
        } catch (e) {
            console.log('Could not get profile:', e);
        }

        // 2. 準備 Flex Message 給管理員
        const flexMessage = {
            type: 'flex',
            altText: `收到來自 ${senderName} 的訊息`,
            contents: {
                type: 'bubble',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `📩 來自: ${senderName}`,
                            weight: 'bold',
                            size: 'md',
                            color: '#1DB446'
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: originalMessage,
                            wrap: true,
                            margin: 'md',
                            size: 'sm'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            color: '#000000',
                            action: {
                                type: 'postback',
                                label: '回覆此人',
                                data: `action=set_target&user_id=${senderId}&user_name=${senderName}`,
                                displayText: `我要回覆 ${senderName}`
                            }
                        }
                    ]
                }
            }
        };

        // 3. 轉發給所有管理員
        const targetIds = subscribers.map(s => s.user_id);
        const pushPromise = client.multicast(targetIds, flexMessage)
            .catch(err => console.error('Error forwarding message:', err));

        // 4. 儲存訊息到 Supabase
        const dbPromise = supabase
            .from('messages')
            .insert({
                user_id: senderId,
                user_name: senderName,
                content: originalMessage
            })
            .then(({ error }) => {
                if (error) console.error('Error storing message in Supabase:', error);
            });

        await Promise.all([pushPromise, dbPromise]);
    }
}

// 處理 Postback 事件
async function handlePostback(event) {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    if (action === 'set_target') {
        const targetUserId = data.get('user_id');
        const targetUserName = data.get('user_name') || '使用者';
        const adminId = event.source.userId;

        // 更新 Supabase 中該管理員的 active_chat_target
        const { error } = await supabase
            .from('subscribers')
            .update({ active_chat_target: targetUserId })
            .eq('user_id', adminId);

        if (error) {
            console.error('Error updating admin target:', error);
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '❌ 系統錯誤，無法鎖定對象。'
            });
        }

        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🔒 已鎖定對話對象：${targetUserName}\n\n現在您發送的訊息將直接傳送給對方。\n若要切換對象，請點擊其他訊息的「回覆」按鈕。`
        });
    }
}

const port = process.env.PORT || 3000;
const server = app.listen(port, async () => {
    console.log(`listening on ${port}`);

    // 如果在本地開發環境（通常沒設定 PORT 環境變數），自動啟動 ngrok
    if (!process.env.PORT || process.env.NODE_ENV !== 'production') {
        try {
            const ngrok = require('ngrok');
            const url = await ngrok.connect({
                addr: port,
                // 如果有 ngrok authtoken，可以在這裡設定，或是直接讀取系統環境變數
                // authtoken: process.env.NGROK_AUTHTOKEN, 
            });
            console.log(`\n===================================================`);
            console.log(`🚀 Ngrok Tunnel Created!`);
            console.log(`🌍 Webhook URL: ${url}/callback`);
            console.log(`===================================================\n`);
        } catch (error) {
            console.error('Error starting ngrok:', error);
        }
    }
});

module.exports = app;

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
