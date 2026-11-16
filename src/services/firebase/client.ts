import { getApp, type FirebaseApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from '@react-native-firebase/firestore';

// The default app is initialised natively from GoogleService-Info.plist /
// google-services.json. A missing native app means a misconfigured build or Expo Go.
function resolveApp(): FirebaseApp {
  try {
    return getApp() as unknown as FirebaseApp;
  } catch {
    throw new Error(
      'Firebase native app not found. Use a development build with google-services.json / GoogleService-Info.plist.',
    );
  }
}

export const firebaseApp = resolveApp();
export const auth = getAuth(firebaseApp);

// Native persistence is the offline cache and write queue (docs/offline-sync.md).
export const db = initializeFirestore(firebaseApp, {
  persistence: true,
  cacheSizeBytes: 100 * 1024 * 1024,
  ignoreUndefinedProperties: true,
  serverTimestampBehavior: 'estimate',
});

if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`);
  connectFirestoreEmulator(db, host, 8080);
}
