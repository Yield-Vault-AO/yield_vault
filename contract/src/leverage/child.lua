---@diagnostic disable: undefined-global
-- Leverage Child Process
-- Individual leverage position for a user

local json = require('json')
local utils = require('utils.utils')
local liquidops = require('libs.liquidops')
local leverageUtils = require('leverage.libs.leverage_utils')
local leverageEnums = require('leverage.libs.leverage_enums')

-- Position Configuration (set on spawn)
PositionId = PositionId or ao.env.Process.Tags["Position-Id"]
FactoryId = FactoryId or ao.env.Process.Tags["Factory-Id"]
TokenId = TokenId or ao.env.Process.Tags["Token-Id"]
TargetLeverage = TargetLeverage or tonumber(ao.env.Process.Tags["Target-Leverage"]) or 1
PositionType = PositionType or ao.env.Process.Tags["Position-Type"]
MaxLTV = MaxLTV or tonumber(ao.env.Process.Tags["Max-LTV"]) or 0.65
TradingFeePct = TradingFeePct or tonumber(ao.env.Process.Tags["Trading-Fee-Pct"]) or 0.3
Owner = Owner or ao.env.Process.Tags["Owner"] or ao.authorities[1]

-- Position State
PositionState = PositionState or leverageEnums.PositionState.IDLE
InitialDeposit = InitialDeposit or "0"
TotalCollateral = TotalCollateral or "0"
TotalDebt = TotalDebt or "0"
CurrentLoop = CurrentLoop or 0
PlannedLoops = PlannedLoops or nil  -- { loops, borrowAmounts, ... }
CreatedAt = CreatedAt or os.time()

-- Helper: Check if sender is owner
local function isOwner(address)
    return address == Owner
end

-- Helper: Notify factory of status change
local function notifyFactory(status)
    if FactoryId then
        ao.send({
            Target = FactoryId,
            Action = "Position-Status-Update",
            ["Position-Id"] = PositionId,
            ["Status"] = status
        })
    end
end

-- Helper: Get token balance
local function getBalance(tokenId)
    local result = ao.send({
        Target = tokenId,
        Action = "Balance",
        Recipient = ao.id
    }).receive()
    
    return result and result.Balance or "0"
end

-- Execute single leverage loop
local function executeLeverageLoop(loopIndex)
    if not PlannedLoops or loopIndex > PlannedLoops.loops then
        return false, "Invalid loop index"
    end
    
    local borrowAmount = PlannedLoops.borrowAmounts[loopIndex]
    
    print("Executing loop " .. tostring(loopIndex) .. "/" .. tostring(PlannedLoops.loops))
    print("Borrow amount: " .. borrowAmount)
    
    -- Borrow from LiquidOps
    local borrowResult = liquidops.borrow({
        token = TokenId,
        quantity = borrowAmount,
        noResult = false
    })
    
    if not borrowResult or not borrowResult.status then
        return false, "Borrow failed"
    end
    
    -- Update debt
    TotalDebt = utils.add(TotalDebt, borrowAmount)
    
    -- Supply borrowed amount as collateral
    liquidops.lend({
        tokenId = TokenId,
        quantity = borrowAmount
    })
    
    -- Update collateral
    TotalCollateral = utils.add(TotalCollateral, borrowAmount)
    CurrentLoop = loopIndex
    
    return true
end

-- Info Handler
Handlers.add("Info", "Info",
    function(msg)
        local currentLeverage = leverageUtils.calculateCurrentLeverage(TotalCollateral, InitialDeposit)
        local healthFactor = leverageUtils.calculateHealthFactor(TotalCollateral, TotalDebt, MaxLTV)
        
        msg.reply({
            Action = "Info-Response",
            ["Position-Id"] = PositionId,
            ["Token-Id"] = TokenId,
            ["Position-Type"] = PositionType,
            ["Position-State"] = PositionState,
            ["Target-Leverage"] = tostring(TargetLeverage),
            ["Current-Leverage"] = tostring(currentLeverage),
            ["Initial-Deposit"] = InitialDeposit,
            ["Total-Collateral"] = TotalCollateral,
            ["Total-Debt"] = TotalDebt,
            ["Health-Factor"] = tostring(healthFactor),
            ["Current-Loop"] = tostring(CurrentLoop),
            ["Planned-Loops"] = PlannedLoops and tostring(PlannedLoops.loops) or "0",
            Owner = Owner,
            ["Created-At"] = tostring(CreatedAt)
        })
    end
)

-- Get Position Details
Handlers.add("Get-Position", "Get-Position",
    function(msg)
        local currentLeverage = leverageUtils.calculateCurrentLeverage(TotalCollateral, InitialDeposit)
        local healthFactor = leverageUtils.calculateHealthFactor(TotalCollateral, TotalDebt, MaxLTV)
        
        msg.reply({
            Action = "Position-Response",
            Data = json.encode({
                positionId = PositionId,
                tokenId = TokenId,
                positionType = PositionType,
                state = PositionState,
                targetLeverage = TargetLeverage,
                currentLeverage = currentLeverage,
                initialDeposit = InitialDeposit,
                totalCollateral = TotalCollateral,
                totalDebt = TotalDebt,
                healthFactor = healthFactor,
                currentLoop = CurrentLoop,
                plannedLoops = PlannedLoops and PlannedLoops.loops or 0,
                owner = Owner,
                createdAt = CreatedAt
            })
        })
    end
)

-- Credit Notice Handler - Receives tokens and executes leverage
Handlers.add("Credit-Notice", "Credit-Notice",
    function(msg)
        local tokenId = msg.From or msg.Tags["From-Process"]
        local quantity = msg.Tags.Quantity
        
        -- Validate token
        if tokenId ~= TokenId then
            -- Unexpected token - return to sender
            ao.send({
                Target = tokenId,
                Action = "Transfer",
                Recipient = msg.Tags.Sender or Owner,
                Quantity = quantity,
                ["X-Reason"] = "Unexpected token type"
            })
            
            ao.send({
                Target = Owner,
                Action = "Unexpected-Token-Returned",
                ["Token-Id"] = tokenId,
                Quantity = quantity
            })
            return
        end
        
        -- If position is IDLE, this is initial deposit
        if PositionState == leverageEnums.PositionState.IDLE then
            InitialDeposit = quantity
            PositionState = leverageEnums.PositionState.DEPOSITING
            
            -- Calculate leverage loops
            local success, result = pcall(function()
                return leverageUtils.calculateLeverageLoops(quantity, TargetLeverage, MaxLTV)
            end)
            
            if not success then
                PositionState = leverageEnums.PositionState.ERROR
                notifyFactory("error")
                
                -- Return funds
                ao.send({
                    Target = TokenId,
                    Action = "Transfer",
                    Recipient = Owner,
                    Quantity = quantity,
                    ["X-Reason"] = "Leverage calculation failed: " .. tostring(result)
                })
                return
            end
            
            PlannedLoops = result
            
            print("Initial deposit received: " .. quantity)
            print("Planned loops: " .. tostring(PlannedLoops.loops))
            
            -- Supply initial collateral
            liquidops.lend({
                tokenId = TokenId,
                quantity = quantity
            })
            
            TotalCollateral = quantity
            PositionState = leverageEnums.PositionState.LEVERAGING
            notifyFactory("leveraging")
            
            -- Execute first loop if needed
            if PlannedLoops.loops > 0 then
                local ok, err = executeLeverageLoop(1)
                if not ok then
                    PositionState = leverageEnums.PositionState.ERROR
                    notifyFactory("error")
                    
                    ao.send({
                        Target = Owner,
                        Action = "Leverage-Error",
                        ["Position-Id"] = PositionId,
                        Error = tostring(err)
                    })
                end
            else
                -- No loops needed (1x leverage)
                PositionState = leverageEnums.PositionState.ACTIVE
                notifyFactory("active")
            end
            
            return
        end
        
        -- If leveraging and received borrowed tokens, continue loops
        if PositionState == leverageEnums.PositionState.LEVERAGING then
            if CurrentLoop < PlannedLoops.loops then
                local nextLoop = CurrentLoop + 1
                local ok, err = executeLeverageLoop(nextLoop)
                
                if not ok then
                    PositionState = leverageEnums.PositionState.ERROR
                    notifyFactory("error")
                    
                    ao.send({
                        Target = Owner,
                        Action = "Leverage-Error",
                        ["Position-Id"] = PositionId,
                        ["Loop"] = tostring(nextLoop),
                        Error = tostring(err)
                    })
                else
                    -- Check if all loops completed
                    if CurrentLoop >= PlannedLoops.loops then
                        PositionState = leverageEnums.PositionState.ACTIVE
                        notifyFactory("active")
                        
                        local currentLeverage = leverageUtils.calculateCurrentLeverage(TotalCollateral, InitialDeposit)
                        
                        ao.send({
                            Target = Owner,
                            Action = "Leverage-Position-Active",
                            ["Position-Id"] = PositionId,
                            ["Initial-Deposit"] = InitialDeposit,
                            ["Total-Collateral"] = TotalCollateral,
                            ["Total-Debt"] = TotalDebt,
                            ["Current-Leverage"] = tostring(currentLeverage),
                            ["Loops-Executed"] = tostring(CurrentLoop)
                        })
                    end
                end
            end
            return
        end
        
        -- If position is active or closing, this might be from redemption
        -- Let debit/credit handlers manage this
    end
)

-- Close Position Handler
Handlers.add("Close-Position", "Close-Position",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Close-Position-Error",
                Error = "Unauthorized: Only owner can close position"
            })
            return
        end
        
        if PositionState ~= leverageEnums.PositionState.ACTIVE then
            msg.reply({
                Action = "Close-Position-Error",
                Error = "Position is not active",
                ["Current-State"] = PositionState
            })
            return
        end
        
        PositionState = leverageEnums.PositionState.CLOSING
        notifyFactory("closing")
        
        --TODO: 
        -- Step 1: Redeem all collateral from LiquidOps
        -- We need the oToken ID for this token
        -- For now, we'll use the liquidops.unLend which requires oTokenId
        -- This should be configured or derived
        
        -- Simplified: Get current balance and redeem
        -- In production, track oToken balance properly
        
        msg.reply({
            Action = "Close-Position-Started",
            ["Position-Id"] = PositionId,
            Data = "Closing position - redeeming collateral"
        })
        
        -- Note: Full implementation would:
        -- 1. Call liquidops.unLend to redeem all oTokens
        -- 2. Receive underlying tokens
        -- 3. Call liquidops.repay to repay all debt
        -- 4. Calculate fees
        -- 5. Transfer remaining to owner
        
        -- For this implementation, we'll outline the flow
        ao.send({
            Target = Owner,
            Action = "Close-Position-Notice",
            ["Position-Id"] = PositionId,
            Data = "Position closing initiated. Manual intervention may be required for full redemption."
        })
    end
)

-- Emergency Withdraw (Owner Only)
Handlers.add("Emergency-Withdraw", "Emergency-Withdraw",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Emergency-Withdraw-Error",
                Error = "Unauthorized: Only owner can emergency withdraw"
            })
            return
        end
        
        local tokenId = msg.Tags["Token-Id"]
        local quantity = msg.Tags["Quantity"] or "all"
        
        if not tokenId or not utils.isAddress(tokenId) then
            msg.reply({
                Action = "Emergency-Withdraw-Error",
                Error = "Invalid Token-Id"
            })
            return
        end
        
        local balance = getBalance(tokenId)
        local transferQty = quantity == "all" and balance or quantity
        
        if utils.isZero(transferQty) then
            msg.reply({
                Action = "Emergency-Withdraw-Error",
                Error = "No balance to withdraw"
            })
            return
        end
        
        ao.send({
            Target = tokenId,
            Action = "Transfer",
            Recipient = Owner,
            Quantity = transferQty,
            ["X-Reason"] = "Emergency withdrawal"
        })
        
        msg.reply({
            Action = "Emergency-Withdraw-Success",
            ["Token-Id"] = tokenId,
            Quantity = transferQty
        })
    end
)

-- Force Close (Owner Only) - Simplified close without full unwinding
Handlers.add("Force-Close", "Force-Close",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Force-Close-Error",
                Error = "Unauthorized: Only owner can force close"
            })
            return
        end
        
        PositionState = leverageEnums.PositionState.CLOSED
        notifyFactory("closed")
        
        msg.reply({
            Action = "Force-Close-Success",
            ["Position-Id"] = PositionId,
            Data = "Position force closed. Manual cleanup may be required."
        })
    end
)

print("Leverage Child Process initialized")
print("Position ID: " .. tostring(PositionId))
print("Token ID: " .. tostring(TokenId))
print("Target Leverage: " .. tostring(TargetLeverage))
print("Position Type: " .. tostring(PositionType))
print("Owner: " .. tostring(Owner))
