---@diagnostic disable: undefined-global
local constants = require('libs.constants')
local utils = require('utils.utils')

local mod = {}

local function ensureProcess()
    local pid = constants.LIQUIDOPS_PROCESS_ID
    if not pid or pid == '' then
        error('LiquidOps process id not configured')
    end
    return pid
end

local function ensureToken(tokenId)
    if not tokenId or tokenId == '' then
        error('Token process id not provided')
    end
    if not utils.isAddress(tokenId) then
        error('Invalid token process id: ' .. tostring(tokenId))
    end
    return tokenId
end

local function ensureQuantity(quantity)
    if not quantity then
        error('Quantity is required')
    end
    local qty = tostring(quantity)
    if not utils.isTokenQuantity(qty) then
        error('Invalid quantity: ' .. tostring(quantity))
    end
    return qty
end

local function ensureBorrowConfig()
    if not constants.LIQUIDOPS_BORROW_TOKENS then
        error('LiquidOps borrow token map not configured')
    end
    if not constants.LIQUIDOPS_OTOKEN_MAP then
        error('LiquidOps oToken map not configured')
    end
end

local function resolveTokenInput(token)
    ensureBorrowConfig()

    if not token then
        error('Token input is required')
    end

    local tokens = constants.LIQUIDOPS_BORROW_TOKENS
    local oTokens = constants.LIQUIDOPS_OTOKEN_MAP

    local function matchByTicker(ticker)
        return tokens[ticker], oTokens['o' .. ticker]
    end

    local function matchByAddress(address)
        for ticker, tokenAddress in pairs(tokens) do
            if tokenAddress == address then
                return ticker, tokenAddress, oTokens['o' .. ticker]
            end
        end
    end

    if tokens[token] then
        local tokenAddress = tokens[token]
        local oTokenAddress = oTokens['o' .. token]
        if not oTokenAddress then
            error('Missing oToken address for ticker: ' .. tostring(token))
        end
        return token, tokenAddress, oTokenAddress
    end

    local ticker, tokenAddress, oTokenAddress = matchByAddress(token)
    if tokenAddress then
        if not oTokenAddress then
            error('Missing oToken address for ticker: ' .. tostring(ticker))
        end
        return ticker, tokenAddress, oTokenAddress
    end

    for oTicker, address in pairs(constants.LIQUIDOPS_OTOKEN_MAP or {}) do
        if oTicker == token or address == token then
            error('Token input cannot be an oToken ticker or address.')
        end
    end

    error('Token input is not supported: ' .. tostring(token))
end

local function awaitMessage(matchFn, timeoutMs)
    local deadline = os.time() + math.ceil((timeoutMs or 60000) / 1000)
    while true do
        local elapsed = os.time()
        if elapsed > deadline then
            return nil
        end
        local msg = Receive(matchFn)
        if msg then
            return msg
        end
    end
end

local function awaitBorrowConfirmation(referenceId, oTokenAddress)
    return awaitMessage(function(msg)
        if not msg.Tags then return false end
        if msg.From ~= oTokenAddress then return false end
        if msg.Tags.Action ~= 'Borrow-Confirmation' then return false end
        if msg.Tags['Pushed-For'] ~= referenceId then return false end
        return true
    end)
end

local function awaitTransferNotice(referenceId, tokenAddress)
    return awaitMessage(function(msg)
        if not msg.Tags then return false end
        if msg.From ~= tokenAddress then return false end
        if msg.Tags.Action ~= 'Transfer' then return false end
        if msg.Tags['Pushed-For'] ~= referenceId then return false end
        return true
    end)
end

local function awaitForNotices(referenceId, tokenAddress)
    local debitMsg = nil
    local creditMsg = nil

    local deadline = os.time() + math.ceil(60)
    while os.time() <= deadline do
        local msg = Receive(function(candidate)
            if not candidate.Tags then return false end
            if candidate.From ~= tokenAddress then return false end
            if candidate.Tags['Pushed-For'] ~= referenceId then return false end
            local action = candidate.Tags.Action
            return action == 'Debit-Notice' or action == 'Credit-Notice'
        end)

        if msg then
            local action = msg.Tags.Action
            if action == 'Debit-Notice' and not debitMsg then debitMsg = msg end
            if action == 'Credit-Notice' and not creditMsg then creditMsg = msg end

            if debitMsg and creditMsg then
                return debitMsg, creditMsg
            end
        else
            break
        end
    end

    return debitMsg, creditMsg
end

local function buildBorrowResponse(transferId, confirmation, transferNotice)
    if confirmation then
        return {
            status = true,
            transferID = transferId,
            confirmationId = confirmation.Id,
            transferNoticeId = transferNotice and transferNotice.Id or nil
        }
    end

    return {
        status = 'pending',
        transferID = transferId,
        response = 'Transaction pending.'
    }
end

-- Lending helper: send transfer tagged for LiquidOps mint
function mod.lend(params)
    params = params or {}
    local liquidOpsProcess = ensureProcess()
    local tokenId = ensureToken(params.tokenId)
    local quantity = ensureQuantity(params.quantity)

    ao.send({
        Target = tokenId,
        Action = 'Transfer',
        Recipient = liquidOpsProcess,
        Quantity = quantity,
        ['X-Action'] = 'Mint',
        ['Protocol-Name'] = 'LiquidOps',
        ['Analytics-Tag'] = 'Lend',
        token = tokenId,
        timestamp = tostring(os.time() * 1000)
    })
end

-- Withdraw lent tokens from LiquidOps by redeeming oTokens
function mod.unLend(params)
    params = params or {}
    local tokenId = ensureToken(params.tokenId)
    local quantity = ensureQuantity(params.quantity)
    local oTokenId = ensureToken(params.oTokenId)

    ao.send({
        Target = oTokenId,
        Action = 'Redeem',
        Quantity = quantity,
        ['Protocol-Name'] = 'LiquidOps',
        ['Analytics-Tag'] = 'UnLend',
        token = tokenId,
        timestamp = tostring(os.time() * 1000)
    })
end

function mod.borrow(params)
    params = params or {}
    local quantity = ensureQuantity(params.quantity)
    local _, tokenAddress, oTokenAddress = resolveTokenInput(params.token)

    local transferId = ao.send({
        Target = oTokenAddress,
        Action = 'Borrow',
        Quantity = quantity,
        ['Protocol-Name'] = 'LiquidOps',
        ['Analytics-Tag'] = 'Borrow',
        timestamp = tostring(os.time() * 1000),
        token = tokenAddress
    }).Id

    if params.noResult then
        return transferId
    end

    local confirmation = awaitBorrowConfirmation(transferId, oTokenAddress)
    local transferNotice = awaitTransferNotice(transferId, tokenAddress)

    return buildBorrowResponse(transferId, confirmation, transferNotice)
end

function mod.repay(params)
    params = params or {}
    local quantity = ensureQuantity(params.quantity)
    local _, tokenAddress, oTokenAddress = resolveTokenInput(params.token)
    local onBehalfOf = params.onBehalfOf

    local transferId = ao.send({
        Target = tokenAddress,
        Action = 'Transfer',
        Recipient = oTokenAddress,
        Quantity = quantity,
        ['X-Action'] = 'Repay',
        ['Protocol-Name'] = 'LiquidOps',
        ['Analytics-Tag'] = 'Repay',
        ['timestamp'] = tostring(os.time() * 1000),
        token = tokenAddress,
        ['X-On-Behalf'] = onBehalfOf
    }).Id

    if params.noResult then
        return transferId
    end

    local debitMsg, creditMsg = awaitForNotices(transferId, tokenAddress)
    if not debitMsg or not creditMsg then
        return {
            status = 'pending',
            transferID = transferId,
            response = 'Transaction pending.'
        }
    end

    return {
        status = true,
        transferID = transferId,
        debitID = debitMsg.Id,
        creditID = creditMsg.Id
    }
end

function mod.liquidate(params)
    params = params or {}
    local quantity = ensureQuantity(params.quantity)
    local minExpectedQuantity = ensureQuantity(params.minExpectedQuantity)
    local rewardTokenInput = params.rewardToken
    local targetUserAddress = params.targetUserAddress

    if not rewardTokenInput or rewardTokenInput == '' then
        error('Reward token is required')
    end

    if not targetUserAddress or targetUserAddress == '' then
        error('Target user address is required')
    end

    local _, repayTokenAddress, _ = resolveTokenInput(params.token)
    local _, rewardTokenAddress, _ = resolveTokenInput(rewardTokenInput)

    local controllerAddress = constants.LIQUIDOPS_CONTROLLER_ADDRESS
    if not controllerAddress or controllerAddress == '' then
        error('LiquidOps controller address not configured')
    end

    local transferId = ao.send({
        Target = repayTokenAddress,
        Action = 'Transfer',
        Recipient = controllerAddress,
        Quantity = quantity,
        ['X-Target'] = targetUserAddress,
        ['X-Reward-Token'] = rewardTokenAddress,
        ['X-Action'] = 'Liquidate',
        ['X-Min-Expected-Quantity'] = minExpectedQuantity,
        ['Protocol-Name'] = 'LiquidOps'
    }).Id

    if params.noResult then
        return transferId
    end

    local debitMsg, creditMsg = awaitForNotices(transferId, repayTokenAddress)
    if not debitMsg or not creditMsg then
        return {
            status = 'pending',
            transferID = transferId,
            response = 'Transaction pending.'
        }
    end

    return {
        status = true,
        transferID = transferId,
        debitID = debitMsg.Id,
        creditID = creditMsg.Id
    }
end

return mod
