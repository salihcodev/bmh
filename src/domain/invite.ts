// Invite codes are document ids under workspaces/{wid}/invites, so they must be
// unguessable (rules require >= 24 chars). A shareable token is `${wid}.${code}`.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const INVITE_CODE_LENGTH = 28;
export const INVITE_TTL_DAYS = 7;
export const INVITE_LINK_PREFIX = 'bemyhand://join';

/** `randomBytes` must come from a CSPRNG (expo-crypto in the app). */
export function generateInviteCode(randomBytes: (n: number) => Uint8Array, length = INVITE_CODE_LENGTH): string {
  let code = '';
  // Rejection sampling keeps the distribution uniform.
  const limit = 256 - (256 % ALPHABET.length);
  while (code.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit) code += ALPHABET[byte % ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

export function inviteToken(workspaceId: string, code: string): string {
  return `${workspaceId}.${code}`;
}

export function inviteLink(workspaceId: string, code: string): string {
  return `${INVITE_LINK_PREFIX}?w=${encodeURIComponent(workspaceId)}&c=${encodeURIComponent(code)}`;
}

const ID = /^[A-Za-z0-9_-]+$/;

/** Accepts a full link, a `wid.code` token, or the separate params. Returns null when malformed. */
export function parseInvite(input: string): { workspaceId: string; code: string } | null {
  const value = input.trim();
  if (!value) return null;
  const query = value.includes('?') ? value.slice(value.indexOf('?') + 1) : null;
  if (query) {
    const params = new Map(
      query.split('&').map((pair) => {
        const [k = '', v = ''] = pair.split('=');
        return [k, decodeURIComponent(v)] as const;
      }),
    );
    const workspaceId = params.get('w') ?? '';
    const code = params.get('c') ?? '';
    return ID.test(workspaceId) && ID.test(code) && code.length >= 24 ? { workspaceId, code } : null;
  }
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const workspaceId = value.slice(0, dot);
  const code = value.slice(dot + 1);
  return ID.test(workspaceId) && ID.test(code) && code.length >= 24 ? { workspaceId, code } : null;
}

export type InviteState = 'valid' | 'used' | 'expired';

export function inviteState(invite: { used: boolean; expiresAt: { toMillis(): number } }, now = Date.now()): InviteState {
  if (invite.used) return 'used';
  if (invite.expiresAt.toMillis() <= now) return 'expired';
  return 'valid';
}
