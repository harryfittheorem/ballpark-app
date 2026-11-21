#!/usr/bin/env python3
"""Preview-only persistent outbox recovery; never opens a network provider.
Run after crm-preview.py. Re-running/restarting does not replay accepted actions.
"""
import json
import time
import os
import secrets
import os.path
import sys
import uuid
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from crm_preview_import import load_preview

def provider_worker():
    """Explicit one-location staging mode; no isolated identity or credential fallback."""
    base = os.environ.get('CRM_WORKER_BASE_URL', '').rstrip('/')
    location = os.environ.get('CRM_PILOT_LOCATION_ID', '')
    key = os.environ.get('CRM_WORKER_SECRET', '')
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise SystemExit('Approved HTTPS staging CRM_WORKER_BASE_URL required')
    try:
        uuid.UUID(location)
    except ValueError:
        raise SystemExit('Approved CRM_PILOT_LOCATION_ID required')
    if not key or os.environ.get('CRM_PROVIDER_REHEARSAL_ENABLED') != 'staff-only':
        raise SystemExit('Protected worker authorization and explicit staff-only rehearsal enablement required')
    print('Staff-only staging worker started for one approved location', flush=True)
    while True:
        try:
            request = Request(base + '/api/crm/worker',
                data=json.dumps({'location_id': location}).encode(),
                headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
            with urlopen(request, timeout=25) as response:
                response.read()
        except Exception:
            print('Staging worker unavailable; durable attempts retained without automatic resend', flush=True)
        time.sleep(30)

if '--provider' in sys.argv:
    provider_worker()
    raise SystemExit(0)

preview = load_preview()
USER = '90000000-0000-0000-0000-000000000001'
LOCATION = '20000000-0000-0000-0000-000000000001'
CLAIMS = json.dumps({'sub':USER,'tenant_id':'10000000-0000-0000-0000-000000000001','app_role':'owner','role':'authenticated'})
def execute(command):
    encoded = json.dumps(command).replace("'", "''")
    return preview.sql(f"SET request.jwt.claims='{CLAIMS}'; SET ROLE authenticated; SELECT crm_execute('{LOCATION}','{encoded}'::jsonb);")
while True:
    try:
        enabled = preview.sql(f"SELECT connection='simulated' FROM crm_locations WHERE location_id='{LOCATION}';").strip()
        if enabled != 't' and not preview.sql(f"SELECT account_sid LIKE 'AC_SYNTH_%' FROM crm_locations WHERE location_id='{LOCATION}';").strip() == 't':
            raise RuntimeError('Worker requires isolated simulated binding')
        # One action identity per minute; a process restart reuses it.
        execute({'kind':'tick','key':f'worker:tick:{int(time.time()//60)}'})
        preview.sql(f"SET request.jwt.claims='{CLAIMS}'; SET ROLE authenticated; SELECT crm_reevaluate('{LOCATION}',NULL);")
        pending = json.loads(preview.sql(f"SELECT COALESCE(jsonb_agg(DISTINCT thread_id),'[]') FROM crm_outbox WHERE location_id='{LOCATION}' AND status='queued';"))
        configured = preview.sql(f"SELECT EXISTS(SELECT 1 FROM crm_pilot_config WHERE location_id='{LOCATION}');").strip() == 't'
        if not configured:
            for thread in pending:
                execute({'kind':'dispatch','thread_id':thread,'key':f'worker:dispatch:{thread}:{int(time.time()//60)}'})
        # The same staged transport consumer used by the protected worker route.
        # Preview mode can only use its non-delivering double. The local signer
        # never appears in a command, log or browser response.
        key_path = preview.ROOT / 'generated-artifacts/crm-preview/signing-key'
        if not key_path.exists():
            try:
                with os.fdopen(os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as key:
                    key.write(secrets.token_hex(32))
            except FileExistsError:
                pass
        if key_path.exists():
            request = Request('http://127.0.0.1:5000/api/crm/worker?preview=1',
                data=json.dumps({'location_id': LOCATION}).encode(),
                headers={'Content-Type': 'application/json',
                         'Authorization': 'Bearer ' + key_path.read_text()})
            with urlopen(request, timeout=20) as response:
                response.read()
    except Exception:
        print('CRM worker: dispatch unavailable; retained durable state for next check',flush=True)
    time.sleep(30)
