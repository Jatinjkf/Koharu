// 1. CLOUD DNS FIX
const dns = require('node:dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./src/utils/db');

console.log("[System] Koharu is initiating cloud protocols...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User],
    closeTimeout: 30000
});

// --- CONNECTION DIAGNOSTICS ---
client.on('debug', info => {
    if (info.includes('heartbeat')) return; // Ignore noise
    console.log('[Discord Debug]', info);
});
client.on('error', err => console.error('[Discord Error]', err));

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

// 3. Clear Log on Successful Ready
client.once('ready', () => {
    console.log("-----------------------------------");
    console.log(`🌸 [SUCCESS] ${client.user.tag} IS ONLINE!`);
    console.log("-----------------------------------");
});

// Start Systems
(async () => {
    try {
        console.log("[System] Connecting to Memory...");
        await connectDB();

        console.log("[System] Starting WebUI...");
        require('./src/utils/server')(client);

        const token = process.env.DISCORD_TOKEN?.trim();
        if (!token) return console.error("[CRITICAL] DISCORD_TOKEN missing!");

        console.log("[System] Dispatched Handshake Signal...");
        
        // Handshake Watchdog
        const handshakeWatchdog = setTimeout(() => {
            console.error("[CRITICAL] Handshake taking too long. Forcing restart...");
            process.exit(1); 
        }, 45000); // Give it 45 seconds

        await client.login(token);
        clearTimeout(handshakeWatchdog);

    } catch (err) {
        console.error('[CRITICAL ERROR] Boot sequence failed:', err.message);
        process.exit(1);
    }
})();
