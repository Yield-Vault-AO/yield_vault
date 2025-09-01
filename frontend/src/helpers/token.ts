import { createDataItemSigner } from "@permaweb/aoconnect"
import { dryrun, message, result } from "@permaweb/aoconnect"
import { type Tag } from "arweave/web/lib/transaction"

export interface Message {
    Anchor: string
    Tags: Tag[]
    Target: string
    Data: string
}

export interface TransferParams {
    token: string
    quantity: bigint
    recipient: string
    tags?: Tag[]
}

export interface TokenInfo {
    id: string
    denomination: number
    ticker: string
    logo: string
    name: string
}

export const flattenTags = (tags: Tag[]) =>
    tags.reduce(
        (acc, tag) => {
            acc[tag.name] = tag.value
            return acc
        },
        {} as Record<string, string>,
    )

export const getTagValue = (tagName: string, tags: Tag[]) =>
    tags.find((t) => t.name === tagName)?.value

export async function getTokenInfo(
    tokenId: string,
): Promise<TokenInfo> {
    const result = await dryrun({
        process: tokenId,
        tags: [{ name: "Action", value: "Info" }],
    })

    if (result.Messages.length === 0) throw new Error(`No response from (get) Info (${tokenId})`)
    const tagMap = flattenTags(result.Messages[0].Tags)

    const res = await (await fetch(`https://g8way.io:443/${tagMap["Logo"]}`)).blob()
    const imageUrl = URL.createObjectURL(res)

    return {
        id: tokenId,
        name: tagMap["Name"],
        ticker: tagMap["Ticker"],
        denomination: parseInt(tagMap["Denomination"]),
        logo: imageUrl,
    }
}

export async function transfer(
    data: TransferParams,
    signer: ReturnType<typeof createDataItemSigner>,
) {
    return await message({
        process: data.token,
        signer,
        tags: [
            { name: "Action", value: "Transfer" },
            { name: "Recipient", value: data.recipient },
            { name: "Quantity", value: data.quantity.toString() },
            ...(data.tags || []),
        ],
    })
}

export async function assertTransferResult(message: string, process: string) {
    const res = await result({ process, message })

    if (res.Error) {
        throw new Error(res.Error)
    }

    for (const msg of res.Messages as Message[]) {
        const action = getTagValue("Action", msg.Tags)

        if (action === "Transfer-Error") {
            throw new Error(getTagValue("Error", msg.Tags) || "Unknown transfer error")
        }
    }
}

// In-memory cache to avoid repeated Info dryruns per token
const tokenInfoCache = new Map<string, TokenInfo>()

export async function getCachedTokenInfo(tokenId: string): Promise<TokenInfo> {
    if (tokenInfoCache.has(tokenId)) return tokenInfoCache.get(tokenId) as TokenInfo
    const info = await getTokenInfo(tokenId)
    tokenInfoCache.set(tokenId, info)
    return info
}

// Convert a raw quantity (base units) to human units using denomination, without floating point errors
export function formatQuantityWithDenomination(
    rawQuantity: string | bigint,
    denomination: number,
    {
        maxFractionDigits = 6,
        trimTrailingZeros = true,
        useGrouping = true,
    }: { maxFractionDigits?: number; trimTrailingZeros?: boolean; useGrouping?: boolean } = {},
): string {
    const raw = typeof rawQuantity === "bigint" ? rawQuantity : BigInt(rawQuantity || "0")
    if (denomination <= 0) {
        const intStr = raw.toString()
        return useGrouping ? Number(intStr).toLocaleString() : intStr
    }

    const base = BigInt(10) ** BigInt(denomination)
    const integerPart = raw / base
    let fractionalPart = (raw % base).toString().padStart(denomination, "0")

    // Limit fractional digits
    if (denomination > maxFractionDigits) {
        const cut = fractionalPart.slice(0, maxFractionDigits)
        // Round down (floor). For simplicity, no rounding up.
        fractionalPart = cut
    }

    if (trimTrailingZeros) {
        fractionalPart = fractionalPart.replace(/0+$/g, "")
    }

    const intFormatted = useGrouping
        ? Number(integerPart.toString()).toLocaleString()
        : integerPart.toString()

    return fractionalPart.length > 0 ? `${intFormatted}.${fractionalPart}` : intFormatted
}

// Convenience: format balance for a given token process id using its Info
export async function formatTokenBalance(
    tokenProcessId: string,
    rawQuantity: string,
    options?: Parameters<typeof formatQuantityWithDenomination>[2] & { includeTicker?: boolean },
): Promise<string> {
    const info = await getCachedTokenInfo(tokenProcessId)
    const num = formatQuantityWithDenomination(rawQuantity, info.denomination, options)
    return options?.includeTicker === false ? num : `${num} ${info.ticker}`
}
