import UIKit
import Capacitor

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    // With the UIScene lifecycle the window lives in SceneDelegate; this property stays only so older plugin code that
    // reads `UIApplication.shared.delegate?.window` does not break.
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    // Scene configuration: one default scene, handled by SceneDelegate (Info.plist: UIApplicationSceneManifest).
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // Push notifications: hand the APNs device token (or the failure) to the push plugin (@capacitor-firebase/messaging, which turns it into the FCM token).
    // These stay in AppDelegate: they are application-level callbacks, not scene callbacks.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // Push (Firebase Messaging plugin): a notification that arrives while the app is open / in the background is handed to the plugin.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

    // URL opens and universal links are scene events now: see SceneDelegate (scene(_:openURLContexts:) and scene(_:continue:)),
    // which forward them to Capacitor's SceneDelegateProxy.
}
