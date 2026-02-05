# 🌸 Koharu - Your Personal Study Maid

Koharu is a Discord bot designed to help you learn using Spaced Repetition. She manages your study materials (images), reminds you to review them based on custom schedules, and organizes everything efficiently.

## 🛠️ Setup Guide

### 1. Prerequisites
*   Node.js installed.
*   A Discord Bot Token.
*   A MongoDB Connection String (Free from MongoDB Atlas).

### 2. Configuration
1.  Open `.env` file.
2.  Fill in the details:
    ```env
    DISCORD_TOKEN=your_bot_token
    MONGO_URI=your_mongo_connection_string
    CLIENT_ID=your_bot_id
    GUILD_ID=your_server_id
    ```

### 3. Installation
Open a terminal in this folder and run:
```bash
npm install
node index.js
```

### 4. First Time Setup (In Discord)
Once Koharu is online:
1.  Create a **Private Channel** in your server (e.g., `#bot-storage`).
2.  Run the setup command:
    `/admin setup channel:#bot-storage`
3.  Create your first frequency:
    `/admin freq-add name:"Daily" duration:"1d"`
    `/admin freq-add name:"Weekly" duration:"1w"`

## 🎮 Commands

### for Master (User)
*   **`/learn add [name] [frequency] [image]`**: Upload a new study item.
*   **`/learn remove [name]`**: Delete an item.
*   **`/dashboard`**: View your active study schedule.
*   **`/move [item] [to]`**: Change an item's frequency.
*   **`/archive list`**: View finished items.
*   **`/archive revive [item]`**: Bring an item back.
*   **`/archive send-all`**: **Koharu Special!** Sends all archived images to your DM.

### for Admin
*   **`/admin setup`**: Set the storage channel.
*   **`/admin freq-add`**: Create new schedules (e.g., "Every 12h").
*   **`/admin freq-remove`**: Delete schedules.

## ☁️ Deploying to Render
1.  Upload this code to GitHub.
2.  Create a **Web Service** on Render.
3.  Connect your repo.
4.  Add your Environment Variables in Render settings.
5.  **Important:** Use a service like **Uptime Robot** to ping the Render URL every 5 minutes to keep Koharu awake.
