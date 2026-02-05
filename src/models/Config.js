const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    botName: { type: String, default: 'Koharu' },
    storageChannelId: { type: String, default: null }, 
    quickAddChannelId: { type: String, default: null }, 
    reminderMode: { type: String, enum: ['dm', 'channel', 'both'], default: 'dm' },
    reminderTime: { type: String, default: '0 0 * * *' },
    adminPassword: { type: String, default: 'koharu' }, // NEW: Web Security
    adminRole: { type: String, default: null }
});

module.exports = mongoose.model('Config', configSchema);