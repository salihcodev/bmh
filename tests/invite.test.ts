import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { generateInviteCode, inviteLink, inviteState, inviteToken, parseInvite } from '@/domain/invite';

const rng = (n: number) => new Uint8Array(randomBytes(n));

describe('invite codes', () => {
  it('are long, url-safe and unique', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode(rng)));
    expect(codes.size).toBe(500);
    for (const code of codes) {
      expect(code).toHaveLength(28);
      expect(code).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it('parse back from link and token', () => {
    const code = generateInviteCode(rng);
    expect(parseInvite(inviteLink('wsABC', code))).toEqual({ workspaceId: 'wsABC', code });
    expect(parseInvite(inviteToken('wsABC', code))).toEqual({ workspaceId: 'wsABC', code });
    expect(parseInvite(`  ${inviteToken('wsABC', code)}\n`)).toEqual({ workspaceId: 'wsABC', code });
  });

  it('reject malformed input and short codes', () => {
    expect(parseInvite('')).toBeNull();
    expect(parseInvite('nonsense')).toBeNull();
    expect(parseInvite('ws.short')).toBeNull();
    expect(parseInvite('bemyhand://join?w=ws&c=short')).toBeNull();
    expect(parseInvite('ws/../x.ABCDEFGHJKLMNPQRSTUVWXYZabcd')).toBeNull();
  });

  it('state reflects used and expiry', () => {
    const at = (ms: number) => ({ toMillis: () => ms });
    expect(inviteState({ used: false, expiresAt: at(2000) }, 1000)).toBe('valid');
    expect(inviteState({ used: false, expiresAt: at(1000) }, 1000)).toBe('expired');
    expect(inviteState({ used: true, expiresAt: at(2000) }, 1000)).toBe('used');
  });
});
