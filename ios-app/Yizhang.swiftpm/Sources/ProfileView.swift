import SwiftUI
import PhotosUI

struct ProfileView: View {
    @EnvironmentObject var store: AppStore
    @State private var account = false; @State private var settings = false
    var body: some View {
        List {
            Section {
                HStack(spacing: 18) {
                    RemotePhoto(source: store.profile.avatar ?? "", api: store.api).frame(width: 64, height: 64).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 6) {
                        Text(store.username.isEmpty ? "留一个名字给生活" : store.profile.nickname).font(Palette.font(23))
                        Text(store.profile.bio.isEmpty ? "把生活，做成明信片。" : store.profile.bio).font(.caption).foregroundStyle(Palette.muted)
                    }
                }.padding(.vertical, 12)
                Button(store.username.isEmpty ? "登录 / 注册" : "账号管理") { account = true }
            }.listRowBackground(Palette.surface)
            Section {
                NavigationLink { DraftsView() } label: { Label("我的草稿", systemImage: "doc.text") }
                Button { store.scope = .local; store.tab = 1 } label: { Label("我的作品", systemImage: "rectangle.stack") }
                NavigationLink { StampCollectionView() } label: { Label("我的邮戳", systemImage: "seal") }
                NavigationLink { ProfileEditView() } label: { Label("个人资料", systemImage: "person.crop.circle") }
                Button { store.scope = .favorites; store.tab = 1 } label: { Label("我的收藏", systemImage: "star") }
                NavigationLink { PreferencesView() } label: { Label("偏好设置", systemImage: "slider.horizontal.3") }
                NavigationLink { HelpView() } label: { Label("使用帮助", systemImage: "questionmark.circle") }
            }.listRowBackground(Palette.surface)
            Section {
                HStack { Circle().fill(store.connected ? .green : .orange).frame(width: 7, height: 7); Text(store.connected ? "已连接服务器" : "离线 · 本机草稿可用").font(.caption) }
                Button("连接设置") { settings = true }
            }.listRowBackground(Palette.surface)
        }.scrollContentBackground(.hidden).background(Palette.paper).navigationTitle("我的")
            .sheet(isPresented: $account) { AccountView() }.sheet(isPresented: $settings) { ServerSettingsView() }
            .task { if !store.username.isEmpty { await store.loadProfile() } }
    }
}
struct AccountView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""; @State private var password = ""; @State private var register = false
    var body: some View {
        NavigationStack {
            Form {
                if store.username.isEmpty {
                    TextField("用户名", text: $name).textInputAutocapitalization(.never).autocorrectionDisabled().textContentType(.username)
                    SecureField("密码", text: $password).textContentType(register ? .newPassword : .password)
                    Toggle("创建新账号", isOn: $register)
                    Button(register ? "注册并登录" : "登录") { Task { await store.run("正在登录…") { try await store.authenticate(name: name, password: password, register: register); password = ""; dismiss() } } }
                    Text("与网页、鸿蒙版共用同一个账号。").font(.footnote)
                } else {
                    Text("当前账号：" + store.username)
                    Button("退出登录", role: .destructive) { Task { await store.run("正在退出…") { try await store.logout(); dismiss() } } }
                }
                if !store.status.isEmpty { Text(store.status).font(.footnote) }
                if store.busy { ProgressView() }
            }.disabled(store.busy).navigationTitle("账号").toolbar { Button("完成") { dismiss() }.disabled(store.busy) }
        }.interactiveDismissDisabled(store.busy)
    }
}
struct ServerSettingsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    var body: some View {
        NavigationStack { Form {
            TextField("https://你的服务器", text: $url).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
            Text("更换服务器会退出当前账号。本机草稿保留；请使用原服务器访问已有云端作品。").font(.footnote)
            Button("保存并连接") { Task { await store.run("正在连接…") { try await store.changeServer(url); if store.connected { dismiss() } } } }
            if !store.status.isEmpty { Text(store.status).font(.footnote) }
        }.disabled(store.busy).navigationTitle("连接设置").toolbar { Button("取消") { dismiss() }.disabled(store.busy) }.onAppear { url = store.serverURL }
        }
    }
}
struct ProfileEditView: View {
    @EnvironmentObject var store: AppStore
    @State private var nickname = ""; @State private var bio = ""; @State private var photo: PhotosPickerItem?
    var body: some View {
        Form {
            if store.username.isEmpty { Text("登录后可以修改个人资料。") }
            else {
                PhotosPicker(selection: $photo, matching: .images) {
                    HStack { RemotePhoto(source: store.profile.avatar ?? "", api: store.api).frame(width: 56, height: 56).clipShape(Circle()); Text("导入头像") }
                }
                TextField("昵称", text: $nickname)
                TextField("介绍一下自己", text: $bio, axis: .vertical)
                Button("保存资料") { Task { await store.run("正在保存…") { try await store.updateProfile(["nickname": nickname, "bio": bio]); store.status = "资料已保存" } } }
            }
            if !store.status.isEmpty { Text(store.status).font(.footnote) }
        }.disabled(store.busy).navigationTitle("个人资料")
            .onAppear { nickname = store.profile.nickname; bio = store.profile.bio }
            .onChange(of: photo) { _, item in guard let item else { return }
                Task { await store.run("正在保存头像…") {
                    guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { throw AppError(message: "图片无法读取") }
                    try await store.updateProfile(["avatar": ImageData.encode(image, maxEdge: 512)]); photo = nil
                } }
            }
    }
}
struct DraftsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var renaming: DraftEntry?; @State private var name = ""; @State private var renameAlert = false
    @State private var deleting: DraftEntry?
    var body: some View {
        List {
            Button("新建明信片", systemImage: "plus") { perform { try store.newDraft(); dismiss() } }
            if store.drafts.isEmpty { Text("还没有草稿，先写下第一张吧。").foregroundStyle(Palette.muted) }
            ForEach(store.drafts) { entry in
                VStack(alignment: .leading, spacing: 12) {
                    Button { perform { try store.resume(entry); dismiss() } } label: {
                        HStack { PostcardView(card: entry.card, api: store.api, showHints: false).frame(width: 105).allowsHitTesting(false)
                            VStack(alignment: .leading, spacing: 4) { Text(entry.card.displayName); Text(Date(timeIntervalSince1970: entry.updatedAt/1000), style: .date).font(.caption).foregroundStyle(Palette.muted) }
                        }
                    }.buttonStyle(.plain)
                    HStack {
                        Button("重命名") { renaming = entry; name = entry.card.title; renameAlert = true }
                        Button("复制") { perform { try store.copyDraft(entry) } }
                        Spacer(); Button("删除", role: .destructive) { deleting = entry }
                    }.font(.caption).buttonStyle(.borderless)
                }.padding(.vertical, 5).listRowBackground(Palette.surface)
            }
        }.scrollContentBackground(.hidden).background(Palette.paper).navigationTitle("我的草稿")
            .onAppear { store.flush() }
            .alert("重命名草稿", isPresented: $renameAlert) { TextField("名称", text: $name); Button("保存") { if let entry = renaming { perform { try store.rename(entry, name: name) } } }; Button("取消", role: .cancel) {} }
            .confirmationDialog("删除草稿后无法恢复。", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
                Button("删除草稿", role: .destructive) { if let entry = deleting { perform { try store.deleteDraft(entry) } }; deleting = nil }
            }
    }
    private func perform(_ block: () throws -> Void) { do { try block() } catch { store.status = error.localizedDescription } }
}
struct PreferencesView: View {
    @EnvironmentObject var store: AppStore
    var body: some View {
        Form {
            Section("新建明信片时使用") {
                Picker("版式", selection: $store.preferences.layout) { ForEach(Choice.layouts) { Text($0.name).tag($0.id) } }
                Picker("字体", selection: $store.preferences.font) { Text("手写").tag("hand"); Text("宋体").tag("serif"); Text("简洁").tag("sans") }
                Toggle("中英双语", isOn: $store.preferences.bilingual)
                Picker("语气", selection: $store.preferences.tone) { ForEach(Choice.tones) { Text($0.name).tag($0.id) } }
                Picker("邮戳", selection: $store.preferences.stampColor) { Text("棕色").tag("brown"); Text("红色").tag("red"); Text("蓝色").tag("blue"); Text("绿色").tag("green"); Text("紫色").tag("violet") }
                TextField("邮戳文字", text: $store.preferences.stamp)
                TextField("默认署名", text: $store.preferences.signature)
            }
        }.navigationTitle("偏好设置").onDisappear { do { try store.savePreferences() } catch { store.status = error.localizedDescription } }
    }
}
struct StampCollectionView: View {
    var body: some View { ScrollView { VStack(spacing: 30) { ForEach(["brown", "red", "blue", "green", "violet"], id: \.self) { color in
        Image(uiImage: Assets.image("postage-" + color) ?? UIImage()).resizable().scaledToFit().frame(width: 170, height: 115)
    } }.padding(30) }.background(Palette.paper).navigationTitle("我的邮戳") }
}
struct HelpView: View {
    var body: some View { List {
        Section("创作") { Text("导入照片，选一个喜欢的画风，让AI生成画面和文案。你可以继续改字、手写、盖邮戳。点卡片照片可查看原图。") }
        Section("草稿与作品") { Text("编辑时自动保存本机草稿。在“我的草稿”中继续、重命名、复制或删除。保存作品后可在展览馆的本机作品中查看；登录后还可保存云端。") }
        Section("声音与分享") { Text("录音最长180秒，也可添加10MB以内的背景声音。分享图片只保存画面；生成链接后，对方可以在网页中打开卡片并听到声音。") }
        Section("展览馆") { Text("公开作品可被其他用户浏览、点赞、收藏和评论。自己的云端作品可公开，也可改回私有。") }
        Section("联网与权限") { Text("AI生成、账号和云端功能需要联网。录音和保存相册需要系统权限，可在iPhone设置中调整。服务器地址可在“我的”中修改。") }
    }.navigationTitle("使用帮助") }
}
