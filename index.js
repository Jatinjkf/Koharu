require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./src/utils/db');

console.log("[System] Koharu is waking up...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- DIAGNOSTIC LISTENERS ---
client.on('error', (err) => console.error('[Discord Error]', err));
client.on('warn', (info) => console.warn('[Discord Warning]', info));
process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason));

client.commands = new Collection();

// 1. Load Commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// 2. Load Events
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Start Systems
(async () => {
    try {
        console.log("[System] Initializing Memory (Database)...");
        await connectDB();

        console.log("[System] Opening Mansion Doors (Web Server)...");
        require('./src/utils/server')(client);

        const token = process.env.DISCORD_TOKEN?.trim();
        if (!token) {
            console.error("[CRITICAL] DISCORD_TOKEN is missing in Render Environment!");
            return;
        }

        console.log("[System] Requesting Discord Audience...");
        // Non-blocking login to see if logs proceed
        client.login(token).then(() => {
            console.log("[System] Discord Login successful.");
        }).catch(err => {
            console.error("[CRITICAL] Discord Login Failed:", err.message);
        });

    } catch (err) {
        console.error('[CRITICAL ERROR] Startup sequence broken:', err);
    }
})();
