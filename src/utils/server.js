const express = require('express');
const path = require('path');
const Config = require('../models/Config');
const Frequency = require('../models/Frequency');
const UserConfig = require('../models/UserConfig');
const Item = require('../models/Item');
const parseDuration = require('./timeParser');
const scheduler = require('./scheduler');

module.exports = (client) => {
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../../public')));

    // --- UPTIME MONITORING ---
    app.get('/', (req, res) => {
        res.send("🌸 Koharu is serving her Master. Protocols are active.");
    });

    const gatekeeper = (req, res, next) => {
        const provided = req.headers['x-admin-password'];
        const actual = process.env.ADMIN_PASSWORD || 'koharu';
        if (provided !== actual) return res.status(403).json({ error: "Denied" });
        next();
    };

    // --- API ROUTES ---

    app.get('/api/guilds', gatekeeper, (req, res) => {
        res.json(client.guilds.cache.map(g => ({ id: g.id, name: g.name })));
    });

    app.get('/api/channels/:guildId', gatekeeper, (req, res) => {
        const guild = client.channels.cache.get(req.params.guildId);
        if (!guild) return res.json([]);
        const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id: c.id, name: c.name }));
        res.json(channels);
    });

    app.get('/api/config/:guildId', gatekeeper, async (req, res) => {
        const config = await Config.findOne({ guildId: req.params.guildId });
        res.json(config || { guildId: req.params.guildId });
    });

    app.post('/api/config/:guildId', gatekeeper, async (req, res) => {
        const { storageChannelId, quickAddChannelId, reminderHour, botName } = req.body;
        let config = await Config.findOne({ guildId: req.params.guildId });
        if (!config) config = new Config({ guildId: req.params.guildId });
        config.storageChannelId = storageChannelId;
        config.quickAddChannelId = quickAddChannelId;
        if (botName) config.botName = botName;
        if (reminderHour !== undefined) config.reminderTime = `0 ${reminderHour} * * *`;
        await config.save();
        scheduler.reschedule(client);
        res.json({ success: true });
    });

    app.get('/api/frequencies/:guildId', gatekeeper, async (req, res) => {
        res.json(await Frequency.find({ guildId: req.params.guildId }));
    });

    app.post('/api/frequencies/:guildId', gatekeeper, async (req, res) => {
        const ms = parseDuration(req.body.duration);
        if (!ms) return res.status(400).json({ error: "Invalid format" });
        await Frequency.create({ guildId: req.params.guildId, name: req.body.name, duration: ms });
        res.json({ success: true });
    });

    app.post('/api/frequencies/defaults/:guildId', gatekeeper, async (req, res) => {
        const gid = req.params.guildId;
        const day = 24 * 3600000;
        const defaults = [{ name: "Daily", duration: day, isDefault: true }, { name: "Weekly", duration: 7 * day }];
        for (const def of defaults) {
            await Frequency.findOneAndUpdate({ guildId: gid, name: def.name }, { ...def, guildId: gid }, { upsert: true });
        }
        res.json({ success: true });
    });

    app.delete('/api/frequencies/:id', gatekeeper, async (req, res) => {
        const freq = await Frequency.findById(req.params.id);
        if (!freq) return res.json({ success: true });
        const inUse = await Item.findOne({ guildId: freq.guildId, frequencyName: freq.name });
        if (inUse) return res.status(400).json({ error: "Rhythm in use." });
        await Frequency.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    });

    app.get('/api/users/:guildId', gatekeeper, async (req, res) => {
        res.json(await UserConfig.find({ guildId: req.params.guildId }));
    });

    app.post('/api/users/:guildId', gatekeeper, async (req, res) => {
        const { userId, name } = req.body;
        await UserConfig.findOneAndUpdate({ userId, guildId: req.params.guildId }, { preferredName: name }, { upsert: true });
        res.json({ success: true });
    });

    app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../../public/admin.html')));
    app.listen(process.env.PORT || 3000, () => console.log("[WebUI] Ready."));
};
