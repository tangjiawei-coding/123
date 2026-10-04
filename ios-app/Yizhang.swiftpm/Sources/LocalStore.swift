import Foundation

final class LocalStore {
    let directory: URL
    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Yizhang", isDirectory: true)
    }
    func read<T: Decodable>(_ name: String, as type: T.Type) throws -> T? {
        let url = directory.appendingPathComponent(name + ".json")
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }
    func write<T: Encodable>(_ name: String, _ value: T) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(value).write(to: directory.appendingPathComponent(name + ".json"), options: .atomic)
    }
    func saveDraft(_ card: Postcard, active: Bool = true) throws {
        var entries = try drafts().filter { $0.id != card.draftId }
        if card.meaningful { entries.insert(DraftEntry(id: card.draftId, updatedAt: Date().timeIntervalSince1970 * 1000, card: card), at: 0) }
        try write("drafts", entries)
        if active { try write("current", card) }
    }
    func drafts() throws -> [DraftEntry] { try read("drafts", as: [DraftEntry].self) ?? [] }
    func deleteDraft(_ id: String) throws { try write("drafts", drafts().filter { $0.id != id }) }
    func works() throws -> [Postcard] { try read("works", as: [Postcard].self) ?? [] }
    func saveWork(_ card: Postcard) throws {
        var works = try works().filter { $0.createdAt != card.createdAt }
        works.insert(card, at: 0); try write("works", works)
    }
    func deleteWork(_ createdAt: Double) throws { try write("works", works().filter { $0.createdAt != createdAt }) }
}
