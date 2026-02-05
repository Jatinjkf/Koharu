const { REST, Routes } = require('discord.js');
const Config = require('../models/Config');
const UserConfig = require('../models/UserConfig');
const ai = require('../utils/ai');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`[Status] Koharu is online as ${client.user.tag}`);
        
        // Dynamic Status Loop (Every 3 Hours)
        const updateStatus = async () => {
             try {
                 const firstConfig = await Config.findOne();
                 const botName = firstConfig ? firstConfig.botName : 'Koharu';
                 const statusText = await ai.getStatusMessage(botName);
                 client.user.setActivity(statusText, { type: 4 }); // Type 4 = Custom Status / Playing
                 console.log(`[Status] Updated to: "${statusText}"`);
             } catch (e) {
                 console.error("[Status] Failed to update:", e);
             }
        };
        
        // Run immediately, then every 3 hours
        updateStatus();
        setInterval(updateStatus, 3 * 60 * 60 * 1000); 

        // Register Commands
        const commands = [];
        client.commands.forEach(cmd => commands.push(cmd.data.toJSON()));

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('[System] Refreshing application (/) commands...');
            // Using global registration (can take 1 hour to update) or guild specific (instant)
            // We will use Guild specific if GUILD_ID is provided, else Global
            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands },
                );
                console.log('[System] Successfully registered commands for the Guild.');
            } else {
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands },
                );
                console.log('[System] Successfully registered Global commands.');
            }
        } catch (error) {
            console.error('[System] Error registering commands:', error);
        }

        // Initialize Config and Frequencies
        if (process.env.GUILD_ID) {
            const guildId = process.env.GUILD_ID;
            
            // Config
            const config = await Config.findOne({ guildId });
            if (!config) {
                await Config.create({ guildId });
                console.log('[Database] Created default configuration for Guild.');
            }

            // Frequencies (Default Rhythms)
            const Frequency = require('../models/Frequency');
            const freqCount = await Frequency.countDocuments({ guildId });
            if (freqCount === 0) {
                const day = 24 * 3600000;
                await Frequency.create([
                    { guildId, name: "Daily", duration: day, isDefault: true },
                    { guildId, name: "Every 2 Days", duration: 2 * day },
                    { guildId, name: "Weekly", duration: 7 * day }
                ]);
                console.log('[Database] Initialized default study rhythms for Guild.');
            }
        }
    },
};