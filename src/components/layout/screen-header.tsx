import type { ReactNode } from 'react';

import { Header } from '@/components/ui';

import { SurfaceSwitch, useShowSurfaceSwitch } from './surface-switch';
import { SyncPill } from './sync-pill';

type Variant = 'bar' | 'large' | 'compact';

/**
 * The app's screen header: back, title + subtitle (truncating, RTL-safe), the screen's own actions,
 * then the sync chip. Layout and overlap rules live in the `Header` primitive.
 * Defaults to `large` on screens without back (tab roots) and `bar` with back.
 */
export function ScreenHeader({
  title,
  subtitle,
  back = false,
  onBack,
  actions,
  variant,
  sync = true,
  tag,
  onTitlePress,
  titleHint,
  collapsed = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  /** Screen actions, placed before the sync chip. */
  actions?: ReactNode;
  variant?: Variant;
  /** Hide the sync chip on screens that never write (rare). */
  sync?: boolean;
  tag?: string;
  onTitlePress?: () => void;
  titleHint?: string;
  /** Tighter compact header once the page scrolls. */
  collapsed?: boolean;
}) {
  const resolved: Variant = variant ?? (back ? 'bar' : 'large');
  const showSwitch = useShowSurfaceSwitch();
  const trailing =
    actions || showSwitch || sync ? (
      <>
        {actions}
        {showSwitch ? <SurfaceSwitch /> : null}
        {sync ? <SyncPill compact iconOnly={resolved === 'bar' && !!actions} /> : null}
      </>
    ) : undefined;
  return (
    <Header
      title={title}
      subtitle={subtitle}
      back={back}
      onBack={onBack}
      large={resolved === 'large'}
      compact={resolved === 'compact'}
      collapsed={collapsed}
      tag={tag}
      onTitlePress={onTitlePress}
      titleHint={titleHint}
      trailing={trailing}
    />
  );
}
