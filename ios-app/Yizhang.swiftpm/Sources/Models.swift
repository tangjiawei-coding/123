import Foundation

struct Choice: Codable, Identifiable, Hashable {
    var id: String; var name: String; var desc: String?
    static let layouts = [Choice(id: "split", name: "左图右文"), Choice(id: "stack", name: "上图下文"), Choice(id: "photo", name: "大幅留白")]
    static let tones = [Choice(id: "healing", name: "温暖"), Choice(id: "literary", name: "文艺"), Choice(id: "poetic", name: "诗意"), Choice(id: "love", name: "告白"), Choice(id: "travel", name: "旅行"), Choice(id: "sassy", name: "俏皮")]
    static let styles: [Choice] = [
        .init(id: "photo-abstract-editorial", name: "象牙抽象编辑"), .init(id: "scenes-gathered-zine-v1-3", name: "实景拼贴 Zine"),
        .init(id: "scene-distillation-zine-v1-3", name: "影像蒸馏 Zine"), .init(id: "gc-minimal-zine-poster", name: "极简 Zine 海报"),
        .init(id: "heytea-style", name: "喜茶风格"), .init(id: "ian-xiaohei-illustrations", name: "小黑怪诞配图"),
        .init(id: "postmark-watercolor", name: "水彩邮记"), .init(id: "ukiyoe-picture", name: "浮世绘"),
        .init(id: "layered-sticker", name: "贴纸拼贴"), .init(id: "mono-color", name: "单色光影")]
}
struct AudioClip: Codable, Equatable { var url: String; var name: String; var type: String; var duration: Double }
struct InkLayout: Codable, Equatable {
    var x = 0.57; var y = 0.69; var w = 0.28; var h = 0.22
    var strokes: [[[Double]]] = []
    var color: String? = "#594735"; var lineWidth: Double? = 2.5; var canvasWidth: Double? = 600
}
struct Editor: Codable, Equatable {
    var version = 1; var font = "hand"; var bilingual = true; var stylized = false
    var stampColor = "brown"; var createdAt = ISO8601DateFormatter().string(from: Date())
    var ink: InkLayout?; var layout: String? = "split"
    init() {}
    init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        font = try c.decodeIfPresent(String.self, forKey: .font) ?? "hand"
        bilingual = try c.decodeIfPresent(Bool.self, forKey: .bilingual) ?? true
        stylized = try c.decodeIfPresent(Bool.self, forKey: .stylized) ?? false
        stampColor = try c.decodeIfPresent(String.self, forKey: .stampColor) ?? "brown"
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? createdAt
        ink = try c.decodeIfPresent(InkLayout.self, forKey: .ink)
        layout = try c.decodeIfPresent(String.self, forKey: .layout) ?? "split"
    }
}
struct Postcard: Codable, Identifiable, Equatable {
    var draftId = UUID().uuidString; var id = ""; var title = ""
    var image = ""; var originalImage = ""; var sentence = ""; var handwriting = ""
    var audio: AudioClip?; var backgroundAudio: AudioClip?
    var skill = "photo-abstract-editorial"; var tone = "healing"; var stamp = "一张"
    var visibility = "private"; var ownerNick = ""; var author = ""; var authorNickname = ""; var authorAvatar = ""
    var demo = false; var likes = 0; var liked = false; var collected = false; var commentCount = 0
    var createdAt = Date().timeIntervalSince1970 * 1000; var editor = Editor()
    var displayName: String { title.isEmpty ? "未命名明信片" : title }
    var authorName: String { authorNickname.isEmpty ? (author.isEmpty ? ownerNick : author) : authorNickname }
    var hasPhoto: Bool { !image.isEmpty || !originalImage.isEmpty }
    var meaningful: Bool { hasPhoto || !sentence.isEmpty || !handwriting.isEmpty || audio != nil || backgroundAudio != nil || !title.isEmpty }
    init() {}
    // 服务端历史作品不一定含客户端草稿字段，缺省值沿用新建卡片。
    init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        draftId = try c.decodeIfPresent(String.self, forKey: .draftId) ?? UUID().uuidString
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        image = try c.decodeIfPresent(String.self, forKey: .image) ?? ""
        originalImage = try c.decodeIfPresent(String.self, forKey: .originalImage) ?? ""
        sentence = try c.decodeIfPresent(String.self, forKey: .sentence) ?? ""
        handwriting = try c.decodeIfPresent(String.self, forKey: .handwriting) ?? ""
        audio = try c.decodeIfPresent(AudioClip.self, forKey: .audio)
        backgroundAudio = try c.decodeIfPresent(AudioClip.self, forKey: .backgroundAudio)
        skill = try c.decodeIfPresent(String.self, forKey: .skill) ?? skill
        tone = try c.decodeIfPresent(String.self, forKey: .tone) ?? tone
        stamp = try c.decodeIfPresent(String.self, forKey: .stamp) ?? stamp
        visibility = try c.decodeIfPresent(String.self, forKey: .visibility) ?? visibility
        ownerNick = try c.decodeIfPresent(String.self, forKey: .ownerNick) ?? ""
        author = try c.decodeIfPresent(String.self, forKey: .author) ?? ""
        authorNickname = try c.decodeIfPresent(String.self, forKey: .authorNickname) ?? ""
        authorAvatar = try c.decodeIfPresent(String.self, forKey: .authorAvatar) ?? ""
        demo = try c.decodeIfPresent(Bool.self, forKey: .demo) ?? false
        likes = try c.decodeIfPresent(Int.self, forKey: .likes) ?? 0
        liked = try c.decodeIfPresent(Bool.self, forKey: .liked) ?? false
        collected = try c.decodeIfPresent(Bool.self, forKey: .collected) ?? false
        commentCount = try c.decodeIfPresent(Int.self, forKey: .commentCount) ?? 0
        createdAt = try c.decodeIfPresent(Double.self, forKey: .createdAt) ?? createdAt
        editor = try c.decodeIfPresent(Editor.self, forKey: .editor) ?? Editor()
    }
}
struct Preferences: Codable {
    var layout = "split"; var font = "hand"; var bilingual = true; var tone = "healing"
    var stampColor = "brown"; var stamp = "一张"; var signature = ""
    func card() -> Postcard {
        var c = Postcard(); c.editor.layout = layout; c.editor.font = font; c.editor.bilingual = bilingual
        c.editor.stampColor = stampColor; c.stamp = stamp; c.tone = tone; return c
    }
}
struct DraftEntry: Codable, Identifiable { var id: String; var updatedAt: Double; var card: Postcard }
struct Profile: Codable { var nickname: String; var bio: String; var avatar: String? }
struct Comment: Codable, Identifiable { var id: String; var author: String; var content: String; var createdAt: Double }
struct AuthResult: Decodable { var username: String; var token: String }
struct WorkResult: Decodable { var work: Postcard }
struct WorksResult: Decodable { var works: [Postcard] }
struct PostsResult: Decodable { var posts: [Postcard]; var total: Int? }
struct PostResult: Decodable { var post: Postcard }
struct CommentsResult: Decodable { var comments: [Comment] }
struct ProfileResult: Decodable { var profile: Profile }
struct LinkResult: Decodable { var url: String }
struct GenerateResult: Decodable { var image: String?; var sentence: String? }
struct EmptyResponse: Decodable {}
struct AppError: LocalizedError { var message: String; var errorDescription: String? { message } }
extension Encodable {
    func jsonData() throws -> Data { try JSONEncoder().encode(self) }
    func jsonObject() throws -> [String: Any] { try JSONSerialization.jsonObject(with: jsonData()) as? [String: Any] ?? [:] }
}
