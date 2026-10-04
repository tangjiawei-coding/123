import SwiftUI

struct GalleryView: View {
    @EnvironmentObject var store: AppStore
    @State private var selected: Postcard?
    @State private var privateScope: GalleryScope = .cloud
    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Picker("展览馆", selection: Binding(get: { store.scope == .publicWorks ? 0 : 1 }, set: { store.scope = $0 == 0 ? .publicWorks : privateScope })) {
                    Text("公开").tag(0); Text("私有").tag(1)
                }.pickerStyle(.segmented)
                if store.scope != .publicWorks {
                    Picker("来源", selection: $store.scope) {
                        ForEach([GalleryScope.cloud, .local, .favorites], id: \.self) { Text($0.rawValue).tag($0) }
                    }.pickerStyle(.segmented)
                }
                if store.gallery.isEmpty && !store.galleryLoading {
                    VStack(spacing: 16) { Image(systemName: "rectangle.stack").font(.largeTitle); Text("这里还没有明信片"); Text("写下你的第一张吧。").font(.footnote) }.foregroundStyle(Palette.muted).padding(.vertical, 70)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 155), spacing: 14)], spacing: 18) {
                    ForEach(Array(store.gallery.enumerated()), id: \.offset) { _, card in
                        Button { selected = card } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                PostcardView(card: card, api: store.api, showHints: false).allowsHitTesting(false)
                                Text(card.displayName).font(Palette.font(15)).lineLimit(1)
                                Text(card.authorName.isEmpty ? "我的作品" : card.authorName).font(.caption2).foregroundStyle(Palette.muted)
                                if store.scope == .publicWorks || store.scope == .favorites {
                                    HStack { Label("\(card.likes)", systemImage: "heart"); Spacer(); Label("\(card.commentCount)", systemImage: "bubble") }.font(.caption2).foregroundStyle(Palette.muted)
                                }
                            }.padding(10).background(Palette.surface, in: RoundedRectangle(cornerRadius: 8))
                        }.buttonStyle(.plain)
                    }
                }
                if store.galleryLoading { ProgressView() }
                if store.hasMore { Button("再看看") { Task { await store.loadGallery(more: true) } }.buttonStyle(SoftButtonStyle()).disabled(store.galleryLoading) }
            }.padding(18).frame(maxWidth: 850)
        }.background(Palette.paper).navigationTitle("展览馆").refreshable { await store.loadGallery() }
            .task { await store.loadGallery() }
            .onChange(of: store.scope) { _, scope in if scope != .publicWorks { privateScope = scope }; Task { await store.loadGallery() } }
            .sheet(item: $selected) { card in
                DetailView(initial: card, scope: store.scope)
            }
    }
}
struct DetailView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var voice: VoiceService
    @Environment(\.dismiss) private var dismiss
    var initial: Postcard; var scope: GalleryScope
    @State private var card = Postcard(); @State private var original = false
    @State private var comments: [Comment] = []; @State private var comment = ""
    @State private var sharing: SharePayload?; @State private var confirmPublish = false; @State private var confirmDelete = false
    private var isPublic: Bool { scope == .publicWorks || scope == .favorites }
    var body: some View {
        NavigationStack {
            ScrollView { VStack(alignment: .leading, spacing: 20) {
                PostcardView(card: card, api: store.api, original: original, onPhoto: { original.toggle() })
                HStack {
                    RemotePhoto(source: card.authorAvatar, api: store.api).frame(width: 40, height: 40).clipShape(Circle())
                    VStack(alignment: .leading) { Text(card.authorName.isEmpty ? "我的明信片" : card.authorName).font(.headline); Text(card.displayName).font(.subheadline).foregroundStyle(Palette.muted) }
                    Spacer()
                }
                if card.audio != nil || card.backgroundAudio != nil {
                    Button(voice.playing ? "停止播放" : "听听这张明信片", systemImage: "play.circle") {
                        Task { await store.run("正在打开声音…") { try await voice.play(card, api: store.api) } }
                    }.buttonStyle(SoftButtonStyle())
                }
                HStack {
                    Button("分享图片", systemImage: "square.and.arrow.up") { export(save: false) }
                    Button("保存图片", systemImage: "square.and.arrow.down") { export(save: true) }
                }.buttonStyle(SoftButtonStyle())
                if isPublic { interaction } else { ownActions }
                if store.busy { ProgressView() }
                if !store.status.isEmpty { Text(store.status).font(.footnote).foregroundStyle(Palette.accent) }
            }.padding(20).disabled(store.busy) }.background(Palette.paper)
                .navigationTitle("一张明信片").navigationBarTitleDisplayMode(.inline)
                .toolbar { Button("完成") { dismiss() }.disabled(store.busy) }
                .task { card = initial; if isPublic { await store.run("正在打开明信片…") { try await refresh() } } }
                .onDisappear { voice.stopPlayback() }
                .sheet(item: $sharing) { ShareSheet(items: $0.items) }
                .confirmationDialog("公开后，其他人可以看到照片、文字并听到声音。", isPresented: $confirmPublish, titleVisibility: .visible) {
                    Button("公开到展览馆") { Task { await store.run("正在公开…") {
                        let _: PostResult = try await store.api.request("/api/myworks/\(API.component(card.id))/share", body: [:]); card.visibility = "public"; await store.loadGallery()
                    } } }
                }
                .confirmationDialog("删除这张作品？", isPresented: $confirmDelete, titleVisibility: .visible) {
                    Button("删除作品", role: .destructive) { Task { await store.run("正在删除…") {
                        if scope == .local { try store.local.deleteWork(card.createdAt) }
                        else { let _: EmptyResponse = try await store.api.request("/api/myworks/\(API.component(card.id))/delete", body: [:]) }
                        await store.loadGallery(); dismiss()
                    } } }
                }
        }.interactiveDismissDisabled(store.busy)
    }
    private var interaction: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Button { social("like") } label: { Label("\(card.likes)", systemImage: card.liked ? "heart.fill" : "heart") }
                Spacer()
                Button { social("favorite") } label: { Label(card.collected ? "已收藏" : "收藏", systemImage: card.collected ? "star.fill" : "star") }
            }.buttonStyle(SoftButtonStyle())
            Divider(); Text("留言 · \(comments.count)").font(.headline)
            ForEach(comments) { entry in VStack(alignment: .leading, spacing: 6) { Text(entry.author).font(.caption).foregroundStyle(Palette.muted); Text(entry.content).font(.subheadline) } }
            TextField("写下一句想说的话", text: $comment, axis: .vertical).textFieldStyle(.roundedBorder)
            Button("发表评论") { social("comments") }.buttonStyle(SoftButtonStyle(primary: true))
        }
    }
    private var ownActions: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button("继续编辑") { Task { await store.run("正在取回照片…") { try await store.openWork(card); dismiss() } } }
            if scope == .cloud && card.ownerNick == store.username {
                if card.visibility == "public" {
                    Button("设为私有") { Task { await store.run("正在设为私有…") {
                        let result: WorkResult = try await store.api.request("/api/myworks/\(API.component(card.id))/update", body: ["visibility": "private"])
                        card = result.work; await store.loadGallery()
                    } } }
                } else { Button("公开到展览馆") { confirmPublish = true } }
            }
            Button("删除作品", role: .destructive) { confirmDelete = true }
        }.buttonStyle(SoftButtonStyle())
    }
    private func refresh() async throws {
        let result: PostResult = try await store.api.request("/api/community/posts/" + API.component(card.id)); card = result.post
        let replies: CommentsResult = try await store.api.request("/api/community/posts/\(API.component(card.id))/comments"); comments = replies.comments
        store.gallery = store.gallery.map { $0.id == card.id ? card : $0 }
        if store.scope == .favorites && !card.collected { store.gallery.removeAll { $0.id == card.id } }
    }
    private func social(_ action: String) {
        Task { await store.run("正在保存…") {
            guard !store.username.isEmpty else { throw AppError(message: "请先到“我的”登录") }
            let value = comment.trimmingCharacters(in: .whitespacesAndNewlines)
            if action == "comments" && value.isEmpty { throw AppError(message: "先写下一句话吧") }
            let _: EmptyResponse = try await store.api.request("/api/community/posts/\(API.component(card.id))/\(action)", body: action == "comments" ? ["content": value] : [:])
            try await refresh(); if action == "comments" { comment = "" }
        } }
    }
    private func export(save: Bool) {
        Task { await store.run("正在准备卡片…") {
            let image = try await CardExporter.image(card, api: store.api, original: original)
            if save { try await ImageData.saveAlbum(image); store.status = "已保存到相册" } else { sharing = SharePayload(items: [image]) }
        } }
    }
}
