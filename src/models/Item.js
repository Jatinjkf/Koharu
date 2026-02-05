const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    imageUrl: { type: String, required: true }, 
    storageMessageId: { type: String },
    storageChannelId: { type: String },
    
    frequencyName: { type: String, required: true },
    frequencyDuration: { type: Number, required: true },
    nextReminder: { type: Date, required: true },
    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    
    // DUAL SEQUENCE SYSTEM
    activeSeq: { type: Number, default: null }, // # in Dashboard
    archiveSeq: { type: Number, default: null }, // # in Archive
    
    lastReminderMessageId: { type: String, default: null }, // NEW: Track specific messages
    awaitingReview: { type: Boolean, default: false }
});

itemSchema.index({ userId: 1, guildId: 1, isArchived: 1, activeSeq: 1 });
itemSchema.index({ userId: 1, guildId: 1, isArchived: 1, archiveSeq: 1 });

module.exports = mongoose.model('Item', itemSchema);