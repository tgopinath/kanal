// Native app looks for the menu.
// Inside the Android app the menu takes Material Design 3 (Kolam M3 kit: top app bar, navigation bar,
// hardware Back); inside the iPhone app it takes Apple's HIG look (Kolam iOS kit: large titles, Liquid Glass
// tab bar, back + centred title). The kits are plain scripts in public/kolam-native, loaded in <head> so
// <html> is tagged before the first paint. In a browser both stay off and the Kolam website is unchanged.
// The native AR views (ARCore / ARKit) are untouched: they keep their own table UI.

const TABS = [
  { id: 'menu', label: 'Menu', m3: 'restaurant_menu', ios: 'list.bullet', href: '#/' },
  { id: 'table', label: 'On the table', m3: 'table_restaurant', ios: 'square.grid.2x2', href: '#/table/prime-rib' },
  { id: 'order', label: 'Order', m3: 'shopping_bag', ios: 'bag', href: '#/order' },
  { id: 'about', label: 'About', m3: 'info', ios: 'info.circle', href: '#/about' },
];
const BAG = '<svg class="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 8.5h13l-1 11h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/></svg>';
const QR = '<svg class="ios-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/></svg>';

let m3 = null, ios = null, ctx = { tableLabel: () => '', tableHref: () => '#/table/prime-rib' };

export function initNativeUI(opts) {
  ctx = { ...ctx, ...opts };
  const iosTabs = TABS.map(t => ({ id: t.id, label: t.label, icon: t.ios === 'bag' ? BAG : t.ios, href: t.href }));
  // iOS wins if both kits would switch on.
  ios = window.KolamIOS ? window.KolamIOS.init({
    appName: 'Kanal', uaTokens: ['Kanal-iOS'],
    tint: { light: '#6F521C', dark: '#E3C992' },
    tabs: iosTabs, currentTab: 'menu', content: '#app',
    onTabSelect: id => { if (id === 'table') { location.hash = ctx.tableHref(); return false; } },
  }) : null;
  if (ios) { document.documentElement.classList.remove('k-android', 'k-app'); return; }
  const k = window.KolamM3?.init({
    primary: '#7d5d22', title: 'Kanal', home: '#/',
    destinations: TABS.map(t => t.id === 'table'
      ? { id: t.id, label: t.label, icon: t.m3, onSelect: () => { location.hash = ctx.tableHref(); } }
      : { id: t.id, label: t.label, icon: t.m3, href: t.href }),
    actions: [{ id: 'kanalTable', icon: 'qr_code_2', label: 'Your table', href: '#/order' }],
    isRoot: () => !location.hash.startsWith('#/dish/'),
  });
  m3 = k?.enabled ? k : null;
}

export const nativeOn = () => !!(ios || m3);

// Per screen: view = 'menu' | 'dish' | 'table' | 'order' | 'about'.
export function syncNativeUI(view, { title, backLabel } = {}) {
  if (!ios && !m3) return;
  document.documentElement.dataset.kanalView = view;
  const tab = view === 'dish' ? 'menu' : view;
  // The kits reset their per-screen state on every route change, so set ours just after them.
  setTimeout(() => {
    if (ios) {
      window.KolamIOS.tabBar.select(tab);
      const actions = [{ id: 'kanalTableIos', icon: QR, label: 'Your table', onClick: () => { location.hash = '#/order'; } }];
      if (view === 'dish') window.KolamIOS.navBar.set({ title, back: { label: backLabel || 'Menu', onClick: () => (history.length > 1 ? history.back() : (location.hash = '#/')) }, keepTitle: true });
      else window.KolamIOS.navBar.set({ title, subtitle: view === 'menu' ? ctx.tableLabel() : undefined, large: view !== 'table', actions: view === 'menu' ? actions : [], keepTitle: true });
      window.KolamIOS.enhance(document.getElementById('app'));
    } else {
      m3.setTitle(title);
      m3.setActive(tab);
      m3.setBack(view === 'dish' ? '#/' : false);
    }
  });
}
