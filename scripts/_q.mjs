import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
const { data, error } = await sb.from('achievements').select('key,title').order('key');
if (error) { console.error(error); process.exit(1); }
console.log('Total:', data.length);
data.forEach(r => console.log(' -', r.key, '|', r.title));
