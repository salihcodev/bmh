import { deleteApp, getApp, getApps, initializeApp } from '@react-native-firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from '@react-native-firebase/auth';

import { env } from '@/config/env';

const PROVISION_APP = 'bmh-provision';

/**
 * Creates an Auth user without signing the staff member out.
 * Spark has no Admin SDK, so this uses a second Firebase app and then deletes it.
 * The password is never written to Firestore.
 */
export async function provisionAuthUser(email: string, password: string): Promise<string> {
  const leftover = getApps().find((app) => app.name === PROVISION_APP);
  if (leftover) await deleteApp(leftover);

  const source = getApp().options;
  const app = await initializeApp(
    {
      apiKey: source.apiKey,
      appId: source.appId,
      projectId: source.projectId,
      messagingSenderId: source.messagingSenderId,
      storageBucket: source.storageBucket,
      databaseURL: source.databaseURL,
    },
    PROVISION_APP,
  );

  try {
    const secondary = getAuth(app);
    if (env.useEmulators) connectAuthEmulator(secondary, `http://${env.emulatorHost}:9099`);
    const credential = await createUserWithEmailAndPassword(secondary, email.trim().toLowerCase(), password);
    const uid = credential.user.uid;
    await signOut(secondary);
    return uid;
  } finally {
    await deleteApp(app);
  }
}
