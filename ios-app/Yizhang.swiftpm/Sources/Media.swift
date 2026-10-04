import SwiftUI
import UIKit
import Photos
import AVFoundation
import CoreText
import UniformTypeIdentifiers

enum Assets {
    static var bundle: Bundle {
        #if SWIFT_PACKAGE
        return .module
        #else
        return .main
        #endif
    }
    static func image(_ name: String) -> UIImage? {
        if let image = UIImage(named: name, in: bundle, compatibleWith: nil) { return image }
        for ext in ["png", "jpg"] {
            if let url = bundle.url(forResource: name, withExtension: ext), let image = UIImage(contentsOfFile: url.path) { return image }
        }
        return nil
    }
    static func registerFont() {
        if let url = bundle.url(forResource: "WenKai", withExtension: "ttf") { CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) }
    }
}
@MainActor final class ImageCache {
    static let shared = ImageCache()
    private let cache = NSCache<NSString, UIImage>()
    func load(_ source: String, api: API) async throws -> UIImage {
        guard !source.isEmpty else { throw AppError(message: "未选择照片") }
        let key = api.absolute(source) as NSString
        if let image = cache.object(forKey: key) { return image }
        guard let image = UIImage(data: try await api.bytes(source)) else { throw AppError(message: "照片无法读取") }
        cache.setObject(image, forKey: key); return image
    }
}
enum ImageData {
    static func encode(_ image: UIImage, maxEdge: CGFloat = 1600) throws -> String {
        let ratio = min(1, maxEdge / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        let normalized = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let data = normalized.jpegData(compressionQuality: 0.88) else { throw AppError(message: "照片转换失败") }
        return "data:image/jpeg;base64," + data.base64EncodedString()
    }
    static func saveAlbum(_ image: UIImage) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw AppError(message: "请在系统设置中允许保存照片") }
        try await PHPhotoLibrary.shared().performChanges { PHAssetChangeRequest.creationRequestForAsset(from: image) }
    }
}
struct PhotoCamera: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void; var onCancel: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = context.coordinator; return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: PhotoCamera
        init(_ parent: PhotoCamera) { self.parent = parent }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.onCancel() }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) } else { parent.onCancel() }
        }
    }
}
struct ShareSheet: UIViewControllerRepresentable {
    var items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
struct SharePayload: Identifiable { let id = UUID(); var items: [Any] }

@MainActor final class VoiceService: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var recording = false; @Published var playing = false; @Published var seconds = 0
    private var recorder: AVAudioRecorder?; private var players: [AVAudioPlayer] = []; private var timer: Timer?
    var onRecorded: ((AudioClip) -> Void)?; var onError: ((String) -> Void)?
    override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVAudioSession.interruptionNotification, object: nil)
    }
    func start() async throws {
        let allowed = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
            AVAudioSession.sharedInstance().requestRecordPermission { c.resume(returning: $0) }
        }
        guard allowed else { throw AppError(message: "请在系统设置中允许麦克风权限") }
        stopPlayback()
        let session = AVAudioSession.sharedInstance(); try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth]); try session.setActive(true)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".m4a")
        recorder = try AVAudioRecorder(url: url, settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 96000])
        guard recorder?.record(forDuration: 180) == true else { throw AppError(message: "录音启动失败") }
        recording = true; seconds = 0
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }; self.seconds += 1
                if self.seconds >= 180 { self.finish() }
            }
        }
    }
    func finish() {
        guard recording, let recorder else { return }
        let duration = max(recorder.currentTime, Double(seconds)); recorder.stop(); timer?.invalidate(); timer = nil; recording = false
        defer { try? FileManager.default.removeItem(at: recorder.url); self.recorder = nil; try? AVAudioSession.sharedInstance().setActive(false) }
        do {
            let data = try Data(contentsOf: recorder.url)
            guard duration > 0.1 else { throw AppError(message: "录音太短，请再试一次") }
            onRecorded?(AudioClip(url: "data:audio/mp4;base64," + data.base64EncodedString(), name: "我的声音", type: "audio/mp4", duration: duration))
        } catch { onError?(error.localizedDescription) }
    }
    func importAudio(_ url: URL) async throws -> AudioClip {
        let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        guard data.count <= 10 * 1024 * 1024 else { throw AppError(message: "请选择10MB以内的音频") }
        let probe = try AVAudioPlayer(data: data)
        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "audio/mp4"
        return AudioClip(url: "data:\(mime);base64," + data.base64EncodedString(), name: url.lastPathComponent, type: mime, duration: probe.duration)
    }
    func play(_ card: Postcard, api: API) async throws {
        if playing { stopPlayback(); return }
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try AVAudioSession.sharedInstance().setActive(true)
        var next: [AVAudioPlayer] = []
        for (clip, isBackground) in [(card.audio, false), (card.backgroundAudio, true)] {
            if let clip {
                let player = try AVAudioPlayer(data: await api.bytes(clip.url)); player.delegate = self
                player.volume = isBackground && card.audio != nil ? 0.25 : 1; next.append(player)
            }
        }
        players = next; playing = !next.isEmpty; players.forEach { $0.prepareToPlay(); $0.play() }
    }
    func stopPlayback() { players.forEach { $0.stop() }; players = []; playing = false; if !recording { try? AVAudioSession.sharedInstance().setActive(false) } }
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in if !self.players.contains(where: { $0.isPlaying }) { self.stopPlayback() } }
    }
    @objc private func interrupted(_ notification: Notification) { if recording { finish() }; stopPlayback() }
}
