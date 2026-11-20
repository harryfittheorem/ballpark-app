#!/usr/bin/env python3
"""Isolated, persistent PostgreSQL rehearsal. No shared DB or provider access.

Uses the scheduler's actual migrations and guards, NOT another capacity engine.
Run: python scripts/crm-preview.py [start|stop]
Data lives under ignored generated-artifacts/crm-preview; start is repeatable.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'generated-artifacts/crm-preview'
DATA = BASE / 'data'
SOCKET = '/tmp/clubhouse-crm-pg'
PORT = '15439'

def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs).stdout

def sql(text):
    return run('psql', '-XqAt', '-h', SOCKET, '-p', PORT, '-U', 'postgres',
               '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', input=text)

def start():
    BASE.mkdir(parents=True, exist_ok=True)
    Path(SOCKET).mkdir(mode=0o700, exist_ok=True)
    fresh = not DATA.exists()
    if fresh:
        run('initdb', '-D', str(DATA), '-U', 'postgres', '-A', 'trust', '--no-locale')
    if subprocess.run(['pg_ctl', '-D', str(DATA), 'status'], capture_output=True).returncode:
        run('pg_ctl', '-D', str(DATA), '-l', str(BASE/'postgres.log'), '-o',
            f"-k {SOCKET} -p {PORT} -c listen_addresses=''", '-w', 'start')
    if not (BASE/'ready').exists():
        sql((ROOT/'scripts/fixtures/scheduling.sql').read_text())
        # Exact existing credit function, not a replacement.
        credit=(ROOT/'supabase/migrations/20260616000004_eft_weekly_credits.sql').read_text()
        sql(re.search(r'CREATE OR REPLACE FUNCTION public.deduct_session_credit\(.*?\$\$;', credit, re.S).group())
        for name in ['20261120000010_scheduling_integrity.sql','20261120000015_manual_location_capacity.sql',
                     '20261120000019_dated_capacity_guards.sql','20261120000020_dated_capacity_actions.sql',
                     '20261120000021_location_resources.sql','20261121000000_crm_inquiry_journey.sql',
                     '20261121000001_crm_provider_events.sql']:
            sql((ROOT/'supabase/migrations'/name).read_text())
        sql((ROOT/'scripts/fixtures/crm.sql').read_text())
        (BASE/'ready').write_text('isolated-synthetic-only\n')
    print('CRM rehearsal PostgreSQL ready; no live connections. Portal: /owner/crm?preview=1')

if __name__ == '__main__':
    try:
        if len(sys.argv)>1 and sys.argv[1]=='stop':
            run('pg_ctl','-D',str(DATA),'-m','fast','-w','stop')
        else:
            if len(sys.argv)>1 and sys.argv[1]=='reset' and BASE.exists():
                subprocess.run(['pg_ctl','-D',str(DATA),'-m','fast','-w','stop'],capture_output=True)
                BASE.rename(BASE.with_name('crm-preview-archive-'+datetime.now().strftime('%Y%m%d%H%M%S')))
            start()
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        sys.exit(1)
