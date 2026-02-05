const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Config = require('../models/Config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Configure Koharu system settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('setup')
               .setDescription('Set the image storage channel')
               .addChannelOption(option => option.setName('channel').setDescription('The channel to hide images in').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('quick-add')
               .setDescription('Set the channel for dropping images & receiving reminders')
               .addChannelOption(opt => opt.setName('channel').setDescription('The channel').setRequired(true))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            let config = await Config.findOne({ guildId });
            if (!config) config = new Config({ guildId });
            
            config.storageChannelId = channel.id;
            await config.save();
            
            return interaction.reply({ content: `Understood, Master. I will use ${channel} to store your learning materials safely.`, ephemeral: true });
        }

        if (sub === 'quick-add') {
            const channel = interaction.options.getChannel('channel');
            
            let config = await Config.findOne({ guildId });
            if (!config) config = new Config({ guildId });

            config.quickAddChannelId = channel.id;
            // Force reminders to this channel as requested
            config.reminderChannelId = channel.id;
            config.reminderMode = 'channel';
            
            await config.save();

            return interaction.reply({ content: `Understood. I will watch ${channel} for new items AND send all daily reminders there.`, ephemeral: true });
        }
    }
};