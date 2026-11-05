// Tonight's menu at Kanal. Every dish is a real 3D scan (photogrammetry) or a photo-textured model,
// credited below and on the Credits screen. Weights and prices are the restaurant's (fictional) menu.
// `model` is the GLB under public/models; `usdz` the iOS copy made by tools/usdz.mjs.

import { MARK } from '../icons.js';

export const RESTAURANT = {
  id: 'kanal',
  name: 'Kanal',
  wordmark: 'KANAL',
  sub: 'கனல்', subLang: 'ta',
  line: 'Wood-fire kitchen · Chennai',
  service: 'Dinner',
  mark: MARK,
  heroLabel: 'Tonight’s signature',
  heroAlt: 'on an oak board',
  aboutTitle: '<span lang="ta">கனல்</span> means ember.',
  about: 'Kanal cooks over a single wood fire: meat rested beside it, bread baked against its floor, pears poached in what is left of the heat. This menu lets you see each plate at its real size, on your own table, before you order. Kanal is a fictional restaurant made for a design portfolio.',
  theme: 'kanal',
  lockupAR: 'ar/lockup',
};

export const COURSES = [
  { id: 'starter', label: 'Starters', one: 'Starter' },
  { id: 'main', label: 'Mains', one: 'Main' },
  { id: 'dessert', label: 'Desserts', one: 'Dessert' },
  { id: 'drink', label: 'Drinks', one: 'Drink' },
];

export const BY = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
export const CC0 = { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const sketchfab = uid => `https://sketchfab.com/3d-models/${uid}`;

export const DISHES = [
  {
    id: 'lettuce-cup', course: 'starter',
    name: 'Butter Lettuce Cup',
    line: 'Charred chicken, sesame, crisp shallots, citrus soy',
    story: 'A whole head of butter lettuce opened like a flower and filled at the pass with ember-charred chicken thigh, toasted sesame and shallots fried slowly until they crackle. Dressed at the table with a bright citrus soy.',
    grams: 240, price: 520,
    tags: ['Gluten-free option'], allergens: ['Sesame', 'Soy'],
    pairing: 'Yuzu tonic',
    credit: { title: 'Lettuce bowl salad by Chef Yoshida', author: 'Nantsune Co. Ltd', url: sketchfab('2df67b7644d742d2b0c198bedfd7c3f2'), license: BY, kind: '3D scan' },
  },
  {
    id: 'sashimi', course: 'starter',
    name: 'Sashimi Moriawase',
    line: 'Chef’s selection for three, shiso, fresh wasabi',
    story: 'The morning’s best fish from Kasimedu harbour, cut to order: tuna, yellowtail, salmon and sea bream on crushed ice with shiso leaves, daikon and wasabi grated at the table. Serves three.',
    grams: 420, price: 2450,
    tags: ['Raw', 'Serves 3'], allergens: ['Fish', 'Soy'],
    pairing: 'Junmai sake, chilled',
    credit: { title: 'ある日の海幸の刺身盛り合わせ3人前 (sashimi platter for three)', author: 'keizi666', url: sketchfab('419d358d21a24b2cb0ef4d50b849e268'), license: BY, kind: '3D scan' },
  },
  {
    id: 'flatbread', course: 'starter',
    name: 'Wood-fired Flatbread',
    line: 'Red onion, rocket, mozzarella, on the board',
    story: 'Dough rested for forty-eight hours, stretched by hand and baked in under two minutes against the oven floor. Topped simply with mozzarella, thin red onion and a handful of rocket added the moment it leaves the fire.',
    grams: 310, price: 680,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy'],
    pairing: 'House lemonade',
    credit: { title: 'Homemade pizza', author: 'christophe.bougere', url: sketchfab('0e6df6c6ca5a4140b5ace6a957046ce9'), license: BY, kind: '3D model' },
  },
  {
    id: 'prime-rib', course: 'main',
    name: 'Prime Rib on the Board',
    line: 'Bone-in, rested over embers, smoked salt, jus',
    story: 'Our signature. A bone-in rib roasted slowly beside the fire, rested, then finished hard over coals so the crust shatters. Brought whole on an oak board and carved at your table.',
    grams: 600, price: 3200,
    tags: ['Signature', 'Serves 2'], allergens: [],
    pairing: 'Syrah, Nashik',
    hero: true,
    credit: { title: 'Prime rib on wood board', author: 'alban', url: sketchfab('0d72ef49ea764361a865207e4d0d8252'), license: BY, kind: '3D scan' },
  },
  {
    id: 'bistecca', course: 'main',
    name: 'Bistecca Fiorentina',
    line: 'T-bone, rosemary, olive oil, flaky salt',
    story: 'A thick T-bone in the Florentine way: seared on the grill, sliced off the bone and laid back around it, finished with rosemary, good olive oil and flaky salt. Rare to medium-rare only.',
    grams: 800, price: 3900,
    tags: ['Serves 2'], allergens: [],
    pairing: 'Sangiovese',
    credit: { title: 'Florence Steak – Fiorentina bistecca', author: 'Shahriar Shahrabi', url: sketchfab('969285ae788c41cd914387cecf088708'), license: BY, kind: '3D scan' },
  },
  {
    id: 'pear-tart', course: 'dessert',
    name: 'Pear Bourdaloue Tart',
    line: 'Poached pear, almond cream, sweet pastry',
    story: 'A classic Parisian tart: pears poached in vanilla syrup, fanned over almond frangipane and baked in a crisp sweet crust until the edges caramelise. Cut to order.',
    grams: 160, price: 460,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy', 'Egg', 'Nuts'],
    pairing: 'Sauternes',
    credit: { title: 'Tarte poire bordaloue', author: 'MadeleineMirabelle', url: sketchfab('8bd39f148aab472397a68930839a9aac'), license: BY, kind: '3D scan' },
  },
  {
    id: 'carrot-cake', course: 'dessert',
    name: 'Carrot Bundt Cake',
    line: 'Spiced ring cake, cream cheese glaze, walnut',
    story: 'A brown-sugar ring cake with grated carrot, cinnamon and nutmeg, baked in a fluted tin and finished with a not-too-sweet cream cheese glaze and chopped walnuts. Cut at the table for two or more.',
    grams: 180, price: 420,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy', 'Egg', 'Nuts'],
    pairing: 'Filter coffee',
    credit: { title: 'Carrot Cake', author: 'Greg Zaal & James Ray Cock (Poly Haven)', url: 'https://polyhaven.com/a/carrot_cake', license: CC0, kind: '3D scan' },
  },
  {
    id: 'apple-pie', course: 'dessert',
    name: 'Apple Pie Slice',
    line: 'Lattice crust, cinnamon apples, warm',
    story: 'Our grandmother-style pie with a flaky butter lattice and cinnamon-spiced apples, served warm on a stoneware plate.',
    grams: 150, price: 380,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy'],
    pairing: 'Masala chai',
    credit: { title: 'Slice of apple pie on a coffee plate', author: 'alban', url: sketchfab('1e96b1fd3d3c42f3aef4f3cdb6051746'), license: BY, kind: '3D scan' },
  },
  {
    id: 'strawberry-tart', course: 'dessert',
    name: 'Strawberry Tartlet',
    line: 'Ooty strawberries, crème pâtissière, vanilla ice cream',
    story: 'A single tartlet filled with vanilla custard and glazed Ooty strawberries, crowned with a scoop of house vanilla ice cream.',
    grams: 130, price: 440,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy', 'Egg'],
    pairing: 'Moscato d’Asti',
    credit: { title: 'Strawberry pie – The Smith Restaurant', author: 'Guillermo', url: sketchfab('09af8624f011406c974b7cd4678650db'), license: BY, kind: '3D model' },
  },
  {
    id: 'filter-coffee', course: 'drink',
    name: 'Kumbakonam Filter Coffee',
    line: 'Chicory blend, frothed milk, stoneware cup',
    story: 'Decoction dripped slowly through a brass filter, mixed with hot milk and pulled until it froths. Served in a hand-thrown stoneware cup.',
    grams: 180, price: 160, unit: 'ml',
    tags: ['Vegetarian'], allergens: ['Dairy'],
    pairing: 'Carrot bundt cake',
    standIn: 'The scan shows the stoneware cup it is served in, not the coffee’s froth.',
    credit: { title: 'Pottery coffee cup', author: 'harukaf', url: sketchfab('f5e8252067fc4fa5a1f79f4e3d7b7c45'), license: BY, kind: '3D scan' },
  },
  {
    id: 'tea-service', course: 'drink',
    name: 'Nilgiri Tea Service',
    line: 'Single-estate black tea, pot, cup and sugar',
    story: 'A pot of single-estate Nilgiri black tea, brewed for four minutes and brought with a fine china cup and a lidded sugar pot; milk on request.',
    grams: 500, price: 340, unit: 'ml',
    tags: ['Vegan option'], allergens: [],
    pairing: 'Apple pie slice',
    standIn: 'A modelled china set (not a scan), rearranged for the table; the tea itself is not shown.',
    credit: { title: 'Tea Set 01', author: 'Rico Cilliers, James Ray Cock & Jurita Burger (Poly Haven)', url: 'https://polyhaven.com/a/tea_set_01', license: CC0, kind: '3D model' },
  },
];

export const ENV_CREDITS = [
  { what: 'Walnut table surface', title: 'Black Walnut Veneer 02', author: 'Poly Haven', url: 'https://polyhaven.com/a/black_walnut_veneer_02', license: CC0 },
  { what: 'Board under the flatbread', title: 'Wooden Cutting Board', author: 'Poly Haven', url: 'https://polyhaven.com/a/wooden_cutting_board', license: CC0 },
];


