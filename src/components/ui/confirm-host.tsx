import { useEffect, useState } from 'react';

import { ConfirmDialog } from './feedback';

type Request = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

let show: ((request: Request) => void) | null = null;

/**
 * Awaitable design-system confirmation for non-UI code (services, submit handlers).
 * Resolves false when no host is mounted so callers never hang.
 */
export function confirmAsync(options: Omit<Request, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(false);
    show({ ...options, resolve });
  });
}

/** Mount once near the root. */
export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  useEffect(() => {
    show = (next) =>
      setRequest((current) => {
        current?.resolve(false);
        return next;
      });
    return () => {
      show = null;
    };
  }, []);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmDialog
      visible={request !== null}
      title={request?.title ?? ''}
      message={request?.message}
      confirmLabel={request?.confirmLabel ?? ''}
      cancelLabel={request?.cancelLabel ?? ''}
      destructive={request?.destructive}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );
}
