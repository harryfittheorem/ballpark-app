import 'server-only';

/**
 * Read-only Meta Graph client, ported from the MyAgencyOS graph helper.
 * GET only. Version comes from META_GRAPH_API_VERSION (default v27.0).
 * The system user token is read from META_SYSTEM_USER_TOKEN and is never logged.
 */
import { DEFAULT_GRAPH_API_VERSION } from '../types';

const GRAPH_HOST = 'graph.facebook.com';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MIN_GAP_MS = 200;

/** App, user, and ad-account throttling. 80004 is the ads insights rate limit. */
export const RETRYABLE_META_CODES = new Set([4, 17, 32, 613, 80004]);
export const MAX_GRAPH_PAGES = 20;

export class MetaGraphError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly fbtraceId: string | null;

  constructor(message: string, fields: { status?: number; code?: number | null; fbtraceId?: string | null } = {}) {
    super(message);
    this.name = 'MetaGraphError';
    this.status = fields.status ?? 0;
    this.code = fields.code ?? null;
    this.fbtraceId = fields.fbtraceId ?? null;
  }
}

export interface GraphPage<T> {
  data?: T[];
  paging?: { next?: string; cursors?: { before?: string; after?: string } };
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string; type?: string };
}

export interface GraphClientOptions {
  maxPages?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  minGapMs?: number;
  maxRetries?: number;
  sleepImpl?: (ms: number) => Promise<void>;
  backoffMs?: (attempt: number) => number;
}

export function graphApiVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  return raw && /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_GRAPH_API_VERSION;
}

export function metaTokenConfigured(): boolean {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  return typeof token === 'string' && token.trim().length > 0;
}

export function redactSecrets(text: string): string {
  const token = process.env.META_SYSTEM_USER_TOKEN?.trim();
  const withoutQuery = text.split('?')[0] ?? text;
  if (!token) return withoutQuery;
  return withoutQuery.split(token).join('[redacted]');
}

export function isGraphUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === GRAPH_HOST;
  } catch {
    return false;
  }
}

export function buildGraphUrl(path: string, params: Record<string, string>): string {
  const token = process.env.META_SYSTEM_USER_TOKEN?.trim();
  if (!token) throw new MetaGraphError('Meta system user token is not configured');
  const url = new URL(`https://${GRAPH_HOST}/${graphApiVersion()}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', token);
  return url.toString();
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultBackoff(attempt: number): number {
  const base = Math.min(8_000, 500 * 2 ** (attempt - 1));
  return base + Math.floor(Math.random() * 200);
}

let throttleChain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function waitForTurn(minGapMs: number, sleepImpl: (ms: number) => Promise<void>): Promise<void> {
  const run = throttleChain.then(async () => {
    if (minGapMs <= 0) return;
    const wait = minGapMs - (Date.now() - lastRequestAt);
    if (wait > 0) await sleepImpl(wait);
    lastRequestAt = Date.now();
  });
  throttleChain = run.then(() => undefined, () => undefined);
  return run;
}

function errorFields(body: GraphPage<unknown> | null, status: number): { message: string; code: number | null; fbtraceId: string | null } {
  const code = typeof body?.error?.code === 'number' ? body.error.code : null;
  const fbtraceId = typeof body?.error?.fbtrace_id === 'string' ? body.error.fbtrace_id : null;
  const detail = code === null ? `HTTP ${status}` : `HTTP ${status}, code ${code}`;
  return { message: `Meta Insights request failed (${detail}).`, code, fbtraceId };
}

async function readBody(response: Response): Promise<{ text: string; json: GraphPage<unknown> | null }> {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) as GraphPage<unknown> };
  } catch {
    return { text, json: null };
  }
}

/**
 * Idempotent GET with a hard timeout, a minimum gap between calls, and
 * exponential backoff on HTTP 429 or Meta codes 4 / 17 / 32 / 613 / 80004.
 * Any other method throws before the network is touched.
 */
export async function metaGraphFetch(url: string, init: { method?: string } = {}, options: GraphClientOptions = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    throw new MetaGraphError('Meta client is read-only and allows GET only');
  }
  if (!isGraphUrl(url)) {
    throw new MetaGraphError('Refusing a non-Graph URL');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = (options.maxRetries ?? DEFAULT_MAX_RETRIES) + 1;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const backoffMs = options.backoffMs ?? defaultBackoff;
  const minGapMs = options.minGapMs ?? DEFAULT_MIN_GAP_MS;

  let lastError: MetaGraphError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForTurn(minGapMs, sleepImpl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
      if (response.ok) return response;
      const { json } = await readBody(response);
      const fields = errorFields(json, response.status);
      const retryable = response.status === 429 || (fields.code !== null && RETRYABLE_META_CODES.has(fields.code));
      lastError = new MetaGraphError(fields.message, { status: response.status, code: fields.code, fbtraceId: fields.fbtraceId });
      if (retryable && attempt < maxAttempts) {
        console.warn(`[MetaAPI] throttled (${fields.message}); retry ${attempt} of ${maxAttempts - 1} url=${redactSecrets(url)}`);
        await sleepImpl(backoffMs(attempt));
        continue;
      }
      console.error(`[MetaAPI] request failed url=${redactSecrets(url)} ${fields.message}`);
      throw lastError;
    } catch (error) {
      if (error instanceof MetaGraphError) throw error;
      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? `Meta Insights request timed out after ${timeoutMs}ms`
        : 'Meta Insights request failed before a response arrived';
      lastError = new MetaGraphError(redactSecrets(message));
      if (attempt >= maxAttempts) {
        console.error(`[MetaAPI] ${lastError.message} url=${redactSecrets(url)}`);
        throw lastError;
      }
      await sleepImpl(backoffMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new MetaGraphError('Meta Insights request failed');
}

/** Follow paging.next until it is gone. A cursor left after the page cap sets incomplete. */
export async function graphGetAll<T>(startUrl: string, options: GraphClientOptions = {}): Promise<{ rows: T[]; incomplete: boolean }> {
  if (!isGraphUrl(startUrl)) throw new MetaGraphError('Refusing a non-Graph URL');
  const maxPages = options.maxPages ?? MAX_GRAPH_PAGES;
  let url: string | null = startUrl;
  let pages = 0;
  const rows: T[] = [];
  let incomplete = false;

  while (url) {
    const response = await metaGraphFetch(url, { method: 'GET' }, options);
    let body: GraphPage<T>;
    try {
      body = await response.json() as GraphPage<T>;
    } catch {
      throw new MetaGraphError('Meta Insights returned a response that was not JSON');
    }
    if (body.error) {
      const code = typeof body.error.code === 'number' ? body.error.code : null;
      const fbtraceId = typeof body.error.fbtrace_id === 'string' ? body.error.fbtrace_id : null;
      throw new MetaGraphError(
        code === null ? 'Meta Insights request failed' : `Meta Insights request failed (code ${code}).`,
        { status: 200, code, fbtraceId },
      );
    }
    pages += 1;
    if (Array.isArray(body.data)) rows.push(...body.data);
    const next = typeof body.paging?.next === 'string' ? body.paging.next : null;
    // The last page still carries cursors.after. That is the end of the list,
    // not a remaining page. A next URL we do not follow means the cursor remains.
    if (!next) break;
    if (pages >= maxPages || !isGraphUrl(next)) {
      incomplete = true;
      break;
    }
    url = next;
  }
  return { rows, incomplete };
}
