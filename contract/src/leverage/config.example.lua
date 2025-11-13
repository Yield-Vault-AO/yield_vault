---@diagnostic disable: undefined-global
-- Example Leverage Factory Configuration
-- Copy this file and customize for your deployment

return {
    -- LiquidOps Protocol Settings
    maxLTV = 0.65,  -- 65% loan-to-value ratio (LiquidOps standard)
    
    -- Fee Configuration
    tradingFeePct = 0.3,  -- 0.3% trading fee on position close
    
    -- Allowed tokens for leverage (volatile assets)
    allowedTokens = {
        ["wBTC"] = "Sa0iBLPNyJQrwpTTG-tWLQU-1QeUAJA73DdxGGiKoJc",
        ["wETH"] = "0rDbXzcUQtVECgKUGMF_FLiJ_Hp0YJVMmxPJJwkZUdI",
        ["AO"] = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
        ["GAME"] = "s6jcB3ctSbiDNwR-paJgy5iOAhahXahLul8exSLHbGE"
    },
    
    -- Stable tokens (for leverage short positions)
    stableTokens = {
        ["USDC"] = "GcFxqTQnKHcr304qnOcq00ZqbaYGDn4Wbb0DHAM-wvU",
        ["USDT"] = "KAW6p3qpVLqz8GGJwCLPjqZcjVY8xXDWJN8Ks5Qs5Ys",
        ["DAI"] = "OT9qTE2467gcozb2g8R6D6N3nQS94ENcaAIJfUzHCww"
    },
    
    -- LiquidOps Integration (add to libs/constants.lua)
    liquidOpsConfig = {
        processId = "LIQUIDOPS_MAIN_PROCESS_ID",
        controllerAddress = "LIQUIDOPS_CONTROLLER_ADDRESS",
        
        -- Token to oToken mapping
        oTokenMap = {
            ["owBTC"] = "OWBTC_PROCESS_ID",
            ["owETH"] = "OWETH_PROCESS_ID",
            ["oUSDC"] = "OUSDC_PROCESS_ID",
            ["oUSDT"] = "OUSDT_PROCESS_ID",
            ["oDAI"] = "ODAI_PROCESS_ID",
            ["oAO"] = "OAO_PROCESS_ID",
            ["oGAME"] = "OGAME_PROCESS_ID"
        }
    },
    
    -- Child process module ID
    childModuleId = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s",
    
    -- Leverage limits by risk profile
    leverageLimits = {
        conservative = 1.5,  -- 1.5x max
        moderate = 2.0,      -- 2x max
        aggressive = 2.5,    -- 2.5x max
        maximum = 2.857      -- Theoretical max with 65% LTV
    },
    
    -- Recommended health factor thresholds
    healthFactorThresholds = {
        safe = 1.5,
        warning = 1.2,
        danger = 1.1,
        liquidation = 1.0
    }
}
