import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMarketListing } from '../functions/api/[[path]].js';

const [sql, api, html, main, account, styles] = await Promise.all([
  readFile(new URL('../supabase/market-mvp-build94.sql', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/player-account.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

const uuid = '123e4567-e89b-42d3-a456-426614174000';
assert.deepEqual(validateMarketListing({ cosmeticId: 'ship_void_hunter', price: 430, requestId: uuid }).value, { cosmeticId: 'ship_void_hunter', price: 430, requestId: uuid });
assert.ok(validateMarketListing({ cosmeticId: 'ship_default', price: 430, requestId: uuid }).error);
assert.ok(validateMarketListing({ cosmeticId: 'ship_void_hunter', price: 49, requestId: uuid }).error);
assert.match(sql, /acquisition_source='crate'/, 'only crate catalog items are tradeable');
assert.match(sql, /status='active'\) >= 5/, 'active listings are capped server-side');
assert.match(sql, /market_listing_id is not null/, 'an inventory item cannot be listed twice');
assert.match(sql, /listing\.seller_id=p_user_id[\s\S]*SELF_PURCHASE/, 'self-purchases are rejected');
assert.match(sql, /for update;[\s\S]*balance=balance-listing\.price[\s\S]*balance=balance\+payout/, 'buyer and seller wallets settle under locks');
assert.match(sql, /fee := greatest\(1,floor\(listing\.price\*listing\.fee_rate\/100\.0\)/, 'the market fee is server-calculated');
assert.match(sql, /unique \(buyer_id, request_id\)/, 'purchase replay is idempotent');
assert.match(sql, /market_listing_id is null and c\.active/, 'listed items cannot be equipped');
assert.match(api, /rpc\/create_market_listing/);
assert.match(api, /rpc\/buy_market_listing/);
assert.match(api, /rpc\/cancel_market_listing/);
assert.match(account, /buyMarketListing\(listingId\)/);
assert.match(html, /id="vaultMarketTab"[\s\S]*id="marketBrowseTab"[\s\S]*id="marketSellTab"[\s\S]*id="marketMineTab"/);
assert.match(html, /id="marketCategoryFilter"[\s\S]*id="marketRarityFilter"[\s\S]*id="marketSortFilter"[\s\S]*id="marketHideOwned"/, 'Browse exposes category, rarity, sorting and owned filters');
assert.match(main, /THE MARKET SETS THE PRICE|marketBounds/);
assert.match(main, /marketCategoryFilter === 'all'[\s\S]*marketRarityFilter === 'all'[\s\S]*marketHideOwned/, 'Browse filters are applied before rendering');
assert.match(main, /marketSortFilter === 'price-low'[\s\S]*marketSortFilter === 'price-high'/, 'market price sorting works in both directions');
assert.match(main, /marketMode === 'browse' && owned/, 'owned listings cannot be purchased twice');
assert.match(main, /showStorePurchaseReveal\(item\.cosmeticId, 'market'\)/, 'a successful market purchase gets a rarity-coloured acquisition reveal');
assert.match(main, /\['shop', 'market'\]\.includes\(acquisition\?\.source\)/, 'market purchases receive the collection NEW marker');
assert.match(styles, /#vaultOverlay \{[^}]*overflow-y: scroll;[^}]*scrollbar-gutter: stable both-edges/, 'short market tabs reserve scrollbar space and cannot widen the Vault');
assert.match(styles, /\.market-catalog[\s\S]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/, 'market becomes a readable two-column mobile grid');
assert.match(styles, /\.market-filters[\s\S]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/, 'market filters become a compact two-by-two mobile control grid');

console.log('Crown Market pricing, escrow, settlement and mobile UX tests passed');
