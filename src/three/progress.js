// Saved progress (main.js keeps it in the browser's storage, or the tab's under ?playtest): the stars won on each level
// (bd3.stars, by level index), the furthest level open (bd3.reached, an index), the level cards seen (bd3.cardN) and the save's
// layout (bd3.v); the camp shop's coins and things (bd3.coins, bd3.owned, bd3.pet, bd3.shop: shop.js) are never moved here.
// When the levels move, a save made before is moved with them, once. Plain functions on a store (getItem, setItem,
// removeItem), so the tests run them on a stand-in (test/progress.test.mjs).
export const VERSION = '3';

const cardsSeen = (store, count) => Array.from({ length: count + 1 }, (_, k) => k).filter((k) => store.getItem(`bd3.card${k}`) === '1');
function readStars(store) {
  // (stars that won't parse count as none: the parse used to throw before bd3.v was written, so the move ran again on the next
  // load, onto a save made after it: QA 2026-11-14, ROBUST-1)
  try {
    const s = JSON.parse(store.getItem('bd3.stars') || '{}');
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

// layout 2 (2026-11-10): the warm-up came in front of the levels there were, so everything moves one level on
function shiftForWarmup(store, count) {
  const was = readStars(store), moved = {};
  for (const [k, n] of Object.entries(was)) moved[Number(k) + 1] = n;
  if (store.getItem('bd3.stars') != null) store.setItem('bd3.stars', JSON.stringify(moved));
  if (store.getItem('bd3.reached') != null) store.setItem('bd3.reached', String((Number(store.getItem('bd3.reached')) || 0) + 1));
  for (const k of cardsSeen(store, count).reverse()) {
    store.setItem(`bd3.card${k + 1}`, '1');
    store.removeItem(`bd3.card${k}`);
  }
}

// layout 3 (2026-11-18, the easier curve: crazygames/CURVE.md): 14 boards kept, in new places (campaign.js `was`: a board's
// level number in layout 2), 17 new ones. Stars move with their board, and a new board starts with none; the furthest level
// open never goes back, and reaches every kept board the player could play (none of the levels they had open is locked; the
// shop's tiers, which open by it, stay open); the cards seen move with their board. A save from before any shop (no bd3.owned)
// is first paid its coins for the stars as they were: wallet(total), shop.js loadWallet
function moveToCurve3(store, campaign, wallet) {
  const to = {};
  campaign.forEach((l, j) => l.was && (to[l.was - 1] = j));
  const was = readStars(store), total = Object.values(was).reduce((s, n) => s + (Number(n) || 0), 0);
  if (wallet && store.getItem('bd3.owned') == null && total) wallet(total);
  const moved = {};
  for (const [k, n] of Object.entries(was)) if (to[k] != null) moved[to[k]] = n;
  if (store.getItem('bd3.stars') != null) store.setItem('bd3.stars', JSON.stringify(moved));
  if (store.getItem('bd3.reached') != null || total) {
    // open in layout 2: up to bd3.reached, and the level after each one won
    const r = Number(store.getItem('bd3.reached')) || 0, open = (k) => k <= r || was[k] > 0 || was[k - 1] > 0;
    let reached = r;
    for (const [k, j] of Object.entries(to)) if (open(Number(k))) reached = Math.max(reached, j);
    store.setItem('bd3.reached', String(Math.min(reached, campaign.length - 1)));
  }
  const seen = cardsSeen(store, Math.max(campaign.length, 31));
  for (const k of seen) store.removeItem(`bd3.card${k}`);
  for (const k of seen) if (to[k] != null) store.setItem(`bd3.card${to[k]}`, '1');
}

// moves a save to the levels as they are now, once (bd3.v); true if it did. campaign: the levels (campaign.js CAMPAIGN)
export function migrate(store, campaign, { wallet = null } = {}) {
  const v = store.getItem('bd3.v');
  if (v === VERSION) return false;
  if (v !== '2') shiftForWarmup(store, campaign.length);
  moveToCurve3(store, campaign, wallet);
  store.setItem('bd3.v', VERSION);
  return true;
}
