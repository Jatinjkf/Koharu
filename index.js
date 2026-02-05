// PRODUCTION PROTOCOL: FORCED IPv4
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./src/utils/db');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

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
        console.log("[System] Connecting to Memory...");
        await connectDB();

        console.log("[System] Starting WebUI Port Binding...");
        require('./src/utils/server')(client);

        const token = process.env.DISCORD_TOKEN?.trim();
        if (!token) {
            console.error("[CRITICAL] DISCORD_TOKEN is missing!");
            return;
        }

        console.log("[System] Connecting to Discord...");
        // Non-blocking login for Render stability
        client.login(token).catch(err => {
            console.error("[CRITICAL] Login Handshake Failed:", err.message);
        });

    } catch (err) {
        console.error('[CRITICAL ERROR] Boot sequence failed:', err.message);
    }
})();
