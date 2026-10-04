import SwiftUI

enum Palette {
    static let paper = Color(hex: "F8F5EE"), surface = Color(hex: "FFFCF7"), ink = Color(hex: "594735"), accent = Color(hex: "806650"), muted = Color(hex: "988B79"), line = Color(hex: "E4D9C9")
    static func font(_ size: CGFloat, style: String = "hand") -> Font {
        switch style { case "sans": return .system(size: size); case "serif": return .system(size: size, design: .serif); default: return .custom("LXGWWenKaiGBScreen", size: size) }
    }
}
extension Color {
    init(hex: String) { let n = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x594735
        self.init(red: Double((n >> 16) & 255)/255, green: Double((n >> 8) & 255)/255, blue: Double(n & 255)/255) }
}
struct SoftButtonStyle: ButtonStyle {
    var primary = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 13)).padding(.horizontal, 16).padding(.vertical, 10)
            .foregroundStyle(primary ? .white : Palette.ink)
            .background(primary ? Palette.accent : Color(hex: "EEE8DF"), in: Capsule()).opacity(configuration.isPressed ? 0.65 : 1)
    }
}
struct RemotePhoto: View {
    var source: String; var api: API; var fit: ContentMode = .fill
    @State private var image: UIImage?
    var body: some View {
        GeometryReader { g in
            Group { if let image { Image(uiImage: image).resizable().aspectRatio(contentMode: fit) }
                else { Rectangle().fill(Palette.line.opacity(0.35)).overlay(Image(systemName: "photo").foregroundStyle(Palette.muted)) } }
                .frame(width: g.size.width, height: g.size.height).clipped()
        }.task(id: api.absolute(source)) { image = nil; image = try? await ImageCache.shared.load(source, api: api) }
    }
}
struct CardImages { var photo: UIImage?; var handwriting: UIImage? }
struct PostcardView: View {
    var card: Postcard; var api: API; var original = false; var showHints = true
    var editable = false; var onPhoto: () -> Void = {}; var onInkMove: ((Double, Double) -> Void)?
    @State private var images = CardImages()
    private var photoSource: String { original ? (card.originalImage.isEmpty ? card.image : card.originalImage) : (card.image.isEmpty ? card.originalImage : card.image) }
    var body: some View {
        GeometryReader { geometry in
            CardArtwork(card: card, images: images, original: original, showHints: showHints,
                editable: editable, onPhoto: onPhoto, onInkMove: onInkMove)
                .frame(width: 560, height: 360).scaleEffect(geometry.size.width/560, anchor: .topLeading)
        }.aspectRatio(14/9, contentMode: .fit)
            .task(id: photoSource + card.handwriting + api.baseURL) {
                images.photo = nil; images.handwriting = nil
                images.photo = try? await ImageCache.shared.load(photoSource, api: api)
                if !card.handwriting.isEmpty { images.handwriting = try? await ImageCache.shared.load(card.handwriting, api: api) }
            }
    }
}
struct CardArtwork: View {
    var card: Postcard; var images: CardImages; var original = false; var showHints = false
    var editable = false; var onPhoto: () -> Void = {}; var onInkMove: ((Double, Double) -> Void)?
    @GestureState private var drag = CGSize.zero
    var layout: String { card.editor.layout ?? "split" }
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(hex: "FFF9EA")
            if let texture = Assets.image("paper") { Image(uiImage: texture).resizable().opacity(0.5) }
            if layout == "stack" {
                VStack(spacing: 14) { photo.frame(height: 178); HStack(alignment: .top, spacing: 14) { copy; stamp.frame(width: 112, height: 90) } }.padding(22)
            } else if layout == "photo" {
                photo.padding(22)
                stamp.frame(width: 112, height: 90).position(x: 470, y: 64)
                copy.padding(12).background(Color(hex: "FFF9EA").opacity(0.94)).frame(width: 280, height: 142).position(x: 372, y: 263)
            } else {
                HStack(spacing: 19) {
                    photo.frame(width: 260)
                    ZStack {
                        Path { p in for y in stride(from: 110.0, to: 298.0, by: 36) { p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: 215, y: y)) } }.stroke(Palette.line.opacity(0.5), lineWidth: 0.6)
                        VStack(spacing: 12) { HStack { Spacer(); stamp.frame(width: 129, height: 104).rotationEffect(.degrees(9)) }; copy }
                    }
                }.padding(22)
            }
            if card.audio != nil || card.backgroundAudio != nil {
                Image(uiImage: Assets.image("record") ?? UIImage()).resizable().frame(width: 64, height: 64)
                    .position(x: layout == "split" ? 496 : 62, y: 299)
            }
            if let image = images.handwriting {
                let ink = card.editor.ink ?? InkLayout()
                Image(uiImage: image).resizable().scaledToFit().frame(width: 560 * ink.w, height: 360 * ink.h)
                    .offset(x: 560 * ink.x + drag.width, y: 360 * ink.y + drag.height)
                    .contentShape(Rectangle())
                    .gesture(DragGesture().updating($drag) { value, state, _ in if editable { state = value.translation } }
                        .onEnded { value in guard editable else { return }
                            onInkMove?(min(max(0, ink.x + value.translation.width/560), 1-ink.w), min(max(0, ink.y + value.translation.height/360), 1-ink.h))
                        })
            }
        }.frame(width: 560, height: 360).clipped().overlay(Rectangle().stroke(Palette.line, lineWidth: 1))
    }
    private var photo: some View {
        GeometryReader { geometry in
            Group {
                if let image = images.photo {
                    Image(uiImage: image).resizable().aspectRatio(contentMode: !original && card.editor.stylized ? .fit : .fill)
                } else {
                    VStack(spacing: 16) { Image(systemName: "photo").font(.system(size: 28)); Text("导入一张照片").font(Palette.font(20)); if showHints { Text("把生活的瞬间，变成明信片").font(.system(size: 12)) } }.frame(maxWidth: .infinity, maxHeight: .infinity).foregroundStyle(Palette.muted)
                }
            }.frame(width: geometry.size.width, height: geometry.size.height).background(Color(hex: "F0EBDD")).clipped().contentShape(Rectangle()).onTapGesture(perform: onPhoto)
        }
    }
    private var copy: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(card.sentence.isEmpty && showHints ? "这一面，留给你的话。" : card.sentence)
                .font(Palette.font(19, style: card.editor.font)).foregroundStyle(Palette.ink)
                .minimumScaleFactor(0.55).lineLimit(10).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            Text(dateString).font(.system(size: 10)).tracking(2).foregroundStyle(Palette.muted)
        }
    }
    private var dateString: String {
        let date = ISO8601DateFormatter().date(from: card.editor.createdAt) ?? Date(timeIntervalSince1970: card.createdAt/1000)
        let formatter = DateFormatter(); formatter.dateFormat = "yyyy.MM.dd"; return formatter.string(from: date)
    }
    private var stamp: some View {
        GeometryReader { g in
            Image(uiImage: Assets.image("postage-" + card.editor.stampColor) ?? UIImage()).resizable().scaledToFit().opacity(0.75)
            Text(card.stamp).font(Palette.font(14)).foregroundStyle(Palette.accent).lineLimit(2).minimumScaleFactor(0.5)
                .frame(width: g.size.width * 0.44, height: g.size.height * 0.3).position(x: g.size.width * 0.385, y: g.size.height * 0.46)
        }
    }
}
@MainActor enum CardExporter {
    static func image(_ card: Postcard, api: API, original: Bool = false) async throws -> UIImage {
        let source = original ? (card.originalImage.isEmpty ? card.image : card.originalImage) : (card.image.isEmpty ? card.originalImage : card.image)
        let photo = try await ImageCache.shared.load(source, api: api)
        var ink: UIImage?
        if !card.handwriting.isEmpty { ink = try await ImageCache.shared.load(card.handwriting, api: api) }
        let renderer = ImageRenderer(content: CardArtwork(card: card, images: CardImages(photo: photo, handwriting: ink), original: original).environment(\.colorScheme, .light))
        renderer.scale = 3
        guard let result = renderer.uiImage else { throw AppError(message: "卡片导出失败") }
        return result
    }
}
