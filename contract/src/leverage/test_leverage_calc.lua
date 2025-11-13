-- Test Leverage Calculations
-- Run this to verify leverage loop calculations

package.path = package.path .. ";../?.lua"

local leverageUtils = require('leverage.libs.leverage_utils')

print("=== Leverage Calculation Tests ===\n")

-- Test 1: Calculate max leverage
print("Test 1: Maximum Leverage Calculation")
print("--------------------------------------")
local maxLTV = 0.65
local maxLev = leverageUtils.calculateMaxLeverage(maxLTV)
print(string.format("LTV: %.2f%% -> Max Leverage: %.3fx", maxLTV * 100, maxLev))
print()

-- Test 2: 2x leverage loops
print("Test 2: 2x Leverage Loops (65% LTV)")
print("--------------------------------------")
local initialAmount = "100000000"  -- 1 token (8 decimals)
local targetLeverage = 2.0

local result = leverageUtils.calculateLeverageLoops(initialAmount, targetLeverage, maxLTV)
print(string.format("Initial Amount: %s", initialAmount))
print(string.format("Target Leverage: %.2fx", targetLeverage))
print(string.format("Loops Required: %d", result.loops))
print("\nLoop Details:")
for i, amount in ipairs(result.borrowAmounts) do
    print(string.format("  Loop %d: Borrow %s", i, amount))
end
print(string.format("\nFinal Collateral: %s", result.finalCollateral))
print(string.format("Final Debt: %s", result.finalDebt))

local finalLev = leverageUtils.calculateCurrentLeverage(result.finalCollateral, initialAmount)
print(string.format("Actual Leverage: %.3fx", finalLev))
print()

-- Test 3: Maximum leverage loops
print("Test 3: Maximum Leverage (2.85x)")
print("--------------------------------------")
local maxTargetLev = 2.85

local maxResult = leverageUtils.calculateLeverageLoops(initialAmount, maxTargetLev, maxLTV)
print(string.format("Initial Amount: %s", initialAmount))
print(string.format("Target Leverage: %.2fx", maxTargetLev))
print(string.format("Loops Required: %d", maxResult.loops))
print(string.format("Final Collateral: %s", maxResult.finalCollateral))
print(string.format("Final Debt: %s", maxResult.finalDebt))

local maxFinalLev = leverageUtils.calculateCurrentLeverage(maxResult.finalCollateral, initialAmount)
print(string.format("Actual Leverage: %.3fx", maxFinalLev))
print()

-- Test 4: Health factor calculation
print("Test 4: Health Factor Calculation")
print("--------------------------------------")
local healthFactor = leverageUtils.calculateHealthFactor(
    result.finalCollateral,
    result.finalDebt,
    maxLTV
)
print(string.format("Collateral: %s", result.finalCollateral))
print(string.format("Debt: %s", result.finalDebt))
print(string.format("LTV: %.2f%%", maxLTV * 100))
print(string.format("Health Factor: %.3f", healthFactor))

if healthFactor > 1.5 then
    print("Status: SAFE ✓")
elseif healthFactor > 1.2 then
    print("Status: MODERATE ⚠")
elseif healthFactor > 1.0 then
    print("Status: RISKY ⚠⚠")
else
    print("Status: LIQUIDATION RISK ✗")
end
print()

-- Test 5: Fee calculation
print("Test 5: Trading Fee Calculation")
print("--------------------------------------")
local feePercentage = 0.3  -- 0.3%
local positionValue = "200000000"  -- 2 tokens
local fee = leverageUtils.calculateFee(positionValue, feePercentage)
print(string.format("Position Value: %s", positionValue))
print(string.format("Fee Percentage: %.2f%%", feePercentage))
print(string.format("Fee Amount: %s", fee))
print()

-- Test 6: PnL calculation
print("Test 6: Profit/Loss Calculation")
print("--------------------------------------")
local initialDeposit = "100000000"
local finalAmount = "150000000"  -- 50% gain
local fees = leverageUtils.calculateFee(finalAmount, feePercentage)

local pnl = leverageUtils.calculatePnL(initialDeposit, finalAmount, fees)
print(string.format("Initial Deposit: %s", initialDeposit))
print(string.format("Final Amount: %s", finalAmount))
print(string.format("Fees: %s", fees))
print(string.format("After Fees: %s", pnl.afterFees))
print(string.format("PnL: %s (%.2f%%)", pnl.pnl, pnl.pnlPercentage))
print()

-- Test 7: Conservative leverage (1.5x)
print("Test 7: Conservative Leverage (1.5x)")
print("--------------------------------------")
local conservativeLev = 1.5
local conservativeResult = leverageUtils.calculateLeverageLoops(initialAmount, conservativeLev, maxLTV)
print(string.format("Target Leverage: %.2fx", conservativeLev))
print(string.format("Loops Required: %d", conservativeResult.loops))
print(string.format("Final Collateral: %s", conservativeResult.finalCollateral))
print(string.format("Final Debt: %s", conservativeResult.finalDebt))

local conservativeHealth = leverageUtils.calculateHealthFactor(
    conservativeResult.finalCollateral,
    conservativeResult.finalDebt,
    maxLTV
)
print(string.format("Health Factor: %.3f (SAFER)", conservativeHealth))
print()

-- Test 8: Validate leverage parameters
print("Test 8: Parameter Validation")
print("--------------------------------------")

local testCases = {
    {leverage = 2.0, shouldPass = true},
    {leverage = 3.0, shouldPass = false},  -- Exceeds max
    {leverage = 0.5, shouldPass = false},  -- Below 1
    {leverage = 2.85, shouldPass = true},
}

for i, test in ipairs(testCases) do
    local valid, err = leverageUtils.validateLeverageParams(test.leverage, maxLTV)
    local status = valid and "✓ PASS" or "✗ FAIL"
    local expected = test.shouldPass and "✓ PASS" or "✗ FAIL"
    local match = (valid == test.shouldPass) and "✓" or "✗"
    
    print(string.format("  %.2fx leverage: %s (expected %s) %s", 
        test.leverage, status, expected, match))
    if not valid then
        print(string.format("    Error: %s", err))
    end
end
print()

-- Test 9: Position type determination
print("Test 9: Position Type Determination")
print("--------------------------------------")
local stableTokens = {
    ["USDC"] = "usdc_id",
    ["USDT"] = "usdt_id"
}

local volatileToken = "wbtc_id"
local stableToken = "usdc_id"

local volatileType = leverageUtils.determinePositionType(volatileToken, stableTokens)
local stableType = leverageUtils.determinePositionType(stableToken, stableTokens)

print(string.format("Volatile Token: %s", volatileType))
print(string.format("Stable Token: %s", stableType))
print()

print("=== All Tests Complete ===")
