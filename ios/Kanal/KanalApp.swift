import SwiftUI
import CoreText

/// Kanal on iPhone: the same menu as the web and Android apps (bundled, works offline at the table),
/// plus a native ARKit + RealityKit view for "View on your table".
@main
struct KanalApp: App {
    init() { Brand.registerFonts() }
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    @State private var arRequest: ARRequest?
    @State private var webReturn: Int?

    var body: some View {
        WebShell(onOpenAR: { arRequest = $0 }, returnIndex: $webReturn)
            .ignoresSafeArea()
            .background(Color(red: 0.07, green: 0.055, blue: 0.04))
            .fullScreenCover(item: $arRequest) { req in
                ARTableScreen(request: req) { index in
                    arRequest = nil
                    webReturn = index
                }
                .ignoresSafeArea()
            }
    }
}

/// What the web menu sends when "Open camera" is tapped.
struct ARRequest: Identifiable {
    struct Dish { let id, name, qty, price, usdz: String }
    let id = UUID()
    let dishes: [Dish]
    let index: Int
    /// Prefix of the venue's table-lockup PNGs, e.g. "ar/lockup" (Kanal) or "ar/bun-lockup" (Bun Kadai).
    var lockup = "ar/lockup"
}

enum Brand {
    static let gold = UIColor(red: 0.851, green: 0.741, blue: 0.518, alpha: 1)
    static let goldLight = UIColor(red: 0.91, green: 0.827, blue: 0.651, alpha: 1)
    static let ink = UIColor(red: 0.984, green: 0.957, blue: 0.91, alpha: 1)
    static let walnut = UIColor(red: 0.07, green: 0.055, blue: 0.04, alpha: 1)

    static func registerFonts() {
        for name in ["CormorantGaramond", "Lato-Regular", "Lato-Bold"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }

    /// Cormorant Garamond SemiBold from the variable font (falls back to the system serif).
    static func serif(_ size: CGFloat) -> UIFont {
        let base = UIFontDescriptor(fontAttributes: [.family: "Cormorant Garamond"])
        let wght = 0x77676874 // 'wght'
        let d = base.addingAttributes([UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String): [wght: 600]])
        let f = UIFont(descriptor: d, size: size)
        if f.familyName == "Cormorant Garamond" { return f }
        return UIFont(descriptor: UIFont.systemFont(ofSize: size, weight: .semibold).fontDescriptor.withDesign(.serif) ?? base, size: size)
    }
    static func sans(_ size: CGFloat, bold: Bool = false) -> UIFont {
        UIFont(name: bold ? "Lato-Bold" : "Lato-Regular", size: size) ?? .systemFont(ofSize: size, weight: bold ? .bold : .regular)
    }
}
