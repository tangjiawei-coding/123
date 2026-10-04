// swift-tools-version: 5.9
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Yizhang",
    platforms: [.iOS("17.0")],
    products: [.iOSApplication(
        name: "一张", targets: ["AppModule"], bundleIdentifier: "com.tangjiawei.yizhang",
        displayVersion: "1.0", bundleVersion: "1", appIcon: .asset("AppIcon"),
        accentColor: .presetColor(.brown), supportedDeviceFamilies: [.phone, .pad],
        supportedInterfaceOrientations: [.portrait, .landscapeLeft, .landscapeRight],
        capabilities: [
            .camera(purposeString: "拍下此刻，制作你的明信片"),
            .microphone(purposeString: "录下想说的话，附在明信片上"),
            .photoLibraryAdd(purposeString: "把完成的明信片保存到相册")
        ], additionalInfoPlistContentFilePath: "AppSettings.plist"
    )],
    targets: [.executableTarget(name: "AppModule", path: ".",
        exclude: ["AppSettings.plist"], sources: ["Sources"],
        resources: [.process("Resources")])], swiftLanguageVersions: [.v5]
)
