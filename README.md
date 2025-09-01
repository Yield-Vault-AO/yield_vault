## YAO — Yield Optimization Agent (Hackathon Submission)

Autonomous yield optimization agents on AO. Users discover LP pools, get AI recommendations (APUS), optionally request a verifiable random pick (RandAO), and spawn an independent agent that executes a 50/50 swap + LP strategy on their behalf.

### Why this matters
- **Autonomy**: Each user gets their own AO process agent with isolated config and state.
- **Transparency**: All actions occur on AO processes; UI is a thin client.
- **Composability**: Strategy engine is modular (current: LP mining), extendable to new protocols.

---

## Architecture

- **Contracts (AO / Lua)**
  - `contract/src/manager.lua`: Orchestrator. Holds available pools, serves APUS AI recommendations via `Get-AI-Recommendations`, exposes RandAO random selection via `Get-Random-Recommendation`, and spawns per-user agents via `Spawn-Agent`.
  - `contract/src/main.lua`: The agent process implementing the LP mining strategy (swap 50% of base into token-out, then add LP). Rich `Info`/stats and control actions.
  - `contract/src/libs/*`: Shared modules (strategy, permaswap, random, enums/constants, token utils, assertions, etc.).
  - Build outputs: `contract/build/main-process.lua`, `contract/build/manager-process.lua`.

- **Backend (Bun + Hono)**
  - `backend/index.ts`: Small proxy/cache for upstream pool data, exposed at `GET /pools` with 1h TTL. Configured by environment variables to point at your pool data source.

- **Frontend (React + Vite)**
  - React app surfaced via Vite. Users browse pools, run risk assessment, fetch AI recommendations through the manager contract, or request a random pool via RandAO. Wallet signing via Arweave Wallet Kit / ArConnect.
  - Key files: `frontend/src/components/recommendation/*`, `frontend/src/services/aoService.ts`, `frontend/src/components/Agent.tsx`, `frontend/src/components/Strategy.tsx`.

---

## Prerequisites

- Bun v1.1+ (`bun --version`)
- AOS (AO Shell) installed and connected to the AO network
- Arweave wallet for scripts: `wallet.json` at the repo root (used to sign AO messages from CLI scripts)
- Browser wallet (e.g., ArConnect) for the UI (`window.arweaveWallet`), with permissions: `ACCESS_ADDRESS`, `SIGN_TRANSACTION`, `DISPATCH`

---

## Configuration

### Backend env (.env)
Create `backend/.env` with at least:

```bash
PORT=3000
# Upstream JSON API returning pool data the frontend/backend expect
SOURCE_ROUTE=https://YOUR_UPSTREAM_POOLS_ENDPOINT
# JSON string of HTTP headers for the upstream request (e.g. API key)
HEADERS_JSON={"Authorization":"Bearer YOUR_API_KEY"}
```

Notes:
- `HEADERS_JSON` must be a valid JSON object encoded as a single-line string.
- Backend caches upstream response for 1 hour.

### AO process IDs

- Frontend constants: `frontend/src/constants/yao_process.ts`
  - `AO_TOKEN`: Base token process id
  - `MANAGER_CONTRACT`: Manager process id (default in repo)

- Chatbot/APUS config: `frontend/src/config/index.ts`
  - `aoProcessId`: APUS AO process id
  - `apusHyperbeamNodeUrl`: HyperBEAM node URL

If you deployed a new process, update these values accordingly.

### Frontend env (Vite)
Create `frontend/.env.local` (or use your environment) and set:

```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_MANAGER_CONTRACT=YOUR_MANAGER_PROCESS_ID
VITE_AO_TOKEN=YOUR_AO_TOKEN_PROCESS_ID
VITE_APUS_AO_PROCESS_ID=YOUR_APUS_PROCESS_ID
VITE_APUS_HYPERBEAM_URL=https://your-hyperbeam:8734
```

### Scripts env (Bun)
You can override defaults when running scripts:

```bash
# Common
MANAGER_PROCESS_ID=YOUR_MANAGER_ID \
WALLET_PATH=./wallet.json \
BACKEND_URL=http://localhost:3000 \
# Spawn overrides
DEX=Botega TOKEN_OUT=GAME_PROCESS_ID BASE_TOKEN=AO_PROCESS_ID \
POOL_ID=BOTEGA_POOL_ID SLIPPAGE=1.0 CONVERSION_PERCENTAGE=50 STRATEGY_TYPE=Swap50LP50 \
RUN_INDEFINITELY=true START_DATE=$(date +%s) END_DATE=$(( $(date +%s) + 31536000 )) \
# set-eval-data
PROCESS_ID=YOUR_MANAGER_ID LUA_PATH=./contract/build/main-process.lua \
# Run the scripts
bun run set-eval-data && bun run sync-pools && bun run spawn-agent

```

### Scripts wallet and IDs
- CLI scripts use `./wallet.json` and currently include default process IDs in code. You can switch to your own by editing env variables above.

---

## Build contracts

We use Bun to run all scripts.

```bash
# From repo root
bun install

# Build both processes (recommended)
bun run process:build

# Or build individually
bun run process:build:main
bun run process:build:manager
```

Outputs are written to `contract/build/`.

---

## Deploy/Load manager into AOS

Manual local workflow (requested for judging):

```bash
cd contract/src
aos new-manager
.load manager.lua
```

This creates a new manager process and loads `manager.lua`. Keep the returned manager process id; set it in:
- `frontend/src/constants/yao_process.ts` as `MANAGER_CONTRACT`
- scripts via env (`MANAGER_PROCESS_ID`) for `set-eval-data`, `sync-pools`, `upgrade-agents`

Optional scripted flows exist in `contract/scripts/deploy-*.sh`, but the manual flow above matches the hackathon instructions.

---

## Initialize manager with strategy code and pools

These scripts require `./wallet.json`.

```bash
# 1) Upload agent evaluator code to the manager (reads contract/build/main-process.lua)
bun run set-eval-data

# 2) Sync available pools into the manager from the local backend
bun run sync-pools

# 3) (Optional) Upgrade all existing agents with current evalData
bun run upgrade-agents
```

What they do:
- `set-eval-data`: Sends `Set-Eval-Data` with the built agent (`main-process.lua`) to the manager.
- `sync-pools`: Fetches `${BACKEND_URL:-http://localhost:3000}/pools`, transforms Botega pools (adds APY, risk) and sends `Set-Available-Pools` to the manager.
- `upgrade-agents`: Sends `Upgrade-All-Agents` to the manager, which pushes `Eval` (from `evalData`) to all tracked agents.

---

## Using the app

### From the UI
1. Open the frontend, connect your Arweave wallet (grant requested permissions).
2. Browse pools and run the risk assessment form.
3. Click “Get AI Recommendations” to call the manager’s APUS-powered `Get-AI-Recommendations`.
4. Or click “Random” to get a verifiable random pick via RandAO (`Get-Random-Recommendation`) with graceful fallback if credits are low.
5. “Spawn Agent” to create your own agent process configured for the selected pool and strategy.
6. Use the Agent dashboard to inspect `Info`, balances, and execute or withdraw as supported.

### From the CLI

```bash
# Spawns an agent with default Botega GAME/AO config
bun run spawn-agent
```

The script prints the AO message id and session information returned by the manager.

---

## How recommendations and randomness work

- **APUS AI recommendations**
  - The manager constructs a prompt from your risk profile and calls APUS (`ApusAI.infer`). If APUS credits are insufficient, it returns a curated fallback list.
  - Frontend calls `Get-AI-Recommendations` and parses the response; it hydrates token details by calling the backend `/pools` for richer metadata.

- **RandAO random selection**
  - The manager requests entropy and selects from verified pool ids. If credits are insufficient, it falls back to a pseudo-random choice.
  - Frontend can also poll `Get-Random-Recommendation-Status` to retrieve the chosen pool id.

---

## Scripts reference

- `bun run process:build` — Build agent and manager Lua into `contract/build/`
- `bun run set-eval-data` — Push `main-process.lua` evaluator to the manager
- `bun run sync-pools` — Fetch and push available pools to the manager
- `bun run upgrade-agents` — Push current evalData to all tracked agents
- `bun run spawn-agent` — Ask the manager to spawn a new agent with defaults

---

## Notes, limitations, and disclaimers

- This is a hackathon prototype. Not financial advice. Use small amounts.
- Backend requires a valid `SOURCE_ROUTE` that returns pool objects with fields used in `scripts/sync-pools.js` (e.g., `amm_process`, `liquidity_usd`, `pool_fee_bps`, token metadata).
- Frontend and scripts currently default to known AO process ids in the repo; update them when you deploy your own manager.
- APUS and RandAO usage depends on available credits; both have safe fallbacks.

---

## Credits

- Seun — Project Manager
- Ikem Peter — Lead Engineer
- Manoah — Full‑stack
- Martins — Frontend

License: MIT

