// FINAL CLOUD HANDSHAKE PROTOCOL
const dns = require('node:dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./src/utils/db');

console.log("[System] Koharu is initiating the Final Cloud Handshake...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User],
    // WebSocket stability for cloud environments
    rest: { timeout: 60000 },
    sweepers: { messages: { interval: 3600, lifetime: 1800 } }
});

// --- CRITICAL ERROR LOGGING ---
client.on('error', err => console.error('[Gateway Error]', err.message));
client.on('shardError', err => console.error('[Shard Error]', err.message));
client.on('shardDisconnect', () => console.warn('[Shard] Disconnected...'));
client.on('shardReconnecting', () => console.info('[Shard] Reconnecting...'));

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command);
}

// Load Events
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
}

client.once('ready', () => {
    console.log("-----------------------------------");
    console.log(`🌸 [SUCCESS] ${client.user.tag} IS ONLINE!`);
    console.log("-----------------------------------");
});

// Start Systems
(async () => {
    try {
        console.log("[System] 1. Connecting to Memory...");
        await connectDB();

        console.log("[System] 2. Opening Mansion Doors (WebUI)...");
        require('./src/utils/server')(client);

        const token = process.env.DISCORD_TOKEN?.trim();
        if (!token) throw new Error("DISCORD_TOKEN is missing!");

        console.log("[System] 3. Attempting Discord Handshake...");
        
        // Timeout Protection
        const watchdog = setTimeout(() => {
            console.error("[CRITICAL] Handshake timeout. Restarting container...");
            process.exit(1);
        }, 60000);

        await client.login(token);
        clearTimeout(watchdog);

    } catch (err) {
        console.error('[CRITICAL ERROR]', err.message);
        process.exit(1);
    }
})();
