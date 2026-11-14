// The camp trail: the level map (benchmark 2026-10-28, item 2). The levels are stops along a winding forest trail, each with
// the stars won there; and the camp shop (shop.js, 2026-11-14): the coins, and what they buy for the camp.
import { ITEMS, nextItem } from './shop.js';

// the extras' icons, flat, 40 x 40
export const ICON = {
  lanterns: '<path d="M20 3v6" stroke="#3a3a3a" stroke-width="2"/><circle cx="20" cy="21" r="13" fill="#ffc070" opacity=".25"/><path d="M12 13h16l-4-5h-8z" fill="#3a3a3a"/><rect x="14" y="13" width="12" height="16" rx="3" fill="#ffd27a" stroke="#3a3a3a" stroke-width="2"/><path d="M20 13v16" stroke="#3a3a3a" stroke-width="1.5"/><rect x="12" y="29" width="16" height="4" rx="1.5" fill="#3a3a3a"/>',
  bunting: '<path d="M2 8q18 10 36 0" stroke="#c8b080" stroke-width="2" fill="none"/><path d="M4 10.5l7 2-3 9z" fill="#f05a3c"/><path d="M12 12.6l7 .4-3.5 9z" fill="#ff9d2e"/><path d="M20 13l7-.4-3.5 9z" fill="#ffd23a"/><path d="M28 12.4l7-2-3 9z" fill="#5cc753"/>',
  hammock: '<rect x="4" y="9" width="3" height="26" rx="1" fill="#7a5530"/><rect x="33" y="9" width="3" height="26" rx="1" fill="#7a5530"/><path d="M6 11l5 8M34 11l-5 8" stroke="#c8b080" stroke-width="1.5"/><path d="M10 19q10 14 20 0q-10 8-20 0z" fill="#c84a3a"/><path d="M11 20.5q9 9 18 0" stroke="#e8dcc0" stroke-width="2" fill="none"/>',
  fox: '<path d="M7 7l8 9h10l8-9-1 13q-12 17-24 0z" fill="#f0a85a"/><path d="M12 22q8 11 16 0q-8 4-16 0z" fill="#fff4e0"/><circle cx="15.5" cy="19.5" r="1.8" fill="#2a2235"/><circle cx="24.5" cy="19.5" r="1.8" fill="#2a2235"/><circle cx="20" cy="28" r="2" fill="#2a2235"/>',
  canoe: '<path d="M3 24q17-18 34 0z" fill="#b8502c"/><path d="M3 24h34" stroke="#7a3018" stroke-width="2"/><rect x="8" y="24" width="2.5" height="9" fill="#7a5530"/><rect x="29.5" y="24" width="2.5" height="9" fill="#7a5530"/><path d="M5 36l22-4" stroke="#b08050" stroke-width="2"/><ellipse cx="30" cy="31.4" rx="4.5" ry="1.8" fill="#b08050" transform="rotate(-10 30 31.4)"/>',
  flag: '<ellipse cx="10" cy="36" rx="7" ry="2.5" fill="#8a8a80"/><rect x="9" y="4" width="2.5" height="32" fill="#7a5530"/><circle cx="10.2" cy="4" r="2" fill="#f2c440"/><path d="M11.5 6h22v2.4h-22z" fill="#f05a3c"/><path d="M11.5 8.4h22v2.4h-22z" fill="#ff9d2e"/><path d="M11.5 10.8h22v2.4h-22z" fill="#ffd23a"/><path d="M11.5 13.2h22v2.4h-22z" fill="#5cc753"/><path d="M11.5 15.6h22v2.4h-22z" fill="#3f9cf0"/><path d="M11.5 18h22v2.4h-22z" fill="#ab70f0"/>',
  fish: '<rect x="3" y="6" width="34" height="3" rx="1.5" fill="#7a5530"/><g fill="#9ab4c8"><path d="M8.5 9h5l-2.5 5z"/><ellipse cx="11" cy="22" rx="3.4" ry="8.5"/><path d="M17.5 9h5l-2.5 5z"/><ellipse cx="20" cy="23" rx="3.4" ry="8.5"/><path d="M26.5 9h5l-2.5 5z"/><ellipse cx="29" cy="22" rx="3.4" ry="8.5"/></g><g fill="#2a2235"><circle cx="11" cy="28" r="1"/><circle cx="20" cy="29" r="1"/><circle cx="29" cy="28" r="1"/></g>',
  signpost: '<rect x="18.5" y="6" width="3" height="31" fill="#6a4628"/><path d="M6 8h21l4 4.5-4 4.5H6z" fill="#c89a62"/><path d="M34 19H13l-4 4.5 4 4.5h21z" fill="#c89a62"/><path d="M9 12.5h14M15 23.5h15" stroke="#4a2e16" stroke-width="1.6"/>',
};
// the shop's things as pictures of their models (assets/ui/shop, tools/shop-icons.js)
// (every one of them a picture of its model since 2026-11-14, the first extras too: ICON stays for anything without one)
export const icon = (id, size = 40) => (ITEMS.some((it) => it.id === id) ? `<img src="assets/ui/shop/${id}.png" width="${size}" height="${size}" alt="">` : `<svg viewBox="0 0 40 40" width="${size}" height="${size}">${ICON[id] || ''}</svg>`);
// a coin
export const COIN = (size = 20) => `<svg class="coin" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#e9a72a"/><circle cx="10" cy="10" r="7" fill="#ffd24a"/><path d="M10 5.5l1.3 2.9 3.1.3-2.4 2 .7 3.1L10 12.2l-2.7 1.6.7-3.1-2.4-2 3.1-.3z" fill="#e9a72a"/></svg>`;

// the trail: `count` stops in rows that wind back and forth; best: stars won per level (index); open: the furthest level
// that can be played; current: the level in play; pick(k) when a stop is chosen
export function drawTrail(box, { count, best, open, current, pick }) {
  const w = box.clientWidth || 320, cols = w < 330 ? 4 : 5, gap = w / cols, rowH = 92, rows = Math.ceil(count / cols), h = rows * rowH + 6;
  const pts = Array.from({ length: count }, (_, k) => {
    const r = Math.floor(k / cols), c = k % cols;
    return [((r % 2 ? cols - 1 - c : c) + 0.5) * gap, 38 + r * rowH];
  });
  // the trail's segments: straight along a row, a loop round at its end
  const segs = pts.slice(1).map((b, k) => {
    const a = pts[k];
    if (a[1] === b[1]) return `L${b[0]},${b[1]}`;
    const dx = gap * 0.62 * (a[0] > w / 2 ? 1 : -1);
    return `C${a[0] + dx},${a[1]} ${b[0] + dx},${b[1]} ${b[0]},${b[1]}`;
  });
  const start = `M${pts[0][0]},${pts[0][1]}`, all = start + segs.join(' '), walked = start + segs.slice(0, Math.max(0, open)).join(' ');
  box.style.height = `${h}px`;
  box.innerHTML = `<svg width="${w}" height="${h}" aria-hidden="true"><path d="${all}" class="edge"/><path d="${all}" class="sand"/><path d="${walked}" class="walked"/></svg>`;
  pts.forEach(([x, y], k) => {
    const b = document.createElement('button'), stars = best[k] || 0, locked = k > open;
    b.className = `node${locked ? ' locked' : ''}${k === current ? ' now' : ''}`;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.innerHTML = locked
      ? '<svg viewBox="0 0 20 20" width="20" height="20"><rect x="4" y="9" width="12" height="9" rx="2" fill="currentColor"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
      : `${k + 1}<span class="st">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>`;
    b.title = locked ? `Level ${k + 1}: finish level ${k} first` : `Level ${k + 1}`;
    if (!locked) b.onclick = () => pick(k);
    box.append(b);
  });
}

// the shop: a tile for each thing, cheapest first; what the coins buy now lit, its price on it; what the camp has ticked; and
// a line about the cheapest thing still to buy. buy(id) when one is pressed
export function drawShop(box, line, { owned, coins, buy }) {
  const next = nextItem(owned);
  box.innerHTML = '';
  for (const it of ITEMS) {
    const has = owned.includes(it.id), can = !has && coins >= it.price, b = document.createElement('button');
    b.className = `ex${has ? ' has' : can ? ' can' : ' no'}${next && next.id === it.id ? ' next' : ''}`;
    b.innerHTML = `${icon(it.id)}<div>${it.name}</div><div class="cost">${has ? '✓ in the camp' : `${COIN(13)} ${it.price}`}</div>`;
    b.disabled = !can;
    b.title = has ? `${it.name}: in the camp` : can ? `Buy the ${it.name.toLowerCase()} for ${it.price} coins` : `${it.name}: ${it.price} coins`;
    if (can) b.onclick = () => buy(it.id);
    box.append(b);
  }
  line.innerHTML = !next ? 'Everything is in the camp!' : coins >= next.price ? `Pick something for the camp: it stands in every level`
    : `<b>${next.price - coins}</b> more coins for the ${next.name.toLowerCase()}<div class="bar"><i style="width:${Math.round((100 * coins) / next.price)}%"></i></div>`;
}
