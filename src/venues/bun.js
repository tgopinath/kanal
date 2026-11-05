// Bun Kadai (பன் கடை, "bun shop"): a smash-burger counter, the second restaurant on the same table-menu platform.
// Every item is a real 3D scan (photogrammetry), credited below and on the Credits screen. Prices are fictional.
import { BY } from './kanal.js';

const sketchfab = uid => `https://sketchfab.com/3d-models/${uid}`;

// Mark: a bun in a ring, drawn on the same 64-unit grid and stroke as Kanal's ember.
export const MARK_BUN = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="29"/><path d="M16 30c0-8.5 7.2-14 16-14s16 5.5 16 14z"/><path d="M15 35.5c3 2 5 2 8 0s5-2 8 0 5 2 8 0 5-2 9 0"/><path d="M17 41h30a2 2 0 0 1-2 6H19a2 2 0 0 1-2-6z"/><path d="M26 22.5l1.5-1M33 21l1.5 1M38.5 24.5l1 1.2"/></svg>`;

export const RESTAURANT = {
  id: 'bun',
  name: 'Bun Kadai',
  wordmark: 'BUN KADAI',
  sub: 'பன் கடை', subLang: 'ta',
  line: 'Smash burgers · Chennai',
  service: 'All day',
  mark: MARK_BUN,
  heroLabel: 'House favourite',
  heroAlt: 'on the counter',
  aboutTitle: 'A bun shop, done properly.',
  about: 'Bun Kadai smashes every patty to order on a steel plancha, toasts its buns in butter and cuts its fries by hand each morning. Point your phone at the counter to see each burger at its real size before you order, then send it straight to the kitchen. Bun Kadai is a fictional restaurant made for a design portfolio.',
  theme: 'bun',
  lockupAR: 'ar/bun-lockup',
};

export const COURSES = [
  { id: 'burger', label: 'Burgers', one: 'Burger' },
  { id: 'side', label: 'Sides', one: 'Side' },
  { id: 'sweet', label: 'Shakes & sweets', one: 'Sweet' },
];

const scan = (title, author, uid) => ({ title, author, url: sketchfab(uid), license: BY, kind: '3D scan' });

export const DISHES = [
  {
    id: 'classic-burger', course: 'burger', hero: true,
    name: 'Classic Smash',
    line: 'Beef patty, butter lettuce, house sauce, toasted bun',
    story: 'Our first burger and still the one most people order: a hand-pressed beef patty smashed hard on the plancha for a crust you can hear, butter lettuce, a smoky house sauce that runs down the side, all in a bun toasted in butter.',
    grams: 260, price: 340,
    tags: ['Bestseller'], allergens: ['Gluten', 'Egg', 'Mustard'],
    pairing: 'Thick-cut fries and a cold cola',
    credit: scan('Burger', 'Whynotmake', 'aebff3e80d30473b83cb5306d5e35c9c'),
  },
  {
    id: 'cheeseburger', course: 'burger',
    name: 'Butter Bun Cheeseburger',
    line: 'Single patty, melted cheddar, soft milk bun',
    story: 'The simple one: a single smashed patty under a slice of sharp cheddar, in a soft milk bun brushed with butter. Nothing else in the way.',
    grams: 210, price: 290,
    tags: [], allergens: ['Gluten', 'Dairy'],
    pairing: 'Nuggets on the side',
    credit: scan('Cheese Burger Garry’s', 'vladFo', '2fda9e598122434ab67865d2549bd218'),
  },
  {
    id: 'vegan-double-burger', course: 'burger',
    name: 'Green Double',
    line: 'Two plant patties, vegan cheddar, poppy-seed bun',
    story: 'Two plant patties seared until crisp at the edges, vegan cheddar, lettuce and a cashew mayo, in a poppy-seed bun. Served on a teak board. Fully vegan, cooked on its own plancha.',
    grams: 340, price: 390,
    tags: ['Vegan'], allergens: ['Gluten', 'Tree nuts (cashew)'],
    pairing: 'Thick-cut fries',
    credit: scan('Double Decker Vegan Burger @ Apuro Vegan Bar', 'jcamilophoto', 'f0c6f83eda934bc59e0d1d9a7cdc4b58'),
  },
  {
    id: 'crispy-chicken-burger', course: 'burger',
    name: 'Crispy Chicken Plate',
    line: 'Buttermilk fried chicken burger with fries',
    story: 'Chicken thigh soaked overnight in spiced buttermilk, double-fried until it shatters, with tomato, cucumber and lettuce in a sesame bun. Comes as a plate with a heap of fries.',
    grams: 420, price: 380,
    tags: ['Comes with fries'], allergens: ['Gluten', 'Dairy', 'Sesame', 'Egg'],
    pairing: 'Cocoa shake',
    credit: scan('Crispy Chicken Burger', 'ARtemis 3D', '37007daa91f34701ac6165c553d59200'),
  },
  {
    id: 'fries-bowl', course: 'side',
    name: 'Thick-cut Fries',
    line: 'Hand-cut each morning, fried twice, sea salt',
    story: 'Potatoes cut by hand each morning, blanched, rested and fried again to order so they stay fluffy inside and crisp outside. Sea salt, nothing else.',
    grams: 180, price: 160,
    tags: ['Vegan'], allergens: [],
    pairing: 'Any burger',
    credit: scan('OC Chips (Reduced Quality)', 'Jimmy Gunawan', '24903f39680a4ed18fff062261ae1a9e'),
  },
  {
    id: 'nuggets', course: 'side',
    name: 'Chicken Nuggets × 6',
    line: 'Breaded chicken breast, smoky dip',
    story: 'Chunks of chicken breast in a crisp seasoned crumb, six to a slate, with a smoky dip.',
    grams: 150, price: 220,
    tags: [], allergens: ['Gluten', 'Egg'],
    pairing: 'Butter Bun Cheeseburger',
    credit: scan('Chicken Nugget', 'Laser Design', '511db88f24e04eb1be8b0c0c080e1e5e'),
    standIn: 'One scanned nugget, served six times on a modelled slate.',
  },
  {
    id: 'hot-dog', course: 'side',
    name: 'Kadai Hot Dog',
    line: 'Smoked sausage, split bun, relish, mustard',
    story: 'A smoked pork-and-beef sausage griddled until it blisters, in a split bun with sweet relish and yellow mustard.',
    grams: 180, price: 240,
    tags: [], allergens: ['Gluten', 'Mustard'],
    pairing: 'Thick-cut fries',
    credit: scan('hotdog', 'ryuki miura', '184096cd9c664d38b5889e432714381c'),
  },
  {
    id: 'milkshake', course: 'sweet', unit: 'ml',
    name: 'Cocoa Shake',
    line: 'Dark chocolate, vanilla ice cream, whipped cream',
    story: 'Thick dark-chocolate shake blended with vanilla ice cream, chocolate sauce down the cup and whipped cream on top.',
    grams: 400, price: 210,
    tags: ['Vegetarian'], allergens: ['Dairy'],
    pairing: 'Classic Smash',
    credit: scan('Milgshake', 'ra_fuq', 'c2ba2daa94f4486696e431226c7aac7f'),
    standIn: 'A rough scan: the cup is dented and the straw was cut short.',
  },
  {
    id: 'brownie', course: 'sweet',
    name: 'Peppermint Fudge Brownie',
    line: 'Dark chocolate brownie, crushed peppermint',
    story: 'A dense dark-chocolate brownie, glossy on top, with crushed peppermint candy for crunch. Warmed before it comes out.',
    grams: 90, price: 180,
    tags: ['Vegetarian'], allergens: ['Gluten', 'Dairy', 'Egg'],
    pairing: 'Cocoa shake',
    credit: scan('Candy Cane Brownie', 'jtressle', 'b5d46802166d4201873fc90bbf318924'),
  },
];

export const ENV_CREDITS = [];
