# Crown Lizard security notes

## Current trust boundaries

- Global leaderboard runs and score submissions pass through the Cloudflare Pages Function and Supabase. The Supabase secret is never shipped to the browser.
- Crown Vault uses the authenticated server wallet outside localhost. `localStorage` contains the Supabase session, retry IDs and the untouched legacy backup, but cannot mutate the live wallet.
- Cosmetics do not affect hitboxes, damage, lives, score multipliers, or leaderboard rank.
- The rewarded-ad adapter is simulated and must not be connected to paid inventory without server-side provider verification.

## Fixed in Build 45

- Production URLs cannot enable debug controls through query parameters.
- Crate tier selection, cosmetic selection, opening identifiers, and local run identifiers use Web Crypto rather than `Math.random`.
- Cloudflare Pages sends a restrictive Content Security Policy plus clickjacking, MIME-sniffing, referrer, permissions, and HTTPS protections.
- One local run ID can only receive one shard payout, one eligible run can only receive one sponsored crate, and daily sponsored claims are capped.
- Pending duplicate rewards are settled before another crate can open.

## Known limitations before a market or real rewarded ads

Local checks cannot make a browser-owned wallet tamper-proof. Checksums or an embedded signing secret would only obscure manipulation because the player receives the verification code and secret. Before cosmetics have transferable or monetary value:

1. Store wallet balance, inventory, pity state, and transaction IDs in Supabase behind the Cloudflare function. Implemented and connected for non-localhost builds.
2. Settle shard rewards against the server-created run ID with atomic, idempotent database operations. Implemented in the staged server API with Auth ownership, elapsed-time/stat validation, a locked run row and a unique transaction key.
3. Roll crates on the server with an atomic balance deduction and unique opening ID. Implemented in the staged API: Web Crypto rolls are generated in Cloudflare and cost, pity, tier, inventory and duplicate salvage settle under a database row lock.
4. Verify rewarded-ad completion using the ad provider's server callback before issuing a sponsored opening token.
5. Add an account or anonymous bearer credential that can later be linked to an account, plus rate limits and an audit log. Anonymous bearer sessions and permanent email/password linking are implemented in Build 55; a dedicated account-event audit table remains future hardening before a player market.

Until the updated schema and Cloudflare variables are applied, the cutover intentionally fails closed rather than falling back to a mutable production wallet.

Anonymous player creation is rate-limited per hashed IP. Before public account activation, Supabase Anonymous Sign-Ins must be enabled and `SUPABASE_PUBLISHABLE_KEY` configured in Cloudflare. The optional legacy import is fail-closed unless `ECONOMY_MIGRATION_DEADLINE` is a valid future timestamp.

Player passwords are accepted only by the account route and forwarded to Supabase Auth over HTTPS. They are never stored in public tables, written to the economy ledger or included in application logs. Failed login responses are deliberately generic to reduce account enumeration, and password creation requires a verified non-anonymous Auth identity.
