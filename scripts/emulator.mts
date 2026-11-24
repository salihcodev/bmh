import { createConnection } from "node:net";

export const DEMO_PROJECT = "demo-be-my-hand";
export const FIRESTORE_EMULATOR = "127.0.0.1:8080";
export const AUTH_EMULATOR = "127.0.0.1:9099";

/**
 * The demo project is the local emulator (`pnpm emulators`). When the host is unset and there is
 * no service-account key, point Firestore at that emulator so `pnpm data` works without extra
 * flags. A key or an explicit host is left untouched, so a live run still requires
 * GOOGLE_APPLICATION_CREDENTIALS and `--project bemyhand-8de0e`.
 */
export function useDemoEmulator(projectId: string): void {
  if (projectId !== DEMO_PROJECT) return;
  if (
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  )
    return;
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
  console.log(`FIRESTORE_EMULATOR_HOST unset; using ${FIRESTORE_EMULATOR}.`);
}

export async function assertEmulator(
  address: string,
  label: string,
): Promise<void> {
  const [host, portText] = address.split(":");
  const port = Number(portText);
  const open = await new Promise<boolean>((resolve) => {
    if (!host || !Number.isInteger(port)) {
      resolve(false);
      return;
    }
    const socket = createConnection({ host, port });
    const finish = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(800);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
  if (open) return;
  console.error(
    `${label} emulator is not running at ${address}. Start it with: pnpm emulators`,
  );
  process.exit(1);
}
