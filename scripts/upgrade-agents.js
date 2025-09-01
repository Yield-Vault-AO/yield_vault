#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createDataItemSigner, message, result as resresult } from '@permaweb/aoconnect';

const walletPath = process.env.WALLET_PATH || './wallet.json';
const wallet = JSON.parse(readFileSync(walletPath).toString());

async function upgradeAllAgents() {
  try {
    const managerProcessId = process.env.MANAGER_PROCESS_ID || process.env.PROCESS_ID || process.argv[2] || "CAT2qDMSaOFO1eXsYpKcitU2S-b31nW076_-q814RHM";
    if (!managerProcessId) {
      console.error('Error: Provide manager id via MANAGER_PROCESS_ID/PROCESS_ID env or argv[2]');
      process.exit(1);
    }

    console.log('Upgrading all agents for manager:', managerProcessId);

    const messageId = await message({
      process: managerProcessId,
      tags: [
        { name: 'Action', value: 'Upgrade-All-Agents' },
      ],
      signer: createDataItemSigner(wallet),
    });

    console.log('Message sent. ID:', messageId);
    console.log('Waiting for result...');

    const resp = await resresult({ message: messageId, process: managerProcessId });
    const last = resp?.Messages?.[0];
    if (!last) {
      console.log('No response message. Full result:', resp);
      return;
    }

    const action = last.Tags?.find(t => t.name === 'Action')?.value;
    const upgraded = last.Tags?.find(t => t.name === 'Upgraded-Count')?.value;
    const failed = last.Tags?.find(t => t.name === 'Failed-Count')?.value;

    console.log('Action:', action);
    if (typeof upgraded !== 'undefined') console.log('Upgraded-Count:', upgraded);
    if (typeof failed !== 'undefined') console.log('Failed-Count:', failed);
    if (last.Data) console.log('Data:', last.Data);

    if (action === 'Upgrade-All-Agents-Error') {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

upgradeAllAgents();


