// Bridge to the native AR view.
// Android: the Capacitor plugin "TableAR" (Kotlin + ARCore/SceneView).
// iOS: the SwiftUI shell's WKScriptMessageHandler "tableAR" (ARKit + RealityKit); replies come back via window.__kanalNative.
// On the web, `available()` is false and the app falls back to <model-viewer> AR or the table preview.

const cap = () => window.Capacitor;
const ios = () => window.webkit?.messageHandlers?.tableAR;

export const platform = () => {
  if (ios()) return 'ios';
  if (cap()?.isNativePlatform?.() && cap().getPlatform?.() === 'android') return 'android';
  return 'web';
};

export const Native = {
  available: () => platform() !== 'web',

  // dishes: [{ id, name, qty, price, model, usdz }] ; index: dish to start with
  async open(dishes, index) {
    const payload = { dishes, index };
    if (ios()) {
      return new Promise(res => {
        window.__kanalNative = Object.assign(window.__kanalNative || {}, { closed: i => res({ ok: true, index: i }) });
        ios().postMessage({ action: 'open', ...payload });
      });
    }
    const c = cap();
    if (c?.nativePromise) return c.nativePromise('TableAR', 'open', payload);
    return c.Plugins.TableAR.open(payload);
  },

  async support() {
    if (ios()) return new Promise(res => {
      window.__kanalNative = Object.assign(window.__kanalNative || {}, { support: res });
      ios().postMessage({ action: 'support' });
      setTimeout(() => res({ supported: false, reason: 'timeout' }), 1500);
    });
    const c = cap();
    if (!c?.isNativePlatform?.()) return { supported: false, reason: 'web' };
    try { return await (c.nativePromise ? c.nativePromise('TableAR', 'support', {}) : c.Plugins.TableAR.support()); }
    catch (e) { return { supported: false, reason: String(e?.message || e) }; }
  },
};
