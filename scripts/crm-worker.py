#!/usr/bin/env python3
"""Preview-only persistent outbox recovery; never opens a network provider.
Run after crm-preview.py. Re-running/restarting does not replay accepted actions.
"""
import json
import time
from crm_preview_import import load_preview

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
        if enabled != 't':
            raise RuntimeError('Worker requires isolated simulated binding')
        # One action identity per minute; a process restart reuses it.
        execute({'kind':'tick','key':f'worker:tick:{int(time.time()//60)}'})
        preview.sql(f"SET request.jwt.claims='{CLAIMS}'; SET ROLE authenticated; SELECT crm_reevaluate('{LOCATION}',NULL);")
        pending = json.loads(preview.sql(f"SELECT COALESCE(jsonb_agg(DISTINCT thread_id),'[]') FROM crm_outbox WHERE location_id='{LOCATION}' AND status='queued';"))
        for thread in pending:
            execute({'kind':'dispatch','thread_id':thread,'key':f'worker:dispatch:{thread}:{int(time.time()//60)}'})
    except Exception:
        print('CRM worker: dispatch unavailable; retained durable state for next check',flush=True)
    time.sleep(30)
