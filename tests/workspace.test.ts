import { describe, expect, it } from 'vitest';

import { pickActiveWorkspace } from '@/domain/workspace';

const memberships = [{ workspaceId: 'w1' }, { workspaceId: 'w2' }, { workspaceId: 'w3' }];

describe('switching workspaces', () => {
  it('uses the device preference when it is still a membership', () => {
    expect(pickActiveWorkspace(memberships, 'w2')?.workspaceId).toBe('w2');
  });

  it('falls back to the profile preference on a new device', () => {
    expect(pickActiveWorkspace(memberships, null, 'w3')?.workspaceId).toBe('w3');
  });

  it('ignores stale ids (left or removed) and picks the first membership', () => {
    expect(pickActiveWorkspace(memberships, 'gone', 'also-gone')?.workspaceId).toBe('w1');
  });

  it('returns null without memberships (onboarding)', () => {
    expect(pickActiveWorkspace([], 'w1', 'w1')).toBeNull();
  });
});
