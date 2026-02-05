const mongoose = require('mongoose');

const userConfigSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true }, // Filter by mansion
    preferredName: { type: String, default: 'Master' },
    lastDashboardMessageId: { type: String, default: null },
    lastDashboardChannelId: { type: String, default: null }
});

// One entry per User per Guild
userConfigSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('UserConfig', userConfigSchema);