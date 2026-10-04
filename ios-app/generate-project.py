"""从 .swiftpm 同一份源码生成可直接签名安装的 Xcode 工程；不依赖 XcodeGen。"""
from pathlib import Path
import hashlib, json, plistlib
ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'Yizhang.swiftpm'
PROJECT = ROOT / 'Yizhang.xcodeproj'
PROJECT.mkdir(exist_ok=True)
def uid(value): return hashlib.sha1(value.encode()).hexdigest()[:24].upper()
def q(value): return json.dumps(str(value),ensure_ascii=False)
objects = {}
def obj(key, value): objects[uid(key)] = value; return uid(key)
files = sorted((PACKAGE/'Sources').glob('*.swift'))
resources = sorted(p for p in (PACKAGE/'Resources').iterdir() if p.is_file() or p.suffix=='.xcassets')
source_refs, source_builds, resource_refs, resource_builds = [], [], [], []
for file in files + resources:
    rel = file.relative_to(ROOT).as_posix()
    kind = 'sourcecode.swift' if file.suffix=='.swift' else 'folder.assetcatalog' if file.suffix=='.xcassets' else 'image.png' if file.suffix=='.png' else 'image.jpeg' if file.suffix=='.jpg' else 'file'
    ref = obj(rel, '{isa = PBXFileReference; lastKnownFileType = '+kind+'; path = '+q(rel)+'; sourceTree = SOURCE_ROOT;}')
    build = obj('build:'+rel, '{isa = PBXBuildFile; fileRef = '+ref+';}')
    (source_refs if file in files else resource_refs).append(ref)
    (source_builds if file in files else resource_builds).append(build)
product = obj('product','{isa = PBXFileReference; explicitFileType = wrapper.application; path = Yizhang.app; sourceTree = BUILT_PRODUCTS_DIR;}')
src_group = obj('sources','{isa = PBXGroup; name = Sources; children = ('+','.join(source_refs)+'); sourceTree = "<group>";}')
res_group = obj('resources','{isa = PBXGroup; name = Resources; children = ('+','.join(resource_refs)+'); sourceTree = "<group>";}')
products = obj('products','{isa = PBXGroup; name = Products; children = ('+product+'); sourceTree = "<group>";}')
main = obj('main','{isa = PBXGroup; children = ('+','.join([src_group,res_group,products])+'); sourceTree = "<group>";}')
sources = obj('sourcesphase','{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(source_builds)+'); runOnlyForDeploymentPostprocessing = 0;}')
res = obj('resourcesphase','{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(resource_builds)+'); runOnlyForDeploymentPostprocessing = 0;}')
framework = obj('frameworksphase','{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;}')
common = {'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'17.0','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','SWIFT_OPTIMIZATION_LEVEL':'-Onone'}
app = {'PRODUCT_NAME':'Yizhang','PRODUCT_BUNDLE_IDENTIFIER':'com.tangjiawei.yizhang','INFOPLIST_FILE':'Info.plist','GENERATE_INFOPLIST_FILE':'NO','CODE_SIGN_STYLE':'Automatic','TARGETED_DEVICE_FAMILY':'1,2','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','MARKETING_VERSION':'1.0','CURRENT_PROJECT_VERSION':'1','SWIFT_EMIT_LOC_STRINGS':'YES'}
def config(key,settings,name):
    return obj(key,'{isa = XCBuildConfiguration; buildSettings = {'+''.join(k+' = '+q(v)+';' for k,v in settings.items())+'}; name = '+name+';}')
def configs(key,settings):
    ids=[]
    for name in ['Debug','Release']:
        value={**settings}
        if name=='Release' and 'SWIFT_OPTIMIZATION_LEVEL' in value: value['SWIFT_OPTIMIZATION_LEVEL']='-O'
        ids.append(config(key+name,value,name))
    return obj(key,'{isa = XCConfigurationList; buildConfigurations = ('+','.join(ids)+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;}')
project_config=configs('projectconfig',common); app_config=configs('appconfig',app)
target=obj('target','{isa = PBXNativeTarget; buildConfigurationList = '+app_config+'; buildPhases = ('+','.join([sources,framework,res])+'); buildRules = (); dependencies = (); name = Yizhang; productName = Yizhang; productReference = '+product+'; productType = "com.apple.product-type.application";}')
test_ref=obj('uitestfile','{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "UITests/CreatorFlowTests.swift"; sourceTree = SOURCE_ROOT;}')
test_build=obj('uitestbuild','{isa = PBXBuildFile; fileRef = '+test_ref+';}')
test_product=obj('uitestproduct','{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = YizhangUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;}')
test_sources=obj('uitestsources','{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+test_build+'); runOnlyForDeploymentPostprocessing = 0;}')
test_frameworks=obj('uitestframeworks','{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;}')
test_config=configs('uitestconfig',{'PRODUCT_NAME':'YizhangUITests','PRODUCT_BUNDLE_IDENTIFIER':'com.tangjiawei.yizhang.uitests','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'Yizhang','TARGETED_DEVICE_FAMILY':'1,2','CODE_SIGN_STYLE':'Automatic'})
proxy=obj('uitestproxy','{isa = PBXContainerItemProxy; containerPortal = '+uid('project')+'; proxyType = 1; remoteGlobalIDString = '+target+'; remoteInfo = Yizhang;}')
dependency=obj('uitestdependency','{isa = PBXTargetDependency; target = '+target+'; targetProxy = '+proxy+';}')
test_target=obj('uitesttarget','{isa = PBXNativeTarget; buildConfigurationList = '+test_config+'; buildPhases = ('+test_sources+','+test_frameworks+'); buildRules = (); dependencies = ('+dependency+'); name = YizhangUITests; productName = YizhangUITests; productReference = '+test_product+'; productType = "com.apple.product-type.bundle.ui-testing";}')
objects[main]=objects[main].replace('children = (','children = ('+test_ref+',')
objects[products]=objects[products].replace('children = (','children = ('+test_product+',')
project=obj('project','{isa = PBXProject; attributes = {LastUpgradeCheck = 1600; TargetAttributes = {'+test_target+' = {TestTargetID = '+target+';};};}; buildConfigurationList = '+project_config+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh_CN; knownRegions = (zh_CN,en,Base); mainGroup = '+main+'; productRefGroup = '+products+'; projectDirPath = ""; projectRoot = ""; targets = ('+target+','+test_target+');}')
(PROJECT/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+ '\n'.join(k+' = '+v+';' for k,v in objects.items())+'\n}; rootObject = '+project+';}\n',encoding='utf-8')
info=plistlib.loads((PACKAGE/'AppSettings.plist').read_bytes())
info.update(CFBundleDevelopmentRegion='zh_CN',CFBundleDisplayName='一张',CFBundleExecutable='$(EXECUTABLE_NAME)',CFBundleIdentifier='$(PRODUCT_BUNDLE_IDENTIFIER)',CFBundleInfoDictionaryVersion='6.0',CFBundleName='$(PRODUCT_NAME)',CFBundlePackageType='APPL',CFBundleShortVersionString='$(MARKETING_VERSION)',CFBundleVersion='$(CURRENT_PROJECT_VERSION)',LSRequiresIPhoneOS=True,UILaunchScreen={},UIApplicationSceneManifest={'UIApplicationSupportsMultipleScenes':False},UISupportedInterfaceOrientations=['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],NSCameraUsageDescription='拍下此刻，制作你的明信片',NSMicrophoneUsageDescription='录下想说的话，附在明信片上',NSPhotoLibraryAddUsageDescription='把完成的明信片保存到相册')
(ROOT/'Info.plist').write_bytes(plistlib.dumps(info,sort_keys=False))
scheme=PROJECT/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
reference=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Yizhang.app" BlueprintName="Yizhang" ReferencedContainer="container:Yizhang.xcodeproj"/>'
test_reference=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{test_target}" BuildableName="YizhangUITests.xctest" BlueprintName="YizhangUITests" ReferencedContainer="container:Yizhang.xcodeproj"/>'
(scheme/'Yizhang.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB"><Testables><TestableReference skipped="NO">{test_reference}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''',encoding='utf-8')
print('Generated',PROJECT)
