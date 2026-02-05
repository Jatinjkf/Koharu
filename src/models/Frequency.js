const mongoose = require('mongoose');

const frequencySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true }, // "Every 2 Days"
    duration: { type: Number, required: true }, // Milliseconds
    isDefault: { type: Boolean, default: false }
});

module.exports = mongoose.model('Frequency', frequencySchema);