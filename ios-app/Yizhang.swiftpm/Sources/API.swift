import Foundation
import Security

struct API {
    var baseURL: String
    var token: String = ""
    static let defaultURL = "http://120.55.251.74:5123"
    func absolute(_ source: String) -> String {
        if source.hasPrefix("data:") || URL(string: source)?.scheme != nil { return source }
        return baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/" + source.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
    func request<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
        guard let url = URL(string: absolute(path)) else { throw AppError(message: "服务器地址不正确") }
        var r = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 480)
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !token.isEmpty { r.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
        if let body { r.httpMethod = "POST"; r.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await URLSession.shared.data(for: r)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw AppError(message: object?["error"] as? String ?? "请求未完成，请检查网络后重试")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
    func imageData(_ source: String) async throws -> String {
        if source.hasPrefix("data:image/") { return source }
        let data = try await bytes(source)
        return "data:image/\(data.starts(with: [137,80,78,71]) ? "png" : "jpeg");base64," + data.base64EncodedString()
    }
    func bytes(_ source: String) async throws -> Data {
        if source.hasPrefix("data:"), let comma = source.firstIndex(of: ","),
           let data = Data(base64Encoded: String(source[source.index(after: comma)...])) { return data }
        guard let url = URL(string: absolute(source)), ["http", "https"].contains(url.scheme ?? "") else {
            throw AppError(message: "素材地址不正确")
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw AppError(message: "素材下载失败") }
        return data
    }
    static func component(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    }
}
enum SessionKeychain {
    static func query(_ host: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.tangjiawei.yizhang.session", kSecAttrAccount as String: host]
    }
    static func token(_ host: String) -> String {
        var q = query(host); q[kSecReturnData as String] = true
        var item: CFTypeRef?; guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
    static func save(_ token: String, host: String) throws {
        let q = query(host); SecItemDelete(q as CFDictionary)
        if token.isEmpty { return }
        var item = q; item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw AppError(message: "登录凭据未能保存，请重新登录") }
    }
}
