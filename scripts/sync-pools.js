#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createDataItemSigner, message, result as resresult } from '@permaweb/aoconnect';

const walletPath = process.env.WALLET_PATH || "./wallet.json";
const wallet = JSON.parse(
    readFileSync(walletPath).toString(),
);

// Helper functions to determine token types (from Dashboard.tsx)
const isStableToken = (ticker, name) => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return (
        tokenStr.includes("usd") ||
        tokenStr.includes("dai") ||
        tokenStr.includes("usdt") ||
        tokenStr.includes("usdc")
    );
};

const isAOToken = (ticker, name) => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return tokenStr.includes("ao") || tokenStr.includes("war");
};

const isGameToken = (ticker, name) => {
    if (!ticker && !name) return false;
    const tokenStr = `${ticker || ""} ${name || ""}`.toLowerCase();
    return tokenStr.includes("game") || Boolean(name?.includes("Game"));
};

// Calculate risk level based on token types (from Dashboard.tsx)
const calculateRisk = (pool) => {
    const token0Stable = isStableToken(pool.token0_ticker, pool.token0_name);
    const token1Stable = isStableToken(pool.token1_ticker, pool.token1_name);
    const token0AO = isAOToken(pool.token0_ticker, pool.token0_name);
    const token1AO = isAOToken(pool.token1_ticker, pool.token1_name);
    const token0Game = isGameToken(pool.token0_ticker, pool.token0_name);
    const token1Game = isGameToken(pool.token1_ticker, pool.token1_name);

    if (
        (token0Stable && token1AO) ||
        (token1Stable && token0AO) ||
        token0Game ||
        token1Game ||
        (token0Stable && token1Stable)
    ) {
        return "Very Low";
    }

    if ((token0Stable || token1Stable) && (token0AO || token1AO)) {
        return "Low";
    }

    if (token0Stable || token1Stable) {
        return "Medium";
    }

    // Default high risk
    return "High";
};

// Calculate APY from pool data (from Dashboard.tsx)
const deriveApyPct = (pool) => {
    const vol = Number(pool?.volume_usd) || 0;
    const liq = Number(pool?.liquidity_usd) || 0;
    const feeBps = Number(pool?.pool_fee_bps) || 0;
    if (!liq || !feeBps) return 0;
    const feeRate = feeBps / 10000; // e.g., 25 bps => 0.0025
    const daily = (vol / liq) * feeRate; // daily yield estimate
    const annual = daily * 365;
    return Math.max(0, annual) * 100; // percent
};

// Format USD values
const fmtUSD = (v) => {
    const num = Number(v) || 0;
    return num >= 1_000_000
        ? `$${(num / 1_000_000).toFixed(2)}M`
        : num >= 1_000
            ? `$${(num / 1_000).toFixed(2)}K`
            : `$${num.toFixed(2)}`;
};

// Transform pool data to manager format
const transformPoolData = (rawPool) => {
    const apy = deriveApyPct(rawPool);
    const riskLevel = calculateRisk(rawPool);

    // Only include pools with positive APY and from Botega
    if (apy <= 0 || !rawPool.amm_name?.toLowerCase().includes('botega')) {
        return null;
    }

    return {
        id: rawPool.amm_process, // Pool ID is the AMM process
        name: rawPool.amm_name || `${rawPool.token0_ticker || rawPool.token0_name}/${rawPool.token1_ticker || rawPool.token1_name}`,
        dex: "BOTEGA", // Only BOTEGA is supported according to validation
        token_a: rawPool.token0, // Token A address
        token_b: rawPool.token1, // Token B address
        apy: `${apy.toFixed(2)}%`, // APY as percentage string
        risk_level: riskLevel, // Risk level based on token analysis
        tvl: fmtUSD(rawPool.liquidity_usd), // Total Value Locked
        description: `${rawPool.amm_name} liquidity pool with ${rawPool.pool_fee_bps / 100}% fee. Volume: ${fmtUSD(rawPool.volume_usd)}`,
        verified: true, // Mark as verified by default
        // Additional metadata
        volume_usd: rawPool.volume_usd,
        pool_fee_bps: rawPool.pool_fee_bps,
        transactions: rawPool.transactions,
        token0_ticker: rawPool.token0_ticker,
        token1_ticker: rawPool.token1_ticker,
        token0_name: rawPool.token0_name,
        token1_name: rawPool.token1_name,
        token0_price: rawPool.token0_current_price,
        token1_price: rawPool.token1_current_price
    };
};

async function syncPools() {
    try {
        // Get manager process ID from environment or command line args
        const managerProcessId = process.env.MANAGER_PROCESS_ID || process.env.PROCESS_ID || process.argv[2] || "CAT2qDMSaOFO1eXsYpKcitU2S-b31nW076_-q814RHM";

        const backendUrl = process.env.BACKEND_URL || process.env.API_BASE || 'https://yield-pools.apps.ikem.dev';
        console.log(`Fetching pools from ${backendUrl}/pools...`);

        // Fetch pools from API
        const response = await fetch(`${backendUrl}/pools`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rawPools = await response.json();
        console.log(`Fetched ${rawPools.length} pools from API`);

        // Transform pools to manager format
        const transformedPools = rawPools
            .map(transformPoolData)
            .filter(pool => pool !== null); // Remove null entries

        console.log(`Transformed ${transformedPools.length} valid pools for manager`);

        if (transformedPools.length === 0) {
            console.log('No valid pools to sync. Exiting.');
            return;
        }

        // Display sample of transformed data
        console.log('\nSample transformed pool:');
        console.log(JSON.stringify(transformedPools[0], null, 2));

        console.log(`\nSending pools to manager: ${managerProcessId}`);

        // Send Set-Available-Pools message to the manager
        const messageId = await message({
            process: managerProcessId,
            tags: [
                { name: 'Action', value: 'Set-Available-Pools' }
            ],
            data: JSON.stringify(transformedPools),
            signer: createDataItemSigner(wallet),
        });

        console.log('\nPools sync request sent successfully!');
        console.log('Message ID:', messageId);

        // Wait for the result
        console.log('\nWaiting for sync response...');
        const result = await resresult({
            message: messageId,
            process: managerProcessId
        });

        console.log('\nSync Response:');
        const responseMessage = result.Messages?.[0];
        if (responseMessage) {
            console.log('Action:', responseMessage.Tags?.find(t => t.name === 'Action')?.value);
            console.log('Pool Count:', responseMessage.Tags?.find(t => t.name === 'Pool-Count')?.value);
            console.log('Data:', responseMessage.Data);

            const action = responseMessage.Tags?.find(t => t.name === 'Action')?.value;
            if (action === 'Set-Pools-Success') {
                console.log('\n✅ Pools synchronized successfully!');
            } else if (action === 'Set-Pools-Error') {
                console.log('\n❌ Error synchronizing pools:');
                console.log('Error:', responseMessage.Tags?.find(t => t.name === 'Error')?.value);
                const details = responseMessage.Tags?.find(t => t.name === 'Details')?.value;
                if (details) {
                    console.log('Details:', JSON.parse(details));
                }
            }
        } else {
            console.log('No response message received');
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Add some helpful information
console.log('Pool Sync Script');
console.log('================');
console.log('This script fetches pool data from BACKEND_URL (default http://localhost:3000)/pools and syncs it with the AO manager process.');
console.log('It transforms the data to match the manager\'s expected format and filters for valid Botega pools.\n');

syncPools();