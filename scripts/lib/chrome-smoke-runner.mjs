/** Shared bounded Chrome/Chromium process runner for CI smoke tests. */
import { spawnSync } from 'node:child_process';
export const CHROME_PROBE_TIMEOUT_MS = 5_000;
export const DEFAULT_CHROME_TIMEOUT_MS = 25_000;
export const DEFAULT_CHROME_MAX_BUFFER = 30 * 1024 * 1024;
export const DEFAULT_CHROME_CANDIDATES = Object.freeze([
  process.env.CHROME_BIN, 'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
].filter(Boolean));
const text = value => typeof value === 'string' ? value : (value == null ? '' : String(value));
export function tailChromeOutput(value, maximum = 4_000) {
  const output = text(value);
  return output.length <= maximum ? output : output.slice(-maximum);
}
export function normaliseChromeResult(result, { command, timeoutMs }) {
  const errorCode = result?.error?.code ?? null;
  const timedOut = errorCode === 'ETIMEDOUT';
  const startupError = Boolean(result?.error) && !timedOut;
  const status = Number.isInteger(result?.status) ? result.status : null;
  return { ...result, command, timeoutMs, status, stdout: text(result?.stdout), stderr: text(result?.stderr), timedOut, startupError,
    ok: !timedOut && !startupError && status === 0,
    failureKind: timedOut ? 'timeout' : (startupError ? 'startup' : (status === 0 ? null : 'exit')) };
}
export function runChrome(command, args, { timeoutMs = DEFAULT_CHROME_TIMEOUT_MS, maxBuffer = DEFAULT_CHROME_MAX_BUFFER, spawn = spawnSync, ...options } = {}) {
  if (!command) throw new TypeError('A Chrome/Chromium parancs kötelező.');
  if (!Array.isArray(args)) throw new TypeError('A Chrome argumentumlistája tömb kell legyen.');
  const result = spawn(command, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer, killSignal: 'SIGTERM', ...options });
  return normaliseChromeResult(result, { command, timeoutMs });
}
export function findChrome({ candidates = DEFAULT_CHROME_CANDIDATES, timeoutMs = CHROME_PROBE_TIMEOUT_MS, spawn = spawnSync } = {}) {
  for (const command of [...new Set(candidates.filter(Boolean))]) {
    const result = runChrome(command, ['--version'], { timeoutMs, maxBuffer: 1024 * 1024, spawn });
    if (result.ok) return command;
  }
  return null;
}
export function describeChromeFailure(result) {
  if (result?.timedOut) return `a Chrome időtúllépés miatt leállt (${result.timeoutMs} ms)`;
  if (result?.startupError) return `a Chrome nem indítható (${result.error?.code ?? 'ismeretlen'}: ${result.error?.message ?? 'ismeretlen hiba'})`;
  return `a Chrome hibakóddal leállt (${result?.status ?? 'ismeretlen'})`;
}
