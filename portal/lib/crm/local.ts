import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CRMCommand, CRMState } from './types';
const exec = promisify(execFile);
export const root = path.resolve(process.cwd(), process.cwd().endsWith('/portal') ? '..' : '.');
export const fixtureTenant = '10000000-0000-0000-0000-000000000001';
export const fixtureLocation = '20000000-0000-0000-0000-000000000001';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUUID(value: string) {
  if (!uuid.test(value)) throw new Error('Invalid identifier');
  return value;
}
export function previewReady() {
  return process.env.NODE_ENV !== 'production' && existsSync(path.join(root, 'generated-artifacts/crm-preview/ready'));
}
// Hex encoding avoids SQL interpolation of user-controlled text. All actual
// authority is still checked by the same SECURITY DEFINER functions and RLS.
export function literal(value: unknown) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::jsonb`;
}
export async function localSQL(query: string, actor?: { userId: string; role: string; tenantId?: string }) {
  if (!previewReady()) throw new Error('Isolated CRM rehearsal is not running. Run python scripts/crm-preview.py.');
  const claims = actor ? { sub: assertUUID(actor.userId), tenant_id: actor.tenantId || fixtureTenant, app_role: actor.role, role: 'authenticated' } : {};
  const prefix = actor ? `SET request.jwt.claims=${JSON.stringify(JSON.stringify(claims)).replace(/^"|"$/g, "'").replace(/\\"/g, '"')}; SET ROLE authenticated;` : '';
  // No TCP listener, environment database URL or provider credential involved.
  const { stdout } = await exec('psql', ['-XqAt', '-h', '/tmp/clubhouse-crm-pg', '-p', '15439', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', prefix + query], { maxBuffer: 4 * 1024 * 1024, timeout: 15000 });
  const lines = stdout.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1];
  if (last === 't') return true;
  if (last === 'f') return false;
  return last ? JSON.parse(last) : null;
}
export async function localSnapshot(location: string, actor: { userId: string; role: string }) {
  return localSQL(`SELECT crm_snapshot('${assertUUID(location)}');`, actor) as Promise<CRMState>;
}
export async function localExecute(location: string, command: CRMCommand, actor: { userId: string; role: string }) {
  return localSQL(`SELECT crm_execute('${assertUUID(location)}',${literal(command)});`, actor) as Promise<CRMState>;
}
