# Kanal — table menu with AR

A portfolio concept by Gopinath Thandapani: the menu of Kanal (கனல், "ember"), a fictional wood-fire restaurant in Chennai.
Browse tonight's dishes as real 3D scans, then set one down on your own table at its real size, with its name and price floating above it
and the KANAL · MENU controls lying on the table.

- **Web / PWA** — Vite, plain JS, Kolam design system, `<model-viewer>`. `npm install && npm run dev` → http://localhost:5310
- **Android** — Capacitor 8 shell with a native ARCore view (Kotlin + SceneView) in `android/`
- **iPhone** — SwiftUI shell with a native ARKit + RealityKit view in `ios/`

See [BRIEF.md](BRIEF.md) for the design brief, architecture, build commands, model credits and what has been verified.

3D models: CC BY 4.0 and CC0 scans by their authors (credited in the app and in BRIEF.md). Code: MIT.
