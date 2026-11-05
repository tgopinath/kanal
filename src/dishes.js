// The menu the app is showing. Each restaurant ("venue") lives in src/venues/<id>.js with its brand, courses,
// dishes and credits. The venue comes from the table's QR code (?venue=bun&table=03…), is remembered with the table
// for the visit, and falls back to Kanal. Every screen reads the active venue through these exports.
import * as kanal from './venues/kanal.js';
import * as bun from './venues/bun.js';

export const VENUES = { kanal, bun };
const read = () => { try { return JSON.parse(localStorage.getItem('kanal.table.v1'))?.venue; } catch { return null; } };
const q = new URLSearchParams(location.search);
// A Kanal table code carries no venue; any scanned table code decides the venue outright.
const fromUrl = q.get('venue') || (q.get('table') ? 'kanal' : null);
// Staff screens (kitchen, table codes) follow their own address only; the guest menu also remembers the seated venue.
const staff = /(kitchen|tables)\.html$/.test(location.pathname);
const last = () => { try { return localStorage.getItem('kanal.venue.v1'); } catch { return null; } };
export const VENUE_ID = VENUES[fromUrl] ? fromUrl : staff ? 'kanal' : VENUES[read()] ? read() : VENUES[last()] ? last() : 'kanal';
if (!staff) try { localStorage.setItem('kanal.venue.v1', VENUE_ID); } catch {}
const V = VENUES[VENUE_ID];

export const { RESTAURANT, COURSES, DISHES, ENV_CREDITS } = V;
export const byId = id => DISHES.find(d => d.id === id);
export const inCourse = c => DISHES.filter(d => d.course === c);
export const formatPrice = n => '₹' + n.toLocaleString('en-IN');
export const formatQty = d => `${d.grams} ${d.unit || 'g'}`;
export const lockupHTML = (small = false, R = RESTAURANT) =>
  `<span class="lockup ${small ? 'lockup-sm' : ''}">${R.mark}<span class="lockup-words"><span class="lockup-name">${R.wordmark}</span>${R.sub ? `<span class="lockup-ta" lang="${R.subLang}">${R.sub}</span>` : ''}</span></span>`;
document.documentElement.dataset.venue = VENUE_ID;
