# Kanal (கனல்) — a table menu you can set down on the table

Portfolio concept piece. Kanal is a **fictional** wood-fire restaurant in Chennai (கனல் = ember). The logo mark (a flame inside a ring, above a hearth line) and the name are original.

## Problem
Menus describe food in words and, at best, a styled photo. Guests can't tell how big "600 g prime rib, serves 2" is, whether a tartlet is a bite or a slice, or what three people's sashimi platter looks like on their table. Over-ordering, under-ordering and "that's not what I expected" follow.

## User
A guest seated at a table, phone in hand (QR on the table or the restaurant's app), usually in dim, warm light, ordering in 2–5 minutes, often for a group. Secondary: the restaurant, which wants its signature dishes to sell themselves without a pushy upsell.

## Jobs to be done
1. *When I'm deciding what to order, I want to see how big a dish really is, so I order the right amount.*
2. *When a friend asks "what's that?", I want to show them the dish quickly, not read a paragraph.*
3. *When I've picked, I want to show my server a clear list, so nothing gets lost in a noisy room.*

## v1 screens
1. **Menu** — masthead with the lockup and table number, tonight's signature, sticky course tabs (Starters, Mains, Desserts, Drinks) with scroll-spy, dish rows (scan poster, Cormorant name, line, `weight · price` in mono, one tag, AR shortcut).
2. **Dish** — `<model-viewer>` turntable on walnut (drag to turn, pinch, reset, previous/next dish), story, pairing, allergens, **View on your table**, add-to-shortlist stepper, model credit with licence.
3. **On the table** — the concept layout from the reference: dish standing on walnut, a frosted card floating above (serif name, thin gold rule, `280 g · ₹1,450`), a leader line to a glowing pin, and the KANAL · MENU lockup with previous / pause / next lying flat on the table. 8-second slideshow with a progress ring; pause, arrows, keyboard (←/→/space), touching the dish pauses. On a computer this *is* the experience; on phones **Open camera** hands off to real AR.
4. **Native AR** (Android and iPhone) — plane detection with coaching, tap to set the dish down at real size, the same card, leader line, pin, flat lockup and ring controls tracked to the table; pinch to resize, twist to turn, tap the table again to move it; next/prev swap with a scale/fade; pause stops the auto-advance. Closing returns the menu to the dish you were looking at.
5. **Shortlist** — dishes and quantities, estimated total, "Show to my server" large-type sheet. Stays on the phone; nothing is ordered.
6. **About** — the restaurant, how the AR works, theme switch (Match phone / Evening / Daylight), full credits.

## Architecture (and why)
- **Web layer: Vite + plain JS** (`src/`), Kolam tokens and components (`src/kolam/`, `k-` classes) with a per-app theme: champagne gold primary (#d9bd84 dark / #7d5d22 light) and warm walnut neutrals. Lato for all UI, JetBrains Mono for weights and prices. **Exception to flag:** dish names and display lines use **Cormorant Garamond** (brand layer only), because the concept depends on a serif display face; Kolam's rule is Lato-only. `@google/model-viewer` for the 3D turntable and the PWA's AR fallback (WebXR / Scene Viewer / Quick Look). PWA manifest + service worker (offline at the table once opened).
- **Android: Capacitor 8 shell + custom native plugin `TableAR`** (`android/app/src/main/java/com/gopinath/kanal/`): `TableARPlugin.kt` starts `TableArActivity.kt` (Kotlin, **ARCore via SceneView `io.github.sceneview:arsceneview:2.3.0`**) and resolves with the last dish index. `TableOverlayView.kt` draws the card, leader line, pin, coaching panel, and the lockup image warped with a perspective matrix onto the table plane; real `ImageButton`s sit on the projected ring centres so TalkBack can use them. Unlike the other portfolio shells, **the web app is bundled in the APK, not loaded from Vercel**: the AR view needs the model files locally, and the menu should work offline in a restaurant with poor signal. ARCore is `optional` in the manifest, so the menu installs on every phone.
- **iOS: SwiftUI shell (ZoorassicPark-iOS pattern) + ARKit/RealityKit** (`ios/Kanal/`), no third-party dependencies. `WebShell.swift` serves the bundled web build over a `kanal://` scheme (ES modules, fetch of models and fonts work offline) and listens on the `tableAR` message handler. `ARTableView.swift`: `ARWorldTrackingConfiguration` (horizontal planes, environment texturing, people occlusion where supported) with `ARCoachingOverlayView`; tap → raycast → anchor; USDZ dishes via `ModelEntity.loadModelAsync`, RealityKit scale/rotate gestures; the lockup is a textured unlit plane lying on the table; the card is a `UIVisualEffectView` (real frosted blur) projected each frame with `ARView.project`. Without ARKit (Simulator) it shows **"AR needs a real iPhone"** and a RealityKit non-AR *studio preview* of the same scene on a virtual walnut table, so the layout can be checked.
- **Why not one codebase (Expo + ViroReact)?** The table UI is the whole point: a frosted card with real blur, a crisp serif and controls that lie on the table. Native ARKit/RealityKit and ARCore/SceneView give us that directly and stay close to the platform AR conventions (Apple's coaching overlay, Google's plane renderer). The menu itself is written once on the web and reused by the web, Android and iPhone apps; only the camera view is per-platform. The Android side also follows the existing Capacitor/Mettu native-plugin pattern.

## 3D models
All downloaded without an account: Sketchfab scans via the Objaverse mirror on Hugging Face (`allenai/objaverse`, licence metadata from its per-object records) and Poly Haven (CC0). Processed by `tools/process-models.mjs` (weld, meshopt simplify, 1024 px textures, re-centred with the bottom on y = 0, scaled to real-world size in metres). GLBs 0.1–4.5 MB each; iOS USDZ (three.js exporter with JPEG textures, then macOS `usdcrush`, validated by `usdchecker`) 0.14–4.0 MB each. No Draco/meshopt geometry compression, so Filament, RealityKit and model-viewer all read them without decoders.

| Dish | Source model | Author | Licence | Kind |
|---|---|---|---|---|
| Butter Lettuce Cup | [Lettuce bowl salad by Chef Yoshida](https://sketchfab.com/3d-models/2df67b7644d742d2b0c198bedfd7c3f2) | Nantsune Co. Ltd | CC BY 4.0 | scan |
| Sashimi Moriawase | [ある日の海幸の刺身盛り合わせ3人前](https://sketchfab.com/3d-models/419d358d21a24b2cb0ef4d50b849e268) | keizi666 | CC BY 4.0 | scan (scan base trimmed) |
| Wood-fired Flatbread | [Homemade pizza](https://sketchfab.com/3d-models/0e6df6c6ca5a4140b5ace6a957046ce9) | christophe.bougere | CC BY 4.0 | model (scan paper trimmed; small white edges remain) |
| Prime Rib on the Board | [Prime rib on wood board](https://sketchfab.com/3d-models/0d72ef49ea764361a865207e4d0d8252) | alban | CC BY 4.0 | scan |
| Bistecca Fiorentina | [Florence Steak – Fiorentina bistecca](https://sketchfab.com/3d-models/969285ae788c41cd914387cecf088708) | Shahriar Shahrabi | CC BY 4.0 | scan |
| Pear Bourdaloue Tart | [Tarte poire bordaloue](https://sketchfab.com/3d-models/8bd39f148aab472397a68930839a9aac) | MadeleineMirabelle | CC BY 4.0 | scan |
| Carrot Bundt Cake | [Carrot Cake](https://polyhaven.com/a/carrot_cake) | Greg Zaal, James Ray Cock | CC0 | scan |
| Apple Pie Slice | [Slice of apple pie on a coffee plate](https://sketchfab.com/3d-models/1e96b1fd3d3c42f3aef4f3cdb6051746) | alban | CC BY 4.0 | scan |
| Strawberry Tartlet | [Strawberry pie – The Smith Restaurant](https://sketchfab.com/3d-models/09af8624f011406c974b7cd4678650db) | Guillermo | CC BY 4.0 | model |
| Kumbakonam Filter Coffee | [Pottery coffee cup](https://sketchfab.com/3d-models/f5e8252067fc4fa5a1f79f4e3d7b7c45) | harukaf | CC BY 4.0 | scan — **stand-in**: the cup, not the coffee's froth |
| Nilgiri Tea Service | [Tea Set 01](https://polyhaven.com/a/tea_set_01) | Rico Cilliers, James Ray Cock, Jurita Burger | CC0 | modelled set, **stand-in**: not a scan, rearranged (pot, cup and saucer, sugar pot), no tea shown |

Environment: [Black Walnut Veneer 02](https://polyhaven.com/a/black_walnut_veneer_02) and [Brown Photostudio 02](https://polyhaven.com/a/brown_photostudio_02) HDRI (Poly Haven, CC0). Fonts: Lato and Cormorant Garamond (SIL OFL, licences in `native-fonts/`). No tacos: no account-free realistic taco scan exists, so the menu was written around the scans that do. Every credit is also in the app (About → Credits, and under each dish).

## Run and build
```sh
npm install
npm run dev                       # http://localhost:5310
npm run build                     # dist/ (web, also bundled into both apps)

# models (sources in models-src/, not committed)
node tools/process-models.mjs     # public/models/*.glb + models-src/ios/*.glb
node tools/usdz.mjs               # public/models/*.usdz   (dev server running)
node tools/posters.mjs            # public/posters/*.webp  (dev server running)
node tools/ar-assets.mjs          # public/ar/lockup-*.png (dev server running)
node tools/shots.mjs              # prototype/shots/*.jpg + shots-desktop/web.jpg
node tools/native-icons.mjs       # Android launcher icons/splash + iOS app icon

# Android (Java from Android Studio)
npx cap sync android
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk (copied to kanal.apk)

# iOS (Simulator)
cd ios && xcodebuild -project Kanal.xcodeproj -scheme Kanal -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcrun simctl install "iPhone 17 Pro" build/Build/Products/Debug-iphonesimulator/Kanal.app
xcrun simctl launch "iPhone 17 Pro" com.gopinath.kanal -kanalDemo prime-rib   # opens the table view's native screen directly
```
The iOS build phase copies `../dist` into the app, so run `npm run build` first. For a device build, open `ios/Kanal.xcodeproj`, pick the team (22CAB8R3V5 is set) and run on an iPhone.

## Verified vs. unverified (2026-11-05)
**Verified**
- Web: dev server, every screen at 375/390 px and 1440 px, dark and light, no console errors; table slideshow (next/prev/pause, progress ring, swap transition), leader line tracking, shortlist and server sheet, credits, theme switch.
- Android: debug APK builds (56 MB, arm64/armv7/x86_64); installs and runs on the Medium_Phone_API_36.1 emulator: menu, dish 3D viewer and the table preview run inside the app from bundled files; **Open camera** starts `TableArActivity` (camera permission prompt, Filament engine, ARCore session creation); System back returns `{ index, ok: true }` and the menu stays on that dish.
- Google Play Services for AR 1.57.0 (official ARCore SDK release, Google-signed) was installed on the emulator, but **ARCore can't open the emulator's virtual camera on this Apple-silicon (arm64) image** ("No default camera 0 found" → `FatalException`); the activity shows its friendly error state instead of crashing.
- iOS: `xcodebuild` for the iPhone 17 Pro Simulator succeeds; the app launches; the bundled menu renders over `kanal://`; the native table view opens from the web button, shows **"AR needs a real iPhone"**, and the RealityKit studio preview renders the USDZ dish, the frosted Cormorant card, leader line, pin and the lockup lying on the table with ring buttons in the right places; the slideshow advances.

**Not verified (needs real devices)**
- Real AR on Android: plane detection, tap placement, the perspective-warped lockup, ring-button alignment, pinch/rotate gestures, lighting estimation, model swap animation, shadows. Needs an ARCore phone.
- Real AR on iPhone: ARKit placement, coaching overlay, gestures, people occlusion, close-button round trip (code path shared with the simulator view, but tapping wasn't automated there because the Simulator integration needs `xcode-select`). Needs an iPhone with ARKit.
- Mobile-web AR hand-off (`model-viewer` WebXR / Scene Viewer / Quick Look) on real phones.
- Not published: no GitHub repo, no Vercel project (planned URL `https://kanal-menu.vercel.app`), no APK release, no portfolio card.

## Success criteria
- A guest can go from the menu to a dish standing on their table in under 10 seconds, and back with the dish they were looking at still selected.
- Every dish shows its real size, weight and price, and every model credits its author and licence.
- WCAG AA: text contrast in both themes, 48 px targets, keyboard and screen-reader use for the menu and the table controls (real buttons over the drawn rings in both native AR views).

## Out of scope for v1
Ordering and payment, accounts/sign-in, a real restaurant backend or POS, multiple languages (Tamil appears in the brand only), dietary filters, server-side analytics, App Store / Play Store release.

## UI element sources
Looked at AI Elements, assistant-ui, prompt-kit, CopilotKit and 21st.dev for patterns before designing: the course tabs follow the *suggestion chips* pattern (scrollable pill row); the coaching panel and How-it-works steps follow prompt-kit's *steps/loader* pattern; the dish card and floating glass card follow 21st.dev's *glass card* and AI Elements' *inline citation/source* structure (credit under each dish); the slideshow progress ring follows the *auto-advancing carousel with pause* pattern. Structure and behaviour only; every element is rebuilt with Kolam tokens.

## Table ordering (added 2026-11-05)
Guests order straight to the kitchen; no server takes the order.
- **Table QR codes:** `tables.html` prints one code per table (01–12): `<menu>?table=07&k=<check code>`. Scanning seats the phone at that table for 4 hours; a wrong check code is rejected. A "Can't scan? enter the number" picker is the fallback. Codes are derived in `src/orders.js` (`tableCode`); a real deployment should issue and rotate them on the server.
- **Guest (`#/order`):** cart with steppers, a note for the kitchen (allergies), "Send to the kitchen" with a confirm dialog. Sent rounds show a live 4-step tracker (Received → Cooking → On its way → Served), the running bill, and "Ask for the bill". Status-change toasts appear on any screen. "Add to order" is also on the dish page and on the table-view card.
- **Kitchen (`kitchen.html`):** tablet board, columns New / On the fire / To run, with a timer per ticket (amber after 12 min, red after 20), notes highlighted, one-tap advance with Undo, a bill-request strip, an optional chime, a "Served tonight" log, and a Demo order button.
- **Channel:** `src/orders.js` (list / put / subscribe) uses localStorage + BroadcastChannel, so guest and kitchen sync live between tabs on **one device** (open the kitchen in a second window to demo). Real cross-device ordering needs a realtime backend behind the same three calls (e.g. Firestore with anonymous auth); not wired yet.
- Verified: Playwright end to end (QR seat, bad code rejected, cart + note, send, kitchen receives, status flows back, bill request, table-view add), no console errors; APK and iOS Simulator builds succeed with the new pages bundled.

## Dish visuals (2026-11-05)
Scans shipped as `KHR_materials_unlit` with roughness 1, so they looked pasted on. `tools/process-models.mjs` now (per-dish `look` in `tools/dishes-src.json`) makes them lit PBR: smooth normals, a normal map and a gloss/roughness map derived from each scan's colour, clearcoat on wet/glazed dishes, and part of the colour fed back as emission so baked capture light doesn't go muddy. Lighting is a custom warm HDRI (`tools/make-hdr.mjs` → `public/env/hearth.hdr`) with `tone-mapping="neutral"`; stages have a warm spotlight pool. Posters are 1024 px. Before/after: `node tools/compare.mjs <id> b.tone-mapping=neutral` (needs old GLBs in `public/old/`).

## Proper cut-outs (2026-11-05)
The old `trimBelow` height slice left torn paper and broken plates. `tools/process-models.mjs` now takes per-dish rules in `dishes-src.json`:
- `remove`: drop triangles by the scan's real texture colour (`sat`, `lum`, `hue`), height band (`below`/`above`/`reach`) and distance from centre (`outside`).
- `islands`: drop loose fragments below a fraction of the surface area.
- `vessel`: a clean modelled plate (`plate`) or slate (`slate`), or a real CC0 model (`src`), replacing a broken scanned vessel. The food is lifted onto it.
- `repeat`: extra servings of one scan (six nuggets).
Check with `node tools/inspect.mjs /models/<id>.glb out.jpg` (three views on magenta). Note: Vite serves public files at `/models/…`, not `/public/models/…`.

## Second restaurant: Bun Kadai (2026-11-05)
`src/venues/<id>.js` each hold a brand (name, wordmark, Tamil sub-line, mark, copy, AR lockup prefix), courses (with singular `one`) and dishes. `src/dishes.js` resolves the active venue: URL `?venue=` → a scanned table code (no venue = Kanal) → the seated table → the last venue opened → Kanal. Staff pages (`kitchen.html`, `tables.html`) follow their URL only. The theme is under `[data-venue="bun"]` in `styles.css`: charcoal, mustard #f2b33d (light #8a5a00), Lato 900 for brand type, and a procedural brushed-steel counter from `tools/make-counter.mjs`. Orders, table codes and kitchen tickets are tagged with the venue. Native AR receives `lockup` (`ar/bun-lockup`) in the payload. About → "Restaurants on this menu" switches between them.
- Bun Kadai menu: 9 CC BY scans from Objaverse (`models-src/burger/sources.json`). There's no soda (no unbranded scan exists). The Double Stack (a Big Mac scan) was dropped for quality and brand reasons. Stand-ins are labelled: the nuggets are one scan repeated, and the shake is a rough scan.
- The table view now frames dishes at one real-world scale (camera at least 0.62 m), so a burger reads smaller than a 40 cm board.
- The native card colours and fonts are still Kanal's gold/serif in both venues; only the lockup image changes per venue. Bun Kadai as its own branded app (app id, icon, name) isn't done yet.
