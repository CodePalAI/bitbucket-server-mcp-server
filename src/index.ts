#!/usr/bin/env node

import {BitbucketServer} from './server.js';

// Create and start server with proper error handling
async function main() {
    try {
        const server = new BitbucketServer();
        await server.run();
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
main().catch((error) => {
    console.error('Unexpected error during startup:', error);
    process.exit(1);
});