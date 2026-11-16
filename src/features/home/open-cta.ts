import { router, type Href } from 'expo-router';
import { Linking } from 'react-native';

import type { ResolvedCta } from '@/domain/marketing';

export function openCta(cta: ResolvedCta) {
  if (!cta) return;
  if (cta.kind === 'route') router.push(cta.href as Href);
  else void Linking.openURL(cta.url);
}
