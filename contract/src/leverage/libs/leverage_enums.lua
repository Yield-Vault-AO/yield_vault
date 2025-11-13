local enums = {
    PositionState = {
        IDLE = "Idle",
        DEPOSITING = "Depositing",
        LEVERAGING = "Leveraging",
        ACTIVE = "Active",
        CLOSING = "Closing",
        CLOSED = "Closed",
        ERROR = "Error"
    },
    
    PositionType = {
        LEVERAGE_LONG = "LeverageLong",   -- Long volatile asset
        LEVERAGE_SHORT = "LeverageShort"  -- Short via stable
    },
    
    LeverageAction = {
        OPEN = "Open",
        CLOSE = "Close",
        LIQUIDATE = "Liquidate"
    }
}

return enums
