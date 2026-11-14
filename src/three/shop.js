// The camp shop. First (2026-11-14 morning; Oleg: "rewards are unsatisfying (maybe add in game currency and cool stuff to
// buy)") it sold things to stand round the camp: by the evening a camp with a few of them "looks like a ... camp with so much
// junk laying around. restructure the buy upgrades so they offer visual upgrades without making the place look like
// junkyard", and "right now is overbuy there is no motivation". So now (mock-ups in crazygames/cover-options/tiers-2026-11-14,
// chosen by Oleg) the shop sells upgrades of what the camp already has:
// - each part of the camp (the tent, the campfire, the beds, the workshop, the water, the stores and the board) in three
//   tiers, each in its own ground: it gets better, not fuller (tiers.js, camp.js, board.js);
// - the crews' tools, held in the hand, swung as they work, in iron, steel and gold (people.js);
// - one of each: the camp's pet (one shows; any bought can be brought out), the string lights, the camp flag.
// The pay and the prices (Oleg: "sounds good"): a new star pays 10, 15, 25 (the third the most: a reason to play a level
// again); everything costs about 2.4 times a perfect run, so a run buys about half and the rest is what the third stars and
// the replays are for; the dearer tiers open only as the levels go on (no buying everything at once with a windfall; there
// is always something new soon).
import { earned } from './extras.js';

// the lines: a part of the camp (its site's kind, camp.js KIND), the tools, the lights, the flag; each tier's name and what
// it does, its price and the level it opens at (1 = from the start)
const PART = (line, kind, color, name, open1, tiers) => ({ line, kind, color, name, tiers: tiers.map(([tname, blurb], k) => ({ name: tname, blurb, price: [40, 100, 160][k], open: [open1, 8, 18][k] })) });
export const LINES = [
  PART('tent', 'tent', 'orange', 'Tent', 1, [
    ['Door rug', 'A striped rug at the tent door and the tent crew\'s pennant.'],
    ['Bright canvas', 'New canvas for the tent in the crew\'s bright orange.'],
    ['Striped tent', 'Striped canvas, an awning over the door and flags along the ridge.']]),
  PART('fire', 'fire', 'red', 'Campfire', 1, [
    ['Stone ring', 'A ring of big stones round the fire, and another log to sit on.'],
    ['Cooking spit', 'A spit over the fire with a pot of stew.'],
    ['Stone circle', 'Flat stones laid all round the fire and the beds.']]),
  PART('beds', 'beds', 'yellow', 'Beds', 4, [
    ['Plaid blankets', 'A big plaid blanket on every bed.'],
    ['Bedside rugs', 'A striped rug under every bed.'],
    ['Sun shades', 'A striped shade over the head of every bed.']]),
  PART('bench', 'bench', 'green', 'Workshop', 1, [
    ['Awning', 'A green striped awning over the workbench.'],
    ['Anvil and grindstone', 'An anvil and a grindstone by the bench.'],
    ['Workshop roof', 'A roof painted green over the workshop, and its sign.']]),
  PART('water', 'water', 'blue', 'Water', 3, [
    ['Banded barrels', 'Wooden water barrels with blue bands.'],
    ['Hand pump', 'A pump at the trough: water on tap.'],
    ['Stone well', 'A stone well with a blue roof.']]),
  PART('chest', 'chest', 'purple', 'Stores', 4, [
    ['Tidy stack', 'The boxes stacked neatly under a purple tarp.'],
    ['Store shelter', 'A purple striped shelter over the stores.'],
    ['Store shed', 'A little shed with a purple roof for the stores.']]),
  PART('board', null, null, 'Board', 1, [
    ['Varnished frame', 'Honey varnish on the board\'s frame, brass caps on its corner posts, warmer tiles.'],
    ['Painted frame', 'A frame painted green, cream posts, tiles in two soft tones.'],
    ['Walnut and gold', 'A dark walnut frame with a gold line, gold caps and pale stone tiles.']]),
  { line: 'tools', name: 'Tools', tiers: [
    { name: 'Iron tools', blurb: 'A tool of their trade in every camper\'s hand, swung as they work.', price: 100, open: 3 },
    { name: 'Steel tools', blurb: 'Bright steel tools for the whole camp.', price: 180, open: 10 },
    { name: 'Gold tools', blurb: 'Gold tools that shine as they swing.', price: 300, open: 20 }] },
  { line: 'lights', name: 'String lights', tiers: [
    { name: 'String lights', blurb: 'A string of little lights behind the beds, glowing at dusk.', price: 60, open: 5 },
    { name: 'More lights', blurb: 'Strings of lights out to the tent and the workshop.', price: 140, open: 14 }] },
  { line: 'flag', name: 'Camp flag', tiers: [{ name: 'Camp flag', blurb: 'The camp\'s own flag, in all six crews\' colours, on a tall pole.', price: 80, open: 6 }] },
];
export const PETS = [
  { id: 'chick', name: 'Chick', price: 100, open: 3 },
  { id: 'cat', name: 'Cat', price: 150, open: 9 },
  { id: 'dog', name: 'Dog', price: 200, open: 15 },
  { id: 'parrot', name: 'Parrot', price: 250, open: 22 },
];
const PET_BLURB = 'A pet for the camp: it wanders round, and dances when you win. One shows at a time.';
// every thing for sale: a line's tier (id: the line and the tier, 'tent2') or a pet. The first tent tier is cheaper: the first
// thing bought comes after the first level or two
export const ITEMS = [
  ...LINES.flatMap((l) => l.tiers.map((t, k) => ({ id: `${l.line}${k + 1}`, line: l.line, tier: k + 1, of: l.tiers.length, lineName: l.name, kind: l.kind || l.line, ...t, price: l.line === 'tent' && k === 0 ? 30 : t.price }))),
  ...PETS.map((p) => ({ ...p, line: 'pet', tier: 1, of: 1, lineName: p.name, kind: 'pet', blurb: PET_BLURB })),
];
export const item = (id) => ITEMS.find((it) => it.id === id) || null;
export const lineOf = (line) => LINES.find((l) => l.line === line) || null;

// the model files a pet needs (assets/models/shop/pets), by the name main.js loads them under
export const SHOP_MODELS = Object.fromEntries(PETS.map((p) => [p.id, { [`pet-${p.id}`]: `pets/animal-${p.id}.glb` }]));

// coins a win pays: 10, 15 and 25 for a level's first, second and third star when new; a level won again with no new star, 5
const STAR_PAY = [10, 15, 25];
export function winCoins(before, after) {
  if (after <= before) return 5;
  let c = 0;
  for (let s = before + 1; s <= after; s++) c += STAR_PAY[s - 1] || 0;
  return c;
}

// what the first shop (2026-11-14 morning) sold, at its prices: given back as coins for what is gone (the pets and the flag
// carry over)
const OLD_PRICES = { lanterns: 40, candles: 50, bunting: 60, pumpkins: 60, lantern: 80, lamppost: 100, campbench: 100, chick: 120, hammock: 120, logs: 120, signpost: 120, garden: 140, bunny: 160, flag: 160, fish: 160, cat: 200, fox: 200, canoe: 200, beaver: 220, bigtent: 240, dog: 250, parrot: 300 };
const CARRY = { chick: 'chick', cat: 'cat', dog: 'dog', parrot: 'parrot', flag: 'flag1' };

// the wallet, saved: the coins, what is bought and which pet is out. A player from before any shop gets 10 coins a star and
// the worth of the extras their stars had earned; a player of the first shop keeps the pets and the flag and gets back what
// the rest cost (once: bd3.shop). ?owned=all|id,id, ?coins=N and ?tier=N (every line up to tier N; checks and pictures) never
// save
export function loadWallet(store, q, starTotal) {
  let owned = null, coins = 0, pet = null, version = 0;
  try {
    owned = JSON.parse(store.getItem('bd3.owned') || 'null');
    coins = Number(store.getItem('bd3.coins')) || 0;
    pet = store.getItem('bd3.pet');
    version = Number(store.getItem('bd3.shop')) || 0;
  } catch {}
  let refund = 0;
  if (!Array.isArray(owned)) {
    // before any shop: the stars' extras as coins
    refund = starTotal * 10 + earned(starTotal).reduce((n, id) => n + (OLD_PRICES[id] || 0), 0);
    owned = [];
    coins = refund;
  } else if (version < 2) {
    const kept = [];
    for (const id of owned) {
      if (CARRY[id]) kept.push(CARRY[id]);
      else refund += OLD_PRICES[id] || 0;
    }
    owned = kept;
    coins += refund;
  }
  if (version < 2) {
    try {
      store.setItem('bd3.owned', JSON.stringify(owned));
      store.setItem('bd3.coins', String(coins));
      store.setItem('bd3.shop', '2');
    } catch {}
  }
  const test = q.has('owned') || q.has('coins') || q.has('tier');
  if (q.has('owned')) owned = q.get('owned') === 'all' ? ITEMS.map((it) => it.id) : q.get('owned').split(',').filter((id) => item(id));
  if (q.has('tier')) {
    const n = Number(q.get('tier')) || 0;
    owned = [...owned.filter((id) => item(id)?.line === 'pet'), ...ITEMS.filter((it) => it.line !== 'pet' && it.tier <= n).map((it) => it.id)];
  }
  if (q.has('coins')) coins = Number(q.get('coins')) || 0;
  owned = owned.filter((id) => item(id));
  if (!owned.includes(pet)) pet = owned.filter((id) => item(id).line === 'pet').at(-1) || null;
  return {
    owned, coins, pet, refund,
    has: (id) => owned.includes(id),
    // the tier a line has got to (0: none of it)
    tier: (line) => owned.reduce((n, id) => {
      const it = item(id);
      return it && it.line === line ? Math.max(n, it.tier) : n;
    }, 0),
    save() {
      if (test) return;
      try {
        store.setItem('bd3.owned', JSON.stringify(owned));
        store.setItem('bd3.coins', String(this.coins));
        if (this.pet) store.setItem('bd3.pet', this.pet);
      } catch {}
    },
  };
}

// what can be bought next: each line's next tier, and every pet not bought; open: whether the levels have got that far
// (reached: the furthest level open, 1-based)
export function forSale(wallet, reached) {
  const out = [];
  for (const l of LINES) {
    const t = wallet.tier(l.line);
    if (t < l.tiers.length) out.push(item(`${l.line}${t + 1}`));
  }
  for (const p of PETS) if (!wallet.has(p.id)) out.push(item(p.id));
  return out.map((it) => ({ ...it, open: it.open <= reached }));
}
// the cheapest thing that can be bought now or next (the win card and the coins say how far off it is)
export const nextItem = (wallet, reached) => forSale(wallet, reached).filter((it) => it.open).sort((a, b) => a.price - b.price)[0] || null;

// the camp's look for a wallet: each part's tier, the tools', the lights', the flag, and the pet out (camp.js, board.js)
export function campLook(wallet) {
  return { tent: wallet.tier('tent'), fire: wallet.tier('fire'), beds: wallet.tier('beds'), bench: wallet.tier('bench'), water: wallet.tier('water'), chest: wallet.tier('chest'), board: wallet.tier('board'), tools: wallet.tier('tools'), lights: wallet.tier('lights'), flag: wallet.tier('flag'), pet: wallet.pet };
}

export function blurb(it) {
  return it?.blurb || '';
}
