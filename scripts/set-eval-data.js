#!/usr/bin/env node

import { readFileSync } from 'fs';
import { connect, createDataItemSigner, message } from '@permaweb/aoconnect';

const ao = connect();
const walletPath = process.env.WALLET_PATH || "./wallet.json";
const wallet = JSON.parse(
    readFileSync(walletPath).toString(),
  );
  
async function setEvalData() {
    try {
        // Read the main-process.lua file
        const luaPath = process.env.LUA_PATH || './contract/build/main-process.lua';
        const luaContent = readFileSync(luaPath, 'utf8');
        
        // Get process ID from environment or command line args
        const processId = process.env.PROCESS_ID || process.env.MANAGER_PROCESS_ID || process.argv[2] || "CAT2qDMSaOFO1eXsYpKcitU2S-b31nW076_-q814RHM";

        if (!processId) {
            console.error('Error: Please provide a process ID via PROCESS_ID environment variable or as a command line argument');
            process.exit(1);
        }

        console.log('Setting eval data for process:', processId);
        console.log('Content length:', luaContent.length, 'characters');

        // Send Set-Eval-Data message to the process
        const messageId = await message({
            process: processId,
            tags: [
                { name: 'Action', value: 'Set-Eval-Data' }
            ],
            data: luaContent,
            signer: createDataItemSigner(wallet),
        });

        console.log('Message sent successfully!');
        console.log('Message ID:', messageId);

        // Wait for the result
        const result = await ao.result({
            message: messageId,
            process: processId
        });

        console.log('Result:', result);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

setEvalData();