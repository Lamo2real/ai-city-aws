import SwiftUI

@main
struct AICityApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model: AppModel = AICityApp.makeModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task {
                    delegate.attach(model)
                    await model.start()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await model.becameActive() } }
                    if phase == .background { model.wentToBackground() }
                }
        }
    }

    @MainActor static func makeModel() -> AppModel {
        #if DEBUG
        // `-demo` (Debug builds only): a fake city and a fake sign-in, for the simulator and screenshots.
        // Nothing of this is in a Release build.
        if ProcessInfo.processInfo.arguments.contains("-demo") { return Demo.model() }
        #endif
        let model = AppModel()
        model.startCalls()  // PushKit wants its delegate during launch, before any screen
        AppDelegate.launched = model
        return model
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    /// The glass screens are dark whatever the phone's appearance (decision 103), and so is everything the system
    /// presents over them (alerts, confirmation dialogs, menus, popovers), which follows the window's scheme. Only
    /// the City tab keeps the phone's own appearance, or the one the owner chose (VAIC can set it, decision 143).
    private var scheme: ColorScheme? {
        guard case .ready = model.boot, model.section == .city else { return .dark }
        switch model.appearance {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    var body: some View {
        content.preferredColorScheme(scheme)
            // Every tap anywhere answers with two rings, a soft click and a light haptic (UI/TapFeedback.swift).
            .background { TapFeedbackInstaller().frame(width: 0, height: 0) }
    }

    @ViewBuilder private var content: some View {
        switch model.boot {
        case .starting:
            VStack(spacing: 16) {
                Wordmark()
                Text("Starting…").foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .nightScreen()
        case .signedOut:
            SignInFlow()
        case .failed(let why):
            VStack(spacing: 16) {
                Wordmark()
                Banner(tone: .bad, text: "AI City could not start: \(why) Nothing was lost.")
                Button("Try again") { Task { await model.start() } }
                    .buttonStyle(.glassPrimary)
            }
            .padding(24)
            .glassPanel()
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .nightScreen()
        case .ready:
            MainTabs()
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        @Bindable var push = model.push
        TabView(selection: $model.section) {
            ForEach(AppSection.tabs) { s in
                Group {
                    if s == .more {
                        NavigationStack(path: $model.morePath) {
                            MoreList().navigationDestination(for: AppSection.self) { screen($0) }
                        }
                    } else {
                        NavigationStack { screen(s) }
                    }
                }
                .tabItem { Label(s.title, systemImage: s.symbol) }
                .tag(s)
            }
        }
        .overlay(alignment: .bottom) { ToastView().padding(.bottom, 60) }
        .sheet(isPresented: $model.showGuide) { FirstRunGuide { model.finishGuide() } }
        .alert("Get a notification when a large feature is done?", isPresented: $push.askNow) {
            Button("Not now", role: .cancel) { model.push.notNow() }
            Button("Allow") { Task { await model.push.allow() } }
        } message: {
            Text("AI City tells you when it has finished a large feature, never for small steps.")
        }
    }

    @ViewBuilder private func screen(_ s: AppSection) -> some View {
        switch s {
        case .vaic: ChatScreen()
        case .city: CityScreen()
        case .inbox: InboxScreen()
        case .away: AwaySettingsScreen()
        case .tickets: TicketsScreen()
        case .files: FilesScreen()
        case .more: MoreList()
        case .costs: CostsScreen()
        case .settings: SettingsScreen()
        }
    }
}

struct MoreList: View {
    var body: some View {
        List(AppSection.underMore) { s in
            NavigationLink(value: s) { Label(s.title, systemImage: s.symbol).frame(minHeight: 44) }.glassRows()
        }
        .nightScreen()
        .navigationTitle("More")
    }
}
