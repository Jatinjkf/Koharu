const https = require('https');

const FALLBACKS = {
    reminder: (item, name) => `Forgive me for the interruption, ${name}, but it is time for your review of "**${item}**". I have prepared everything for you... 🙇‍♀️🌸`,
    praise: (item, name) => `Incredible work, ${name}! You have mastered "**${item}**". Your dedication fills me with pride... ✨🎀`,
    dashboard: (name) => `Welcome back, ${name}. I have tidied your learning schedule and await your commands... 🏰📜`,
    archive: (item, name) => `As you wish, ${name}. I have carefully preserved "**${item}**" in the Royal Archives... 📦🎀`,
    rename: (oldName, newName, name, loc) => `📝 Renamed "**${oldName}**" to "**${newName}**" ${loc}.`,
    move: (item, freq, name) => `As you wish. I have moved "**${item}**" to the **${freq}** schedule.`,
    revive: (item, name) => `✅ Restored "**${item}**" to Dashboard.`,
    status: [
        "Dusting the Royal Archives 🧹",
        "Preparing Master's tea 🍵",
        "Polishing study materials ✨",
        "Awaiting Master's orders 🙇‍♀️",
        "Organizing the library 📚",
        "Watching over Master 🌸",
        "Tidying the Mansion 🏰",
        "Reviewing study logs 📜",
        "Serving with devotion 🎀",
        "Arranging fresh flowers 🦢"
    ]
};

class KoharuAI {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = "gemma-3-12b-it";
        this.isReady = !!this.apiKey;
        this.queue = Promise.resolve(); // Simple queue to avoid overlapping requests

        this.baseSystemPrompt = `
            You are {BOTNAME}, a devoted, submissive, and polite personal royal maid. 
            The user's name is "{NAME}". 
            You must address them with maximum respect.
            - Typically address them as "Master {NAME}" or just "Master".
            - If the name suggests a female user, you may use "Mistress {NAME}".
            - Never use the name without an honorific.
            - Your tone is soft, obedient, elegant, and encouraging.
            - Use emojis freely to express elegance and loyalty.
            - Keep your responses short (under 2 sentences).
        `;
    }

    async generate(prompt, userName, botName = 'Koharu', retryCount = 0) {
        if (!this.isReady) return null;

        // Add to queue to prevent concurrent requests (fixes many hang-ups)
        return this.queue = this.queue.then(async () => {
            const result = await this._makeRequest(prompt, userName, botName);
            
            // If it failed with a hangup and we haven't retried yet, try once more
            if (result === null && retryCount < 1) {
                console.log(`[AI] Socket hung up. Performing emergency retry...`);
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s
                return this._makeRequest(prompt, userName, botName);
            }
            return result;
        });
    }

    async _makeRequest(prompt, userName, botName) {
        const personalizedSystemPrompt = this.baseSystemPrompt
            .replace('{NAME}', userName || 'Master')
            .replace('{BOTNAME}', botName);

        const data = JSON.stringify({
            contents: [{ parts: [{ text: `${personalizedSystemPrompt}\n\n${prompt}` }] }],
            generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 150 }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Connection': 'keep-alive' // Keep the line stable
            }
        };

        return new Promise((resolve) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (d) => { responseData += d; });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.error(`[AI] Error ${res.statusCode}:`, responseData);
                        return resolve(null);
                    }
                    try {
                        const json = JSON.parse(responseData);
                        if (json.candidates && json.candidates[0].content) {
                            resolve(json.candidates[0].content.parts[0].text.trim());
                        } else { resolve(null); }
                    } catch (e) { resolve(null); }
                });
            });

            req.on('error', (e) => {
                console.error("[AI] Socket/Request Error:", e.message);
                resolve(null);
            });

            req.setTimeout(8000, () => { req.destroy(); resolve(null); }); // Increased to 8s
            req.write(data);
            req.end();
        });
    }

    async getReminderMessage(itemName, userName, botName) {
        const text = await this.generate(`Task: Remind ${userName} to study "${itemName}".`, userName, botName);
        return text || FALLBACKS.reminder(itemName, userName);
    }

    async getPraiseMessage(itemName, userName, botName) {
        const text = await this.generate(`Task: ${userName} finished studying "${itemName}". Praise them sweetly.`, userName, botName);
        return text || FALLBACKS.praise(itemName, userName);
    }

    async getDashboardIntro(userName, botName) {
        const text = await this.generate(`Task: Present the study schedule to ${userName}. Bow and be welcoming.`, userName, botName);
        return text || FALLBACKS.dashboard(userName);
    }

    async getArchiveMessage(itemName, userName, botName) {
        const text = await this.generate(`Task: Confirm that "${itemName}" has been archived.`, userName, botName);
        return text || FALLBACKS.archive(itemName, userName);
    }

    async getRenameMessage(oldName, newName, loc, userName, botName) {
        const text = await this.generate(`Task: Confirm that "${oldName}" has been renamed to "${newName}" (${loc}).`, userName, botName);
        return text || FALLBACKS.rename(oldName, newName, userName, loc);
    }

    async getMoveMessage(itemName, freqName, userName, botName) {
        const text = await this.generate(`Task: Confirm that "${itemName}" is now on the "${freqName}" schedule.`, userName, botName);
        return text || FALLBACKS.move(itemName, freqName, userName);
    }

    async getReviveMessage(itemName, userName, botName) {
        const text = await this.generate(`Task: Confirm that "${itemName}" has been restored from the archive.`, userName, botName);
        return text || FALLBACKS.revive(itemName, userName);
    }

    async getStatusMessage(botName = 'Koharu') {
        const text = await this.generate(`Task: Generate a 5-word status for ${botName}'s duty with an emoji.`, "Master", botName);
        if (text) return text.replace(/["\.]/g, '').replace(/\n/g, ' ').trim();
        return FALLBACKS.status[Math.floor(Math.random() * FALLBACKS.status.length)];
    }
}

module.exports = new KoharuAI();
