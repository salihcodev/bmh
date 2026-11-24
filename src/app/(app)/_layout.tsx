import { Redirect, Stack } from "expo-router";

import { BrandLoading } from "@/components/brand/brand-loading";
import { SurfaceMemory } from "@/components/layout/surface-switch";
import { routeFor } from "@/domain/route-guard";
import { canEnterApp } from "@/domain/user";
import { useRouteGuard } from "@/hooks/use-route-guard";
import { useStackScreenOptions } from "@/hooks/use-stack-screen-options";
import { useAuth } from "@/providers/auth-provider";

/** Signed in, active and onboarded. Support and custom system users stay on the dashboard. */
export default function AppLayout() {
  const guard = useRouteGuard();
  const { profile } = useAuth();
  const stackOptions = useStackScreenOptions();
  if (guard.kind === "loading") return <BrandLoading />;
  if (guard.kind !== "app" && guard.kind !== "dashboard") return <Redirect href={routeFor(guard)!} />;
  if (!canEnterApp(profile?.userType)) return <Redirect href="/(dashboard)" />;
  return (
    <SurfaceMemory surface="app">
      <Stack screenOptions={stackOptions} />
    </SurfaceMemory>
  );
}
