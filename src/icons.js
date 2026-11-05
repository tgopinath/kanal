// Line icons (24 px grid, 1.75 stroke) drawn for Kanal. No emoji, no fills.
const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  prev: '<path d="M14.5 7l-5 5 5 5"/>',
  next: '<path d="M9.5 7l5 5-5 5"/>',
  pause: '<path d="M9.5 7.5v9M14.5 7.5v9"/>',
  play: '<path d="M9.5 7.2v9.6l7.4-4.8z"/>',
  ar: '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.8 7.9L12 12l7.2-4.1M12 12v8.3"/>',
  table: '<path d="M3 9.5h18M5 9.5l-1.5 9M19 9.5l1.5 9M8 9.5v4h8v-4"/>',
  menu: '<path d="M5 6.5h14M5 12h14M5 17.5h9"/>',
  bookmark: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z"/>',
  bookmarkOn: '<path d="M7 4.5h10v15l-5-3.6-5 3.6z"/><path d="M9.8 10.2l1.6 1.6 3-3.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.6v3.6h-3.6"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  camera: '<path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v10H4z"/><circle cx="12" cy="13.2" r="3.3"/>',
  phone: '<rect x="7" y="3.5" width="10" height="17" rx="2"/><path d="M11 17.5h2"/>',
  hand: '<path d="M8.5 13V6.8a1.4 1.4 0 0 1 2.8 0V12M11.3 11V5.4a1.4 1.4 0 0 1 2.8 0V11M14.1 11V6.8a1.4 1.4 0 0 1 2.8 0v6.7c0 3.5-2.4 6-5.6 6-2.4 0-3.8-1.1-5.1-3.3L4.6 13a1.4 1.4 0 0 1 2.3-1.5l1.6 2"/>',
  external: '<path d="M13.5 5.5h5v5M18.5 5.5l-7.5 7.5M16.5 13.5v5h-11v-11h5"/>',
  leaf: '<path d="M5.5 18.5c0-8 5-13 13-13 0 8-5 13-13 13z"/><path d="M5.5 18.5l7-7"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/>',
  moon: '<path d="M18.5 14.5A7.5 7.5 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9z"/>',
  check: '<path d="M5.5 12.5l4 4 9-9.5"/>',
  bag: '<path d="M5.5 8.5h13l-1 11h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  send: '<path d="M4.5 11.5l15-7-5.5 15-2.5-6z"/><path d="M11.5 13.5l8-9"/>',
  bell: '<path d="M6.5 16.5h11l-1.3-2V10a4.2 4.2 0 0 0-8.4 0v4.5z"/><path d="M10.5 19a1.6 1.6 0 0 0 3 0"/>',
  receipt: '<path d="M6.5 3.5h11v17l-2.2-1.4-1.6 1.4-1.7-1.4-1.7 1.4-1.6-1.4-2.2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  qr: '<path d="M4.5 4.5h5v5h-5zM14.5 4.5h5v5h-5zM4.5 14.5h5v5h-5z"/><path d="M14.5 14.5h2v2M19.5 14.5v5h-3M14.5 19.5v-1"/>',
  flame: '<path d="M12 3.5c3.5 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3 1.5-5.3 3.2-7.2.3 2.4 1.4 3.8 2.8 4.3-.8-3-.3-6 0-8.1z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="k-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;

export const MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="29"/><path d="M32 13c6 7 11 13.5 11 21.5a11 11 0 0 1-22 0c0-5.2 2.6-9.2 5.6-12.6.6 4.2 2.4 6.6 4.9 7.6-1.4-5.4-.6-11 .5-16.5z"/><path d="M32 36.5c2.2 2 3.6 3.9 3.6 6a3.6 3.6 0 0 1-7.2 0c0-2.1 1.4-4 3.6-6z"/><path d="M20 52h24"/></svg>`;
