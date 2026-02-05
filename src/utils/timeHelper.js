/**
 * Handles IST Timezone math correctly for Koharu
 */
function getISTDate() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
}

function getMidnightIST(baseDate = null) {
    const date = baseDate ? new Date(baseDate) : getISTDate();
    date.setHours(0, 0, 0, 0);
    return date;
}

// Convert MS to Days (rounded)
function msToDays(ms) {
    return Math.round(ms / (24 * 60 * 60 * 1000));
}

module.exports = { getISTDate, getMidnightIST, msToDays };