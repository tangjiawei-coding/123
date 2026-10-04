import SwiftUI

enum GalleryScope: String, CaseIterable { case publicWorks = "公开", cloud = "我的云端", local = "本机作品", favorites = "收藏" }
@MainActor final class AppStore: ObservableObject {
    @Published var card = Postcard() { didSet { scheduleSave(); shareLink = nil; linkPayload = nil } }
    @Published var preferences = Preferences()
    @Published var drafts: [DraftEntry] = []
    @Published var gallery: [Postcard] = []
    @Published var scope: GalleryScope = .publicWorks
    @Published var styles = Choice.styles
    @Published var username = ""; @Published var profile = Profile(nickname: "", bio: "", avatar: nil)
    @Published var serverURL = API.defaultURL
    @Published var connected = false; @Published var busy = false; @Published var status = ""
    @Published var hasMore = false; @Published var galleryLoading = false
    @Published var editorOpen = false; @Published var tab = 0
    @Published var shareLink: URL?
    let local = LocalStore(); let voice = VoiceService()
    private var token = ""; private var saveTask: Task<Void, Never>?; private var galleryRevision = 0; private var page = 1
    private var linkPayload: [String: Any]?
    var api: API { API(baseURL: serverURL, token: token) }
    init() {
        do {
            preferences = try local.read("preferences", as: Preferences.self) ?? Preferences()
            serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? API.defaultURL
            username = UserDefaults.standard.string(forKey: "username") ?? ""
            token = SessionKeychain.token(serverURL)
            if token.isEmpty { username = "" }
            card = try local.read("current", as: Postcard.self) ?? preferences.card()
            drafts = try local.drafts()
        } catch { status = "草稿恢复失败：" + error.localizedDescription }
        voice.onRecorded = { [weak self] clip in self?.card.audio = clip; self?.status = "声音已放进明信片" }
        voice.onError = { [weak self] message in self?.status = message }
    }
    func run(_ message: String, operation: () async throws -> Void) async {
        guard !busy else { return }; busy = true; status = message
        defer { busy = false }
        do { try await operation(); if status == message { status = "" } }
        catch is CancellationError { status = "已取消" }
        catch { status = error.localizedDescription }
    }
    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 400_000_000) } catch { return }
            self?.flush()
        }
    }
    func flush() {
        saveTask?.cancel()
        do { try local.saveDraft(card); drafts = try local.drafts() }
        catch { status = "草稿未能保存：" + error.localizedDescription }
    }
    func connect() async {
        do { styles = try await api.request("/api/skills"); connected = true }
        catch { connected = false; status = "暂时连不上服务器，仍可编辑本机作品和草稿" }
        if !token.isEmpty { await loadProfile() }
    }
    func changeServer(_ url: String) async throws {
        let value = url.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let parsed = URL(string: value), ["http", "https"].contains(parsed.scheme ?? ""), parsed.host != nil,
              parsed.user == nil, parsed.password == nil, parsed.query == nil, parsed.fragment == nil else { throw AppError(message: "请输入完整的 http:// 或 https:// 服务器地址") }
        serverURL = value; token = ""; username = ""; profile = Profile(nickname: "", bio: "", avatar: nil)
        UserDefaults.standard.set(value, forKey: "serverURL"); UserDefaults.standard.removeObject(forKey: "username")
        gallery = []; shareLink = nil; linkPayload = nil; galleryRevision += 1
        await connect()
    }
    func importPhoto(_ image: UIImage) throws {
        card.originalImage = try ImageData.encode(image)
        // 换照片即清掉上一轮生成图文，防止把旧文案带入新照片。
        card.image = ""; card.sentence = ""; card.editor.stylized = false
    }
    func generate(textOnly: Bool = false) async {
        await run(textOnly ? "正在写一句话…" : "正在把照片做成明信片…") {
            guard !card.originalImage.isEmpty else { throw AppError(message: "请先导入一张照片") }
            let snapshot = card
            let source = try await api.imageData(snapshot.originalImage)
            let body: [String: Any] = ["image": source, "text": textOnly ? snapshot.sentence : "", "skill": snapshot.skill, "tone": snapshot.tone, "mode": "fast", "bilingual": snapshot.editor.bilingual]
            if textOnly {
                let result: GenerateResult = try await api.request("/api/generate-sentence", body: body)
                card.sentence = result.sentence ?? ""; return
            }
            let client = api
            async let image: Result<GenerateResult, Error> = Self.generatePart(client, path: "/api/generate-image", body: body)
            async let words: Result<GenerateResult, Error> = Self.generatePart(client, path: "/api/generate-sentence", body: body)
            let (picture, sentence) = await (image, words)
            var errors: [String] = []
            switch picture { case .success(let result): card.image = result.image ?? ""; card.editor.stylized = !card.image.isEmpty
            case .failure(let e): errors.append("画面：" + e.localizedDescription) }
            switch sentence { case .success(let result): card.sentence = result.sentence ?? ""
            case .failure(let e): errors.append("文案：" + e.localizedDescription) }
            status = errors.isEmpty ? "完成了，点击照片可查看原图" : errors.joined(separator: "\n")
        }
    }
    private static func generatePart(_ api: API, path: String, body: [String: Any]) async -> Result<GenerateResult, Error> {
        do { return .success(try await api.request(path, body: body)) } catch { return .failure(error) }
    }
    func newDraft() throws { try local.saveDraft(card); voice.stopPlayback(); card = preferences.card(); editorOpen = true; tab = 0; flush() }
    func clearDraft() { let id = card.draftId; voice.stopPlayback(); card = preferences.card(); card.draftId = id; flush() }
    func resume(_ entry: DraftEntry) throws { try local.saveDraft(card); voice.stopPlayback(); card = entry.card; tab = 0; editorOpen = true; flush() }
    func copyDraft(_ entry: DraftEntry) throws {
        var copy = entry.card; copy.draftId = UUID().uuidString; copy.id = ""; copy.ownerNick = ""; copy.visibility = "private"
        copy.createdAt = Date().timeIntervalSince1970 * 1000; copy.title = copy.displayName + " · 副本"
        try local.saveDraft(copy, active: false); drafts = try local.drafts()
    }
    func rename(_ entry: DraftEntry, name: String) throws {
        var copy = entry.card; copy.title = name
        try local.saveDraft(copy, active: false)
        if card.draftId == entry.id { card.title = name }
        drafts = try local.drafts()
    }
    func deleteDraft(_ entry: DraftEntry) throws {
        saveTask?.cancel(); try local.deleteDraft(entry.id)
        if card.draftId == entry.id { card = preferences.card(); try local.saveDraft(card) }
        drafts = try local.drafts()
    }
    func savePreferences() throws { try local.write("preferences", preferences) }
    func saveWork() async {
        await run("正在保存作品…") {
            guard card.hasPhoto else { throw AppError(message: "请先导入照片") }
            try local.saveWork(card); flush()
            if username.isEmpty { status = "已保存到本机，登录后可保存云端"; return }
            var payload = card; if payload.image.isEmpty { payload.image = payload.originalImage }
            let path = !payload.id.isEmpty && payload.ownerNick == username ? "/api/myworks/\(API.component(payload.id))/update" : "/api/myworks"
            let result: WorkResult = try await api.request(path, body: payload.jsonObject())
            card.id = result.work.id; card.ownerNick = result.work.ownerNick
            try local.saveWork(card); status = "已保存到本机和云端"
        }
    }
    func authenticate(name: String, password: String, register: Bool) async throws {
        let result: AuthResult = try await api.request("/api/auth/" + (register ? "register" : "login"), body: ["username": name.trimmingCharacters(in: .whitespacesAndNewlines), "password": password])
        try SessionKeychain.save(result.token, host: serverURL); token = result.token; username = result.username
        UserDefaults.standard.set(username, forKey: "username"); await loadProfile(); await loadGallery()
    }
    func logout() async throws {
        let _: EmptyResponse = try await api.request("/api/auth/logout", body: [:])
        try SessionKeychain.save("", host: serverURL); token = ""; username = ""; profile = Profile(nickname: "", bio: "", avatar: nil)
        UserDefaults.standard.removeObject(forKey: "username"); gallery = []; shareLink = nil; linkPayload = nil
    }
    func loadProfile() async {
        do { let result: ProfileResult = try await api.request("/api/auth/profile"); profile = result.profile }
        catch { status = error.localizedDescription }
    }
    func updateProfile(_ fields: [String: Any]) async throws {
        let result: ProfileResult = try await api.request("/api/auth/profile", body: fields); profile = result.profile
    }
    func loadGallery(more: Bool = false) async {
        galleryRevision += 1; let revision = galleryRevision; let selected = scope
        if !more { page = 1; gallery = [] }; let requestedPage = more ? page + 1 : 1
        galleryLoading = true; defer { if revision == galleryRevision { galleryLoading = false } }
        do {
            var items: [Postcard]; var total = 0
            switch selected {
            case .local: items = try local.works()
            case .cloud:
                guard !username.isEmpty else { throw AppError(message: "登录后查看云端作品") }
                let result: WorksResult = try await api.request("/api/myworks?nick=" + API.component(username)); items = result.works
            case .publicWorks, .favorites:
                if selected == .favorites && username.isEmpty { throw AppError(message: "登录后查看收藏") }
                let result: PostsResult = try await api.request(selected == .favorites ? "/api/community/favorites" : "/api/community/posts?page=\(requestedPage)&pageSize=12&sort=new")
                items = result.posts; total = result.total ?? 0
            }
            guard revision == galleryRevision else { return }
            gallery = more ? gallery + items : items; page = requestedPage
            hasMore = selected == .publicWorks && requestedPage * 12 < total
        } catch { if revision == galleryRevision { status = error.localizedDescription; hasMore = false } }
    }
    func openWork(_ work: Postcard) async throws {
        var copy = work
        copy.originalImage = try await api.imageData(work.originalImage.isEmpty ? work.image : work.originalImage)
        if !copy.image.isEmpty { copy.image = try await api.imageData(copy.image) }
        if !copy.handwriting.isEmpty { copy.handwriting = try await api.imageData(copy.handwriting) }
        copy.draftId = UUID().uuidString
        try resume(DraftEntry(id: copy.draftId, updatedAt: Date().timeIntervalSince1970 * 1000, card: copy))
    }
    func createLink(to: String, from: String) async throws -> URL {
        guard !username.isEmpty else { throw AppError(message: "请先到“我的”登录") }
        guard card.hasPhoto else { throw AppError(message: "请先导入照片") }
        if let shareLink, let payload = linkPayload, payload["toName"] as? String == to, payload["fromName"] as? String == from { return shareLink }
        if linkPayload == nil || linkPayload?["toName"] as? String != to || linkPayload?["fromName"] as? String != from {
            var payload = try card.jsonObject()
            payload["image"] = card.image.isEmpty ? card.originalImage : card.image
            let preview = try await CardExporter.image(card, api: api)
            guard let data = preview.pngData() else { throw AppError(message: "预览生成失败") }
            payload["preview"] = "data:image/png;base64," + data.base64EncodedString()
            payload["requestId"] = UUID().uuidString; payload["keepRecord"] = true; payload["toName"] = to; payload["fromName"] = from
            linkPayload = payload
        }
        let result: LinkResult = try await api.request("/api/delivery/link", body: linkPayload)
        guard let url = URL(string: api.absolute(result.url)) else { throw AppError(message: "分享链接不正确") }
        shareLink = url; return url
    }
}
