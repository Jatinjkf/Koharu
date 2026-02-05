module.exports = function parseDuration(durationStr) {
    const regex = /(\d+)([dhwm])/; // Matches 2d, 12h, 1w, 1m (month=30d approx)
    const match = durationStr.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const hour = 3600 * 1000;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;

    switch (unit) {
        case 'h': return value * hour;
        case 'd': return value * day;
        case 'w': return value * week;
        case 'm': return value * month;
        default: return null;
    }
};