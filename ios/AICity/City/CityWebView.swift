// The City scene is the web HUD's own (web/src/city/scene.js + city-state.js), bundled into the app as
// CityWeb/city-embed.html + city-embed.js (built by `npm run build:city-embed -w @aic/web`). It runs in a
// WKWebView that is locked down:
// - pages come only from the app bundle through the private `aic-city://` scheme, and only the two files of
//   the City page are served; every other navigation is refused (no web origin, so no cookies or tokens);
// - the page has no network (its CSP sets connect-src 'none') and never receives a token: the app hands it
//   the /city snapshot and each WebSocket event as JSON values;
// - one message handler, `city`, carries back only what was tapped, checked here before use;
// - no file access, no pop-ups, no link previews, no inspector in Release.
import SwiftUI
import WebKit

enum CityWeb {
    static let scheme = "aic-city"
    static let host = "city"
    static let page = URL(string: "aic-city://city/city-embed.html")!
    /// The only files the page may load, with their types.
    static let files: [String: String] = ["city-embed.html": "text/html", "city-embed.js": "text/javascript"]

    /// What the page reports back, refused unless it has exactly this shape.
    enum Tap: Equatable {
        case ready, none
        case agent(String)
        case building(String)

        init?(message body: Any) {
            guard let d = body as? [String: Any], let type = d["type"] as? String else { return nil }
            let id = (d["id"] as? String).flatMap { $0.count <= 200 ? $0 : nil }
            switch (type, id) {
            case ("ready", _): self = .ready
            case ("none", _): self = .none
            case ("agent", let id?) where !id.isEmpty: self = .agent(id)
            case ("building", let id?) where !id.isEmpty: self = .building(id)
            default: return nil
            }
        }
    }

    /// Whether a navigation may go ahead: only the bundled City page itself.
    static func allows(_ url: URL?) -> Bool {
        guard let url, url.scheme == scheme, url.host == host else { return false }
        return files[String(url.path.dropFirst())] == "text/html"
    }
}

/// Serves the City page's files from the app bundle, and nothing else.
final class CitySchemeHandler: NSObject, WKURLSchemeHandler {
    let bundle: Bundle
    init(bundle: Bundle = .main) { self.bundle = bundle }

    static func response(for url: URL?, bundle: Bundle) -> (Data, String)? {
        guard let url, url.scheme == CityWeb.scheme, url.host == CityWeb.host else { return nil }
        let name = String(url.path.dropFirst())
        guard let type = CityWeb.files[name], let file = bundle.url(forResource: name, withExtension: nil),
              let data = try? Data(contentsOf: file) else { return nil }
        return (data, type)
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let (data, type) = Self.response(for: task.request.url, bundle: bundle) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let r = HTTPURLResponse(url: task.request.url!, statusCode: 200, httpVersion: "HTTP/1.1",
                                headerFields: ["Content-Type": "\(type); charset=utf-8", "Content-Length": "\(data.count)", "Cache-Control": "no-store"])!
        task.didReceive(r)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// Keeps one web view alive for the app's lifetime (switching tabs doesn't reload the town) and feeds it.
@MainActor
final class CityWebController: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    let webView: WKWebView
    private var ready = false
    private var pending: [(String, [String: Any])] = []
    var onTap: (CityWeb.Tap) -> Void = { _ in }
    var onReady: () -> Void = {}

    override init() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(CitySchemeHandler(), forURLScheme: CityWeb.scheme)
        config.websiteDataStore = .nonPersistent()  // nothing is stored for this page
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = false
        config.mediaTypesRequiringUserActionForPlayback = .all
        config.dataDetectorTypes = []
        config.suppressesIncrementalRendering = false
        if #available(iOS 17.0, *) { config.allowsInlinePredictions = false }
        let controller = WKUserContentController()
        config.userContentController = controller
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        controller.add(WeakHandler(self), name: "city")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        // The scene does its own pinch and pan on the canvas; the page itself must not scroll or zoom.
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.55, green: 0.78, blue: 0.43, alpha: 1)
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        webView.load(URLRequest(url: CityWeb.page))
    }

    // MARK: Data in

    func load(snapshot: JSONValue) { call("aicCity.load(x)", snapshot) }
    func event(_ e: JSONValue) { call("aicCity.event(x)", e) }
    func zoomIn() { run("aicCity.zoomIn()") }
    func zoomOut() { run("aicCity.zoomOut()") }
    func fit() { run("aicCity.fit()") }
    func resume() { run("aicCity.resume()") }
    func select(_ id: String?) { call("aicCity.select(x)", id.map { .string($0) } ?? .null) }

    /// Values go in as arguments, never pasted into the script text.
    private func call(_ js: String, _ value: JSONValue) {
        let args: [String: Any] = ["x": value.foundation]
        guard ready else { pending.append((js, args)); return }
        webView.callAsyncJavaScript(js, arguments: args, in: nil, in: .page) { _ in }
    }
    private func run(_ js: String) {
        guard ready else { return }
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { _ in }
    }

    // MARK: Data out

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == CityWeb.scheme, origin.host == CityWeb.host,
              let tap = CityWeb.Tap(message: message.body) else { return }
        if tap == .ready {
            ready = true
            for (js, args) in pending { webView.callAsyncJavaScript(js, arguments: args, in: nil, in: .page) { _ in } }
            pending = []
            onReady()
        } else {
            onTap(tap)
        }
    }

    // MARK: Lockdown

    func webView(_ w: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        CityWeb.allows(action.request.url) && action.targetFrame?.isMainFrame == true ? .allow : .cancel
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? { nil }
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
        ready = false
        w.load(URLRequest(url: CityWeb.page))  // the page asks for a fresh snapshot when it is ready again
    }
}

/// WKUserContentController keeps its handlers strongly; this breaks the cycle.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: (any WKScriptMessageHandler)?
    init(_ t: any WKScriptMessageHandler) { target = t }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}

struct CityWebView: UIViewRepresentable {
    let controller: CityWebController
    func makeUIView(context: Context) -> WKWebView { controller.webView }
    func updateUIView(_ v: WKWebView, context: Context) {}
}

extension JSONValue {
    /// Plain Foundation values, for passing to the page as script arguments.
    var foundation: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let b): return b
        case .number(let n): return n
        case .string(let s): return s
        case .array(let a): return a.map(\.foundation)
        case .object(let o): return o.mapValues(\.foundation)
        }
    }
}
