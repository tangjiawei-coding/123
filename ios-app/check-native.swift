import Foundation

// 与 App 使用完全相同的网络、数据模型和本地存储实现；仅连接测试启动的空白后端。
@main struct NativeCheck {
    static func require(_ value: Bool, _ message: String) throws {
        if !value { throw AppError(message: message) }
    }
    static func main() async throws {
        let base = CommandLine.arguments[1]
        let guest = API(baseURL: base)
        let styles: [Choice] = try await guest.request("/api/skills")
        try require(styles.count == 10, "style list decode")
        let account: AuthResult = try await guest.request("/api/auth/register", body: ["username": "swift_client", "password": "native-check-password"])
        let api = API(baseURL: base, token: account.token)
        let profile: ProfileResult = try await api.request("/api/auth/profile", body: ["nickname": "苹果测试", "bio": "给照片留下心意"])
        try require(profile.profile.nickname == "苹果测试", "profile decode")
        var card = Postcard()
        card.image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ3sAAAAASUVORK5CYII="
        card.originalImage = card.image; card.handwriting = card.image
        card.title = "Swift 接口检查"; card.sentence = "把今天的晚霞带给你。"
        card.editor.layout = "stack"; card.editor.ink = InkLayout()
        card.editor.ink?.strokes = [[[1, 2], [30, 40]]]
        let work: WorkResult = try await api.request("/api/myworks", body: card.jsonObject())
        try require(work.work.editor.layout == "stack", "card/editor decode")
        let works: WorksResult = try await api.request("/api/myworks?nick=swift_client")
        try require(works.works.count == 1, "works decode")
        let data = try await api.bytes(work.work.image)
        try require(!data.isEmpty, "image download")
        let published: PostResult = try await api.request("/api/myworks/\(work.work.id)/share", body: [:])
        let path = "/api/community/posts/" + published.post.id
        let _: EmptyResponse = try await api.request(path + "/like", body: [:])
        let _: EmptyResponse = try await api.request(path + "/favorite", body: [:])
        let _: EmptyResponse = try await api.request(path + "/comments", body: ["content": "收到了"])
        let detail: PostResult = try await api.request(path)
        try require(detail.post.liked && detail.post.collected && detail.post.commentCount == 1, "social state decode")
        let comments: CommentsResult = try await api.request(path + "/comments")
        try require(comments.comments.first?.content == "收到了", "comment decode")
        let favorites: PostsResult = try await api.request("/api/community/favorites")
        try require(favorites.posts.count == 1, "favorites decode")
        var payload = try card.jsonObject()
        payload["preview"] = card.image; payload["requestId"] = UUID().uuidString
        payload["toName"] = "朋友"; payload["fromName"] = "我"; payload["keepRecord"] = true
        let link: LinkResult = try await api.request("/api/delivery/link", body: payload)
        try require(URL(string: api.absolute(link.url)) != nil, "share link decode")
        let legacy = try JSONDecoder().decode(Postcard.self, from: Data("{\"id\":\"old\",\"editor\":{\"font\":\"hand\"}}".utf8))
        try require(legacy.editor.layout == "split", "legacy defaults")
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("yizhang-swift-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let local = LocalStore(directory: directory)
        try local.saveDraft(card)
        try require(try local.read("current", as: Postcard.self) == card, "draft roundtrip")
        try require(try local.drafts().count == 1, "draft index")
        try local.saveWork(card); try local.saveWork(card)
        try require(try local.works().count == 1, "work update without duplicate")
        try local.deleteDraft(card.draftId)
        try require(try local.drafts().isEmpty, "draft delete")
        try local.deleteWork(card.createdAt)
        try require(try local.works().isEmpty, "work delete")
        let _: EmptyResponse = try await api.request("/api/myworks/\(work.work.id)/delete", body: [:])
        let _: EmptyResponse = try await api.request("/api/auth/logout", body: [:])
        print("PASS: real Swift URLSession client, response decoding, legacy models, draft and work persistence")
    }
}
