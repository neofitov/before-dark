# Asset licences

Every asset is CC0 1.0 (public domain), copied or converted from the local packs in `C:\Source\Personal\tools\assets-cc0`,
except the music (see Music). The one library, three.js, is MIT (see the end).

| Pack | By | Licence | Files used |
|---|---|---|---|
| Survival Kit 2.0 (Previews) | Kenney (www.kenney.nl) | CC0 1.0 | sprites/ (the 2D prototypes): tent, campfire, box, chest, barrel, bedroll, workbench, signpost, rock, tree, wood, fish, bucket, axe |
| Survival Kit 2.0 (GLB models) | Kenney | CC0 1.0 | models/barrel-open, barrel, chest, bedroll, resource-wood, bucket, box-open, Textures/colormap.png |
| Nature Kit (GLB models) | Kenney | CC0 1.0 | models/stump_round, stump_old |
| Stylized Nature MegaKit (standard, FBX) | Quaternius (quaternius.com) | CC0 1.0 | nature/: CommonTree_3-5, Pine_1, Pine_4, Pine_5, TwistedTree_3, Bush_Common, Bush_Common_Flowers, Fern_1, Plant_1, Plant_7, Grass_Common_Short/Tall, Grass_Wispy_Short/Tall, Flower_3_Group, Flower_4_Group, Clover_1, Mushroom_Common, Pebble_Round_1-2, Rock_Medium_1-3 (converted to GLB, textures shrunk to 512 px: bark, bark-twisted, leaves-tree, leaves-pine, leaves-twisted, leaves, grass, flowers, mushrooms, rocks, pathrocks) |
| Animals (Deer) | Quaternius | CC0 1.0 | models/deer (converted to GLB; animations Idle, Idle_2, Idle_Headlow, Eating, Walk kept) |
| Ultimate Animated Animal Pack (Fox) | Quaternius (via poly.pizza/m/Bc97C66HKi) | CC0 1.0 | models/fox (GLB slimmed by tools/slim-glb.mjs to the clips Attack, Eating, Gallop, Jump_ToIdle, Walk, Idle_2_HeadLow, Idle_2, Idle; downloaded 2026-10-24 with Oleg's yes) |
| Mini Characters 1.0 | Kenney | CC0 1.0 | models/people/character-male-a, male-b, male-e, female-b, female-c, female-f, Textures/colormap.png (downloaded 2026-10-24 with Oleg's yes; the 'Kenney' campers) |
| Cube Pets 2.0 | Kenney | CC0 1.0 | models/shop/pets/animal-chick, bunny, cat, beaver, dog, parrot (GLB, their animations), pets/Textures/colormap.png: the camp shop's pets (downloaded 2026-11-14 with Oleg's yes) |
| Nature Kit (GLB models) | Kenney | CC0 1.0 | models/shop/tent_detailedOpen, log_stackLarge, crops_cornStageD, crops_wheatStageB: the shop's big tent, log stack, veggie patch |
| Halloween Bits 1.0 | KayKit (Kay Lousberg, www.kaylousberg.com) | CC0 1.0 | models/shop/kaykit/: pumpkin_orange_jackolantern, pumpkin_orange_small, pumpkin_yellow_small, lantern_standing, post_lantern, bench, candle_triple (glTF + bin), halloweenbits_texture.png: the shop's pumpkins, big lantern, lamp post, bench, candles |
| RPG Audio | Kenney | CC0 1.0 | sfx/ (2D): exit, win, fail, pick, clear, grow; sfx3d/cloth1 (cloth2), coins1 (handleCoins), latch1 (metalLatch), chop1 (chop), leather1 (dropLeather), cloth2-4 (cloth1, cloth3, cloth4), coins2 (handleCoins2), book1-2 (bookPlace1-2), click1 (metalClick), as mp3. No creak or door sounds, no metal pot (Oleg; pot1, metalPot1, removed 2026-11-14). |
| Impact Sounds | Kenney | CC0 1.0 | sfx/ (2D): slide, place; sfx3d/pick1-3 (impactWood_light_000, 002, 004), drop1-3 (impactWood_medium_000, 002, 004), heavy1 (impactWood_heavy_001), bump1-2 (impactPlank_medium_000, 003), stone1-3 (impactMining_000, 001, 003), thud1-3 (impactWood_heavy_000, 002, 003), tap1-3 (impactMetal_light_000, 002, 004), plank1-2 (impactPlank_medium_001, 002), soft1-2 (impactSoft_medium_000, 002), glass1 (impactGlass_light_001), as mp3 |

## Music

`music/camp-piano.mp3`: "Before Dark camp piano", made 2026-11-07 for this game with the ACE-Step v1.5 XL model on ACE Music
(acemusic.ai, TimeDomain Inc.), free plan, from the description "calm solo piano, soft felt piano, gentle flowing arpeggios,
warm and cozy, peaceful, ambient piano, minimal and unobtrusive, campfire at sunset in a forest camp, puzzle game background
music, no drums, no vocals, instrumental" (D major, 6/8, 180 s); Oleg's pick of two. ACE Music Terms of Service (version
2026-11-01), section 4.2: outputs of ACE-Step v1.5, XL included, may be used for personal and commercial purposes with no
fee, attribution appreciated but not required, and not conditional on a paid plan (https://acemusic.ai/terms/). The model
itself is MIT (github.com/ACE-Step/ACE-Step-1.5). Made with AI, and said so in the README and the store texts. Turned to
-20 LUFS at 128 kbps, cover art and tags removed.

Made in code: my own campers (src/three/people.js), every camp building (stones, logs, tent poles and canvas, sawhorses,
bench, tools, tool wall, trough, lanterns, coins...), the crates, tiles, frame, flags, mats, stencils, flames, particles,
rain, leaves, mist, sky, and the evening's birds, crickets, fire crackle, rain and wind.

The FBX models were converted in a browser page with three.js's FBXLoader and GLTFExporter (one primitive per material,
shared vertices merged, textures attached at run time by material name); unused animations were stripped from the GLBs.

## three.js

`vendor/three` holds five files of three.js r170 (npm `three@0.170.0`, integrity checked against the registry):
`build/three.module.min.js`, `examples/jsm/loaders/GLTFLoader.js`, `examples/jsm/utils/BufferGeometryUtils.js`,
`examples/jsm/utils/SkeletonUtils.js` and `examples/jsm/geometries/RoundedBoxGeometry.js`. MIT licence, copyright 2010-2024
three.js authors (`vendor/three/LICENSE`).

The music (src/three/music.js) and the owl, splash, whoosh, birds, crickets and crackle are made in code (no files).

The loading pictures (`ui/loader-wide.jpg`, `loader-tall.jpg`, `loader-phone.jpg`, since 2026-11-12) are drawn in code by
`tools/cover-drawn.js`; their title is set in Lilita One (Juan Montoreano, SIL Open Font License 1.1, from Google Fonts;
`tools/fonts/LilitaOne-OFL.txt`). Only the pictures ship with the game, not the font.

The shop's pictures (`ui/shop/*.png`, 2026-11-14) are renders of these models and of the camp's extras (made in code), by
`tools/shop-icons.js`.
