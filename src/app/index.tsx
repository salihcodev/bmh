import { Redirect } from 'expo-router';

import { BrandLoading } from '@/components/brand/brand-loading';
import { routeFor } from '@/domain/route-guard';
import { useRouteGuard } from '@/hooks/use-route-guard';

export default function IndexScreen() {
  const route = routeFor(useRouteGuard());
  if (!route) return <BrandLoading />;
  return <Redirect href={route} />;
}
