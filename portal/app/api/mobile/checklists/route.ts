import { NextRequest, NextResponse } from 'next/server';
import { enrollmentAuth } from '@/lib/enrollmentAuth';
import { readAppRole, readTenantId } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { assignmentById, dbError, revision, type TrainingContext } from '@/lib/training/server';
import { learningAction } from '@/lib/training/learning';
import { TrainingError, requireValue, uuid } from '@/lib/training/validation';

export const dynamic = 'force-dynamic';

async function context(req: NextRequest): Promise<TrainingContext> {
  // This endpoint is token-only: cookies must not bypass mobile authorization.
  requireValue(req.headers.has('authorization'), 'Staff access token required', 401);
  const { session } = await enrollmentAuth(req);
  requireValue(session, 'Sign in to access assigned checklists', 401);
  const role = readAppRole(session);
  const tenantId = readTenantId(session);
  requireValue(tenantId && ['owner', 'admin', 'coach'].includes(role), 'Staff access required', 403);
  const db = createServiceClient();
  let isStaff = false;
  if (role === 'coach') {
    const { data, error } = await db.from('coaches').select('is_active,capabilities')
      .eq('tenant_id', tenantId).eq('user_id', session.user.id).maybeSingle();
    dbError(error);
    requireValue(data?.is_active, 'Active instructor account required', 403);
    isStaff = data.capabilities?.preset === 'staff';
  }
  return {
    db, tenantId, userId: session.user.id, email: session.user.email ?? '',
    role: role as TrainingContext['role'], isStaff, canManage: role === 'owner' || role === 'admin',
  };
}

async function handleRequest(req: NextRequest) {
  try {
    const ctx = await context(req);
    if (req.method === 'GET') {
      // Do not call overview(): opening a checklist must not run auto-assignment rules.
      const { data: assignments, error } = await ctx.db.from('training_assignments').select('*')
        .eq('tenant_id', ctx.tenantId).eq('user_id', ctx.userId);
      dbError(error);
      const result = [];
      for (const assignment of assignments ?? []) {
        const published = await revision(ctx, assignment.course_id, assignment.version);
        const { data: progress, error: progressError } = await ctx.db.from('training_progress')
          .select('lesson_id,completed_at').eq('assignment_id', assignment.id);
        dbError(progressError);
        for (const lesson of published.content.lessons) {
          if (lesson.kind !== 'checklist') continue;
          result.push({
            assignment_id: assignment.id, course_title: published.content.title,
            lesson_id: lesson.id, title: lesson.title, items: lesson.checklist ?? [],
            completed: progress?.some(p => p.lesson_id === lesson.id && !!p.completed_at) ?? false,
          });
        }
      }
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    }
    const raw = await req.text();
    requireValue(Buffer.byteLength(raw) <= 16_384, 'Request too large', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new TrainingError('Invalid checklist request'); }
    requireValue(body && typeof body === 'object' && !Array.isArray(body), 'Invalid checklist request');
    const assignment = await assignmentById(ctx, uuid(body.assignmentId));
    const published = await revision(ctx, assignment.course_id, assignment.version);
    requireValue(published.content.lessons.some(l => l.id === body.lessonId && l.kind === 'checklist'),
      'Assigned checklist not found', 404);
    await learningAction(ctx, 'progress', body);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TrainingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[phone-checklists]', error instanceof Error ? error.message : 'Request failed');
    return NextResponse.json({ error: 'Could not load or save checklists. Please retry.' }, { status: 500 });
  }
}

// Token-only endpoint: no cookie authentication and no credentialed CORS.
// This also supports the existing Expo web phone preview on a separate origin.
function cors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const OPTIONS = () => cors(new NextResponse(null, { status: 204 }));
export const GET = async (req: NextRequest) => cors(await handleRequest(req));
export const POST = async (req: NextRequest) => cors(await handleRequest(req));
