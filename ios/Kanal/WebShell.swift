import SwiftUI
import WebKit
import SafariServices
import ARKit
import UniformTypeIdentifiers

/// The Kanal web menu, served from the app bundle (web/) through a custom kanal:// scheme so ES modules,
/// fetch() of 3D models and fonts all work offline. The page talks to native code through the "tableAR" message handler.
struct WebShell: UIViewRepresentable {
    static let home = URL(string: "kanal://app/index.html")!
    let onOpenAR: (ARRequest) -> Void
    @Binding var returnIndex: Int?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "kanal")
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(context.coordinator, name: "tableAR")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = Brand.walnut
        web.scrollView.backgroundColor = Brand.walnut
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        #if DEBUG
        web.isInspectable = true
        #endif
        web.load(URLRequest(url: Self.home))
        context.coordinator.web = web
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        if let i = returnIndex {
            DispatchQueue.main.async { returnIndex = nil }
            web.evaluateJavaScript("window.__kanalNative && window.__kanalNative.closed && window.__kanalNative.closed(\(i))")
        }
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let parent: WebShell
        weak var web: WKWebView?
        init(_ parent: WebShell) { self.parent = parent }

        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
            switch action {
            case "support":
                let ok = ARWorldTrackingConfiguration.isSupported
                web?.evaluateJavaScript("window.__kanalNative && window.__kanalNative.support && window.__kanalNative.support({ supported: \(ok), reason: '\(ok ? "arkit" : "simulator-or-unsupported")' })")
            case "open":
                let list = (body["dishes"] as? [[String: Any]] ?? []).map {
                    ARRequest.Dish(id: $0["id"] as? String ?? "", name: $0["name"] as? String ?? "", qty: $0["qty"] as? String ?? "",
                                   price: $0["price"] as? String ?? "", usdz: $0["usdz"] as? String ?? "")
                }
                guard !list.isEmpty else { return }
                let index = min(max(0, (body["index"] as? Int) ?? 0), list.count - 1)
                parent.onOpenAR(ARRequest(dishes: list, index: index))
            default: break
            }
        }

        /// Test hook: launching with `-kanalDemo <dish-id>` opens that dish's table view and taps "Open camera",
        /// so the native view can be checked in the Simulator without touch input.
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            let args = ProcessInfo.processInfo.arguments
            guard let i = args.firstIndex(of: "-kanalDemo"), i + 1 < args.count, !didDemo else { return }
            didDemo = true
            let id = args[i + 1].replacingOccurrences(of: "'", with: "")
            webView.evaluateJavaScript("location.hash = '#/table/\(id)'; setTimeout(() => document.querySelector('#ts-ar') && document.querySelector('#ts-ar').click(), 2500)")
        }
        private var didDemo = false

        // Credits and licence links open in Safari's in-app viewer.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, url.scheme == "https" || url.scheme == "http" {
                if let vc = webView.window?.rootViewController {
                    var top = vc; while let p = top.presentedViewController { top = p }
                    top.present(SFSafariViewController(url: url), animated: true)
                }
                return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        }
    }
}

/// Serves kanal://app/<path> from the bundle's web/ folder.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst()))
        guard file.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish(); return
        }
        let mime = Self.mime(file.pathExtension)
        let headers = ["Content-Type": mime, "Content-Length": "\(data.count)", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json"
        case "svg": return "image/svg+xml"
        case "glb": return "model/gltf-binary"
        case "usdz": return "model/vnd.usdz+zip"
        case "hdr": return "image/vnd.radiance"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
