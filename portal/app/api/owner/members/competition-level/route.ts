import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { requireOwnerContext } from '@/lib/ownerAccess';

const LEVELS = ['Rec', 'Travel', 'Both'] as const;

export async function POST(req: NextRequest) {
  try {
    await requireOwnerContext();
    const { kidId, level } = await req.json() as { kidId: string; level: string | null };

    if (!kidId) return NextResponse.json({ error: 'Missing kidId' }, { status: 400 });
    if (level !== null && !LEVELS.includes(level as typeof LEVELS[number])) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('kids')
      .update({ competition_level: level })
      .eq('id', kidId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
