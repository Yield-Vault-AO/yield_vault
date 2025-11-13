---@diagnostic disable: undefined-global
local bint = require ".bint"(1024)

local mod = {}

-- Calculate maximum possible leverage given LTV
function mod.calculateMaxLeverage(maxLTV)
    if maxLTV <= 0 or maxLTV >= 1 then
        error("Invalid LTV: must be between 0 and 1")
    end
    return 1 / (1 - maxLTV)
end

-- Calculate leverage loops needed to achieve target leverage
-- Returns: { loops = n, borrowAmounts = {amount1, amount2, ...} }
function mod.calculateLeverageLoops(initialAmount, targetLeverage, maxLTV)
    if targetLeverage <= 1 then
        return { loops = 0, borrowAmounts = {} }
    end
    
    local maxPossibleLeverage = mod.calculateMaxLeverage(maxLTV)
    if targetLeverage > maxPossibleLeverage then
        error(string.format(
            "Target leverage %.2fx exceeds maximum possible %.2fx with LTV %.2f%%",
            targetLeverage, maxPossibleLeverage, maxLTV * 100
        ))
    end
    
    -- Find minimal n loops needed
    local n = 0
    local maxLevAfterN = 1
    while maxLevAfterN < targetLeverage do
        n = n + 1
        -- Formula: (1 - LTV^(n+1)) / (1 - LTV)
        local ltvPower = maxLTV ^ (n + 1)  -- Use ^ operator instead of math.pow
        maxLevAfterN = (1 - ltvPower) / (1 - maxLTV)
    end
    
    -- Simulate actual borrow amounts
    local currentCollateral = bint(initialAmount)
    local currentDebt = bint(0)
    local borrowAmounts = {}
    
    for i = 1, n do
        local borrow
        if i < n then
            -- Max borrow for intermediate loops
            local maxBorrow = bint.__sub(
                bint.udiv(
                    bint.__mul(currentCollateral, bint(math.floor(maxLTV * 1000000))),
                    bint(1000000)
                ),
                currentDebt
            )
            borrow = maxBorrow
        else
            -- Last borrow: exact amount to reach target
            local targetCollateral = bint.udiv(
                bint.__mul(bint(initialAmount), bint(math.floor(targetLeverage * 1000000))),
                bint(1000000)
            )
            local requiredDebt = bint.__sub(targetCollateral, bint(initialAmount))
            borrow = bint.__sub(requiredDebt, currentDebt)
        end
        
        table.insert(borrowAmounts, tostring(borrow))
        currentCollateral = bint.__add(currentCollateral, borrow)
        currentDebt = bint.__add(currentDebt, borrow)
    end
    
    return { 
        loops = n, 
        borrowAmounts = borrowAmounts,
        finalCollateral = tostring(currentCollateral),
        finalDebt = tostring(currentDebt)
    }
end

-- Calculate current leverage ratio
function mod.calculateCurrentLeverage(totalCollateral, initialDeposit)
    local collateral = bint(totalCollateral)
    local initial = bint(initialDeposit)
    
    if bint.__eq(initial, bint(0)) then
        return 1
    end
    
    -- Leverage = totalCollateral / initialDeposit
    local leverage = bint.udiv(
        bint.__mul(collateral, bint(1000000)),
        initial
    )
    
    return tonumber(tostring(leverage)) / 1000000
end

-- Calculate health factor
-- Health Factor = (Collateral * LTV) / Debt
-- If < 1, position can be liquidated
function mod.calculateHealthFactor(collateral, debt, maxLTV)
    local col = bint(collateral)
    local dbt = bint(debt)
    
    if bint.__eq(dbt, bint(0)) then
        return math.huge
    end
    
    local maxBorrow = bint.udiv(
        bint.__mul(col, bint(math.floor(maxLTV * 1000000))),
        bint(1000000)
    )
    
    local healthFactor = bint.udiv(
        bint.__mul(maxBorrow, bint(1000000)),
        dbt
    )
    
    return tonumber(tostring(healthFactor)) / 1000000
end

-- Calculate trading fee
function mod.calculateFee(amount, feePercentage)
    local amt = bint(amount)
    local fee = bint.udiv(
        bint.__mul(amt, bint(math.floor(feePercentage * 1000000))),
        bint(100000000)
    )
    return tostring(fee)
end

-- Validate leverage parameters
function mod.validateLeverageParams(targetLeverage, maxLTV)
    if type(targetLeverage) ~= "number" or targetLeverage <= 0 then
        return false, "Invalid target leverage"
    end
    
    if targetLeverage < 1 then
        return false, "Target leverage must be >= 1"
    end
    
    local maxPossible = mod.calculateMaxLeverage(maxLTV)
    if targetLeverage > maxPossible then
        return false, string.format(
            "Target leverage %.2fx exceeds max %.2fx",
            targetLeverage, maxPossible
        )
    end
    
    return true
end

-- Determine position type based on token
function mod.determinePositionType(tokenId, stableTokens)
    for _, stableId in pairs(stableTokens) do
        if tokenId == stableId then
            return "LEVERAGE_SHORT"  -- Stable = short volatile
        end
    end
    return "LEVERAGE_LONG"  -- Volatile = long volatile
end

-- Calculate profit/loss
function mod.calculatePnL(initialDeposit, finalAmount, fees)
    local initial = bint(initialDeposit)
    local final = bint(finalAmount)
    local fee = bint(fees)
    
    local afterFees = bint.__sub(final, fee)
    local pnl = bint.__sub(afterFees, initial)
    
    return {
        pnl = tostring(pnl),
        pnlPercentage = tonumber(tostring(
            bint.udiv(
                bint.__mul(pnl, bint(100000000)),
                initial
            )
        )) / 1000000,
        afterFees = tostring(afterFees)
    }
end

return mod
