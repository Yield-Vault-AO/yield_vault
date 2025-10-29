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

return mod
