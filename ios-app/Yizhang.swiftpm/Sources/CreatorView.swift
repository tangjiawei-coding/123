import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct CreatorView: View {
    @EnvironmentObject var store: AppStore
    @EnvironmentObject var voice: VoiceService
    @State private var tool = 0; @State private var original = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showCamera = false; @State private var showInk = false; @State private var showSave = false
    @State private var showPreview = false; @State private var audioImport = false; @State private var clear = false
    @State private var opening = false
    private let tools = ["风格", "文字", "手写", "声音", "邮戳"]
    private let icons = ["sparkles", "textformat", "pencil.tip", "mic", "seal"]
    var body: some View {
        Group {
            if store.editorOpen { editor } else { cover }
        }.background(Palette.paper).toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showCamera) {
                PhotoCamera(onImage: { image in do { try store.importPhoto(image); original = false } catch { store.status = error.localizedDescription }; showCamera = false }, onCancel: { showCamera = false })
            }
            .sheet(isPresented: $showInk) { HandwritingView() }
            .sheet(isPresented: $showSave) { SaveShareView() }
            .sheet(isPresented: $showPreview) {
                NavigationStack { PostcardView(card: store.card, api: store.api, original: original).padding().navigationTitle("明信片预览").toolbar { Button("完成") { showPreview = false } } }
            }
            .fileImporter(isPresented: $audioImport, allowedContentTypes: [.audio]) { result in
                Task { await store.run("正在添加声音…") { store.card.backgroundAudio = try await voice.importAudio(result.get()) } }
            }
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                Task { await store.run("正在导入照片…") {
                    guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { throw AppError(message: "照片无法读取") }
                    try store.importPhoto(image); original = false; selectedPhoto = nil
                } }
            }
            .confirmationDialog("清空当前草稿？照片、文字、笔迹和声音都会移除。", isPresented: $clear, titleVisibility: .visible) {
                Button("清空草稿", role: .destructive) { store.clearDraft(); original = false; tool = 0 }
            }
    }
    private var cover: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer()
            Text("一张，给世界的温柔").font(Palette.font(32))
            Text("把生活，做成明信片。").font(Palette.font(17)).foregroundStyle(Palette.muted)
            Button {
                withAnimation(.easeInOut(duration: 0.35)) { opening = true }
                Task { try? await Task.sleep(nanoseconds: 350_000_000); store.editorOpen = true; opening = false }
            } label: {
                coverArtwork.allowsHitTesting(false)
                    .rotation3DEffect(.degrees(opening ? -65 : -6), axis: (x: 0, y: 1, z: 0))
                    .shadow(color: Palette.ink.opacity(0.15), radius: 18, y: 12).padding(.vertical, 35)
            }.buttonStyle(.plain)
            Text("轻轻打开，写下今天。 ").font(Palette.font(17)).frame(maxWidth: .infinity)
            Spacer()
        }.padding(24)
    }
    private var coverCard: Postcard {
        if store.card.hasPhoto { return store.card }
        var card = Postcard(); card.sentence = "有些瞬间，\n想好好留住。\n\n有些心意，\n想慢慢送到。"; return card
    }
    @ViewBuilder private var coverArtwork: some View {
        if store.card.hasPhoto { PostcardView(card: store.card, api: store.api) }
        else {
            GeometryReader { geometry in
                CardArtwork(card: coverCard, images: CardImages(photo: Assets.image("coast-study")))
                    .frame(width: 560, height: 360).scaleEffect(geometry.size.width/560, anchor: .topLeading)
            }.aspectRatio(14/9, contentMode: .fit)
        }
    }
    private var editor: some View {
        ScrollView {
            VStack(spacing: 18) {
                HStack {
                    Button { voice.finish(); store.flush(); store.editorOpen = false } label: { Image(systemName: "chevron.left") }
                    Text("编辑明信片").font(.headline); Spacer()
                    Button("清空草稿") { clear = true }.font(.caption)
                    Button("保存草稿") { store.flush(); store.status = "已保存到“我的草稿”" }.font(.caption).buttonStyle(SoftButtonStyle(primary: true))
                }
                HStack {
                    Picker("版式", selection: Binding(get: { store.card.editor.layout ?? "split" }, set: { store.card.editor.layout = $0 })) {
                        ForEach(Choice.layouts) { Text($0.name).tag($0.id) }
                    }.pickerStyle(.menu)
                    Spacer(); Button("放大看", systemImage: "arrow.up.left.and.arrow.down.right") { showPreview = true }.font(.caption)
                }
                PostcardView(card: store.card, api: store.api, original: original, editable: true,
                    onPhoto: { if store.card.hasPhoto { original.toggle() } },
                    onInkMove: { x, y in store.card.editor.ink?.x = x; store.card.editor.ink?.y = y })
                HStack {
                    Button("保存 / 分享 ↗") { voice.finish(); showSave = true }
                    Spacer()
                    PhotosPicker(selection: $selectedPhoto, matching: .images) { Label(store.card.hasPhoto ? "换张照片" : "导入照片", systemImage: "photo") }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) { Button { showCamera = true } label: { Image(systemName: "camera") } }
                }.font(.caption)
                VStack(spacing: 18) {
                    HStack {
                        ForEach(0..<tools.count, id: \.self) { index in
                            Button { tool = index } label: {
                                VStack(spacing: 8) { Image(systemName: icons[index]).font(.system(size: 21)); Text(tools[index]).font(.caption); Capsule().fill(tool == index ? Palette.accent : .clear).frame(width: 18, height: 2) }.frame(maxWidth: .infinity)
                            }.foregroundStyle(tool == index ? Palette.ink : Palette.muted)
                        }
                    }
                    Divider()
                    toolPanel
                }.padding(18).background(Palette.surface, in: RoundedRectangle(cornerRadius: 20))
            }.padding(18).frame(maxWidth: 720)
                .disabled(store.busy || voice.recording)
            // 录音时仍可停止，不让全局禁用状态困住录音操作。
            if voice.recording {
                Button("停止录音 · \(voice.seconds) 秒") { voice.finish() }.buttonStyle(SoftButtonStyle(primary: true)).padding()
            }
        }.scrollDismissesKeyboard(.interactively)
    }
    @ViewBuilder private var toolPanel: some View {
        switch tool {
        case 0:
            Text("给风景，另一种表达").font(Palette.font(20)).frame(maxWidth: .infinity, alignment: .leading)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) { ForEach(store.styles) { style in
                    Button { store.card.skill = style.id } label: {
                        VStack(spacing: 8) {
                            Image(uiImage: Assets.image("style-" + style.id) ?? UIImage()).resizable().scaledToFit().frame(width: 72, height: 82).background(Palette.paper)
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(store.card.skill == style.id ? Palette.accent : Palette.line, lineWidth: store.card.skill == style.id ? 2 : 1))
                            Text(style.name).font(.system(size: 10)).frame(width: 76)
                        }
                    }.buttonStyle(.plain)
                } }
            }
            Button(store.card.image.isEmpty ? "生成我的明信片" : "按所选画风重新生成") { original = false; Task { await store.generate() } }.buttonStyle(SoftButtonStyle(primary: true))
        case 1:
            Text("想对 Ta 说些什么？").font(Palette.font(20)).frame(maxWidth: .infinity, alignment: .leading)
            TextEditor(text: $store.card.sentence).font(Palette.font(16)).frame(height: 95).scrollContentBackground(.hidden).padding(8).background(Palette.paper, in: RoundedRectangle(cornerRadius: 8))
                .onChange(of: store.card.sentence) { _, value in if value.count > 200 { store.card.sentence = String(value.prefix(200)) } }
            HStack { Button("AI 帮我写") { Task { await store.generate(textOnly: true) } }.buttonStyle(SoftButtonStyle()); Toggle("中英双语", isOn: $store.card.editor.bilingual).font(.caption) }
            HStack {
                Picker("语气", selection: $store.card.tone) { ForEach(Choice.tones) { Text($0.name).tag($0.id) } }
                Spacer()
                ForEach(["hand", "serif", "sans"], id: \.self) { style in
                    Button { store.card.editor.font = style } label: { Text("Aa").font(Palette.font(18, style: style)).padding(6).overlay(RoundedRectangle(cornerRadius: 4).stroke(store.card.editor.font == style ? Palette.accent : Palette.line)) }
                }
            }
        case 2:
            Text("留下你的笔迹").font(Palette.font(20)).frame(maxWidth: .infinity, alignment: .leading)
            HStack {
                Button(store.card.handwriting.isEmpty ? "写一段手写文字" : "继续写 / 换笔色") { showInk = true }
                if !store.card.handwriting.isEmpty { Button("移除") { store.card.handwriting = ""; store.card.editor.ink = nil } }
            }.buttonStyle(SoftButtonStyle())
            if store.card.editor.ink != nil {
                HStack { Text("大小").font(.caption); Slider(value: Binding(get: { store.card.editor.ink?.w ?? 0.28 }, set: { value in
                    guard var ink = store.card.editor.ink else { return }; ink.h = min(0.85, ink.h * value / max(ink.w, 0.01)); ink.w = value
                    ink.x = min(ink.x, 1-ink.w); ink.y = min(ink.y, 1-ink.h); store.card.editor.ink = ink
                }), in: 0.18...0.55) }
                Text("在卡片上拖动笔迹，调整位置").font(.caption).foregroundStyle(Palette.muted)
            }
        case 3:
            Text("让 Ta 听见你的声音").font(Palette.font(20)).frame(maxWidth: .infinity, alignment: .leading)
            HStack { Image(uiImage: Assets.image("record") ?? UIImage()).resizable().frame(width: 68, height: 68); Text("有些话，想亲口说。\n声音会成为卡片上的一枚唱片。").font(Palette.font(15)) }
            HStack {
                Button("录一段话") { Task { await store.run("正在打开麦克风…") { try await voice.start() } } }
                Button("添加背景声音") { audioImport = true }
            }.buttonStyle(SoftButtonStyle())
            if let clip = store.card.audio { HStack { Text("我的声音 · \(Int(clip.duration)) 秒"); Spacer(); Button("移除") { voice.stopPlayback(); store.card.audio = nil } }.font(.caption) }
            if let clip = store.card.backgroundAudio { HStack { Text(clip.name).lineLimit(1); Spacer(); Button("移除") { voice.stopPlayback(); store.card.backgroundAudio = nil } }.font(.caption) }
            if store.card.audio != nil || store.card.backgroundAudio != nil {
                Button(voice.playing ? "停止播放" : "听一听") { Task { await store.run("正在打开声音…") { try await voice.play(store.card, api: store.api) } } }.buttonStyle(SoftButtonStyle())
            }
        default:
            Text("给这一刻，盖个纪念").font(Palette.font(20)).frame(maxWidth: .infinity, alignment: .leading)
            HStack { ForEach(["brown", "red", "blue", "green", "violet"], id: \.self) { color in
                Button { store.card.editor.stampColor = color } label: {
                    Image(uiImage: Assets.image("postage-" + color) ?? UIImage()).resizable().scaledToFit().frame(height: 48).padding(3).overlay(RoundedRectangle(cornerRadius: 4).stroke(store.card.editor.stampColor == color ? Palette.accent : .clear))
                }
            } }
            TextField("邮戳文字", text: $store.card.stamp).textFieldStyle(.roundedBorder).onChange(of: store.card.stamp) { _, value in if value.count > 8 { store.card.stamp = String(value.prefix(8)) } }
        }
    }
}
struct SaveShareView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var to = ""; @State private var from = ""
    @State private var sharing: SharePayload?
    var body: some View {
        NavigationStack {
            ScrollView { VStack(spacing: 22) {
                PostcardView(card: store.card, api: store.api)
                TextField("给这张明信片起个名字", text: $store.card.title).textFieldStyle(.roundedBorder)
                Button("保存作品") { Task { await store.saveWork() } }
                HStack {
                    Button("保存到相册", systemImage: "square.and.arrow.down") { export(save: true) }
                    Button("分享图片", systemImage: "square.and.arrow.up") { export(save: false) }
                }
                Divider()
                TextField("给谁（可不填）", text: $to).textFieldStyle(.roundedBorder)
                TextField("署名（可不填）", text: $from).textFieldStyle(.roundedBorder)
                Button("生成并分享链接") {
                    Task { await store.run("正在生成分享链接…") { let url = try await store.createLink(to: to, from: from); sharing = SharePayload(items: [url]) } }
                }
                if let url = store.shareLink { Button("复制链接") { UIPasteboard.general.url = url; store.status = "链接已复制" } }
                Text("图片保留卡片画面；通过链接打开，还能听见声音。").font(.caption).foregroundStyle(Palette.muted)
                if !store.status.isEmpty { Text(store.status).font(.footnote).foregroundStyle(Palette.accent) }
                if store.busy { ProgressView() }
            }.padding(22).disabled(store.busy).buttonStyle(SoftButtonStyle()) }
                .background(Palette.paper).navigationTitle("保存 / 分享").navigationBarTitleDisplayMode(.inline)
                .toolbar { Button("完成") { dismiss() }.disabled(store.busy) }
                .onAppear { from = store.preferences.signature }
                .sheet(item: $sharing) { ShareSheet(items: $0.items) }
        }.interactiveDismissDisabled(store.busy)
    }
    private func export(save: Bool) {
        Task { await store.run("正在准备卡片图片…") {
            let image = try await CardExporter.image(store.card, api: store.api)
            if save { try await ImageData.saveAlbum(image); store.status = "已保存到相册" }
            else { sharing = SharePayload(items: [image]) }
        } }
    }
}
