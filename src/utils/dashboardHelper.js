const { EmbedBuilder } = require('discord.js');
const Item = require('../models/Item');
const UserConfig = require('../models/UserConfig');
const ai = require('./ai');

function isUrlExpired(url) {
    if (!url) return true;
    try {
        const urlObj = new URL(url);
        const ex = urlObj.searchParams.get('ex');
        if (!ex) return false;
        const expiry = parseInt(ex, 16) * 1000;
        return Date.now() > (expiry - 3600000);
    } catch (e) { return true; }
}

async function getFreshImageUrl(client, item) {
    if (!isUrlExpired(item.imageUrl)) return item.imageUrl;
    if (!item.storageMessageId || !item.storageChannelId) return item.imageUrl;
    try {
        const channel = await client.channels.fetch(item.storageChannelId);
        const msg = await channel.messages.fetch(item.storageMessageId);
        const newUrl = msg.attachments.first().url;
        item.imageUrl = newUrl;
        await item.save();
        return newUrl;
    } catch (e) {
        return item.imageUrl; 
    }
}

async function generateDashboardEmbed(client, guildId, userId) {
    const items = await Item.find({ userId, guildId, isArchived: false }).sort({ activeSeq: 1 });
    const userConfig = await UserConfig.findOne({ userId, guildId });
    const displayName = userConfig ? userConfig.preferredName : 'Master';

    const Config = require('../models/Config');
    const guildConfig = await Config.findOne({ guildId }); 
    const botName = guildConfig ? guildConfig.botName : 'Koharu';

    const greeting = await ai.getDashboardIntro(displayName, botName);

    const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle(`📚 ${botName}'s Dashboard`)
        .setDescription(greeting)
        .setTimestamp();

    if (items.length === 0) {
        embed.setDescription(`*Your schedule is empty, ${displayName}.*`);
        return embed;
    }

    const grouped = {};
    items.forEach(item => {
        if (!grouped[item.frequencyName]) grouped[item.frequencyName] = [];
        grouped[item.frequencyName].push(item);
    });

    for (const [freq, groupItems] of Object.entries(grouped)) {
        // Updated to show relative time (e.g., "in 2 days")
        const list = groupItems.map(i => {
            const time = Math.floor(i.nextReminder.getTime() / 1000);
            return `❀ **${i.name}** \`[#${i.activeSeq}]\`\n└ *Next: <t:${time}:R>*`;
        }).join('\n');
        
        const partitionName = `─── 🌸 ✧ ${freq.toUpperCase()} ✧ 🌸 ───`;
        embed.addFields({ name: partitionName, value: list + '\n\u200b' });
    }

    return embed;
}

async function updateDashboard(client, guildId, userId) {
    try {
        let userConfig = await UserConfig.findOne({ userId, guildId });
        if (!userConfig) userConfig = await UserConfig.create({ userId, guildId });

        const Config = require('../models/Config');
        const config = await Config.findOne({ guildId });
        if (!config || !config.quickAddChannelId) return;

        const channel = client.channels.cache.get(config.quickAddChannelId);
        if (!channel) return;

        const embed = await generateDashboardEmbed(client, guildId, userId);
        const channelChanged = userConfig.lastDashboardChannelId !== config.quickAddChannelId;

        if (!channelChanged && userConfig.lastDashboardMessageId) {
            try {
                const lastMsg = await channel.messages.fetch(userConfig.lastDashboardMessageId);
                await lastMsg.edit({ content: `<@${userId}>'s Dashboard`, embeds: [embed] });
                return;
            } catch (e) {}
        }

        const newMsg = await channel.send({ content: `<@${userId}>'s Dashboard`, embeds: [embed] });
        userConfig.lastDashboardMessageId = newMsg.id;
        userConfig.lastDashboardChannelId = config.quickAddChannelId;
        await userConfig.save();

    } catch (err) { console.error("[Dashboard Update] Error:", err); }
}

module.exports = { generateDashboardEmbed, updateDashboard, getFreshImageUrl };
