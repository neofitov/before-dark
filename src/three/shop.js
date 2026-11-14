// The camp shop (2026-11-14; Oleg: "rewards are unsatisfying (maybe add in game currency and cool stuff to buy)", then "yes
// on the shop", "do the shop first"). Until now the stars' total earned the camp's eight extras by itself (extras.js); the
// player chose nothing, and after 51 of the 93 stars there was nothing left. Now a win pays coins and the camp trail sells
// things for the camp: the first eight extras (made in code), more for the camp (Kenney Nature Kit, KayKit Halloween Bits) and
// pets that wander round it (Kenney Cube Pets), all CC0. Each stands in every level once bought; they cost more in all than
// one perfect run of the levels pays, so the player picks, and playing a level again pays a little.
import { EXTRAS, earned } from './extras.js';

// kind: 'extra' (extras.js MAKE, made in code), 'decor' (a model, extras.js), 'pet' (wanders the camp, extras.js)
export const ITEMS = [
  { id: 'lanterns', name: 'Lanterns', price: 40, kind: 'extra' },
  { id: 'candles', name: 'Candles', price: 50, kind: 'decor' },
  { id: 'bunting', name: 'Bunting', price: 60, kind: 'extra' },
  { id: 'pumpkins', name: 'Pumpkins', price: 60, kind: 'decor' },
  { id: 'lantern', name: 'Big lantern', price: 80, kind: 'decor' },
  { id: 'lamppost', name: 'Lamp post', price: 100, kind: 'decor' },
  { id: 'campbench', name: 'Bench', price: 100, kind: 'decor' },
  { id: 'chick', name: 'Chick', price: 120, kind: 'pet' },
  { id: 'hammock', name: 'Hammock', price: 120, kind: 'extra' },
  { id: 'logs', name: 'Log stack', price: 120, kind: 'decor' },
  { id: 'signpost', name: 'Signpost', price: 120, kind: 'extra' },
  { id: 'garden', name: 'Veggie patch', price: 140, kind: 'decor' },
  { id: 'bunny', name: 'Bunny', price: 160, kind: 'pet' },
  { id: 'flag', name: 'Camp flag', price: 160, kind: 'extra' },
  { id: 'fish', name: 'Fish rack', price: 160, kind: 'extra' },
  { id: 'cat', name: 'Cat', price: 200, kind: 'pet' },
  { id: 'fox', name: 'Camp fox', price: 200, kind: 'extra' },
  { id: 'canoe', name: 'Canoe', price: 200, kind: 'extra' },
  { id: 'beaver', name: 'Beaver', price: 220, kind: 'pet' },
  { id: 'bigtent', name: 'Big tent', price: 240, kind: 'decor' },
  { id: 'dog', name: 'Dog', price: 250, kind: 'pet' },
  { id: 'parrot', name: 'Parrot', price: 300, kind: 'pet' },
];
export const item = (id) => ITEMS.find((it) => it.id === id) || null;

// the model files each one needs (assets/models/shop/), by the name main.js loads them under
export const SHOP_MODELS = {
  candles: { 'shop-candles': 'kaykit/candle_triple.gltf' },
  pumpkins: { 'shop-pumpkin': 'kaykit/pumpkin_orange_jackolantern.gltf', 'shop-pumpkin-small': 'kaykit/pumpkin_orange_small.gltf', 'shop-pumpkin-yellow': 'kaykit/pumpkin_yellow_small.gltf' },
  lantern: { 'shop-lantern': 'kaykit/lantern_standing.gltf' },
  lamppost: { 'shop-lamppost': 'kaykit/post_lantern.gltf' },
  campbench: { 'shop-bench': 'kaykit/bench.gltf' },
  logs: { 'shop-logs': 'log_stackLarge.glb' },
  garden: { 'shop-corn': 'crops_cornStageD.glb', 'shop-wheat': 'crops_wheatStageB.glb' },
  bigtent: { 'shop-tent': 'tent_detailedOpen.glb' },
  chick: { 'pet-chick': 'pets/animal-chick.glb' },
  bunny: { 'pet-bunny': 'pets/animal-bunny.glb' },
  cat: { 'pet-cat': 'pets/animal-cat.glb' },
  beaver: { 'pet-beaver': 'pets/animal-beaver.glb' },
  dog: { 'pet-dog': 'pets/animal-dog.glb' },
  parrot: { 'pet-parrot': 'pets/animal-parrot.glb' },
};

// coins a win pays: 10 for each star new on the level, 20 for its third (the target met); a level won again with no new star, 5
export function winCoins(before, after) {
  if (after <= before) return 5;
  let c = 0;
  for (let s = before + 1; s <= after; s++) c += s === 3 ? 20 : 10;
  return c;
}

// the wallet, saved: coins and what the camp has. A player from before the shop keeps the extras the stars had earned and gets
// 10 coins a star to spend (once). ?stars=N (checks, covers) stands for the extras N stars earned; ?owned=all|id,id and ?coins=N
// for tests and pictures
export function loadWallet(store, q, starTotal) {
  let owned = null, coins = 0;
  try {
    owned = JSON.parse(store.getItem('bd3.owned') || 'null');
    coins = Number(store.getItem('bd3.coins')) || 0;
  } catch {}
  if (!Array.isArray(owned)) {
    owned = earned(starTotal);
    coins = starTotal * 10;
    try {
      store.setItem('bd3.owned', JSON.stringify(owned));
      store.setItem('bd3.coins', String(coins));
    } catch {}
  }
  if (q.has('stars')) owned = earned(Number(q.get('stars')) || 0);
  if (q.has('owned')) owned = q.get('owned') === 'all' ? ITEMS.map((it) => it.id) : q.get('owned').split(',').filter((id) => item(id));
  if (q.has('coins')) coins = Number(q.get('coins')) || 0;
  owned = owned.filter((id) => item(id));
  return {
    owned, coins,
    has: (id) => owned.includes(id),
    save() {
      if (q.has('stars') || q.has('owned') || q.has('coins')) return;
      try {
        store.setItem('bd3.owned', JSON.stringify(owned));
        store.setItem('bd3.coins', String(this.coins));
      } catch {}
    },
  };
}

// the cheapest thing not in the camp yet (the win card and the shop say how far off it is)
export const nextItem = (owned) => ITEMS.find((it) => !owned.includes(it.id)) || null;

export { EXTRAS };
