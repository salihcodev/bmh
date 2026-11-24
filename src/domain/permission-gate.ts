export type PermissionGateState = { loading: boolean; allowed: boolean };

/** What a permission-gated route renders: wait while roles load, then show it or leave. */
export function permissionGate(state: PermissionGateState): 'loading' | 'allow' | 'redirect' {
  if (state.allowed) return 'allow';
  return state.loading ? 'loading' : 'redirect';
}
