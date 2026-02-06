const { SlashCommandBuilder } = require('discord.js');
const Item = require('../models/Item');
const Frequency = require('../models/Frequency');
const ai = require('../utils/ai');
const Config = require('../models/Config');
const UserConfig = require('../models/UserConfig');
const { updateDashboard } = require('../utils/dashboardHelper');
const { getMidnightIST } = require('../utils/timeHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Change the frequency of a learning item')
        .addStringOption(opt => opt.setName('item').setDescription('Name or #ID').setAutocomplete(true).setRequired(true))
        .addStringOption(opt => opt.setName('to').setDescription('The new rhythm').setAutocomplete(true).setRequired(true)),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const guildId = interaction.guildId;

        if (focused.name === 'item') {
            const items = await Item.find({ userId: interaction.user.id, guildId, isArchived: false }).sort({ activeSeq: 1 });
            const filtered = items.filter(i => 
                i.name.toLowerCase().includes(focused.value.toLowerCase()) || 
                (i.activeSeq && String(i.activeSeq).includes(focused.value))
            );
            await interaction.respond(
                filtered.map(i => ({ 
                    name: `#${i.activeSeq || 'Old'} - ${i.name}`, 
                    value: i._id.toString() 
                })).slice(0, 25)
            );
        }

        if (focused.name === 'to') {
            const freqs = await Frequency.find({ guildId });
            const filtered = freqs.filter(f => f.name.toLowerCase().includes(focused.value.toLowerCase()));
            
            if (filtered.length === 0 && focused.value === "") {
                // If no frequencies, warn the user
                return await interaction.respond([{ name: "⚠️ No Rhythms found. Set them in Admin Panel!", value: "none" }]);
            }

            await interaction.respond(
                filtered.map(f => ({ name: f.name, value: f.name })).slice(0, 25)
            );
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const itemIdOrName = interaction.options.getString('item');
        const freqName = interaction.options.getString('to');
        const guildId = interaction.guild.id;

        if (freqName === "none") return interaction.editReply({ content: "Please configure rhythms in the Web Admin Panel first." });

        // Find Item
        let item = await Item.findById(itemIdOrName);
        if (!item) {
             if (!isNaN(itemIdOrName)) {
                 item = await Item.findOne({ userId: interaction.user.id, guildId, activeSeq: parseInt(itemIdOrName), isArchived: false });
             } else {
                 item = await Item.findOne({ userId: interaction.user.id, guildId, name: itemIdOrName, isArchived: false });
             }
        }

        if (!item) return interaction.editReply({ content: 'I could not find that item in your active list.' });

        // Find Frequency
        const frequency = await Frequency.findOne({ guildId, name: freqName });
        if (!frequency) return interaction.editReply({ content: 'I do not know that rhythm. Please select one from the list.' });

        // Update
        item.frequencyName = frequency.name;
        item.frequencyDuration = frequency.duration;
        item.nextReminder = getMidnightIST(Date.now() + frequency.duration);
        item.awaitingReview = false; 
        
        await item.save();

        const config = await Config.findOne({ guildId });
        const botName = config ? config.botName : 'Koharu';
        const userConfig = await UserConfig.findOne({ userId: interaction.user.id, guildId });
        const masterName = userConfig ? userConfig.preferredName : 'Master';

        await updateDashboard(interaction.client, guildId, interaction.user.id);
        const msg = await ai.getMoveMessage(item.name, freqName, masterName, botName);
        await interaction.editReply({ content: msg });
    }
};