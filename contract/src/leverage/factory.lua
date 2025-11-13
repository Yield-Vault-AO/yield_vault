---@diagnostic disable: undefined-global
-- Leverage Factory Process
-- Manages configuration and spawns child leverage processes

local json = require('json')
local utils = require('utils.utils')
local leverageUtils = require('leverage.libs.leverage_utils')

-- Factory Configuration
Owner = Owner or ao.authorities[1] or ao.id
ModuleId = ModuleId or "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s"  -- Child process module

-- LiquidOps Configuration
MAX_LTV = MAX_LTV or 0.65  -- 65% LTV for LiquidOps
MAX_LEVERAGE_MULTIPLIER = MAX_LEVERAGE_MULTIPLIER or leverageUtils.calculateMaxLeverage(MAX_LTV)

-- Token Configuration
ALLOWED_LEVERAGE_TOKENS = ALLOWED_LEVERAGE_TOKENS or {}
STABLE_TOKENS = STABLE_TOKENS or {}

-- Fee Configuration
TRADING_FEE_PCT = TRADING_FEE_PCT or 0.3  -- 0.3% trading fee

-- Position Tracking
UserPositions = UserPositions or {}  -- Map of user address to array of position IDs
AllPositions = AllPositions or {}    -- Map of position ID to position record
PositionCounter = PositionCounter or 0

-- Child Process Eval Data
ChildEvalData = ChildEvalData or ""

-- Helper: Check if sender is owner
local function isOwner(address)
    return address == Owner
end

-- Helper: Generate position ID
local function generatePositionId()
    PositionCounter = PositionCounter + 1
    return "LEV_" .. tostring(os.time()) .. "_" .. tostring(PositionCounter)
end

-- Helper: Validate token is allowed
local function isTokenAllowed(tokenId)
    for _, allowedId in pairs(ALLOWED_LEVERAGE_TOKENS) do
        if tokenId == allowedId then
            return true
        end
    end
    return false
end

-- Helper: Check if token is stable
local function isStableToken(tokenId)
    for _, stableId in pairs(STABLE_TOKENS) do
        if tokenId == stableId then
            return true
        end
    end
    return false
end

-- Set Factory Configuration (Owner Only)
Handlers.add("Set-Config", "Set-Config",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Set-Config-Error",
                Error = "Unauthorized: Only owner can set configuration"
            })
            return
        end
        
        -- Update MAX_LTV
        if msg.Tags["Max-LTV"] then
            local newLTV = tonumber(msg.Tags["Max-LTV"])
            if newLTV and newLTV > 0 and newLTV < 1 then
                MAX_LTV = newLTV
                MAX_LEVERAGE_MULTIPLIER = leverageUtils.calculateMaxLeverage(MAX_LTV)
            end
        end
        
        -- Update Trading Fee
        if msg.Tags["Trading-Fee-Pct"] then
            local newFee = tonumber(msg.Tags["Trading-Fee-Pct"])
            if newFee and newFee >= 0 and newFee <= 100 then
                TRADING_FEE_PCT = newFee
            end
        end
        
        -- Update Allowed Tokens (expects JSON array)
        if msg.Data and msg.Data ~= "" then
            local success, config = pcall(json.decode, msg.Data)
            if success then
                if config.allowedTokens then
                    ALLOWED_LEVERAGE_TOKENS = config.allowedTokens
                end
                if config.stableTokens then
                    STABLE_TOKENS = config.stableTokens
                end
            end
        end
        
        msg.reply({
            Action = "Set-Config-Success",
            ["Max-LTV"] = tostring(MAX_LTV),
            ["Max-Leverage"] = tostring(MAX_LEVERAGE_MULTIPLIER),
            ["Trading-Fee-Pct"] = tostring(TRADING_FEE_PCT)
        })
    end
)

-- Get Factory Configuration
Handlers.add("Get-Config", "Get-Config",
    function(msg)
        msg.reply({
            Action = "Config-Response",
            Data = json.encode({
                maxLTV = MAX_LTV,
                maxLeverageMultiplier = MAX_LEVERAGE_MULTIPLIER,
                tradingFeePct = TRADING_FEE_PCT,
                allowedTokens = ALLOWED_LEVERAGE_TOKENS,
                stableTokens = STABLE_TOKENS,
                owner = Owner
            })
        })
    end
)

-- Deploy Leverage Position
Handlers.add("Deploy-Leverage", "Deploy-Leverage",
    function(msg)
        local userAddress = msg.From
        local tokenId = msg.Tags["Token-Id"]
        local targetLeverage = tonumber(msg.Tags["Target-Leverage"])
        
        -- Validate inputs
        if not tokenId or tokenId == "" then
            msg.reply({
                Action = "Deploy-Leverage-Error",
                Error = "Token-Id is required"
            })
            return
        end
        
        if not utils.isAddress(tokenId) then
            msg.reply({
                Action = "Deploy-Leverage-Error",
                Error = "Invalid Token-Id format"
            })
            return
        end
        
        if not isTokenAllowed(tokenId) then
            msg.reply({
                Action = "Deploy-Leverage-Error",
                Error = "Token not allowed for leverage"
            })
            return
        end
        
        if not targetLeverage or targetLeverage <= 0 then
            msg.reply({
                Action = "Deploy-Leverage-Error",
                Error = "Invalid Target-Leverage"
            })
            return
        end
        
        -- Validate leverage is within bounds
        local isValid, err = leverageUtils.validateLeverageParams(targetLeverage, MAX_LTV)
        if not isValid then
            msg.reply({
                Action = "Deploy-Leverage-Error",
                Error = err
            })
            return
        end
        
        -- Determine position type
        local positionType = leverageUtils.determinePositionType(tokenId, STABLE_TOKENS)
        
        -- Generate position ID
        local positionId = generatePositionId()
        
        -- Create position record
        local positionRecord = {
            positionId = positionId,
            owner = userAddress,
            tokenId = tokenId,
            targetLeverage = targetLeverage,
            positionType = positionType,
            processId = nil,  -- Will be set when spawned
            status = "spawning",
            createdAt = os.time()
        }
        
        -- Store position
        AllPositions[positionId] = positionRecord
        
        if not UserPositions[userAddress] then
            UserPositions[userAddress] = {}
        end
        table.insert(UserPositions[userAddress], positionId)
        
        -- Spawn child process
        ao.spawn(ModuleId, {
            Tags = {
                ['App-Name'] = 'Leverage Position',
                ['Authority'] = userAddress,
                ['Position-Id'] = positionId,
                ['Factory-Id'] = ao.id,
                ['Token-Id'] = tokenId,
                ['Target-Leverage'] = tostring(targetLeverage),
                ['Position-Type'] = positionType,
                ['Max-LTV'] = tostring(MAX_LTV),
                ['Trading-Fee-Pct'] = tostring(TRADING_FEE_PCT),
                ['Owner'] = userAddress
            }
        })
        
        msg.reply({
            Action = "Deploy-Leverage-Pending",
            ["Position-Id"] = positionId,
            Data = "Leverage position spawn requested"
        })
    end
)

-- Handle Spawned notification
Handlers.add("Spawned", "Spawned",
    function(msg)
        local spawnedId = msg.Tags['Process']
        local positionId = msg.Tags['Position-Id']
        
        if positionId and AllPositions[positionId] then
            local position = AllPositions[positionId]
            position.processId = spawnedId
            position.status = "active"
            
            -- Send eval data to child if available
            if ChildEvalData and ChildEvalData ~= "" then
                ao.send({
                    Target = spawnedId,
                    Action = "Eval",
                    Data = ChildEvalData
                })
            end
            
            -- Notify owner
            ao.send({
                Target = position.owner,
                Action = "Leverage-Position-Ready",
                ["Position-Id"] = positionId,
                ["Process-Id"] = spawnedId,
                ["Token-Id"] = position.tokenId,
                ["Target-Leverage"] = tostring(position.targetLeverage),
                ["Position-Type"] = position.positionType
            })
            
            print("Leverage position spawned: " .. positionId .. " -> " .. spawnedId)
        end
    end
)

-- Get User Positions
Handlers.add("Get-User-Positions", "Get-User-Positions",
    function(msg)
        local userAddress = msg.Tags["User-Address"] or msg.From
        local positions = UserPositions[userAddress] or {}
        local positionDetails = {}
        
        for _, positionId in ipairs(positions) do
            local record = AllPositions[positionId]
            if record then
                table.insert(positionDetails, record)
            end
        end
        
        msg.reply({
            Action = "User-Positions-Response",
            Data = json.encode(positionDetails),
            ["User-Address"] = userAddress,
            ["Position-Count"] = tostring(#positionDetails)
        })
    end
)

-- Get All Positions (Owner Only)
Handlers.add("Get-All-Positions", "Get-All-Positions",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Get-All-Positions-Error",
                Error = "Unauthorized: Only owner can view all positions"
            })
            return
        end
        
        local allPositionsList = {}
        for _, record in pairs(AllPositions) do
            table.insert(allPositionsList, record)
        end
        
        msg.reply({
            Action = "All-Positions-Response",
            Data = json.encode(allPositionsList),
            ["Total-Positions"] = tostring(#allPositionsList)
        })
    end
)

-- Set Child Eval Data (Owner Only)
Handlers.add("Set-Child-Eval-Data", "Set-Child-Eval-Data",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Set-Child-Eval-Data-Error",
                Error = "Unauthorized: Only owner can set eval data"
            })
            return
        end
        
        ChildEvalData = msg.Data or ""
        
        msg.reply({
            Action = "Set-Child-Eval-Data-Success",
            ["Data-Length"] = tostring(string.len(ChildEvalData))
        })
    end
)

-- Position Status Update (from child processes)
Handlers.add("Position-Status-Update", "Position-Status-Update",
    function(msg)
        local positionId = msg.Tags["Position-Id"]
        local newStatus = msg.Tags["Status"]
        
        if positionId and AllPositions[positionId] then
            local position = AllPositions[positionId]
            
            -- Verify sender is the position process
            if msg.From == position.processId then
                position.status = newStatus
                position.updatedAt = os.time()
                
                -- Forward status to owner
                ao.send({
                    Target = position.owner,
                    Action = "Position-Status-Update",
                    ["Position-Id"] = positionId,
                    ["Status"] = newStatus
                })
            end
        end
    end
)

-- Factory Info
Handlers.add("Factory-Info", "Factory-Info",
    function(msg)
        local totalPositions = 0
        for _ in pairs(AllPositions) do
            totalPositions = totalPositions + 1
        end
        
        local totalUsers = 0
        for _ in pairs(UserPositions) do
            totalUsers = totalUsers + 1
        end
        
        msg.reply({
            Action = "Factory-Info-Response",
            ["Max-LTV"] = tostring(MAX_LTV),
            ["Max-Leverage"] = tostring(MAX_LEVERAGE_MULTIPLIER),
            ["Trading-Fee-Pct"] = tostring(TRADING_FEE_PCT),
            ["Total-Positions"] = tostring(totalPositions),
            ["Total-Users"] = tostring(totalUsers),
            ["Allowed-Tokens-Count"] = tostring(#ALLOWED_LEVERAGE_TOKENS),
            ["Stable-Tokens-Count"] = tostring(#STABLE_TOKENS),
            Owner = Owner
        })
    end
)

print("Leverage Factory initialized")
print("Max LTV: " .. tostring(MAX_LTV))
print("Max Leverage: " .. tostring(MAX_LEVERAGE_MULTIPLIER))
print("Trading Fee: " .. tostring(TRADING_FEE_PCT) .. "%")
print("Owner: " .. Owner)
