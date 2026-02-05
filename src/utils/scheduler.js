const cron = require('node-cron');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Item = require('../models/Item');
const UserConfig = require('../models/UserConfig');
const Config = require('../models/Config');
const ai = require('./ai');
const { getFreshImageUrl } = require('./dashboardHelper');

let scheduledTasks = {}; // Store tasks per guildId

async function checkRemindersForGuild(client, guildId) {
    console.log(`[Scheduler] Running checks for Mansion: ${guildId}`);
    try {
        const now = new Date();
        
        // Anti-Deadlock: Reset items waiting for > 24h
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        await Item.updateMany(
            { guildId, awaitingReview: true, nextReminder: { $lte: yesterday } },
            { awaitingReview: false }
        );

        const dueItems = await Item.find({
            guildId,
            nextReminder: { $lte: now },
            isArchived: false,
            awaitingReview: false
        });

        if (dueItems.length === 0) return;

        // Group by User
        const userItems = {};
        for (const item of dueItems) {
            if (!userItems[item.userId]) userItems[item.userId] = [];
            userItems[item.userId].push(item);
        }

        const config = await Config.findOne({ guildId });
        if (!config || !config.quickAddChannelId) return;
        const channel = client.channels.cache.get(config.quickAddChannelId);
        if (!channel) return;

        for (const userId of Object.keys(userItems)) {
            const items = userItems[userId];
            const userConfig = await UserConfig.findOne({ userId });
            const masterName = userConfig ? userConfig.preferredName : 'Master';
            const botName = config.botName || 'Koharu';

            const chunkSize = 10;
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const status = await ai.getStatusMessage(botName);
                
                const embeds = [];
                for(const item of chunk) {
                    const url = await getFreshImageUrl(client, item);
                    embeds.push(new EmbedBuilder()
                        .setColor(0xFFB6C1)
                        .setImage(url)
                        .setFooter({ text: `❀ Item #${item.activeSeq || '?'}: ${item.name}` }));
                }

                embeds[0].setTitle(`📅 Daily Protocol for ${masterName}`)
                         .setDescription(`*${status}.*`);

                const doneButton = new ButtonBuilder()
                    .setCustomId(`batch_done_${userId}`)
                    .setLabel(`I have learned them all, ${botName} 🌸`)
                    .setStyle(ButtonStyle.Secondary);

                const sentMsg = await channel.send({ 
                    content: `🔔 <@${userId}>`, 
                    embeds: embeds, 
                    components: [new ActionRowBuilder().addComponents(doneButton)] 
                });

                for (const item of chunk) {
                    item.awaitingReview = true;
                    item.lastReminderMessageId = sentMsg.id;
                    await item.save();
                }
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } catch (err) { console.error(`[Scheduler Error - ${guildId}]:`, err); }
}

async function startScheduler(client) {
    // Stop all existing
    Object.values(scheduledTasks).forEach(t => t.stop());
    scheduledTasks = {};

    const configs = await Config.find();
    for (const config of configs) {
        const cronTime = config.reminderTime || '0 0 * * *';
        console.log(`[Scheduler] Mansion ${config.guildId} set to "${cronTime}" (IST)`);
        
        scheduledTasks[config.guildId] = cron.schedule(cronTime, () => {
            checkRemindersForGuild(client, config.guildId);
        }, { timezone: "Asia/Kolkata" });
    }
}

// Global check now (triggers for all guilds)
async function checkAllNow(client) {
    const guilds = await Config.find().distinct('guildId');
    for (const gid of guilds) {
        await checkRemindersForGuild(client, gid);
    }
}

module.exports = { start: startScheduler, reschedule: startScheduler, checkNow: checkAllNow };