import { onSnapshot as firestoreOnSnapshot } from '@react-native-firebase/firestore';

import { trackListener } from './listener-registry';

export { activeListenerCount, trackListener, unsubscribeAll } from './listener-registry';

/** Drop-in for Firestore `onSnapshot` that registers the listener. Use this everywhere. */
export const onSnapshot = ((...args: unknown[]) =>
  trackListener((firestoreOnSnapshot as (...a: unknown[]) => () => void)(...args))) as typeof firestoreOnSnapshot;
