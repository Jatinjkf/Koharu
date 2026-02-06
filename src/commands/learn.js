const { SlashCommandBuilder } = require('discord.js');
const Item = require('../models/Item');
const Frequency = require('../models/Frequency');
const Config = require('../models/Config');
const { updateDashboard } = require('../utils/dashboardHelper');
const { getMidnightIST } = require('../utils/timeHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('learn')
        .setDescription('Manage your learning items')
        .addSubcommand(sub => 
            sub.setName('add')
               .setDescription('Add a new item to learn')
               .addStringOption(opt => opt.setName('name').setDescription('Name of the item').setRequired(true))
               .addAttachmentOption(opt => opt.setName('image').setDescription('The image to study').setRequired(true))
               .addStringOption(opt => opt.setName('frequency').setDescription('Optional: Default: Daily').setAutocomplete(true).setRequired(false))
        )
        .addSubcommand(sub => 
            sub.setName('remove')
               .setDescription('Permanently delete an item')
               .addStringOption(opt => opt.setName('item').setDescription('Name or #ID').setAutocomplete(true).setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('archive')
               .setDescription('Move an item to the Archive')
               .addStringOption(opt => opt.setName('item').setDescription('Name or #ID').setAutocomplete(true).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('rename')
               .setDescription('Rename a learning item')
               .addStringOption(opt => opt.setName('item').setDescription('Existing #ID or Name').setAutocomplete(true).setRequired(true))
               .addStringOption(opt => opt.setName('new_name').setDescription('The new name').setRequired(true))
        ),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (focusedOption.name === 'frequency') {
            const freqs = await Frequency.find({ guildId });
            const filtered = freqs.filter(f => f.name.toLowerCase().includes(focusedOption.value.toLowerCase()));
            await interaction.respond(filtered.map(f => ({ name: f.name, value: f.name })).slice(0, 25));
        }

        if (focusedOption.name === 'item') {
            const query = { userId: interaction.user.id, guildId };
            if (sub !== 'rename') query.isArchived = false;

            const items = await Item.find(query).sort({ isArchived: 1, activeSeq: 1, archiveSeq: 1 });
            const filtered = items.filter(i => 
                i.name.toLowerCase().includes(focusedOption.value.toLowerCase()) || 
                (i.activeSeq && String(i.activeSeq).includes(focusedOption.value)) || 
                (i.archiveSeq && String(i.archiveSeq).includes(focusedOption.value))
            );
            
            await interaction.respond(filtered.map(i => {
                const label = i.isArchived ? `📦 [Archive #${i.archiveSeq || 'Old'}] ${i.name}` : `📖 [#${i.activeSeq || 'Old'}] ${i.name}`;
                return { name: label, value: i._id.toString() };
            }).slice(0, 25));
        }
    },
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            await interaction.deferReply({ ephemeral: false });
            const name = interaction.options.getString('name');
            const image = interaction.options.getAttachment('image');
            let freq = await Frequency.findOne({ guildId, name: interaction.options.getString('frequency') }) || await Frequency.findOne({ guildId, isDefault: true }) || await Frequency.findOne({ guildId }) || { name: 'Daily', duration: 86400000 };

            const config = await Config.findOne({ guildId });
            const storageChannel = interaction.client.channels.cache.get(config?.storageChannelId);
            if (!storageChannel) return interaction.editReply('Storage channel not setup.');

            const sentMsg = await storageChannel.send({ content: `Drop: ${interaction.user.tag}`, files: [image.url] });
            const lastActive = await Item.findOne({ userId, guildId, isArchived: false }).sort({ activeSeq: -1 });
            const nextActive = lastActive ? lastActive.activeSeq + 1 : 1;

            const newItem = new Item({
                userId, guildId, name, imageUrl: sentMsg.attachments.first().url, storageMessageId: sentMsg.id, storageChannelId: storageChannel.id,
                frequencyName: freq.name, frequencyDuration: freq.duration, nextReminder: getMidnightIST(Date.now() + freq.duration), activeSeq: nextActive
            });
            await newItem.save();
            await updateDashboard(interaction.client, guildId, userId);
            return interaction.editReply(`✅ Added "**${name}**" (#${nextActive}).`);
        }

        if (sub === 'rename') {
            const itemIdOrName = interaction.options.getString('item');
            const newName = interaction.options.getString('new_name');
            
            let item = await Item.findById(itemIdOrName) || await Item.findOne({ userId, guildId, activeSeq: parseInt(itemIdOrName), isArchived: false }) || await Item.findOne({ userId, guildId, archiveSeq: parseInt(itemIdOrName), isArchived: true }) || await Item.findOne({ userId, guildId, name: itemIdOrName });

            if (!item) return interaction.reply({ content: 'I could not find that item.', ephemeral: true });
            
            const oldName = item.name;
            item.name = newName;
            await item.save();

            const loc = item.isArchived ? "in your archives" : "on your dashboard";
            await interaction.reply({ content: `📝 Renamed "**${oldName}**" to "**${newName}**" ${loc}.`, ephemeral: true });
            await updateDashboard(interaction.client, guildId, userId);
        }

        if (sub === 'remove' || sub === 'archive') {
            const itemIdOrName = interaction.options.getString('item');
            let item = await Item.findById(itemIdOrName) || await Item.findOne({ userId, guildId, activeSeq: parseInt(itemIdOrName), isArchived: false });
            if (!item) return interaction.reply({ content: 'Not found.', ephemeral: true });

            if (sub === 'remove') {
                await Item.findByIdAndDelete(item._id);
                await interaction.reply({ content: `🗑️ Deleted "**${item.name}**".`, ephemeral: true });
            } else {
                item.isArchived = true;
                item.activeSeq = null;
                const lastArchive = await Item.findOne({ userId, guildId, isArchived: true }).sort({ archiveSeq: -1 });
                item.archiveSeq = lastArchive ? lastArchive.archiveSeq + 1 : 1;
                await item.save();
                await interaction.reply({ content: `📦 Archived "**${item.name}**" as Archive #${item.archiveSeq}.`, ephemeral: true });
            }
            await updateDashboard(interaction.client, guildId, userId);
        }
    }
};