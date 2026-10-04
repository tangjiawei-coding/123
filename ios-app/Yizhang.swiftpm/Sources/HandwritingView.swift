import SwiftUI

struct HandwritingView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var ink = InkLayout()
    @State private var current: [[Double]] = []
    private let canvasSize = CGSize(width: 600, height: 280)
    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                HStack(spacing: 24) {
                    ForEach(["#594735", "#AF5751", "#55798C", "#67826B"], id: \.self) { color in
                        Button { ink.color = color } label: { Circle().fill(Color(hex: color)).frame(width: 28, height: 28).padding(5).overlay(Circle().stroke(ink.color == color ? Palette.accent : .clear, lineWidth: 1)) }
                    }
                }
                HStack { Text("粗细"); Slider(value: Binding(get: { ink.lineWidth ?? 2.5 }, set: { ink.lineWidth = $0 }), in: 1...8) }.padding(.horizontal)
                GeometryReader { geometry in
                    drawing(strokes: ink.strokes + (current.isEmpty ? [] : [current]))
                        .frame(width: geometry.size.width, height: geometry.size.height)
                        .background(.white.opacity(0.65)).contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                            current.append([min(600, max(0, value.location.x * 600/geometry.size.width)), min(280, max(0, value.location.y * 280/geometry.size.height))])
                        }.onEnded { _ in if !current.isEmpty { ink.strokes.append(current) }; current = [] })
                }.aspectRatio(600/280, contentMode: .fit).overlay(Rectangle().stroke(Palette.line))
                HStack {
                    Button("撤销") { if !ink.strokes.isEmpty { ink.strokes.removeLast() } }
                    Button("清空") { ink.strokes = []; current = [] }
                }.buttonStyle(SoftButtonStyle())
                Text("保存后，可以在明信片上拖动笔迹。\n背景会保持透明。").font(.footnote).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                Spacer()
            }.padding(20).background(Palette.paper).navigationTitle("留下你的笔迹").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) { Button("完成") { save() } }
                }.onAppear {
                    ink = store.card.editor.ink ?? InkLayout()
                    let old = ink.canvasWidth ?? 600
                    if old != 600 { ink.strokes = ink.strokes.map { $0.map { [$0[0]*600/old, $0[1]*600/old] } } }
                    ink.canvasWidth = 600
                }
        }
    }
    private func drawing(strokes: [[[Double]]]) -> some View {
        Canvas { context, size in
            let scale = size.width/600
            for stroke in strokes where !stroke.isEmpty {
                var path = Path()
                if stroke.count == 1 {
                    let r = (ink.lineWidth ?? 2.5)*scale/2
                    path.addEllipse(in: CGRect(x: stroke[0][0]*scale-r, y: stroke[0][1]*scale-r, width: r*2, height: r*2))
                    context.fill(path, with: .color(Color(hex: ink.color ?? "#594735")))
                } else {
                    for (i, p) in stroke.enumerated() where p.count == 2 {
                        let point = CGPoint(x: p[0]*scale, y: p[1]*scale)
                        if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
                    }
                    context.stroke(path, with: .color(Color(hex: ink.color ?? "#594735")), style: StrokeStyle(lineWidth: (ink.lineWidth ?? 2.5)*scale, lineCap: .round, lineJoin: .round))
                }
            }
        }
    }
    private func save() {
        if ink.strokes.isEmpty { store.card.handwriting = ""; store.card.editor.ink = nil; dismiss(); return }
        let renderer = ImageRenderer(content: drawing(strokes: ink.strokes).frame(width: 600, height: 280)); renderer.scale = 2; renderer.isOpaque = false
        guard let data = renderer.uiImage?.pngData() else { store.status = "笔迹保存失败，请重试"; return }
        if store.card.editor.ink == nil { ink.h = ink.w * (280/600) * (560/360) }
        store.card.handwriting = "data:image/png;base64," + data.base64EncodedString(); store.card.editor.ink = ink; dismiss()
    }
}
