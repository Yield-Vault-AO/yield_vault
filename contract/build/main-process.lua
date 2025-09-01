do
local _ENV = _ENV
package.preload[ "apus_agent" ] = function( ... ) local arg = _G.arg;
local json = require("json")

-- Backend AO Process Logic (Core Flow from section 2.5)

CurrentReference = CurrentReference or 0 -- Initialize or use existing reference counter
Tasks = Tasks or {}                      -- Your process's state where results are stored
Balances = Balances or "0"               -- Store balance information for each reference

APUS_ROUTER = "Bf6JJR2tl2Wr38O2-H6VctqtduxHgKF-NzRB9HhTRzo"

-- Handler to listen for prompts from your frontend
Handlers.add(
    "SendInfer",
    Handlers.utils.hasMatchingTag("Action", "Infer"),
    function(msg)
        local reference = msg.Tags["X-Reference"] or msg.Reference
        local requestReference = reference
        local request = {
            Target = APUS_ROUTER,
            Action = "Infer",
            ["X-Prompt"] = msg.Data,
            ["X-Reference"] = reference
        }
        if msg.Tags["X-Session"] then
            request["X-Session"] = msg.Tags["X-Session"]
        end
        if msg.Tags["X-Options"] then
            request["X-Options"] = msg.Tags["X-Options"]
        end
        Tasks[requestReference] = {
            prompt = request["X-Prompt"],
            options = request["X-Options"],
            session = request["X-Session"],
            reference = reference,
            status = "processing",
            starttime = os.time(),
        }
        Send({
            device = 'patch@1.0',
            cache = {
                tasks = Tasks
            }
        })
        ao.send(request)
        
        -- Reply immediately to the frontend with the task reference
        msg.reply({
            TaskRef = reference,
            Data = "request accepted, taskRef: " .. reference
        })
    end
)

Handlers.add(
    "AcceptResponse",
    Handlers.utils.hasMatchingTag("Action", "Infer-Response"),
    function(msg)
        local reference = msg.Tags["X-Reference"] or ""
        print(msg)

        if msg.Tags["Code"] then
            -- Update task status to failed
            if Tasks[reference] then
                local error_message = msg.Tags["Message"] or "Unknown error"
                Tasks[reference].status = "failed"
                Tasks[reference].error_message = error_message
                Tasks[reference].error_code = msg.Tags["Code"]
                Tasks[reference].endtime = os.time()
            end
            Send({
                device = 'patch@1.0',
                cache = {
                    tasks = {
                        [reference] = Tasks[reference] }
                }
            })
            return
        end
        Tasks[reference].response = msg.Data or ""
        Tasks[reference].status = "success"
        Tasks[reference].endtime = os.time()

        Send({
            device = 'patch@1.0',
            cache = {
                tasks = {
                    [reference] = Tasks[reference] }
            }
        })
    end
)

Handlers.add(
    "GetInferResponse",
    Handlers.utils.hasMatchingTag("Action", "GetInferResponse"),
    function(msg)
        local reference = msg.Tags["X-Reference"] or ""
        print(Tasks[reference])
        if Tasks[reference] then
            msg.reply({Data = json.encode(Tasks[reference])})
        else
            msg.reply({Data = "Task not found"}) -- if task not found, return error
        end
    end
)

-- Frontend workflow
-- 1. User input a prompt
-- 2. Generate a unique reference ID for the request
-- 3. Send the prompt to the backend
-- 4. Wait for the request ended, show a loading indicator
-- 5. Query the task status by Patch API(this is AO HyperBEAM's API for your process, not APUS service!):
--  `GET /{your_process_id}~process@1.0/now/cache/tasks/{your_process_id}-{reference}/serialize~json@1.0`
-- 6. display the response or error message
-- ```
-- {
--     prompt = "who are you?",
--     status = "success/failed",
--     reference = "123",
--     starttime = "1754705621248",
--     endtime = "1754705610148",
--     data = "{"attestation":"","result":"\nI am Gemma, an open-weights AI assistant."}",
--     error_code = "400", // has this field when the request failed
--     error_message = "Invalid request format" // has this field when the request failed
-- }
-- ```
-- 
-- Additional Notes:
-- - Ensure that the `APUS_ROUTER` is correctly set to your APUS service
-- - Ensure your are useing YOUR_PROCESS_ID in the frontend API calls
-- - You can check CREDITS BALANCE by querying the APUS_ROUTER Patch API
--  `GET /{APUS_ROUTER}~process@1.0/now/cache/credits/{your_process_id}/serialize~json@1.0`
-- http://72.46.85.207:8734/D0na6AspYVzZnZNa7lQHnBt_J92EldK_oFtEPLjIexo~process@1.0/now/cache/credits/sNWrdfUcR9kBpRPPPnJKFlel4j_z2rJ89PStNXITMto/serialize~json@1.0
end
end

do
local _ENV = _ENV
package.preload[ "installer" ] = function( ... ) local arg = _G.arg;
-- AO Package Manager for easy installation of packages in ao processes
-- This blueprint fetches the latest APM client from the APM registry and installs it
-------------------------------------------------------------------------
--      ___      .______   .___  ___.     __       __    __       ___
--     /   \     |   _  \  |   \/   |    |  |     |  |  |  |     /   \
--    /  ^  \    |  |_)  | |  \  /  |    |  |     |  |  |  |    /  ^  \
--   /  /_\  \   |   ___/  |  |\/|  |    |  |     |  |  |  |   /  /_\  \
--  /  _____  \  |  |      |  |  |  |  __|  `----.|  `--'  |  /  _____  \
-- /__/     \__\ | _|      |__|  |__| (__)_______| \______/  /__/     \__\
--
---------------------------------------------------------------------------
-- APM Registry source code: https://github.com/betteridea-dev/ao-package-manager
-- CLI tool for managing packages: https://www.npmjs.com/package/apm-tool
-- Web UI for browsing & publishing packages: https://apm.betteridea.dev
-- Built with ❤️ by BetterIDEa


local apm_id = "RLvG3tclmALLBCrwc17NqzNFqZCrUf3-RKZ5v8VRHiU"

function Hexencode(str)
    return (str:gsub(".", function(char) return string.format("%02x", char:byte()) end))
end

function Hexdecode(hex)
    return (hex:gsub("%x%x", function(digits) return string.char(tonumber(digits, 16)) end))
end

-- common error handler
function HandleRun(func, msg)
    local ok, err = pcall(func, msg)
    if not ok then
        local clean_err = err:match(":%d+: (.+)") or err
        print(msg.Action .. " - " .. err)
        -- if not msg.Target == ao.id then
        ao.send({
            Target = msg.From,
            Data = clean_err,
            Result = "error"
        })
        -- end
    end
end

local function InstallResponseHandler(msg)
    local from = msg.From
    if not from == apm_id then
        print("Attempt to update from illegal source")
        return
    end

    if not msg.Result == "success" then
        print("Update failed: " .. msg.Data)
        return
    end

    local source = msg.Data
    local version = msg.Version

    if source then
        source = Hexdecode(source)
    end

    local func, err = load(string.format([[
        local function _load()
            %s
        end
        -- apm = _load()
        _load()
    ]], source))
    if not func then
        error("Error compiling load function: " .. err)
    end
    func()

    apm._version = version
    -- print("✅ Installed APM v:" .. version)
end

Handlers.once(
    "APM.UpdateResponse",
    Handlers.utils.hasMatchingTag("Action", "APM.UpdateResponse"),
    function(msg)
        HandleRun(InstallResponseHandler, msg)
    end
)

Send({
    Target = apm_id,
    Action = "APM.Update"
})
print("📦 Loading APM...")
end
end

do
local _ENV = _ENV
package.preload[ "libs.assertions" ] = function( ... ) local arg = _G.arg;
---@diagnostic disable: undefined-global
local utils = require('utils.utils')
local enums = require('libs.enums')

local mod = {}

-- Validate token quantity
function mod.isTokenQuantity(name, quantity)
    local numQuantity = tonumber(quantity)
    assert(utils.isTokenQuantity(numQuantity),
        "Invalid quantity `" .. name .. "`. Must be a valid token quantity.")
end

-- Validate address
function mod.isAddress(name, value)
    assert(utils.isAddress(value),
        "Invalid address `" .. name .. "`. Must be a valid Arweave address.")
end

-- Validate percentage
function mod.isPercentage(name, value)
    assert(utils.isPercentage(value),
        "Invalid percentage `" .. name .. "`. Must be a valid percentage.")
end

-- Validate slippage
function mod.isValidSlippage(name, value)
    assert(utils.isValidSlippage(value),
        "Invalid slippage `" .. name .. "`. Must be a valid slippage percentage.")
end

-- Validate DEX type
function mod.isValidDex(name, value)
    assert(utils.isValidDex(value),
        "Invalid dex `" .. name .. "`. Must be a valid dex type.")
end

-- Validate running time
function mod.isValidRunningTime(name1, name2, startDate, endDate)
    assert(utils.isValidRunningTime(startDate, endDate),
        "Invalid running time `" .. name1 .. "` and `" .. name2 .. "`. Must be a valid running time.")
end

-- Validate strategy type
function mod.isValidStrategy(name, value)
    assert(utils.isValidStrategy(value),
        "Invalid strategy `" .. name .. "`. Must be a valid strategy type.")
end

-- Validate agent version
function mod.isValidAgentVersion(name, value)
    assert(utils.isValidAgentVersion(value),
        "Invalid agent version `" .. name .. "`. Must be a valid version format.")
end

-- Validate boolean
function mod.isValidBoolean(name, value)
    assert(utils.isValidBoolean(value),
        "Invalid boolean `" .. name .. "`. Must be 'true' or 'false'.")
end

-- Validate status
function mod.isValidStatus(name, value)
    assert(utils.isValidStatus(value),
        "Invalid status `" .. name .. "`. Must be a valid agent status.")
end

-- Check wallet permission
function mod.checkWalletForPermission(msg, errorMessage)
    assert(ao.id == msg.From or Owner == msg.From or AgentOwner == msg.From,
        errorMessage or "Wallet does not have permission to perform this action.")
end

-- Check if agent is active
function mod.isAgentActive()
    assert(Status == enums.AgentStatus.ACTIVE,
        "Agent is not active and cannot perform operations.")
end

-- Check if operation is valid
function mod.isValidOperation(name, value)
    assert(value == enums.OperationType.SWAP or
           value == enums.OperationType.LIQUIDITY_PROVISION or
           value == enums.OperationType.WITHDRAWAL,
        "Invalid operation type `" .. name .. "`. Must be a valid operation.")
end

return mod
end
end

do
local _ENV = _ENV
package.preload[ "libs.botega" ] = function( ... ) local arg = _G.arg;
---@diagnostic disable: undefined-global
local utils = require('utils.utils')
local constants = require('libs.constants')

local mod = {}

-- Check if message is a swap confirmation
function mod.isSwapConfirmation(msg, poolId)
    return msg.From == constants.BOTEGA_AMM_FACTORY_ID and
           msg.Tags["Relayed-From"] == poolId and
           msg.Tags["Relay-To"] == ao.id and
           msg.Tags.Action == 'Order-Confirmation'
end

-- Check if message is a swap refund
function mod.isSwapRefund(msg, poolId)
    return msg.Tags.Action == 'Credit-Notice' and
           msg.Tags.Sender == poolId and
           msg.Tags["X-Refunded-Order"] ~= nil
end

-- Await swap completion
function mod._awaitSwap(poolId)
    local response = Receive(function(msg)
        return mod.isSwapConfirmation(msg, poolId) or mod.isSwapRefund(msg, poolId)
    end)

    if mod.isSwapConfirmation(response, poolId) then
        return true, response
    else
        return false, response
    end
end

-- Get expected output for a swap
function mod.getExpectedOutput(poolId, tokenIn, amountIn)
    local swapOutput = ao.send({
        Target = poolId,
        Action = "Get-Swap-Output",
        Tags = {
            Token = tokenIn,
            Quantity = tostring(amountIn),
            Swapper = ao.id
        }
    }).receive()

    local amountOut = (swapOutput and swapOutput.Output) or "0"
    local slippage = Slippage or 0.5
    local expectedMinOutput = utils.calculateMinOutput(amountOut, slippage)

    return {
        amountOut = tostring(amountOut),
        expectedMinOutput = tostring(expectedMinOutput)
    }
end

-- Get swap nonce
function mod.getSwapNonce()
    return os.time() .. "-" .. math.random(100000000, 999999999)
end

-- Execute swap
function mod.swap(result)
    ao.send({
        Target = result.tokenIn,
        Action = "Transfer",
        Recipient = result.poolId,
        Quantity = result.amountIn,
        ["X-Expected-Min-Output"] = result.expectedMinOutput,
        ["X-Swap-Nonce"] = mod.getSwapNonce(),
        ["X-Action"] = "Swap"
    })

    return mod._awaitSwap(result.poolId)
end

-- Get liquidity pool information
function mod.getPoolInfo(poolId)
    local poolInfo = ao.send({
        Target = poolId,
        Action = "Info"
    }).receive()

    return poolInfo
end

return mod
end
end

do
local _ENV = _ENV
package.preload[ "libs.constants" ] = function( ... ) local arg = _G.arg;
local constants = {
    -- AO Ecosystem Token IDs
    AO_PROCESS_ID = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc",
    GAME_PROCESS_ID = "s6jcB3ctSbiDNwR-paJgy5iOAhahXahLul8exSLHbGE",

    -- DEX Pool IDs
    PERMASWAP_AO_GAME_POOL_ID = "hbRwutwINSXCNxXxVNoNRT2YQk-OIX3Objqu85zJrLo",
    BOTEGA_AO_GAME_POOL_ID = "rG-b4gQwhfjnbmYhrnvCMDPuXguqmAmYwHZf4y24WYs",

    -- DEX Factory IDs
    BOTEGA_AMM_FACTORY_ID = "3XBGLrygs11K63F_7mldWz4veNx6Llg6hI2yZs8LKHo",

    -- Fee Process ID
    FEE_PROCESS_ID = "oOx8YhMyPkeV78LqGw2_BZSKSb4LzwdKEPo0_xwCdLk",

    -- Strategy Configuration
    SWAP_PERCENTAGE = 50,  -- 50% for swapping
    LP_PERCENTAGE = 50,    -- 50% for liquidity provision

    -- Default Configuration
    DEFAULT_SLIPPAGE = 1.0,
    DEFAULT_LP_SLIPPAGE = 1.0,  -- Higher slippage tolerance for LP
    AGENT_VERSION = "0.1.3"
}

-- Pool ID mappings
constants.PERMASWAP_POOL_IDS = {
    [constants.GAME_PROCESS_ID] = constants.PERMASWAP_AO_GAME_POOL_ID
}

constants.BOTEGA_POOL_IDS = {
    [constants.GAME_PROCESS_ID] = constants.BOTEGA_AO_GAME_POOL_ID
}

return constants
end
end

do
local _ENV = _ENV
package.preload[ "libs.enums" ] = function( ... ) local arg = _G.arg;
local enums = {
    DexType = {
        PERMASWAP = "Permaswap",
        BOTEGA = "Botega",
        AUTO = "Auto"
    },

    AgentStatus = {
        ACTIVE = "Active",
        PAUSED = "Paused",
        COMPLETED = "Completed",
        CANCELLED = "Cancelled"
    },

    OperationType = {
        SWAP = "Swap",
        LIQUIDITY_PROVISION = "LiquidityProvision",
        WITHDRAWAL = "Withdrawal"
    },

    StrategyType = {
        SWAP_50_LP_50 = "Swap50LP50",
        CUSTOM = "Custom"
    },

    -- LP staged flow states
    LPFlowState = {
        AWAIT_TOKEN_OUT_CREDIT = "AwaitTokenOutCredit",
        TOKEN_OUT_SENT = "TokenOutSent",
        COMPLETED = "Completed"
    }
}

return enums
end
end

do
local _ENV = _ENV
package.preload[ "libs.permaswap" ] = function( ... ) local arg = _G.arg;
---@diagnostic disable: undefined-global
local utils = require('utils.utils')
local json = require('json')

local mod = {}

-- Check if message is a swap confirmation
function mod.isSwapConfirmation(msg, noteSettle)
    return msg.Tags.Action == 'Credit-Notice' and
           msg.Tags.Sender == noteSettle and
           msg.Tags["X-FFP-For"] == "Settled"
end

-- Check if message is a swap refund
function mod.isSwapRefund(msg, noteSettle)
    return msg.Tags.Action == 'Credit-Notice' and
           msg.Tags.Sender == noteSettle and
           msg.Tags["X-FFP-For"] == "Refund"
end

-- Await swap completion
function mod._awaitSwap(noteSettle)
    local response = Receive(function(msg)
        return mod.isSwapConfirmation(msg, noteSettle) or mod.isSwapRefund(msg, noteSettle)
    end)

    if mod.isSwapConfirmation(response, noteSettle) then
        return true, response
    else
        return false, response
    end
end

-- Get expected output for a swap
function mod.getExpectedOutput(poolId, tokenIn, amountIn)
    local swapOutput = ao.send({
        Target = poolId,
        Action = "GetAmountOut",
        AmountIn = amountIn,
        TokenIn = tokenIn
    }).receive()

    local amountOut = (swapOutput and swapOutput.AmountOut) or "0"
    local slippage = Slippage or 0.5
    local expectedMinOutput = utils.calculateMinOutput(amountOut, slippage)

    return {
        amountOut = tostring(amountOut),
        expectedMinOutput = tostring(expectedMinOutput)
    }
end

-- Request an order for swap
function mod.requestOrder(poolId, tokenIn, tokenOut, amountIn, amountOut)
    local requestOrder = ao.send({
        Target = poolId,
        Action = "RequestOrder",
        TokenIn = tokenIn,
        TokenOut = tokenOut,
        AmountIn = tostring(amountIn),
        AmountOut = tostring(amountOut)
    }).receive()

    return requestOrder
end

-- Execute swap
function mod.swap(result)
    ao.send({
        Target = result.tokenIn,
        Action = "Transfer",
        Recipient = result.noteSettle,
        Quantity = result.amountIn,
        ["X-FFP-For"] = "Settle",
        ["X-FFP-NoteIDs"] = json.encode({ result.noteId })
    })

    return mod._awaitSwap(result.noteSettle)
end

-- Alternative: Direct AddLiquidity call equivalent to permaswap-amm
function mod.addLiquidityDirect(poolId, amountA, amountB, minLiquidity)
    ao.send({
        Target = poolId,
        Action = "AddLiquidity",
        MinLiquidity = minLiquidity or "0",
        AmountA = amountA,
        AmountB = amountB
    }).receive()
end

return mod
end
end

do
local _ENV = _ENV
package.preload[ "libs.random" ] = function( ... ) local arg = _G.arg;
--------------------------------------------------------------------------------
-- RandomModule
-- Interacts with RandAO Protocol to:
--   • Retrieve and update configuration from DNS
--   • Send token transfers to request random values
--   • Receive and process random responses
--   • Manage provider list record random request status
--------------------------------------------------------------------------------
local function RandomModule(json)

    -- Create a table to hold module functions and data
    local self         = {}

    ----------------------------------------------------------------------------
    -- Default State Variables
    --   RandAODNS      : Points to the DNS record that provides random config
    --   PaymentToken   : Token to pay the Random Process with
    --   RandomCost     : Cost (token quantity) per random request
    --   RandomProcess  : Transaction ID / Process that fulfills random requests
    --   Providers      : JSON-encoded list of provider IDs for round-robin usage
    ----------------------------------------------------------------------------
    self.RandAOSubscriptionManager     = "zEZB5ORBX7A8_yZIzmhTBsPL8rvo14qXivBw8IxNKoM"
    self.PaymentToken  = "rPpsRk9Rm8_SJ1JF8m9_zjTalkv9Soaa_5U0tYUloeY"
    self.RandomCost    = "1000000000"
    self.RandomProcess = "1nTos_shMV8HlC7f2svZNZ3J09BROKCTK8DyvkrzLag"
    self.Providers     =
    "{\"provider_ids\":[\"XUo8jZtUDBFLtp5okR12oLrqIZ4ewNlTpqnqmriihJE\",\"c8Iq4yunDnsJWGSz_wYwQU--O9qeODKHiRdUkQkW2p8\",\"Sr3HVH0Nh6iZzbORLpoQFOEvmsuKjXsHswSWH760KAk\"]}"

    ----------------------------------------------------------------------------
    -- initialize()
    -- Sets up a handler to listen for the "Records-Notice" action.
    -- Upon receiving new config data, it updates the module state via setConfig().
    -- Finally, it calls updateConfig() to request the current configuration from DNS.
    ----------------------------------------------------------------------------
    function self.initialize()
        print("Initializing Random Module")
        Handlers.add(
            "Update-Random-Config",
            Handlers.utils.hasMatchingTag("Action", "Update-Random-Config"),
            function(msg)
                print("entered records")
                assert(msg.From == self.RandAOSubscriptionManager, "Failure: message is not from RandAOSubscriptionManager")
                local randomProcess     = msg.Tags.RandomProcess
                local rngToken          = msg.Tags.RNG

                self.setConfig(rngToken, self.RandomCost, randomProcess)
                print("RNG Token: " .. rngToken)
                print("RNG Process: " .. randomProcess)
            end
        )
        table.insert(ao.authorities, "--TKpHlFyOR7aLqZ-uR3tqtmgQisllKaRVctMlwvPwE")

        self.updateConfig()
    end

    ----------------------------------------------------------------------------
    -- updateConfig()
    -- Sends a request to retrieve new configuration records from the RandAOSubscriptionManager.
    ----------------------------------------------------------------------------
    function self.updateConfig()
        return ao.send({
            Target = self.RandAOSubscriptionManager,
            Action = "Subscribe"
        })
    end

    ----------------------------------------------------------------------------
    -- setConfig(paymentToken, randomCost, randomProcess)
    -- Dynamically updates the module's state with new configuration details.
    --
    -- Arguments:
    --   paymentToken  : The token used to pay for random generation
    --   randomCost    : The cost (in tokens) of a single random request
    --   randomProcess : The Process ID responsible for generating random values
    ----------------------------------------------------------------------------
    function self.setConfig(paymentToken, randomCost, randomProcess)
        self.PaymentToken = paymentToken
        self.RandomCost = randomCost
        self.RandomProcess = randomProcess
    end

    ----------------------------------------------------------------------------
    -- setProviderList(providerList)
    -- Updates the module's Providers field to use for random requests.
    --
    -- Arguments:
    --   providerList  : A list of provider ID strings
    ----------------------------------------------------------------------------
    function self.setProviderList(providerList)
        local providers = {provider_ids = providerList}
        self.Providers = json.encode(providers)
    end

    ----------------------------------------------------------------------------
    -- showConfig()
    -- Simple utility to log the current configuration values for debugging.
    ----------------------------------------------------------------------------
    function self.showConfig()
        print("PaymentToken: " .. self.PaymentToken)
        print("RandomCost: " .. self.RandomCost)
        print("RandomProcess: " .. self.RandomProcess)
    end

    ----------------------------------------------------------------------------
    -- isRandomProcess(processId)
    -- Checks if the given process ID matches the configured RandomProcess.
    --
    -- Arguments:
    --   processId : The ID of the process to verify
    --
    -- Returns:
    --   Boolean indicating whether processId is the active RandomProcess
    ----------------------------------------------------------------------------
    function self.isRandomProcess(processId)
        return processId == self.RandomProcess
    end

    ----------------------------------------------------------------------------
    -- generateUUID()
    -- Creates a universally unique identifier (UUID) in the form of a string.
    -- Used as a callback ID when requesting random values.
    --
    -- Returns:
    --   A randomly generated UUID (string)
    ----------------------------------------------------------------------------
    function self.generateUUID()
        local random = math.random
        local template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"

        return string.gsub(template, "[xy]", function(c)
            local v = (c == "x") and random(0, 15) or random(8, 11)
            return string.format("%x", v)
        end)
    end


    ----------------------------------------------------------------------------
    -- prepayForRandom(units)
    -- Sends a token transfer to the configured RandomProcess to prepay for X 
    -- number of future random requests
    --
    -- Arguments:
    --   units : Number of random units to purchase
    ----------------------------------------------------------------------------
    function self.prepayForRandom(units)
        local quantity = units * tonumber(self.RandomCost)

        local send = ao.send({
            Target = self.PaymentToken,
            Action = "Transfer",
            Recipient = self.RandomProcess,
            Quantity = tostring(quantity),
            ["X-Prepayment"] = "true",
        })
        return send
    end

    ----------------------------------------------------------------------------
    -- redeemRandomCredit(callbackId, providerList)
    -- Requests random utilizing prepaid credits with callbackid and optionally a provider providerlist
    --
    -- Arguments:
    --   callbackId : Unique identifier for tracking the random request
    --   providerList : List of providers to use for entropy generation
    ----------------------------------------------------------------------------
    function self.redeemRandomCredit(callbackId, providerList)
        if providerList == nil then
            local send = ao.send({
                Target = self.RandomProcess,
                Action = "Redeem-Random-Credit",
                CallbackId = callbackId,
            })
            return send
        else
            local send = ao.send({
                Target = self.RandomProcess,
                Action = "Redeem-Random-Credit",
                CallbackId = callbackId,
                ["X-Providers"] = providerList
            })
            return send
        end
    end

    ----------------------------------------------------------------------------
    -- requestRandom(callbackId)
    -- Sends a token transfer to the configured RandomProcess to request entropy,
    -- paying the specified RandomCost. Expects to receive a random response
    -- matching callbackId via a subsequent message.
    --
    -- Arguments:
    --   callbackId : Unique identifier for tracking the random request
    ----------------------------------------------------------------------------
    function self.requestRandom(callbackId)
        local send = ao.send({
            Target = self.PaymentToken,
            Action = "Transfer",
            Recipient = self.RandomProcess,
            Quantity = self.RandomCost,
            ["X-CallbackId"] = callbackId
        })
        return send
    end

 ----------------------------------------------------------------------------
    -- requestRandomFromProviders(callbackId)
    -- Similar to requestRandom(), but uses an explicit list of providers.
    -- This instructs the RandomProcess to only utilize specified providers 
    -- for entropy generation.
    --
    -- Arguments:
    --   callbackId : Unique identifier for tracking the random request
    ----------------------------------------------------------------------------
    function self.requestRandomFromProviders(callbackId)
        local send = ao.send({
            Target = self.PaymentToken,
            Action = "Transfer",
            Recipient = self.RandomProcess,
            Quantity = self.RandomCost,
            ["X-Providers"] = self.Providers,
            ["X-CallbackId"] = callbackId
        })
        return send
    end

    ----------------------------------------------------------------------------
    -- processRandomResponse(from, data)
    -- Validates the source process of the random response and extracts the
    -- callbackId and entropy from the data payload.
    --
    -- Arguments:
    --   from : The process ID from which this message arrived
    --   data : Table containing "callbackId" and "entropy"
    --
    -- Returns:
    --   callbackId (string), entropy (number)
    ----------------------------------------------------------------------------
    function self.processRandomResponse(from, data)
        assert(self.isRandomProcess(from), "Failure: message is not from RandomProcess")

        local callbackId = data["callbackId"]
        local entropy    = tonumber(data["entropy"])
        return callbackId, entropy
    end

    ----------------------------------------------------------------------------
    -- viewRandomStatus(callbackId)
    -- Queries the RandomProcess to check the status of a random request
    -- identified by callbackId, and prints the result.
    --
    -- Arguments:
    --   callbackId : Unique identifier of the random request to check
    --
    -- Returns:
    --   The status data returned by the random process
    ----------------------------------------------------------------------------
    function self.viewRandomStatus(callbackId)
        -- utilizies the receive functionality to await for a response to the query
        local results = ao.send({
            Target = self.RandomProcess,
            Action = "Get-Random-Request-Via-Callback-Id",
            Data = callbackId
        }).receive().Data
        print("Results: " .. tostring(results))
        return results
    end
    
    self.initialize()
        
    -- Return the table so the module can be used
    return self
end

return RandomModule
end
end

do
local _ENV = _ENV
package.preload[ "libs.strategy" ] = function( ... ) local arg = _G.arg;
---@diagnostic disable: undefined-global
local constants = require('libs.constants')
local utils = require('utils.utils')
local enums = require('libs.enums')
local permaswap = require('libs.permaswap')
local botega = require('libs.botega')
local json = require('json')

local mod = {}

-- Choose DEX and pool for a given tokenOut and amount (used by staged LP flow)
function mod.getBaseTokenId()
    return BaseToken or constants.AO_PROCESS_ID
end

-- Validate that a pool contains the expected base and out tokens for the given dex
function mod.validatePoolPair(dex, poolId, baseToken, outToken)
    if not dex or not baseToken or not outToken then return false, "Missing params" end
    if dex == enums.DexType.PERMASWAP then
        local pid = poolId or constants.PERMASWAP_POOL_IDS[outToken]
        if not pid then return false, "No Permaswap pool mapping for out token" end
        local out1 = permaswap.getExpectedOutput(pid, baseToken, "1") or { amountOut = "0" }
        local out2 = permaswap.getExpectedOutput(pid, outToken, "1") or { amountOut = "0" }
        if utils.isZero(out1.amountOut) or utils.isZero(out2.amountOut) then
            return false, "Tokens not supported by Permaswap pool"
        end
        return true
    elseif dex == enums.DexType.BOTEGA then
        local pid = poolId or constants.BOTEGA_POOL_IDS[outToken]
        if not pid then return false, "No Botega pool mapping for out token" end
        local out1 = botega.getExpectedOutput(pid, baseToken, "1") or { amountOut = "0" }
        local out2 = botega.getExpectedOutput(pid, outToken, "1") or { amountOut = "0" }
        if utils.isZero(out1.amountOut) or utils.isZero(out2.amountOut) then
            return false, "Tokens not supported by Botega pool"
        end
        return true
    else
        -- AUTO: validate that at least one mapped pool supports both tokens
        if poolId then
            return false, "Cannot validate AUTO with explicit Pool-Id; specify Dex"
        end
        local permaPid = constants.PERMASWAP_POOL_IDS[outToken]
        local botePid = constants.BOTEGA_POOL_IDS[outToken]
        local permaOk = false
        local boteOk = false
        if permaPid then
            local a = permaswap.getExpectedOutput(permaPid, baseToken, "1") or { amountOut = "0" }
            local b = permaswap.getExpectedOutput(permaPid, outToken, "1") or { amountOut = "0" }
            permaOk = (not utils.isZero(a.amountOut)) and (not utils.isZero(b.amountOut))
        end
        if botePid then
            local a = botega.getExpectedOutput(botePid, baseToken, "1") or { amountOut = "0" }
            local b = botega.getExpectedOutput(botePid, outToken, "1") or { amountOut = "0" }
            boteOk = (not utils.isZero(a.amountOut)) and (not utils.isZero(b.amountOut))
        end
        if permaOk or boteOk then return true end
        return false, "No valid pools found for AUTO mode"
    end
end

function mod.chooseDexAndPool(tokenOutId, swapAmount)
    local dex = Dex or enums.DexType.AUTO
    local chosenDex = dex
    local poolId = nil

    if dex == enums.DexType.AUTO then
        local permaPool = constants.PERMASWAP_POOL_IDS[tokenOutId]
        local botePool = constants.BOTEGA_POOL_IDS[tokenOutId]
        local permaOut = { amountOut = "0" }
        local boteOut = { amountOut = "0" }
        local base = mod.getBaseTokenId()
        if permaPool then
            permaOut = permaswap.getExpectedOutput(permaPool, base, swapAmount)
        end
        if botePool then
            boteOut = botega.getExpectedOutput(botePool, base, swapAmount)
        end
        if utils.gt(permaOut.amountOut, boteOut.amountOut) then
            chosenDex = enums.DexType.PERMASWAP
        else
            chosenDex = enums.DexType.BOTEGA
        end
    end

    if dex == enums.DexType.PERMASWAP then
        poolId = PoolIdOverride or constants.PERMASWAP_POOL_IDS[tokenOutId]
    elseif dex == enums.DexType.BOTEGA then
        poolId = PoolIdOverride or constants.BOTEGA_POOL_IDS[tokenOutId]
    else
        if chosenDex == enums.DexType.PERMASWAP then
            poolId = constants.PERMASWAP_POOL_IDS[tokenOutId]
        elseif chosenDex == enums.DexType.BOTEGA then
            poolId = constants.BOTEGA_POOL_IDS[tokenOutId]
        end
    end
    -- Respect explicit PoolIdOverride even in AUTO mode after choosing a dex
    if PoolIdOverride then
        -- Try to infer dex from known mappings to avoid mismatches
        if PoolIdOverride == constants.PERMASWAP_POOL_IDS[tokenOutId] then
            chosenDex = enums.DexType.PERMASWAP
        elseif PoolIdOverride == constants.BOTEGA_POOL_IDS[tokenOutId] then
            chosenDex = enums.DexType.BOTEGA
        end
        poolId = PoolIdOverride
    end

    return chosenDex, poolId
end

-- Fire-and-forget swap trigger; rely on later Credit-Notice for TokenOut
function mod.triggerSwapFireAndForget(dex, poolId, tokenOutId, swapAmount)
    if utils.isZero(swapAmount) then return end
    local base = mod.getBaseTokenId()
    if dex == enums.DexType.PERMASWAP then
        if not poolId then return end
        local out = permaswap.getExpectedOutput(poolId, base, swapAmount)
        -- Update stats using expected minimum output
        TotalSwaps = (TotalSwaps or 0) + 1
        local minOut = tostring(out.expectedMinOutput)
        TotalBought[tokenOutId] = utils.add(TotalBought[tokenOutId] or "0", minOut)
        local order = permaswap.requestOrder(poolId, base, tokenOutId, tostring(swapAmount), out.expectedMinOutput)
        if order and order.NoteID and order.NoteSettle then
            ao.send({
                Target = base,
                Action = "Transfer",
                Recipient = order.NoteSettle,
                Quantity = tostring(swapAmount),
                ["X-FFP-For"] = "Settle",
                ["X-FFP-NoteIDs"] = json.encode({ order.NoteID })
            })
        end
        return
    end
    if dex == enums.DexType.BOTEGA then
        if not poolId then return end
        local out = botega.getExpectedOutput(poolId, base, swapAmount)
        -- Update stats using expected minimum output
        TotalSwaps = (TotalSwaps or 0) + 1
        local minOut = tostring(out.expectedMinOutput)
        TotalBought[tokenOutId] = utils.add(TotalBought[tokenOutId] or "0", minOut)
        ao.send({
            Target = base,
            Action = "Transfer",
            Recipient = poolId,
            Quantity = tostring(swapAmount),
            ["X-Expected-Min-Output"] = tostring(out.expectedMinOutput),
            ["X-Swap-Nonce"] = botega.getSwapNonce(),
            ["X-Action"] = "Swap"
        })
        return
    end
end

-- Send a token to pool appropriately for LP depending on dex
function mod.lpSendTokenToPool(dex, poolId, tokenId, quantity, amountA, amountB)
    print("LP Send Token To Pool " .. dex .. " " .. poolId .. " " .. tokenId .. " " .. quantity .. " " .. amountA .. " " .. amountB)
    if not poolId or not tokenId or utils.isZero(quantity) then return end
    if dex == enums.DexType.BOTEGA then
        print("LP Send Token To Pool Botega")
        local sendMsg = {
            Target = tokenId,
            Action = "Transfer",
            Recipient = poolId,
            Quantity = tostring(quantity),
            ["X-Action"] = "Provide",
        }
        -- Include slippage tolerance only when providing the base token
        if tokenId == mod.getBaseTokenId() then
            sendMsg["X-Slippage-Tolerance"] = tostring(Slippage or 0.5)
        end
        ao.send(sendMsg)
        return
    end
    if dex == enums.DexType.PERMASWAP then
        print("LP Send Token To Pool Permaswap")
        ao.send({
            Target = tokenId,
            Action = "Transfer",
            Recipient = poolId,
            Quantity = tostring(quantity),
            ["X-PS-For"] = "LP",
            ["X-Amount-A"] = tostring(amountA or "0"),
            ["X-Amount-B"] = tostring(amountB or "0"),
        })
        return
    end
end

-- Add liquidity call for permaswap after deposits
function mod.lpAddLiquidityPermaswap(poolId, amountA, amountB)
    if not poolId then return end
    ao.send({
        Target = poolId,
        Action = "AddLiquidity",
        MinLiquidity = "1",
        ["X-Amount-A"] = tostring(amountA or "0"),
        ["X-Amount-B"] = tostring(amountB or "0")
    })
end

-- Get strategy statistics
function mod.getStrategyStats()
    return {
        totalTransactions = TotalTransactions or 0,
        totalAOSold = TotalAOSold or "0",
        totalSwaps = TotalSwaps or 0,
        totalSwapValue = TotalSwapValue or "0",
        totalLPs = TotalLPs or 0,
        totalLPValue = TotalLPValue or "0",
        totalBought = TotalBought or {},
        strategyType = enums.StrategyType.SWAP_50_LP_50
    }
end

return mod
end
end

do
local _ENV = _ENV
package.preload[ "libs.token" ] = function( ... ) local arg = _G.arg;
---@diagnostic disable: undefined-global
local constants = require('libs.constants')
local utils = require('utils.utils')

local mod = {}

-- Get balance for a token
function mod.getBalance(tokenId)
    local result = ao.send({ Target = tokenId, Action = "Balance" }).receive()
    return result.Tags.Balance or "0"
end

-- Get Base token balance (defaults to AO if BaseToken not set)
function mod.getBaseBalance()
    local base = BaseToken or constants.AO_PROCESS_ID
    return mod.getBalance(base)
end

--  AO balance
function mod.getAOBalance()
    return mod.getBalance(constants.AO_PROCESS_ID)
end

-- Transfer tokens back to owner
function mod.transferToSelf(tokenId, quantity)
    ao.send({
        Target = tokenId,
        Action = "Transfer",
        Recipient = AgentOwner,
        Quantity = quantity
    })
end

-- Transfer all remaining balances to owner
function mod.transferRemainingBalanceToSelf()
    -- Build a unique list of token IDs to return balances for
    local toCheck = {}
    local seen = {}

    local function addToken(id)
        if id and not seen[id] then
            table.insert(toCheck, id)
            seen[id] = true
        end
    end

    -- Always include AO
    addToken(constants.AO_PROCESS_ID)
    -- Include BaseToken if different from AO
    if BaseToken and BaseToken ~= constants.AO_PROCESS_ID then
        addToken(BaseToken)
    end
    -- Include configured TokenOut when set and not AO
    if TokenOut and TokenOut ~= constants.AO_PROCESS_ID then
        addToken(TokenOut)
    end

    -- Transfer any non-zero balances back to owner
    for _, tokenId in ipairs(toCheck) do
        local balance = mod.getBalance(tokenId)
        if not utils.isZero(balance) then
            mod.transferToSelf(tokenId, balance)
        end
    end
end

return mod
end
end

do
local _ENV = _ENV
package.preload[ "manager" ] = function( ... ) local arg = _G.arg;
ModuleId = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s"

local utils = require('utils.utils')
local enums = require('libs.enums')
local constants = require('libs.constants')
local json = require('json')
local RandomModule = require('libs.random')
local Random = RandomModule(json)
local ApusAI = require('@apus/ai')
local evalData = evalData or [[]]

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
        ao.send({Target = spawnedId, Action = "Eval", Data = evalData, Tags = {
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
            ["Eval-Data-Length"] = tostring(string.len(evalData)),
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
        evalData = newEvalData
        
        msg.reply({
            Action = "Set-Eval-Data-Success",
            Data = "Successfully updated eval data",
            ["Data-Length"] = tostring(string.len(evalData))
        })
        
        print("Eval data updated by owner. Length: " .. string.len(evalData) .. " characters")
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
            Data = evalData,
            ["Data-Length"] = tostring(string.len(evalData))
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
end
end

do
local _ENV = _ENV
package.preload[ "utils.utils" ] = function( ... ) local arg = _G.arg;
local enums = require('libs.enums')
local bint = require ".bint"(1024)

local utils = {
    add = function(a, b) return tostring(bint(a) + bint(b)) end,
    subtract = function(a, b) return tostring(bint(a) - bint(b)) end,
    mul = function(a, b) return tostring(bint.__mul(bint(a), bint(b))) end,
    div = function(a, b) return tostring(bint.udiv(bint(a), bint(b))) end,
    lt = function(a, b) return bint.__lt(bint(a), bint(b)) end,
    lte = function(a, b) return bint.__lt(bint(a), bint(b)) or bint.__eq(bint(a), bint(b)) end,
    gt = function(a, b) return bint.__lt(bint(b), bint(a)) end,
    gte = function(a, b) return bint.__lt(bint(b), bint(a)) or bint.__eq(bint(b), bint(a)) end,
    isZero = function(a) return bint.__eq(bint(a), bint("0")) end,
    isEqual = function(a, b) return bint.__eq(bint(a), bint(b)) end
}

-- Address validation
function utils.isAddress(addr)
    if type(addr) ~= "string" then return false end
    if string.len(addr) ~= 43 then return false end
    if string.match(addr, "^[A-z0-9_-]+$") == nil then return false end
    return true
end

-- Number validation
function utils.isValidNumber(val)
    return type(val) == "number" and val == val and val ~= math.huge and val ~= -math.huge
end

function utils.isValidInteger(val)
    return utils.isValidNumber(val) and val % 1 == 0
end

function utils.isBintRaw(val)
    local success, result = pcall(function()
        if type(val) ~= "number" and type(val) ~= "string" and not bint.isbint(val) then return false end
        if type(val) == "number" and not utils.isValidInteger(val) then return false end
        return true
    end)
    return success and result
end

-- Token quantity validation
function utils.isTokenQuantity(qty)
    local numVal = tonumber(qty)
    if not numVal or numVal <= 0 then return false end
    if not utils.isBintRaw(qty) then return false end
    if type(qty) == "number" and qty < 0 then return false end
    if type(qty) == "string" and string.sub(qty, 1, 1) == "-" then return false end
    return true
end

-- Percentage validation
function utils.isPercentage(val)
    if not val or type(val) ~= "number" then return false end
    return val // 1 == val and val >= 0 and val <= 100
end

-- DEX validation
function utils.isValidDex(val)
    return val == enums.DexType.PERMASWAP or
           val == enums.DexType.BOTEGA or
           val == enums.DexType.AUTO
end

-- Slippage validation
function utils.isValidSlippage(val)
    if not val or type(val) ~= "number" then return false end
    return val // 1 == val and val >= 0.5 and val <= 10
end

-- Running time validation
function utils.isValidRunningTime(startDate, endDate)
    if not startDate or not endDate then return false end
    return startDate <= endDate
end

-- Boolean validation
function utils.isValidBoolean(val)
    return val == "true" or val == "false"
end

-- Status validation
function utils.isValidStatus(val)
    return val == enums.AgentStatus.ACTIVE or
           val == enums.AgentStatus.PAUSED or
           val == enums.AgentStatus.COMPLETED or
           val == enums.AgentStatus.CANCELLED
end

-- Agent version validation
function utils.isValidAgentVersion(version)
    if not version or type(version) ~= "string" then return false end
    local major, minor, patch = version:match("^(%d+)%.(%d+)%.(%d+)$")
    if not major then return false end
    major = tonumber(major)
    minor = tonumber(minor)
    patch = tonumber(patch)
    if not major or not minor or not patch then return false end
    if major < 0 or minor < 0 or patch < 0 then return false end
    return true
end

-- Strategy validation
function utils.isValidStrategy(val)
    return val == enums.StrategyType.SWAP_50_LP_50 or
           val == enums.StrategyType.CUSTOM
end

-- Check if end date has been reached
function utils.hasReachedEndDate()
    if not EndDate then return false end
    local currentTime = os.time()
    local processedOrSwapped = (ProcessedUpToDate or SwappedUpToDate or 0)
    return currentTime >= EndDate and currentTime >= processedOrSwapped
end

-- Check if the current time is within the configured active window
function utils.isWithinActiveWindow(now)
    local t = now or os.time()
    -- If running indefinitely, only require start date reached
    if RunIndefinitely then
        return t >= StartDate
    end
    if not StartDate or not EndDate then return false end
    return t >= StartDate and t <= EndDate
end

-- Split quantity into two parts based on percentage
function utils.splitQuantity(quantity, percentage)
    local qty = bint(quantity)
    local splitAmount = bint.udiv(bint.__mul(qty, bint(percentage)), bint(100))
    local remainder = bint.__sub(qty, splitAmount)
    return tostring(splitAmount), tostring(remainder)
end

-- Calculate minimum output after slippage
function utils.calculateMinOutput(amount, slippagePercent)
    local adjustedSlippage = math.floor(slippagePercent * 100)
    return utils.div(utils.mul(amount, utils.subtract(10000, adjustedSlippage)), 10000)
end

return utils
end
end

---@diagnostic disable: undefined-global
-- Yield LP Agent
-- A modular agent that implements a 50% swap + 50% liquidity provision strategy
-- Author: Ikem (x.com/ikempeter3) - YAO TEAM

-- Load modules
local constants = require('libs.constants')
local utils = require('utils.utils')
local enums = require('libs.enums')
local token = require('libs.token')
local strategy = require('libs.strategy')
local assertions = require('libs.assertions')
local json = require('json')
local apus_agent = require('apus_agent')

-- Agent State
Status = Status or enums.AgentStatus.ACTIVE
Dex = Dex or ao.env.Process.Tags["Dex"] or enums.DexType.BOTEGA
TokenOut = TokenOut or ao.env.Process.Tags["Token-Out"] or constants.GAME_PROCESS_ID
Slippage = Slippage or tonumber(ao.env.Process.Tags["Slippage"]) or constants.DEFAULT_SLIPPAGE
StartDate = StartDate or tonumber(ao.env.Process.Tags["Start-Date"]) or os.time()
EndDate = EndDate or tonumber(ao.env.Process.Tags["End-Date"]) or math.huge
RunIndefinitely = RunIndefinitely or ao.env.Process.Tags["Run-Indefinitely"] == "true"
ConversionPercentage = ConversionPercentage or tonumber(ao.env.Process.Tags["Conversion-Percentage"]) or 50
StrategyType = StrategyType or ao.env.Process.Tags["Strategy-Type"] or enums.StrategyType.SWAP_50_LP_50
BaseToken = BaseToken or ao.env.Process.Tags["Base-Token"] or constants.AO_PROCESS_ID
PoolIdOverride = PoolIdOverride or ao.env.Process.Tags["Pool-Id"]

-- Statistics
TotalTransactions = TotalTransactions or 0
TotalAOSold = TotalAOSold or "0"
TotalSwaps = TotalSwaps or 0
TotalSwapValue = TotalSwapValue or "0"
TotalLPs = TotalLPs or 0
TotalLPValue = TotalLPValue or "0"
TotalLPTransactions = TotalLPTransactions or 0
TotalLPTokens = TotalLPTokens or "0"
TotalBought = TotalBought or {}
ProcessedUpToDate = ProcessedUpToDate or nil
SwapInProgress = SwapInProgress or false
SwappedUpToDate = SwappedUpToDate or nil
FeeProcessId = FeeProcessId or constants.FEE_PROCESS_ID
AgentVersion = AgentVersion or ao.env.Process.Tags["Agent-Version"] or constants.AGENT_VERSION

-- User info
AgentOwner = AgentOwner or ao.env.Process.Tags["Agent-Owner"]

-- Staged LP flow state (Credit/Debit driven)
LPFlowActive = LPFlowActive or false
LPFlowState = LPFlowState or nil -- enums.LPFlowState
LPFlowDex = LPFlowDex or nil     -- enums.DexType
LPFlowTokenOutId = LPFlowTokenOutId or nil
LPFlowPoolId = LPFlowPoolId or nil
LPFlowAoAmount = LPFlowAoAmount or nil             -- string
LPFlowTokenOutAmount = LPFlowTokenOutAmount or nil -- string
LPFlowPending = LPFlowPending or false             -- when true, start a new flow after current completes

-- Staged LP helpers moved to libs/strategy.lua to avoid duplication

-- Local helper: initiate staged swap+LP flow given current AO balance
local function initiateStagedFlow(msg, tokenOutId)
    local totalAmount = token.getBaseBalance()
    if utils.isZero(totalAmount) then
        SwapInProgress = false
        return false
    end

    local swapAmount, aoForLP = utils.splitQuantity(totalAmount, ConversionPercentage or constants.SWAP_PERCENTAGE)
    local chosenDex, poolId = strategy.chooseDexAndPool(tokenOutId, swapAmount)

    -- Fire-and-forget swap; rely on TokenOut credit notice later
    print("triggerSwapFireAndForget: " .. chosenDex .. " " .. poolId .. " " .. tokenOutId .. " " .. swapAmount)
    strategy.triggerSwapFireAndForget(chosenDex, poolId, tokenOutId, swapAmount)

    -- Stage LP flow
    LPFlowActive = true
    LPFlowState = enums.LPFlowState.AWAIT_TOKEN_OUT_CREDIT
    LPFlowDex = chosenDex
    LPFlowTokenOutId = tokenOutId
    LPFlowPoolId = poolId
    LPFlowAoAmount = tostring(aoForLP)
    LPFlowTokenOutAmount = nil

    ProcessedUpToDate = tonumber(msg and msg.Tags and msg.Tags["X-Swap-Date-To"]) or os.time()
    return true
end

-- Info handler
Handlers.add("Info", "Info",
    function(msg)
        local strategyStats = strategy.getStrategyStats()

        msg.reply({
            Action = "Info-Response",
            ["Start-Date"] = tostring(StartDate),
            ["End-Date"] = tostring(EndDate),
            Dex = Dex,
            ["Token-Out"] = TokenOut,
            ["Base-Token"] = BaseToken or constants.AO_PROCESS_ID,
            ["Pool-Id"] = PoolIdOverride or "",
            Slippage = tostring(Slippage),
            Status = Status,
            ["Run-Indefinitely"] = tostring(RunIndefinitely),
            ["Conversion-Percentage"] = tostring(ConversionPercentage),
            ["Strategy-Type"] = StrategyType,
            ["Agent-Version"] = AgentVersion,
            ["Total-Transactions"] = tostring(strategyStats.totalTransactions),
            ["Total-AO-Sold"] = tostring(strategyStats.totalAOSold),
            ["Total-Swaps"] = tostring(strategyStats.totalSwaps),
            ["Total-Swap-Value"] = tostring(strategyStats.totalSwapValue),
            ["Total-LPs"] = tostring(strategyStats.totalLPs),
            ["Total-LP-Value"] = tostring(strategyStats.totalLPValue),
            ["Total-LP-Transactions"] = tostring(TotalLPTransactions),
            ["Total-LP-Tokens"] = tostring(TotalLPTokens),
            ["Total-Bought"] = json.encode(strategyStats.totalBought),
            ["Swap-In-Progress"] = tostring(SwapInProgress),
            ["Processed-Up-To-Date"] = tostring(ProcessedUpToDate),
            ["Swapped-Up-To-Date"] = tostring(SwappedUpToDate),
            ["LP-Flow-Active"] = tostring(LPFlowActive),
            ["LP-Flow-State"] = tostring(LPFlowState),
        })
    end
)

-- Update agent configuration
Handlers.add("Update-Agent", "Update-Agent",
    function(msg)
        assertions.checkWalletForPermission(msg)
        assertions.isAgentActive()

        -- Stage potential updates for Dex/TokenOut/BaseToken/PoolId for validation
        local desiredDex = Dex
        if utils.isValidDex(msg.Tags.Dex) then desiredDex = msg.Tags.Dex end

        -- Update slippage
        if utils.isValidSlippage(tonumber(msg.Tags.Slippage)) then
            Slippage = tonumber(msg.Tags.Slippage)
        end

        -- Update running time
        if utils.isValidRunningTime(tonumber(msg.Tags["Start-Date"]), tonumber(msg.Tags["End-Date"])) then
            StartDate = tonumber(msg.Tags["Start-Date"])
            EndDate = tonumber(msg.Tags["End-Date"])
        end

        -- Stage Token-Out
        local desiredTokenOut = TokenOut
        if utils.isAddress(msg.Tags["Token-Out"]) then desiredTokenOut = msg.Tags["Token-Out"] end

        -- Update run indefinitely
        if utils.isValidBoolean(msg.Tags["Run-Indefinitely"]) then
            RunIndefinitely = msg.Tags["Run-Indefinitely"] == "true"
        end

        -- Update conversion percentage
        if utils.isPercentage(tonumber(msg.Tags["Conversion-Percentage"])) then
            ConversionPercentage = tonumber(msg.Tags["Conversion-Percentage"])
        end

        -- Update strategy type
        if utils.isValidStrategy(msg.Tags["Strategy-Type"]) then
            StrategyType = msg.Tags["Strategy-Type"]
        end

        -- Stage Base-Token and Pool-Id overrides
        local desiredBase = BaseToken or constants.AO_PROCESS_ID
        if utils.isAddress(msg.Tags["Base-Token"]) then desiredBase = msg.Tags["Base-Token"] end

        local desiredPool = PoolIdOverride
        if utils.isAddress(msg.Tags["Pool-Id"]) then desiredPool = msg.Tags["Pool-Id"] end

        -- If any of Dex/TokenOut/Base-Token/Pool-Id provided, validate pair/pool
        local needsValidation = (msg.Tags.Dex ~= nil) or (msg.Tags["Token-Out"] ~= nil) or
        (msg.Tags["Base-Token"] ~= nil) or (msg.Tags["Pool-Id"] ~= nil)
        if needsValidation then
            local ok, err = strategy.validatePoolPair(desiredDex, desiredPool, desiredBase or constants.AO_PROCESS_ID,
                desiredTokenOut)
            if not ok then
                msg.reply({ Action = "Update-Failed", Error = tostring(err or "Validation failed") })
                return
            end
            -- Commit validated updates
            Dex = desiredDex
            TokenOut = desiredTokenOut
            BaseToken = desiredBase
            PoolIdOverride = desiredPool
        end

        -- Update status
        if utils.isValidStatus(msg.Tags.Status) then
            Status = msg.Tags.Status
            if Status == enums.AgentStatus.COMPLETED or Status == enums.AgentStatus.CANCELLED then
                ao.send({ Target = ao.id, Action = "Finalize-Agent" })
            end
        end

        -- Update agent version
        if utils.isValidAgentVersion(msg.Tags["Agent-Version"]) then
            AgentVersion = msg.Tags["Agent-Version"]
        end

        msg.reply({
            Action = "Update-Success",
            Data = "Agent configuration updated successfully"
        })
    end
)

-- Execute strategy
Handlers.add("Execute-Strategy", "Execute-Strategy",
    function(msg)
        assertions.checkWalletForPermission(msg, "Wallet does not have permission to execute strategy")
        assertions.isAgentActive()

        if SwapInProgress or LPFlowActive then
            -- Queue next run
            LPFlowPending = true
            msg.reply({ Action = "Strategy-Queued", Data = "Staged flow in progress; next run queued" })
            return
        end

        local now = os.time()
        if not utils.isWithinActiveWindow(now) then
            -- Return any held tokens to owner and inform caller
            token.transferRemainingBalanceToSelf()
            msg.reply({
                Action = "Strategy-Skipped-Time-Window",
                Data = "Strategy not executed: outside active time window",
                ["Start-Date"] = tostring(StartDate),
                ["End-Date"] = tostring(EndDate),
                ["Run-Indefinitely"] = tostring(RunIndefinitely),
                ["Current-Time"] = tostring(now)
            })
            return
        end

        -- Trigger staged flow
        SwapInProgress = true
        local tokenOutId = msg.Tags["Token-Out"] or TokenOut
        initiateStagedFlow(msg, tokenOutId)
    end
)

-- Credit notice handler - triggers strategy execution and handles LP tokens
Handlers.add("Credit-Notice", "Credit-Notice",
    function(msg)
        local tokenId = msg.From or msg.Tags["From-Process"]
        local quantity = msg.Tags.Quantity
        -- Base token credit: trigger swap only and stage LP
        local base = strategy.getBaseTokenId()
        if tokenId == base and not utils.isZero(quantity) then
            -- Detect refunds from DEX/pools to avoid auto-restarting the flow
            local sender = msg.Tags.Sender
            local knownPerma = constants.PERMASWAP_POOL_IDS[TokenOut]
            local knownBote = constants.BOTEGA_POOL_IDS[TokenOut]
            local isRefund = (msg.Tags["X-FFP-For"] == "Refund")
                or (msg.Tags["X-Refunded-Order"] ~= nil)
                or (sender and (sender == (LPFlowPoolId or "") or sender == (knownPerma or "") or sender == (knownBote or "")))

            if isRefund then
                -- Stop current flow to prevent retry loops
                SwapInProgress = false
                LPFlowActive = false
                LPFlowState = nil
                LPFlowPending = false
                ao.send({
                    Target = AgentOwner,
                    Action = "Refund-Detected",
                    Data = "Refund received; halting auto-restart",
                    Tags = {
                        Sender = tostring(sender),
                        Quantity = tostring(quantity),
                        ["X-FFP-For"] = tostring(msg.Tags["X-FFP-For"]),
                        ["X-Refunded-Order"] = tostring(msg.Tags["X-Refunded-Order"])
                    }
                })
                return
            end
            -- If outside active window, immediately return credited amount and notify
            local now = os.time()
            if not utils.isWithinActiveWindow(now) then
                token.transferToSelf(base, quantity)
                ao.send({
                    Target = AgentOwner,
                    Action = "Strategy-Skipped-Time-Window",
                    Data = "Base token credit received but outside active time window; returned funds to owner",
                    Tags = {
                        ["Start-Date"] = tostring(StartDate),
                        ["End-Date"] = tostring(EndDate),
                        ["Run-Indefinitely"] = tostring(RunIndefinitely),
                        ["Current-Time"] = tostring(now),
                        ["Returned-Token"] = tokenId,
                        ["Returned-Quantity"] = tostring(quantity)
                    }
                })
                return
            end

            if SwapInProgress or LPFlowActive then
                -- Record pending so we auto-run after finishing current flow
                if not LPFlowPending then LPFlowPending = true end
                print("Staged flow in progress; marked pending for next run")
                return
            end

            SwapInProgress = true
            initiateStagedFlow(msg, TokenOut)
            return
        end

        -- TokenOut credit: when swap delivers TokenOut, push it to pool (persist amount; fallback to current balance if Quantity missing)
        if LPFlowActive and LPFlowState == enums.LPFlowState.AWAIT_TOKEN_OUT_CREDIT and tokenId == LPFlowTokenOutId then
            local resolvedQty = quantity
            if (not resolvedQty or utils.isZero(resolvedQty)) and LPFlowTokenOutId then
                local bal = token.getBalance(LPFlowTokenOutId)
                if not utils.isZero(bal) then
                    resolvedQty = bal
                end
            end

            if not resolvedQty or utils.isZero(resolvedQty) then
                -- Nothing to do yet; keep waiting
                return
            end

            ao.send({ Target = AgentOwner, Action = "Swap-Completed", Data = "Swap completed: tokenOut=" .. tostring(LPFlowTokenOutId) .. ", qty=" .. tostring(resolvedQty) })
            LPFlowTokenOutAmount = resolvedQty
            print("lpSendTokenToPool: " .. tostring(LPFlowTokenOutId) .. " " .. tostring(resolvedQty) .. " " .. tostring(LPFlowAoAmount) .. " " .. tostring(resolvedQty))
            strategy.lpSendTokenToPool(LPFlowDex, LPFlowPoolId, LPFlowTokenOutId, resolvedQty, LPFlowAoAmount, resolvedQty)
            LPFlowState = enums.LPFlowState.TOKEN_OUT_SENT
            return
        end

        -- Any other credits: sweep to owner for accounting (ignore TokenOut which we may await)
        if tokenId ~= TokenOut then
            print("transferToSelf (non-flow credit): " .. tostring(tokenId) .. " " .. tostring(quantity))
            token.transferToSelf(tokenId, quantity)
            return
        end
    end
)

Handlers.add("Debit-Notice", "Debit-Notice",
    function(msg)
        local tokenId = msg.From or msg.Tags["From-Process"]
        local quantity = msg.Tags.Quantity

        -- When our TokenOut transfer is debited, resolve amounts and send Base; for permaswap then AddLiquidity
        if LPFlowActive and LPFlowState == enums.LPFlowState.TOKEN_OUT_SENT and tokenId == LPFlowTokenOutId then
            -- Ensure TokenOut amount is available (fallback to current balance)
            local tokenOutAmt = LPFlowTokenOutAmount
            if (not tokenOutAmt or utils.isZero(tokenOutAmt)) and LPFlowTokenOutId then
                local bal = token.getBalance(LPFlowTokenOutId)
                if not utils.isZero(bal) then
                    tokenOutAmt = bal
                    LPFlowTokenOutAmount = tokenOutAmt
                end
            end

            local base = strategy.getBaseTokenId()
            local amountA = LPFlowAoAmount
            local amountB = tokenOutAmt

            if LPFlowDex == enums.DexType.BOTEGA then
                strategy.lpSendTokenToPool(LPFlowDex, LPFlowPoolId, base, amountA, amountA, amountB)
            elseif LPFlowDex == enums.DexType.PERMASWAP then
                strategy.lpSendTokenToPool(LPFlowDex, LPFlowPoolId, base, amountA, amountA, amountB)
                strategy.lpAddLiquidityPermaswap(LPFlowPoolId, amountA, amountB)
            end

            LPFlowState = enums.LPFlowState.COMPLETED
            LPFlowActive = false
            SwapInProgress = false

            -- If a run is pending, and we're within window, immediately start a new staged flow
            if LPFlowPending then
                local now = os.time()
                if utils.isWithinActiveWindow(now) then
                    LPFlowPending = false
                    -- Only restart if base balance available
                    if not utils.isZero(token.getBaseBalance()) then
                        SwapInProgress = true
                        initiateStagedFlow(nil, TokenOut)
                    end
                end
            end
        end
    end
)

-- Force-continue staged LP flow
Handlers.add("Force-Continue", "Force-Continue",
    function(msg)
        assertions.checkWalletForPermission(msg, "Wallet does not have permission to force-continue")

        -- If there is no active flow, try to start a new one if pending or balances available
        if not LPFlowActive then
            SwapInProgress = false
            msg.reply({ Action = "Force-Continue-Started-New", Data = "No active flow and no available balance/window" })
            return
        end

        -- There is an active flow: advance by current state
        if LPFlowState == enums.LPFlowState.AWAIT_TOKEN_OUT_CREDIT then
            -- If TokenOut was already credited (but notice missed), push it to the pool now
            if not LPFlowTokenOutId then
                msg.reply({ Action = "Force-Continue-Error", Error = "TokenOutId missing for active flow" })
                return
            end
            local outBal = token.getBalance(LPFlowTokenOutId)
            if utils.isZero(outBal) and (not LPFlowTokenOutAmount or utils.isZero(LPFlowTokenOutAmount)) then
                msg.reply({ Action = "Force-Continue-Wait", Data = "TokenOut not credited yet" })
                return
            end

            local qty = (LPFlowTokenOutAmount and not utils.isZero(LPFlowTokenOutAmount)) and LPFlowTokenOutAmount or outBal
            LPFlowTokenOutAmount = qty
            strategy.lpSendTokenToPool(LPFlowDex, LPFlowPoolId, LPFlowTokenOutId, qty, LPFlowAoAmount, qty)
            LPFlowState = enums.LPFlowState.TOKEN_OUT_SENT
            msg.reply({ Action = "Force-Continue-Advanced", State = tostring(LPFlowState) })
            return
        end
        if LPFlowState == enums.LPFlowState.TOKEN_OUT_SENT then
            -- Send Base token now and finalize per dex rules
            local base = strategy.getBaseTokenId()
            strategy.lpSendTokenToPool(LPFlowDex, LPFlowPoolId, base, LPFlowAoAmount, LPFlowAoAmount, LPFlowTokenOutAmount)

            if LPFlowDex == enums.DexType.PERMASWAP then
                strategy.lpAddLiquidityPermaswap(LPFlowPoolId, LPFlowAoAmount, LPFlowTokenOutAmount)
            end

            LPFlowState = enums.LPFlowState.COMPLETED
            LPFlowActive = false
            SwapInProgress = false

            -- Auto-start pending if requested and within window
            if LPFlowPending and utils.isWithinActiveWindow(os.time()) then
                LPFlowPending = false
                if not utils.isZero(token.getBaseBalance()) then
                    SwapInProgress = true
                    initiateStagedFlow(nil, TokenOut)
                end
            end

            msg.reply({ Action = "Force-Continue-Advanced", State = tostring(LPFlowState) })
            return
        end
        if LPFlowState == enums.LPFlowState.COMPLETED then
            -- Completed but still marked active? Clean up and optionally start pending
            LPFlowActive = false
            SwapInProgress = false
            if LPFlowPending and utils.isWithinActiveWindow(os.time()) then
                LPFlowPending = false
                SwapInProgress = true
                msg.reply({ Action = "Force-Continue-Restarted", State = tostring(LPFlowState) })
            else
                msg.reply({ Action = "Force-Continue-No-Op", Data = "Flow already completed" })
            end
            return
        end
        msg.reply({ Action = "Force-Continue-Error", Error = "Unknown LP flow state" })
    end
)

-- Withdraw tokens
Handlers.add("Withdraw", "Withdraw",
    function(msg)
        assertions.checkWalletForPermission(msg, "Wallet does not have permission to withdraw")

        local tokenId = msg.Tags["Token-Id"]
        local quantity = msg.Tags["Quantity"]
        local all = msg.Tags["Transfer-All"]

        assertions.isAddress("Token-Id", tokenId)

        if all then
            local balance = token.getBalance(tokenId)
            token.transferToSelf(tokenId, balance)
        else
            assertions.isTokenQuantity("Quantity", quantity)
            token.transferToSelf(tokenId, quantity)
        end

        msg.reply({
            Action = "Withdraw-Success",
            Data = "Withdrawal completed successfully"
        })
    end
)

-- Finalize agent
Handlers.add("Finalize-Agent", "Finalize-Agent",
    function(msg)
        assertions.checkWalletForPermission(msg, "Wallet does not have permission to finalize the agent")

        -- Transfer remaining balances
        token.transferRemainingBalanceToSelf()

        -- End agent execution
        EndDate = os.time()
        RunIndefinitely = false
        Status = enums.AgentStatus.COMPLETED

        msg.reply({
            Action = "Finalize-Success",
            Data = "Agent finalized successfully"
        })
    end
)

-- Get strategy statistics
Handlers.add("Get-Stats", "Get-Stats",
    function(msg)
        local strategyStats = strategy.getStrategyStats()

        msg.reply({
            Action = "Stats-Response",
            Tags = {
                ["Total-Transactions"] = tostring(strategyStats.totalTransactions),
                ["Total-AO-Sold"] = tostring(strategyStats.totalAOSold),
                ["Total-Swaps"] = tostring(strategyStats.totalSwaps),
                ["Total-Swap-Value"] = tostring(strategyStats.totalSwapValue),
                ["Total-LPs"] = tostring(strategyStats.totalLPs),
                ["Total-LP-Value"] = tostring(strategyStats.totalLPValue),
                ["Total-LP-Transactions"] = tostring(TotalLPTransactions),
                ["Total-LP-Tokens"] = tostring(TotalLPTokens),
                ["Total-Bought"] = json.encode(strategyStats.totalBought)
            }
        })
    end
)

-- LiquidityAdded-Notice handler - handles permaswap LP completion
Handlers.add("LiquidityAdded-Notice", "LiquidityAdded-Notice",
    function(msg)
        local amountLp = msg.Tags.AmountLp or msg.Tags.BalanceLp
        local user = msg.Tags.User
        local poolId = msg.Tags.PoolId

        print("Permaswap LP completed successfully:")
        print("  User: " .. tostring(user))
        print("  Pool: " .. tostring(poolId))
        print("  LP Tokens Minted: " .. tostring(amountLp))

        -- Update LP statistics
        TotalLPTransactions = TotalLPTransactions + 1
        if amountLp then
            TotalLPTokens = utils.add(TotalLPTokens or "0", amountLp)
        end

        msg.reply({
            Action = "LP-Addition-Confirmed",
            User = user,
            PoolId = poolId,
            ["LP-Tokens"] = amountLp
        })
    end
)

-- Provide-Confirmation handler - handles LP completion notifications (Botega)
Handlers.add("Provide-Confirmation", "Provide-Confirmation",
    function(msg)
        local poolTokens = msg.Tags["Received-Pool-Tokens"]
        local provideId = msg.Tags["Provide-Id"]

        print("Botega LP completed successfully:")
        print("  Pool Tokens Received: " .. tostring(poolTokens))
        print("  Provide ID: " .. tostring(provideId))

        -- Update LP statistics
        TotalLPTransactions = TotalLPTransactions + 1
        if poolTokens then
            TotalLPTokens = utils.add(TotalLPTokens or "0", poolTokens)
        end

        msg.reply({
            Action = "LP-Notification-Received",
            ["Provide-Id"] = provideId,
            ["Pool-Tokens"] = poolTokens
        })
    end
)

-- Provider error handler - handles LP provider errors (Botega/Permaswap)
Handlers.add("Provide-Error", "Provide-Error",
    function(msg)
        -- Stop current staged LP flow to prevent loops after provider failures
        LPFlowActive = false
        SwapInProgress = false
        LPFlowPending = false
        LPFlowState = nil

        msg.reply({
            Action = "Provide-Error-Ack",
            Error = tostring(msg.Tags and (msg.Tags.Error or msg.Data) or "Unknown provider error"),
            PoolId = tostring((msg.Tags and msg.Tags.PoolId) or LPFlowPoolId or "")
        })
    end
)

-- Health check
Handlers.add("Health", "Health",
    function(msg)
        msg.reply({
            Action = "Health-Response",
            -- Status = "Healthy",
            ["Agent-Version"] = AgentVersion,
            ["Current-Time"] = tostring(os.time()),
            ["Status"] = Status
        })
    end
)

print("Yield LP Agent initialized with " .. StrategyType .. " strategy")
print("Agent Version: " .. AgentVersion)
print("Status: " .. Status)
print("Token Out: " .. TokenOut)
print("Base Token: " .. (BaseToken or constants.AO_PROCESS_ID))
print("DEX: " .. Dex)
print("Pool Id Override: " .. tostring(PoolIdOverride))
print("owner: " .. AgentOwner)
print("Process ID: " .. ao.id)
