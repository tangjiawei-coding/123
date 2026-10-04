import SwiftUI

@main struct YizhangApp: App {
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase
    init() { Assets.registerFont() }
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).environmentObject(store.voice)
                .tint(Palette.accent).preferredColorScheme(.light)
                .task { if !store.username.isEmpty { await store.loadProfile() } }
                .task(id: scenePhase) {
                    if scenePhase == .active { await store.monitorConnection() }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { store.voice.finish(); store.voice.stopPlayback(); store.flush() }
                }
        }
    }
}
struct RootView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var voice: VoiceService
    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $store.tab) {
                NavigationStack { CreatorView() }.tabItem { Label("创作", systemImage: "house") }.tag(0)
                NavigationStack { GalleryView() }.tabItem { Label("展览馆", systemImage: "building.columns") }.tag(1)
                NavigationStack { ProfileView() }.tabItem { Label("我的", systemImage: "person") }.tag(2)
            }.disabled(store.busy)
            if !store.status.isEmpty {
                HStack(alignment: .top) {
                    if store.busy { ProgressView().padding(.top, 3) }
                    Text(store.status).font(.footnote).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    if !store.busy { Button { store.status = "" } label: { Image(systemName: "xmark") } }
                }.padding(12).foregroundStyle(Palette.ink).background(Color(hex: "EEE8DF"))
            }
        }.onChange(of: store.tab) { _, _ in voice.finish(); voice.stopPlayback(); store.flush() }
    }
}
