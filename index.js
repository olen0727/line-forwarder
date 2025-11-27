// line-forwarder 版本A

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


// Webhook route
app.post('/callback', line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

// Event handler
async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        // ignore non-text-message event
        return Promise.resolve(null);
    }

    const targetUserId = process.env.TARGET_USER_ID;

    if (!targetUserId) {
        console.error('TARGET_USER_ID is not set in .env');
        return Promise.resolve(null);
    }

    // Forward the message to the target user
    // We include the sender's ID (or we could fetch profile) to know who sent it
    const originalMessage = event.message.text;
    const senderId = event.source.userId;

    // Try to get user profile to show name
    let senderName = 'Unknown User';
    try {
        const profile = await client.getProfile(senderId);
        senderName = profile.displayName;
    } catch (e) {
        console.log('Could not get profile:', e);
    }

    // 1. First, forward the message (Priority)
    const forwardMessage = `收到來自 ${senderName} 的訊息：\n\n${originalMessage}`;

    // We push the message first
    const pushPromise = client.pushMessage(targetUserId, {
        type: 'text',
        text: forwardMessage
    }).catch(err => {
        console.error('Error forwarding message:', err);
    });

    // 2. Then, store in Supabase (Background)
    const dbPromise = supabase
        .from('messages')
        .insert({
            user_id: senderId,
            user_name: senderName,
            content: originalMessage
        })
        .then(({ error }) => {
            if (error) console.error('Error storing message in Supabase:', error);
        })
        .catch(err => {
            console.error('Supabase exception:', err);
        });

    // Wait for both (or at least ensure forwarding started)
    await Promise.all([pushPromise, dbPromise]);
}

const port = process.env.PORT || 3000;
const server = app.listen(port, async () => {
    console.log(`listening on ${port}`);

    // 如果是在本地開發環境 (沒有設定 PORT 環境變數通常代表本地)，自動啟動 ngrok
    if (!process.env.PORT || process.env.NODE_ENV !== 'production') {
        try {
            const ngrok = require('ngrok');
            const url = await ngrok.connect({
                addr: port,
                // 如果您有 ngrok authtoken，可以在這裡設定，或是在系統環境變數設定
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
