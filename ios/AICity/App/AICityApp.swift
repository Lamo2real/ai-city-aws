import SwiftUI

@main
struct AICityApp: App {
    @State private var model: AppModel = AICityApp.makeModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.start() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await model.becameActive() } }
                }
        }
    }

    @MainActor static func makeModel() -> AppModel {
        #if DEBUG
        // `-demo` (Debug builds only): a fake city and a fake sign-in, for the simulator and screenshots.
        // Nothing of this is in a Release build.
        if ProcessInfo.processInfo.arguments.contains("-demo") { return Demo.model() }
        #endif
        return AppModel()
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.boot {
        case .starting:
            VStack(spacing: 16) {
                EyeView(size: 120)
                Text("Starting…").foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
        case .needsSite:
            ConnectView()
        case .signedOut:
            SignInFlow()
        case .failed(let why):
            VStack(spacing: 16) {
                EyeView(size: 96)
                Banner(tone: .bad, text: "AI City could not start: \(why) Nothing was lost.")
                Button("Try again") { Task { await model.start() } }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                Button("Change the AI City address") { Task { await model.changeSite() } }
            }
            .padding()
        case .ready:
            MainTabs()
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
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
                .badge(s == .inbox ? model.hud.waitingCount : 0)
            }
        }
        .overlay(alignment: .bottom) { ToastView().padding(.bottom, 60) }
        .sheet(isPresented: $model.showGuide) { FirstRunGuide { model.finishGuide() } }
    }

    @ViewBuilder private func screen(_ s: AppSection) -> some View {
        switch s {
        case .aic: ChatScreen()
        case .city: CityScreen()
        case .inbox: InboxScreen()
        case .tickets: TicketsScreen()
        case .more: MoreList()
        case .costs: CostsScreen()
        case .settings: SettingsScreen()
        }
    }
}

struct MoreList: View {
    var body: some View {
        List(AppSection.underMore) { s in
            NavigationLink(value: s) { Label(s.title, systemImage: s.symbol).frame(minHeight: 44) }
        }
        .navigationTitle("More")
        .withSpendPill()
    }
}
