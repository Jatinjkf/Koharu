const mongoose = require('mongoose');
// Use a try-require to avoid crashing if module is missing, though it should be installed now
let MongoMemoryServer;
try {
    const mms = require('mongodb-memory-server');
    MongoMemoryServer = mms.MongoMemoryServer;
} catch (e) {
    console.error("[Database] Error: 'mongodb-memory-server' is not installed.");
}

async function connectDB() {
    console.log("[Database] Initializing connection sequence...");

    try {
        let uri = process.env.MONGO_URI;

        if (process.env.USE_LOCAL_DB === 'true') {
            if (!MongoMemoryServer) {
                throw new Error("Local DB requested but package is missing.");
            }
            console.log("[Database] Starting Local In-Memory Server... (This may take time on first run)");
            const mongod = await MongoMemoryServer.create();
            uri = mongod.getUri();
            console.log(`[Database] Local DB Server Ready at: ${uri}`);
        }

        if (!uri) {
             throw new Error("No MONGO_URI found and USE_LOCAL_DB is false.");
        }

        console.log("[Database] Connecting to Mongoose...");
        
        // Wait for connection with explicit options
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Fail fast if can't find server
        });

        console.log("[Database] Koharu has successfully connected to her memory.");
    } catch (err) {
        console.error("------------------------------------------------");
        console.error("[Database] CRITICAL CONNECTION ERROR");
        console.error(err);
        console.error("------------------------------------------------");
        process.exit(1); // Force quit if DB fails
    }
}

module.exports = connectDB;