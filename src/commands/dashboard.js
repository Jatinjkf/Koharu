const { SlashCommandBuilder } = require('discord.js');
const { generateDashboardEmbed } = require('../utils/dashboardHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('View your current learning schedule'),
    async execute(interaction) {
        // User requested persistent dashboard (not ephemeral)
        await interaction.deferReply({ ephemeral: false });
        
        // Use the updated helper function
        const embed = await generateDashboardEmbed(interaction.client, interaction.guild.id, interaction.user.id);
        
        await interaction.editReply({ embeds: [embed] });
    }
};
