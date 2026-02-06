const { Events } = require('discord.js');
const Config = require('../models/Config');
const Item = require('../models/Item');
const Frequency = require('../models/Frequency');
const UserConfig = require('../models/UserConfig');
const { updateDashboard } = require('../utils/dashboardHelper');
const { getMidnightIST } = require('../utils/timeHelper');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const config = await Config.findOne({ guildId: message.guild.id });
        if (!config || message.channel.id !== config.quickAddChannelId) return;

        const attachments = message.attachments.filter(a => a.contentType?.startsWith('image/'));
        if (attachments.size === 0) return;

        const userConfig = await UserConfig.findOne({ userId: message.author.id, guildId: message.guild.id });
        const masterName = userConfig ? userConfig.preferredName : 'Master';

        // 1. DENY MULTI-IMAGE DROPS
        if (attachments.size > 1) {
            const reply = await message.reply(`My deepest apologies, ${masterName}. I can only process one study item at a time to ensure perfect organization. Please drop them one by one. 🙇‍♀️`);
            setTimeout(() => {
                message.delete().catch(() => {});
                reply.delete().catch(() => {});
            }, 10000); // 10 seconds for rejection
            return;
        }

        const attachment = attachments.first();
        const storageChannel = message.guild.channels.cache.get(config.storageChannelId);
        if (!storageChannel) return;

        // Find Frequency
        let freq = await Frequency.findOne({ guildId: message.guild.id, isDefault: true }) || await Frequency.findOne({ guildId: message.guild.id }) || { name: 'Daily', duration: 86400000 };

        const userId = message.author.id;

        try {
            // 2. PROCESS SINGLE IMAGE
            const sentMsg = await storageChannel.send({ 
                content: `Quick Add: User ${message.author.tag} (${userId})`, 
                files: [attachment.url] 
            });

            // FIX: Use activeSeq for calculation
            const lastItem = await Item.findOne({ userId, isArchived: false }).sort({ activeSeq: -1 });
            const nextSeq = lastItem ? lastItem.activeSeq + 1 : 1;
            const nextDate = getMidnightIST(Date.now() + freq.duration);

            const itemName = message.content.trim() || `Item ${nextSeq}`;

            const newItem = new Item({
                userId,
                guildId: message.guild.id,
                name: itemName,
                imageUrl: sentMsg.attachments.first().url,
                storageMessageId: sentMsg.id,
                storageChannelId: storageChannel.id,
                frequencyName: freq.name,
                frequencyDuration: freq.duration,
                nextReminder: nextDate,
                activeSeq: nextSeq
            });
            await newItem.save();

            // 3. Response & Dashboard
            const reply = await message.reply(`✅ Saved "**${itemName}**" to your ${freq.name} list, ${masterName}.`);
            await updateDashboard(message.client, message.guild.id, userId);

            setTimeout(() => {
                message.delete().catch(() => {});
                reply.delete().catch(() => {});
            }, 60000);
        } catch (e) {
            console.error("[Quick Add] Error:", e);
            const errReply = await message.reply("My apologies, Master. I failed to preserve that item.");
            setTimeout(() => {
                message.delete().catch(() => {});
                errReply.delete().catch(() => {});
            }, 5000);
        }
    }
};
