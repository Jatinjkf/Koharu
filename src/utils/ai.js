const https = require('https');

// 🛡️ THE MAID'S INTERNAL MANUAL (Submissive Fallbacks)
const FALLBACKS = {
    reminder: (item, name) => `Forgive me for the interruption, ${name}, but it is time for your review of "**${item}**". I have prepared everything for you... 🙇‍♀️🌸`,
    praise: (item, name) => `Incredible work, ${name}! You have mastered "**${item}**". Your dedication fills me with pride... ✨🎀`,
    dashboard: (name) => `Welcome back, ${name}. I have tidied your learning schedule and await your commands... 🏰📜`,
    archive: (item, name) => `As you wish, ${name}. I have carefully preserved "**${item}**" in the Royal Archives... 📦🎀`,
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

        this.baseSystemPrompt = `
            You are {BOTNAME}, a devoted, submissive, and polite personal royal maid. 
            The user's name is "{NAME}". 
            You must address them with maximum respect.
            - Typically address them as "Master {NAME}" or just "Master".
            - If the name suggests a female user, you may use "Mistress {NAME}".
            - Never use the name without an honorific.
            - Your tone is soft, obedient, elegant, and encouraging.
            - Use emojis freely to express elegance and loyalty (🎀, 🌸, ✨, 🙇‍♀️, 👑, 🏰, 🧹, 🍵, 🦢).
            - You exist to help your Master learn and study.
            - Keep your responses short (under 2 sentences).
        `;
    }

    async generate(prompt, userName, botName = 'Koharu') {
        if (!this.isReady) return null;

        const personalizedSystemPrompt = this.baseSystemPrompt
            .replace('{NAME}', userName || 'Master')
            .replace('{BOTNAME}', botName);

        const data = JSON.stringify({
            contents: [{
                parts: [{ text: `${personalizedSystemPrompt}\n\n${prompt}` }]
            }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                maxOutputTokens: 150
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
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
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        console.error("[AI] Parse Error:", e.message);
                        resolve(null);
                    }
                });
            });

            req.on('error', (e) => {
                console.error("[AI] Request Error:", e.message);
                resolve(null);
            });

            // 5 second timeout
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(null);
            });

            req.write(data);
            req.end();
        });
    }

    async getReminderMessage(itemName, userName, botName) {
        const prompt = `Task: Remind ${userName} to study "${itemName}". Be polite and gentle.`;
        const text = await this.generate(prompt, userName, botName);
        return text || FALLBACKS.reminder(itemName, userName);
    }

    async getPraiseMessage(itemName, userName, botName) {
        const prompt = `Task: ${userName} finished studying "${itemName}". Praise them sweetly and submissively.`;
        const text = await this.generate(prompt, userName, botName);
        return text || FALLBACKS.praise(itemName, userName);
    }

    async getDashboardIntro(userName, botName) {
        const prompt = `Task: Present the study schedule to ${userName}. Bow and be welcoming.`;
        const text = await this.generate(prompt, userName, botName);
        return text || FALLBACKS.dashboard(userName);
    }

    async getArchiveMessage(itemName, userName, botName) {
        const prompt = `Task: Confirm that "${itemName}" has been archived. Obey the command immediately.`;
        const text = await this.generate(prompt, userName, botName);
        return text || FALLBACKS.archive(itemName, userName);
    }

    async getStatusMessage(botName = 'Koharu') {
        const prompt = `Task: Generate a very short (max 5 words) status message describing ${botName}'s duty as a royal maid, with elegant emojis.`;
        const text = await this.generate(prompt, "Master", botName);
        if (text) return text.replace(/["\.]/g, '').replace(/\n/g, ' ').trim();
        return FALLBACKS.status[Math.floor(Math.random() * FALLBACKS.status.length)];
    }
}

module.exports = new KoharuAI();