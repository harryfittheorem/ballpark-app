import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireOwnerContext } from '@/lib/ownerAccess';

type GameStatsBody = {
  kidId: string;
  gameDate: string;
  opponent?: string;
  result?: 'win' | 'loss' | 'tie' | 'scrimmage';
  atBats?: number;
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  avgExitVelo?: number;
  peakExitVelo?: number;
  notes?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireOwnerContext();
    const userId = user.id;
    const body = await req.json() as GameStatsBody;
    const { kidId, gameDate } = body;

    if (!kidId || !gameDate) {
      return NextResponse.json({ error: 'kidId and gameDate are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );

    const { data, error } = await supabase
      .from('self_reported_games')
      .insert({
        tenant_id: tenantId,
        kid_id: kidId,
        reported_by: userId,
        game_date: gameDate,
        opponent: body.opponent ?? null,
        result: body.result ?? null,
        at_bats: body.atBats ?? null,
        hits: body.hits ?? null,
        home_runs: body.homeRuns ?? null,
        rbi: body.rbi ?? null,
        avg_exit_velo: body.avgExitVelo ?? null,
        peak_exit_velo: body.peakExitVelo ?? null,
        notes: body.notes ?? null,
        source: 'owner',
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireOwnerContext();
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    if (!kidId) return NextResponse.json({ error: 'kidId required' }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );

    const { data, error } = await supabase
      .from('self_reported_games')
      .select('id, game_date, opponent, result, at_bats, hits, home_runs, rbi, avg_exit_velo, peak_exit_velo, notes, source, created_at')
      .eq('tenant_id', tenantId)
      .eq('kid_id', kidId)
      .order('game_date', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
