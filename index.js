require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./src/utils/db');
const keepAlive = require('./src/utils/server');

// Initialize Koharu
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[Warning] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load Events (if we split them later, for now we can keep basic ones here or move them)
// For modularity, let's keep the main ready/interaction logic here for a moment or move to events folder.
// Let's use the events folder structure for cleanliness.
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
    if (process.env.USE_LOCAL_DB === 'true') {
        console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: Running with In-Memory Database. All data will be LOST when you stop this bot. ⚠️');
    }

    // Connect Database First
    await connectDB();

    // Start Scheduler & Run Initial Check
    const scheduler = require('./src/utils/scheduler');
    scheduler.start(client);

    // Login
    try {
        await client.login(process.env.DISCORD_TOKEN);
        
        // Start Web Server (Admin Panel)
        require('./src/utils/server')(client);

        // Run "Wake Up" check immediately upon connection
        setTimeout(() => {
            scheduler.checkNow(client);
        }, 5000); 

    } catch (err) {
        console.error('[System] Failed to login to Discord:', err.message);
    }
})();