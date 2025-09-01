ModuleId = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s"

local utils = require('utils.utils')
local enums = require('libs.enums')
local constants = require('libs.constants')
local json = require('json')
local RandomModule = require('libs.random')
local Random = RandomModule(json)
local ApusAI = require('@apus/ai')

EvalData = EvalData or [[]]

-- Agent tracking state
AgentsProcess = AgentsProcess or {}           -- Map of agent process IDs to agent records
UserAgentsMap = UserAgentsMap or {}          -- Map of user addresses to agent arrays
PoolAgentsMap = PoolAgentsMap or {}          -- Map of pool IDs to agent arrays

-- AI Integration state
ApusCredits = ApusCredits or 0
ApusRouter = ApusRouter or "Bf6JJR2tl2Wr38O2-H6VctqtduxHgKF-NzRB9HhTRzo"
LastInferenceTime = LastInferenceTime or 0
InferenceSessions = InferenceSessions or {}

-- Random recommendation state
RandomCredits = RandomCredits or 0              -- Number of prepaid RNG requests available
RandomSessions = RandomSessions or {}           -- Map of callbackId to session record

AvailablePools = AvailablePools or {}

-- Owner management
Owner = Owner or ao.authorities[1] or ao.id

-- Helper function to check if sender is owner
local function isOwner(address)
    return address == Owner
end

local function validateAgentInputs(Dex, TokenOut, Slippage, StartDate, EndDate, RunIndefinitely, ConversionPercentage, StrategyType, BaseToken, PoolIdOverride)
    local errors = {}

    -- Validate Dex
    if not utils.isValidDex(Dex) then
        table.insert(errors, "Invalid Dex: " .. tostring(Dex))
    end

    -- Validate TokenOut
    if not utils.isAddress(TokenOut) then
        table.insert(errors, "Invalid Token-Out: " .. tostring(TokenOut))
    end

    -- Validate Slippage
    if not utils.isValidSlippage(Slippage) then
        table.insert(errors, "Invalid Slippage: " .. tostring(Slippage) .. " (must be integer between 0.5 and 10)")
    end

    -- Validate StartDate
    if not utils.isValidNumber(StartDate) or StartDate < 0 then
        table.insert(errors, "Invalid Start-Date: " .. tostring(StartDate))
    end

    -- Validate EndDate
    if not utils.isValidNumber(EndDate) or EndDate < 0 then
        table.insert(errors, "Invalid End-Date: " .. tostring(EndDate))
    end

    -- Validate StartDate < EndDate
    if utils.isValidNumber(StartDate) and utils.isValidNumber(EndDate) and StartDate >= EndDate then
        table.insert(errors, "Start-Date must be less than End-Date")
    end

    -- Validate RunIndefinitely
    if RunIndefinitely ~= true and RunIndefinitely ~= false then
        table.insert(errors, "Invalid Run-Indefinitely: " .. tostring(RunIndefinitely) .. " (must be true or false)")
    end

    -- Validate ConversionPercentage
    if not utils.isPercentage(ConversionPercentage) then
        table.insert(errors, "Invalid Conversion-Percentage: " .. tostring(ConversionPercentage) .. " (must be integer between 0 and 100)")
    end

    -- Validate StrategyType
    if not utils.isValidStrategy(StrategyType) then
        table.insert(errors, "Invalid Strategy-Type: " .. tostring(StrategyType))
    end

    -- Validate BaseToken
    if not utils.isAddress(BaseToken) then
        table.insert(errors, "Invalid Base-Token: " .. tostring(BaseToken))
    end

    -- Validate PoolIdOverride (optional)
    if PoolIdOverride and PoolIdOverride ~= "" and not utils.isAddress(PoolIdOverride) then
        table.insert(errors, "Invalid Pool-Id: " .. tostring(PoolIdOverride))
    end

    if #errors > 0 then
        return false, errors
    end

    return true
end

Handlers.add(
    'Spawned',
    Handlers.utils.hasMatchingTag('Action', 'Spawned'),
    function (msg)
      local spawnedId = msg.Tags['Process']
      local createProcessId = msg.Tags['X-Create-Process-Id']
      
      print("Agent spawned: " .. spawnedId)

      -- Update agent tracking if this was from our spawn request
      if createProcessId and InferenceSessions[createProcessId] then
          local session = InferenceSessions[createProcessId]
          if session.pending_agent then
              local agentRecord = session.pending_agent
              agentRecord.process_id = spawnedId
              agentRecord.status = "active"
              agentRecord.created_at = os.time()
              
              -- Store in tracking maps
              AgentsProcess[spawnedId] = agentRecord
              
              -- Add to user's agent list
              if not UserAgentsMap[agentRecord.owner] then
                  UserAgentsMap[agentRecord.owner] = {}
              end
              table.insert(UserAgentsMap[agentRecord.owner], spawnedId)
              
              -- Add to pool's agent list
              if agentRecord.pool_id then
                  if not PoolAgentsMap[agentRecord.pool_id] then
                      PoolAgentsMap[agentRecord.pool_id] = {}
                  end
                  table.insert(PoolAgentsMap[agentRecord.pool_id], spawnedId)
              end
              
              -- Clear pending agent from session
              session.pending_agent = nil
              session.spawned_agent_id = spawnedId
              
              print("Agent tracking updated for: " .. spawnedId)
          end
      end

      -- Send Eval to load code in process
        ao.send({Target = spawnedId, Action = "Eval", Data = EvalData, Tags = {
            ['X-Create-Process-Id'] = createProcessId
        }})
    end
)

-- Helper functions
local function generateSessionId()
    return tostring(os.time()) .. "_" .. tostring(math.random(1000, 9999))
end

-- Pool validation functions
local function validatePoolData(pool)
    local errors = {}
    
    -- Required fields validation
    if not pool.id or pool.id == "" then
        table.insert(errors, "Pool ID is required")
    end
    if not pool.name or pool.name == "" then
        table.insert(errors, "Pool name is required")
    end
    if not pool.dex or pool.dex == "" then
        table.insert(errors, "Pool DEX is required")
    end
    if not pool.token_a or pool.token_a == "" then
        table.insert(errors, "Token A address is required")
    end
    if not pool.token_b or pool.token_b == "" then
        table.insert(errors, "Token B address is required")
    end
    if not pool.apy or pool.apy == "" then
        table.insert(errors, "Pool APY is required")
    end
    if not pool.risk_level or pool.risk_level == "" then
        table.insert(errors, "Pool risk level is required")
    end
    if not pool.tvl or pool.tvl == "" then
        table.insert(errors, "Pool TVL is required")
    end
    if not pool.description or pool.description == "" then
        table.insert(errors, "Pool description is required")
    end
    
    -- Validate risk level values
    local validRiskLevels = {"Very Low", "Low", "Medium", "High", "Very High"}
    local isValidRisk = false
    for _, validLevel in ipairs(validRiskLevels) do
        if pool.risk_level == validLevel then
            isValidRisk = true
            break
        end
    end
    if not isValidRisk then
        table.insert(errors, "Invalid risk level. Must be one of: Very Low, Low, Medium, High, Very High")
    end
    
    -- Validate DEX (currently only BOTEGA supported)
    if pool.dex ~= "BOTEGA" then
        table.insert(errors, "Only BOTEGA DEX is currently supported")
    end
    
    -- Validate token addresses (basic format check)
    if pool.token_a and not utils.isAddress(pool.token_a) then
        table.insert(errors, "Invalid token A address format")
    end
    if pool.token_b and not utils.isAddress(pool.token_b) then
        table.insert(errors, "Invalid token B address format")
    end
    
    return #errors == 0, errors
end

local function getPoolById(poolId)
    for _, pool in ipairs(AvailablePools) do
        if pool.id == poolId then
            return pool
        end
    end
    return nil
end

local function getVerifiedPools()
    local verifiedPools = {}
    for _, pool in ipairs(AvailablePools) do
        if pool.verified == true then
            table.insert(verifiedPools, pool)
        end
    end
    return verifiedPools
end

local function getPoolsByRiskLevel(riskLevel)
    local filteredPools = {}
    for _, pool in ipairs(AvailablePools) do
        if pool.risk_level == riskLevel then
            table.insert(filteredPools, pool)
        end
    end
    return filteredPools
end

local function formatPoolsForAI()
    local poolsText = ""
    -- Only include verified pools for AI recommendations
    local verifiedPools = getVerifiedPools()
    
    for i, pool in ipairs(verifiedPools) do
        poolsText = poolsText .. string.format(
            "%d. %s (%s)\n   - DEX: %s\n   - APY: %s\n   - Risk: %s\n   - TVL: %s\n   - Verified: %s\n   - Description: %s\n\n",
            i, pool.name, pool.id, pool.dex, pool.apy, pool.risk_level, pool.tvl, 
            pool.verified and "Yes" or "No", pool.description
        )
    end
    return poolsText
end

local function createAIPrompt(riskData)
    local poolsData = formatPoolsForAI()
    local preferredTokensStr = table.concat(riskData.preferredTokens or {}, ", ")
    
    return string.format([[
You are a DeFi yield farming advisor. Based on the user's risk assessment, recommend exactly 3 pools from the provided list.

User Profile:
- Risk Tolerance: %s
- Investment Amount: %s
- Time Horizon: %s
- Experience Level: %s
- Preferred Tokens: %s

Available Pools:
%s

Return ONLY a JSON response with this exact structure:
{
  "recommendations": [
    {
      "pool_id": "string",
      "dex": "string", 
      "token_pair": "string",
      "apy": "string",
      "risk_level": "string",
      "reasoning": "string",
      "match_score": 85
    }
  ]
}

Select exactly 3 pools that best match the user's profile. Prioritize pools with risk levels that align with their tolerance and include their preferred tokens when possible.
]], 
    riskData.riskTolerance or "Medium",
    riskData.investmentAmount or "Unknown", 
    riskData.timeHorizon or "Medium-term",
    riskData.experienceLevel or "Intermediate",
    preferredTokensStr,
    poolsData)
end

local function getFallbackRecommendations(riskData)
    local recommendations = {}
    local riskTolerance = riskData.riskTolerance or "Medium"
    local preferredTokens = riskData.preferredTokens or {}
    
    -- Filter pools based on risk tolerance
    local suitablePools = {}
    for _, pool in ipairs(AvailablePools) do
        local poolRisk = pool.risk_level
        local isRiskMatch = false
        
        if riskTolerance == "Very Low" and (poolRisk == "Very Low" or poolRisk == "Low") then
            isRiskMatch = true
        elseif riskTolerance == "Low" and (poolRisk == "Very Low" or poolRisk == "Low" or poolRisk == "Medium") then
            isRiskMatch = true
        elseif riskTolerance == "Medium" then
            isRiskMatch = true
        elseif riskTolerance == "High" then
            isRiskMatch = true
        end
        
        if isRiskMatch then
            table.insert(suitablePools, pool)
        end
    end
    
    -- Select top 3 pools
    for i = 1, math.min(3, #suitablePools) do
        local pool = suitablePools[i]
        table.insert(recommendations, {
            pool_id = pool.id,
            dex = pool.dex,
            token_pair = pool.name,
            apy = pool.apy,
            risk_level = pool.risk_level,
            reasoning = "Fallback recommendation based on risk tolerance match",
            match_score = 75
        })
    end
    
    return {recommendations = recommendations}
end

local function parseAIResponse(responseData)
    local success, parsed = pcall(json.decode, responseData)
    if not success then
        print("Failed to parse AI response JSON: " .. tostring(responseData))
        return nil
    end
    
    -- Validate response structure
    if not parsed.recommendations or type(parsed.recommendations) ~= "table" then
        print("Invalid AI response structure: missing recommendations array")
        return nil
    end
    
    -- Validate each recommendation
    for i, rec in ipairs(parsed.recommendations) do
        if not rec.pool_id or not rec.dex or not rec.token_pair or 
           not rec.apy or not rec.risk_level or not rec.reasoning then
            print("Invalid recommendation structure at index " .. i)
            return nil
        end
    end
    
    return parsed
end

-- AI Recommendations Handler
Handlers.add("Get-AI-Recommendations", "Get-AI-Recommendations",
    function(msg)
        local sessionId = generateSessionId()
        local userAddress = msg.From
        
        -- Check if pools are available
        if not AvailablePools or #AvailablePools == 0 then
            msg.reply({
                Action = "AI-Recommendations-Error",
                Error = "No pools available. Please contact administrator to configure pools.",
                ["Session-Id"] = sessionId
            })
            return
        end
        
        -- Parse risk assessment data
        local riskData = {}
        if msg.Data and msg.Data ~= "" then
            local success, parsed = pcall(json.decode, msg.Data)
            if success then
                riskData = parsed
            else
                msg.reply({
                    Action = "AI-Recommendations-Error",
                    Error = "Invalid risk assessment data format",
                    ["Session-Id"] = sessionId
                })
                return
            end
        else
            -- Extract from tags if no data provided
            riskData = {
                riskTolerance = msg.Tags["Risk-Tolerance"],
                investmentAmount = msg.Tags["Investment-Amount"],
                timeHorizon = msg.Tags["Time-Horizon"],
                experienceLevel = msg.Tags["Experience-Level"],
                preferredTokens = msg.Tags["Preferred-Tokens"] and 
                    json.decode(msg.Tags["Preferred-Tokens"]) or {}
            }
        end
        
        -- Create inference session
        InferenceSessions[sessionId] = {
            session_id = sessionId,
            user_address = userAddress,
            risk_data = riskData,
            timestamp = os.time(),
            status = "pending"
        }
        
        -- Check if we have sufficient credits (placeholder check)
        if ApusCredits < 1 then
            print("Insufficient APUS credits, using fallback recommendations")
            local fallbackRecs = getFallbackRecommendations(riskData)
            InferenceSessions[sessionId].status = "completed"
            InferenceSessions[sessionId].response = fallbackRecs
            
            msg.reply({
                Action = "AI-Recommendations-Response",
                Data = json.encode(fallbackRecs),
                ["Session-Id"] = sessionId,
                ["Fallback-Used"] = "true"
            })
            return
        end
        
        -- Create AI prompt
        local prompt = createAIPrompt(riskData)
        
        -- Make AI inference request
        ApusAI.infer(prompt, {
            session = sessionId
        }, function(response)
            local session = InferenceSessions[sessionId]
            if not session then
                print("Session not found: " .. sessionId)
                return
            end
            
            if response and response.data then
                local parsed = parseAIResponse(response.data)
                if parsed then
                    session.status = "completed"
                    session.response = parsed
                    session.credits_used = 1
                    ApusCredits = ApusCredits - 1
                    
                    ao.send({
                        Target = userAddress,
                        Action = "AI-Recommendations-Response",
                        Data = json.encode(parsed),
                        ["Session-Id"] = sessionId
                    })
                else
                    -- AI response was malformed, use fallback
                    print("AI response malformed, using fallback for session: " .. sessionId)
                    local fallbackRecs = getFallbackRecommendations(riskData)
                    session.status = "completed"
                    session.response = fallbackRecs
                    
                    ao.send({
                        Target = userAddress,
                        Action = "AI-Recommendations-Response", 
                        Data = json.encode(fallbackRecs),
                        ["Session-Id"] = sessionId,
                        ["Fallback-Used"] = "true"
                    })
                end
            else
                -- AI inference failed, use fallback
                print("AI inference failed, using fallback for session: " .. sessionId)
                local fallbackRecs = getFallbackRecommendations(riskData)
                session.status = "failed"
                session.response = fallbackRecs
                
                ao.send({
                    Target = userAddress,
                    Action = "AI-Recommendations-Response",
                    Data = json.encode(fallbackRecs),
                    ["Session-Id"] = sessionId,
                    ["Fallback-Used"] = "true"
                })
            end
        end)
        
        -- Send immediate acknowledgment
        msg.reply({
            Action = "AI-Recommendations-Pending",
            ["Session-Id"] = sessionId,
            Data = "AI inference request submitted, response will be sent separately"
        })
    end
)

-- Credit notice handler for APUS token purchases
Handlers.add("Credit-Notice", "Credit-Notice",
    function(msg)
        local tokenId = msg.From or msg.Tags["From-Process"]
        local quantity = tonumber(msg.Tags.Quantity) or 0
        
        -- Check if this is APUS token for credit purchase
        if tokenId == "mqBYxpDsolZmJyBdTK8TJp_ftOuIUXVYcSQ8MYZdJg0" and quantity > 0 then
            -- Purchase APUS credits
            ao.send({
                Target = "mqBYxpDsolZmJyBdTK8TJp_ftOuIUXVYcSQ8MYZdJg0",
                Recipient = ApusRouter,
                Action = "Transfer",
                Quantity = tostring(quantity),
                ["X-Reason"] = "Buy-Credits"
            })
            
            -- Update credit balance (simplified - actual credits will be updated by APUS system)
            ApusCredits = ApusCredits + (quantity / 1000000000000) -- Convert from Armstrongs
            
            print("APUS credits purchased: " .. tostring(quantity))
        -- RNG credits purchase via RandAO
        elseif tokenId == Random.PaymentToken and quantity > 0 then
            -- Forward received RNG tokens to the RandomProcess as prepayment credits
            ao.send({
                Target = Random.PaymentToken,
                Recipient = Random.RandomProcess,
                Action = "Transfer",
                Quantity = tostring(quantity),
                ["X-Prepayment"] = "true"
            })

            -- Update local RNG credit balance (units)
            local randomCost = tonumber(Random.RandomCost) or 1
            if randomCost > 0 then
                RandomCredits = RandomCredits + (quantity / randomCost)
            end

            print("RNG credits purchased: quantity=" .. tostring(quantity) .. ", units=" .. tostring(quantity / (tonumber(Random.RandomCost) or 1)))
        end
    end
)
-- Spawn Agent Handler
Handlers.add("Spawn-Agent", "Spawn-Agent",
    function(msg)
        local userAddress = msg.From
        
        -- Extract agent configuration from message
        local dex = msg.Tags["Dex"]
        local tokenOut = msg.Tags["Token-Out"]
        local slippage = tonumber(msg.Tags["Slippage"])
        local startDate = tonumber(msg.Tags["Start-Date"])
        local endDate = tonumber(msg.Tags["End-Date"])
        local runIndefinitely = msg.Tags["Run-Indefinitely"] == "true"
        local conversionPercentage = tonumber(msg.Tags["Conversion-Percentage"])
        local strategyType = msg.Tags["Strategy-Type"] or "SWAP_50_LP_50"
        local baseToken = msg.Tags["Base-Token"]
        local poolIdOverride = msg.Tags["Pool-Id"]
        local poolId = msg.Tags["Pool-Id-Reference"] -- For tracking purposes
        
        -- Validate agent inputs
        local isValid, errors = validateAgentInputs(
            dex, tokenOut, slippage, startDate, endDate, 
            runIndefinitely, conversionPercentage, strategyType, 
            baseToken, poolIdOverride
        )
        
        if not isValid then
            msg.reply({
                Action = "Spawn-Agent-Error",
                Error = "Validation failed",
                Details = json.encode(errors)
            })
            return
        end
        
        -- Create agent record
        local agentRecord = {
            process_id = nil, -- Will be set when spawned
            owner = userAddress,
            pool_id = poolId,
            status = "spawning",
            created_at = nil, -- Will be set when spawned
            config = {
                Dex = dex,
                TokenOut = tokenOut,
                Slippage = slippage,
                StartDate = startDate,
                EndDate = endDate,
                RunIndefinitely = runIndefinitely,
                ConversionPercentage = conversionPercentage,
                StrategyType = strategyType,
                BaseToken = baseToken,
                PoolIdOverride = poolIdOverride,
                AgentOwner = userAddress
            }
        }
        
        -- Store pending agent in session for tracking
        local sessionId = generateSessionId()
        InferenceSessions[sessionId] = {
            session_id = sessionId,
            user_address = userAddress,
            timestamp = os.time(),
            status = "spawning",
            pending_agent = agentRecord
        }
        
        -- Spawn the agent process
        ao.spawn(ModuleId, {
            Tags = {
                ['App-Name'] = 'Yield LP Agent',
                ['Authority'] = ao.authorities[1],
                ['X-Create-Process-Id'] = sessionId,
                ['Dex'] = dex,
                ['Token-Out'] = tokenOut,
                ['Slippage'] = tostring(slippage),
                ['Start-Date'] = tostring(startDate),
                ['End-Date'] = tostring(endDate),
                ['Run-Indefinitely'] = tostring(runIndefinitely),
                ['Conversion-Percentage'] = tostring(conversionPercentage),
                ['Strategy-Type'] = strategyType,
                ['Base-Token'] = baseToken,
                ['Pool-Id'] = poolIdOverride or "",
                ['Agent-Owner'] = userAddress,
                ['Agent-Version'] = "1.0.0"
            }
        })
        
        msg.reply({
            Action = "Spawn-Agent-Pending",
            ["Session-Id"] = sessionId,
            Data = "Agent spawn request submitted, process ID will be provided when ready"
        })
    end
)

-- Get User Agents Handler
Handlers.add("Get-User-Agents", "Get-User-Agents",
    function(msg)
        local userAddress = msg.Tags["User-Address"] or msg.From
        local userAgents = UserAgentsMap[userAddress] or {}
        local agentDetails = {}
        
        for _, agentId in ipairs(userAgents) do
            local agentRecord = AgentsProcess[agentId]
            if agentRecord then
                table.insert(agentDetails, {
                    process_id = agentRecord.process_id,
                    pool_id = agentRecord.pool_id,
                    status = agentRecord.status,
                    created_at = agentRecord.created_at,
                    config = agentRecord.config
                })
            end
        end
        
        msg.reply({
            Action = "User-Agents-Response",
            Data = json.encode(agentDetails),
            ["User-Address"] = userAddress,
            ["Agent-Count"] = tostring(#agentDetails)
        })
    end
)

-- Get Pool Agents Handler
Handlers.add("Get-Pool-Agents", "Get-Pool-Agents",
    function(msg)
        local poolId = msg.Tags["Pool-Id"]
        if not poolId then
            msg.reply({
                Action = "Pool-Agents-Error",
                Error = "Pool-Id is required"
            })
            return
        end
        
        local poolAgents = PoolAgentsMap[poolId] or {}
        local agentDetails = {}
        
        for _, agentId in ipairs(poolAgents) do
            local agentRecord = AgentsProcess[agentId]
            if agentRecord then
                table.insert(agentDetails, {
                    process_id = agentRecord.process_id,
                    owner = agentRecord.owner,
                    status = agentRecord.status,
                    created_at = agentRecord.created_at,
                    config = agentRecord.config
                })
            end
        end
        
        msg.reply({
            Action = "Pool-Agents-Response",
            Data = json.encode(agentDetails),
            ["Pool-Id"] = poolId,
            ["Agent-Count"] = tostring(#agentDetails)
        })
    end
)

-- Update Agent Status Handler
Handlers.add("Update-Agent-Status", "Update-Agent-Status",
    function(msg)
        local agentId = msg.Tags["Agent-Id"]
        local newStatus = msg.Tags["Status"]
        local userAddress = msg.From
        
        if not agentId or not newStatus then
            msg.reply({
                Action = "Update-Agent-Status-Error",
                Error = "Agent-Id and Status are required"
            })
            return
        end
        
        local agentRecord = AgentsProcess[agentId]
        if not agentRecord then
            msg.reply({
                Action = "Update-Agent-Status-Error",
                Error = "Agent not found"
            })
            return
        end
        
        -- Check if user owns this agent
        if agentRecord.owner ~= userAddress then
            msg.reply({
                Action = "Update-Agent-Status-Error",
                Error = "Unauthorized: You don't own this agent"
            })
            return
        end
        
        -- Update status
        agentRecord.status = newStatus
        agentRecord.updated_at = os.time()
        
        msg.reply({
            Action = "Update-Agent-Status-Success",
            ["Agent-Id"] = agentId,
            ["New-Status"] = newStatus
        })
    end
)

-- Agent Ready Handler (called by spawned agents)
Handlers.add("Agent-Ready", "Agent-Ready",
    function(msg)
        local agentId = msg.From
        print("Agent ready notification from: " .. agentId)
        
        -- Update agent status if we're tracking it
        local agentRecord = AgentsProcess[agentId]
        if agentRecord then
            agentRecord.status = "ready"
            agentRecord.ready_at = os.time()
        end
    end
)

-- Get Available Pools Handler
Handlers.add("Get-Available-Pools", "Get-Available-Pools",
    function(msg)
        msg.reply({
            Action = "Available-Pools-Response",
            Data = json.encode(AvailablePools),
            ["Pool-Count"] = tostring(#AvailablePools)
        })
    end
)

-- Manager Info Handler
Handlers.add("Manager-Info", "Manager-Info",
    function(msg)
        local totalAgents = 0
        for _ in pairs(AgentsProcess) do
            totalAgents = totalAgents + 1
        end
        
        local totalUsers = 0
        for _ in pairs(UserAgentsMap) do
            totalUsers = totalUsers + 1
        end
        
        msg.reply({
            Action = "Manager-Info-Response",
            ["Total-Agents"] = tostring(totalAgents),
            ["Total-Users"] = tostring(totalUsers),
            ["Available-Pools"] = tostring(#AvailablePools),
            ["APUS-Credits"] = tostring(ApusCredits),
            ["RNG-Credits"] = tostring(RandomCredits),
            ["Eval-Data-Length"] = tostring(string.len(EvalData)),
            ["Manager-Version"] = "1.0.0"
        })
    end
)

-- Owner-only Pool Management Handlers

-- Set Eval Data (Owner Only)
Handlers.add("Set-Eval-Data", "Set-Eval-Data",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Set-Eval-Data-Error",
                Error = "Unauthorized: Only owner can set eval data"
            })
            return
        end
        
        local newEvalData = msg.Data or ""
        
        -- Update eval data
        EvalData = newEvalData
        
        msg.reply({
            Action = "Set-Eval-Data-Success",
            Data = "Successfully updated eval data",
            ["Data-Length"] = tostring(string.len(EvalData))
        })
        
        print("Eval data updated by owner. Length: " .. string.len(EvalData) .. " characters")
    end
)

-- Get Eval Data (Owner Only)
Handlers.add("Get-Eval-Data", "Get-Eval-Data",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Get-Eval-Data-Error",
                Error = "Unauthorized: Only owner can get eval data"
            })
            return
        end
        
        msg.reply({
            Action = "Get-Eval-Data-Response",
            Data = EvalData,
            ["Data-Length"] = tostring(string.len(EvalData))
        })
    end
)

-- Upgrade All Agents (Owner Only)
Handlers.add("Upgrade-All-Agents", "Upgrade-All-Agents",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Upgrade-All-Agents-Error",
                Error = "Unauthorized: Only owner can upgrade agents"
            })
            return
        end

        if not EvalData or EvalData == "" then
            msg.reply({
                Action = "Upgrade-All-Agents-Error",
                Error = "No eval data set. Use Set-Eval-Data first."
            })
            return
        end

        local upgraded = 0
        local failed = {}

        for agentId, _ in pairs(AgentsProcess) do
            local ok, err = pcall(function()
                ao.send({ Target = agentId, Action = "Eval", Data = EvalData })
            end)
            if ok then
                upgraded = upgraded + 1
            else
                table.insert(failed, { agent = agentId, error = tostring(err) })
            end
        end

        msg.reply({
            Action = "Upgrade-All-Agents-Result",
            ["Upgraded-Count"] = tostring(upgraded),
            ["Failed-Count"] = tostring(#failed),
            Data = (#failed > 0) and json.encode(failed) or "OK"
        })
    end
)

-- Set Available Pools (Owner Only)
Handlers.add("Set-Available-Pools", "Set-Available-Pools",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Set-Pools-Error",
                Error = "Unauthorized: Only owner can set available pools"
            })
            return
        end
        
        -- Parse pools data from message
        local poolsData = {}
        if msg.Data and msg.Data ~= "" then
            local success, parsed = pcall(json.decode, msg.Data)
            if not success then
                msg.reply({
                    Action = "Set-Pools-Error",
                    Error = "Invalid pools data format. Expected JSON array of pool objects."
                })
                return
            end
            poolsData = parsed
        else
            msg.reply({
                Action = "Set-Pools-Error",
                Error = "No pools data provided. Send pools as JSON in message Data."
            })
            return
        end
        
        -- Validate pool structure
        for i, pool in ipairs(poolsData) do
            local isValid, errors = validatePoolData(pool)
            if not isValid then
                msg.reply({
                    Action = "Set-Pools-Error",
                    Error = "Pool validation failed at index " .. i,
                    Details = json.encode(errors)
                })
                return
            end
            
            -- Set default verification status if not provided
            if pool.verified == nil then
                pool.verified = false
            end
        end
        
        -- Update available pools
        AvailablePools = poolsData
        
        msg.reply({
            Action = "Set-Pools-Success",
            Data = "Successfully updated available pools",
            ["Pool-Count"] = tostring(#AvailablePools)
        })
        
        print("Pools updated by owner: " .. #AvailablePools .. " pools now available")
    end
)

-- Add Single Pool (Owner Only)
Handlers.add("Add-Pool", "Add-Pool",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Add-Pool-Error",
                Error = "Unauthorized: Only owner can add pools"
            })
            return
        end
        
        -- Parse pool data from message
        local poolData = {}
        if msg.Data and msg.Data ~= "" then
            local success, parsed = pcall(json.decode, msg.Data)
            if not success then
                msg.reply({
                    Action = "Add-Pool-Error",
                    Error = "Invalid pool data format. Expected JSON pool object."
                })
                return
            end
            poolData = parsed
        else
            msg.reply({
                Action = "Add-Pool-Error",
                Error = "No pool data provided. Send pool as JSON in message Data."
            })
            return
        end
        
        -- Validate pool structure
        local isValid, errors = validatePoolData(poolData)
        if not isValid then
            msg.reply({
                Action = "Add-Pool-Error",
                Error = "Pool validation failed",
                Details = json.encode(errors)
            })
            return
        end
        
        -- Check if pool ID already exists
        for _, existingPool in ipairs(AvailablePools) do
            if existingPool.id == poolData.id then
                msg.reply({
                    Action = "Add-Pool-Error",
                    Error = "Pool with ID '" .. poolData.id .. "' already exists"
                })
                return
            end
        end
        
        -- Set default verification status if not provided
        if poolData.verified == nil then
            poolData.verified = false
        end
        poolData.created_at = os.time()
        
        -- Add pool to available pools
        table.insert(AvailablePools, poolData)
        
        msg.reply({
            Action = "Add-Pool-Success",
            Data = "Successfully added pool: " .. poolData.name,
            ["Pool-ID"] = poolData.id,
            ["Total-Pools"] = tostring(#AvailablePools)
        })
        
        print("Pool added by owner: " .. poolData.name .. " (" .. poolData.id .. ")")
    end
)

-- Remove Pool (Owner Only)
Handlers.add("Remove-Pool", "Remove-Pool",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Remove-Pool-Error",
                Error = "Unauthorized: Only owner can remove pools"
            })
            return
        end
        
        local poolId = msg.Tags["Pool-ID"]
        if not poolId then
            msg.reply({
                Action = "Remove-Pool-Error",
                Error = "Pool-ID tag is required"
            })
            return
        end
        
        -- Find and remove pool
        local poolIndex = nil
        for i, pool in ipairs(AvailablePools) do
            if pool.id == poolId then
                poolIndex = i
                break
            end
        end
        
        if not poolIndex then
            msg.reply({
                Action = "Remove-Pool-Error",
                Error = "Pool with ID '" .. poolId .. "' not found"
            })
            return
        end
        
        local removedPool = table.remove(AvailablePools, poolIndex)
        
        msg.reply({
            Action = "Remove-Pool-Success",
            Data = "Successfully removed pool: " .. removedPool.name,
            ["Pool-ID"] = poolId,
            ["Total-Pools"] = tostring(#AvailablePools)
        })
        
        print("Pool removed by owner: " .. removedPool.name .. " (" .. poolId .. ")")
    end
)

-- Update Pool Verification Status (Owner Only)
Handlers.add("Update-Pool-Verification", "Update-Pool-Verification",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Update-Pool-Verification-Error",
                Error = "Unauthorized: Only owner can update pool verification"
            })
            return
        end
        
        local poolId = msg.Tags["Pool-ID"]
        local verified = msg.Tags["Verified"] == "true"
        
        if not poolId then
            msg.reply({
                Action = "Update-Pool-Verification-Error",
                Error = "Pool-ID tag is required"
            })
            return
        end
        
        -- Find and update pool
        local pool = getPoolById(poolId)
        if not pool then
            msg.reply({
                Action = "Update-Pool-Verification-Error",
                Error = "Pool with ID '" .. poolId .. "' not found"
            })
            return
        end
        
        pool.verified = verified
        pool.updated_at = os.time()
        
        msg.reply({
            Action = "Update-Pool-Verification-Success",
            Data = "Successfully updated verification status for pool: " .. pool.name,
            ["Pool-ID"] = poolId,
            ["Verified"] = tostring(verified)
        })
        
        print("Pool verification updated by owner: " .. pool.name .. " (" .. poolId .. ") - Verified: " .. tostring(verified))
    end
)

-- Get Pools by Risk Level
Handlers.add("Get-Pools-By-Risk", "Get-Pools-By-Risk",
    function(msg)
        local riskLevel = msg.Tags["Risk-Level"]
        if not riskLevel then
            msg.reply({
                Action = "Get-Pools-By-Risk-Error",
                Error = "Risk-Level tag is required"
            })
            return
        end
        
        local filteredPools = getPoolsByRiskLevel(riskLevel)
        
        msg.reply({
            Action = "Pools-By-Risk-Response",
            Data = json.encode(filteredPools),
            ["Risk-Level"] = riskLevel,
            ["Pool-Count"] = tostring(#filteredPools)
        })
    end
)

-- Get Verified Pools Only
Handlers.add("Get-Verified-Pools", "Get-Verified-Pools",
    function(msg)
        local verifiedPools = getVerifiedPools()
        
        msg.reply({
            Action = "Verified-Pools-Response",
            Data = json.encode(verifiedPools),
            ["Pool-Count"] = tostring(#verifiedPools)
        })
    end
)

-- Update Pool Data (Owner Only)
Handlers.add("Update-Pool", "Update-Pool",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Update-Pool-Error",
                Error = "Unauthorized: Only owner can update pools"
            })
            return
        end
        
        local poolId = msg.Tags["Pool-ID"]
        if not poolId then
            msg.reply({
                Action = "Update-Pool-Error",
                Error = "Pool-ID tag is required"
            })
            return
        end
        
        -- Parse updated pool data from message
        local updatedData = {}
        if msg.Data and msg.Data ~= "" then
            local success, parsed = pcall(json.decode, msg.Data)
            if not success then
                msg.reply({
                    Action = "Update-Pool-Error",
                    Error = "Invalid pool data format. Expected JSON pool object."
                })
                return
            end
            updatedData = parsed
        else
            msg.reply({
                Action = "Update-Pool-Error",
                Error = "No pool data provided. Send updated pool data as JSON in message Data."
            })
            return
        end
        
        -- Find existing pool
        local poolIndex = nil
        for i, pool in ipairs(AvailablePools) do
            if pool.id == poolId then
                poolIndex = i
                break
            end
        end
        
        if not poolIndex then
            msg.reply({
                Action = "Update-Pool-Error",
                Error = "Pool with ID '" .. poolId .. "' not found"
            })
            return
        end
        
        -- Validate updated data
        local isValid, errors = validatePoolData(updatedData)
        if not isValid then
            msg.reply({
                Action = "Update-Pool-Error",
                Error = "Pool validation failed",
                Details = json.encode(errors)
            })
            return
        end
        
        -- Update pool
        updatedData.updated_at = os.time()
        AvailablePools[poolIndex] = updatedData
        
        msg.reply({
            Action = "Update-Pool-Success",
            Data = "Successfully updated pool: " .. updatedData.name,
            ["Pool-ID"] = poolId
        })
        
        print("Pool updated by owner: " .. updatedData.name .. " (" .. poolId .. ")")
    end
)

-- Update Owner (Current Owner Only)
Handlers.add("Update-Owner", "Update-Owner",
    function(msg)
        if not isOwner(msg.From) then
            msg.reply({
                Action = "Update-Owner-Error",
                Error = "Unauthorized: Only current owner can update owner"
            })
            return
        end
        
        local newOwner = msg.Tags["New-Owner"]
        if not newOwner or newOwner == "" then
            msg.reply({
                Action = "Update-Owner-Error",
                Error = "New-Owner tag is required"
            })
            return
        end
        
        local oldOwner = Owner
        Owner = newOwner
        
        msg.reply({
            Action = "Update-Owner-Success",
            Data = "Owner successfully updated",
            ["Old-Owner"] = oldOwner,
            ["New-Owner"] = newOwner
        })
        
        print("Owner updated from " .. oldOwner .. " to " .. newOwner)
    end
)


-- Helper to get verified pools now
local function getVerifiedPoolIds()
    local ids = {}
    for _, pool in ipairs(getVerifiedPools()) do
        table.insert(ids, pool.id)
    end
    return ids
end

-- Random Recommendation Request
Handlers.add("Get-Random-Recommendation", "Get-Random-Recommendation",
    function(msg)
        local sessionId = generateSessionId()
        local userAddress = msg.From

        -- Ensure we have pools
        if not AvailablePools or #AvailablePools == 0 then
            msg.reply({
                Action = "Random-Recommendation-Error",
                Error = "No pools available. Please contact administrator to configure pools.",
                ["Session-Id"] = sessionId
            })
            return
        end

        local verifiedPools = getVerifiedPools()
        if #verifiedPools == 0 then
            msg.reply({
                Action = "Random-Recommendation-Error",
                Error = "No verified pools available.",
                ["Session-Id"] = sessionId
            })
            return
        end

        -- If no RNG credits, fallback using pseudo-random selection
        if RandomCredits < 1 then
            local idx = (os.time() % #verifiedPools) + 1
            local pool = verifiedPools[idx]
            local response = {
                recommendation = {
                    pool_id = pool.id,
                    dex = pool.dex,
                    token_pair = pool.name,
                    apy = pool.apy,
                    risk_level = pool.risk_level,
                    reasoning = "Fallback selection without RNG credits"
                }
            }

            msg.reply({
                Action = "Random-Recommendation-Response",
                Data = json.encode(response),
                ["Session-Id"] = sessionId,
                ["Fallback-Used"] = "true"
            })
            return
        end

        -- Prepare RNG session and redeem one credit
        local callbackId = Random.generateUUID()
        RandomSessions[callbackId] = {
            session_id = sessionId,
            user_address = userAddress,
            status = "pending",
            requested_at = os.time(),
            pool_ids = getVerifiedPoolIds()
        }

        Random.redeemRandomCredit(callbackId)

        msg.reply({
            Action = "Random-Recommendation-Pending",
            ["Session-Id"] = sessionId,
            ["Callback-Id"] = callbackId,
            Data = "Random request submitted via RandAO, response will be sent separately"
        })
    end
)

-- Random Recommendation Result Handler
Handlers.add(
    "Random-Recommendation-Result",
    function(msg)
        -- Predicate: message from configured RandomProcess and contains identifiable random payload
        if msg.From ~= Random.RandomProcess then return false end
        if msg.Data and msg.Data ~= "" then return true end
        if msg.Tags and (msg.Tags["Callback-Id"] or msg.Tags["Entropy"]) then return true end
        return false
    end,
    function(msg)
        -- Try to parse as JSON first
        local data
        if msg.Data and msg.Data ~= "" then
            local ok, parsed = pcall(json.decode, msg.Data)
            if ok then data = parsed end
        end
        if not data then
            data = { callbackId = msg.Tags["Callback-Id"], entropy = tonumber(msg.Tags["Entropy"]) }
        end

        if not data or not data.callbackId or not data.entropy then
            print("Random response missing required fields")
            return
        end

        local ok, callbackId, entropy = pcall(function()
            local cid, ent = Random.processRandomResponse(msg.From, data)
            return cid, ent
        end)

        if not ok then
            print("Failed to process random response: " .. tostring(callbackId))
            return
        end

        local session = RandomSessions[callbackId]
        if not session then
            print("No session found for callbackId: " .. tostring(callbackId))
            return
        end

        local poolIds = session.pool_ids or getVerifiedPoolIds()
        if #poolIds == 0 then
            ao.send({
                Target = session.user_address,
                Action = "Random-Recommendation-Error",
                Data = "No verified pools available at selection time",
                ["Session-Id"] = session.session_id
            })
            RandomSessions[callbackId] = nil
            return
        end

        local idx = (entropy % #poolIds) + 1
        local selectedId = poolIds[idx]
        local selectedPool = getPoolById(selectedId)
        if not selectedPool then
            -- Fallback to first verified pool
            local verifiedPools = getVerifiedPools()
            selectedPool = verifiedPools[1]
        end

        -- Consume one RNG credit
        if RandomCredits > 0 then
            RandomCredits = RandomCredits - 1
        end

        local response = {
            recommendation = {
                pool_id = selectedPool.id,
                dex = selectedPool.dex,
                token_pair = selectedPool.name,
                apy = selectedPool.apy,
                risk_level = selectedPool.risk_level,
                reasoning = "Random selection using RandAO entropy",
                entropy = entropy,
                callback_id = callbackId
            }
        }

        ao.send({
            Target = session.user_address,
            Action = "Random-Recommendation-Response",
            Data = json.encode(response),
            ["Session-Id"] = session.session_id
        })

        -- Store completed response for status polling
        session.status = "completed"
        session.completed_at = os.time()
        session.response = response
    end
)

-- Random Recommendation Status (for polling)
Handlers.add("Get-Random-Recommendation-Status", "Get-Random-Recommendation-Status",
    function(msg)
        local sessionId = msg.Tags["Session-Id"]
        local callbackId = msg.Tags["Callback-Id"]

        local session
        if callbackId and RandomSessions[callbackId] then
            session = RandomSessions[callbackId]
        elseif sessionId then
            -- Find by session id
            for _, s in pairs(RandomSessions) do
                if s.session_id == sessionId then
                    session = s
                    break
                end
            end
        end

        if not session then
            msg.reply({
                Action = "Random-Recommendation-Pending",
                ["Session-Id"] = sessionId or "",
                ["Callback-Id"] = callbackId or "",
                Data = "Session not found or not started yet"
            })
            return
        end

        if session.status == "completed" and session.response then
            msg.reply({
                Action = "Random-Recommendation-Response",
                Data = json.encode(session.response),
                ["Session-Id"] = session.session_id,
                ["Callback-Id"] = callbackId or ""
            })
        else
            msg.reply({
                Action = "Random-Recommendation-Pending",
                ["Session-Id"] = session.session_id,
                ["Callback-Id"] = callbackId or "",
                Data = "Still pending"
            })
        end
    end
)

print("AI Agent Manager initialized")
print("Available pools: " .. tostring(#AvailablePools))
print("APUS credits: " .. tostring(ApusCredits))
print("RNG credits: " .. tostring(RandomCredits))
print("Owner: " .. tostring(Owner))
print("Manager process ID: " .. ao.id)
