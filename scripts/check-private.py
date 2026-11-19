#!/usr/bin/env python3
"""Karin OS privacy check — this repo is PUBLIC and served as a public website (GitHub Pages).

Fails (exit 1) if tracked files contain personal or financial data:
  • email addresses (except no-reply / example / allow-listed ones)
  • Israeli mobile numbers (except obvious placeholders / allow-listed ones)
  • money amounts of 1,000 ₪ and up in the app's own code (fictional demos under os/render/ are exempt)
  • masked account numbers (bullets + last four digits), IBAN-like IL numbers, 16-digit card numbers
  • secret keys (Anthropic, OpenAI, Supabase secret / service role, Google, GitHub, Meta, Resend, private keys)
  • any word from the PRIVATE denylist: env PRIVATE_DENYLIST (one entry per line; a GitHub Actions secret)
    and/or ~/.config/karin-os/denylist.txt — names, deals, real amounts. The denylist is never committed.

Personal data belongs in Supabase (table os_private, Karin-only), never in this repo. See CLAUDE.md.

Usage:  python3 scripts/check-private.py            # all tracked files (what the site would publish)
        python3 scripts/check-private.py --staged   # what is about to be committed
"""
import os, re, subprocess, sys

ALLOW_EMAIL = re.compile(r'(noreply@anthropic\.com|@users\.noreply\.github\.com|@example\.(com|org)|^name@|^you@|^user@)', re.I)
ALLOW_PHONE = {
    '0500000000', '0501234567', '0521234567', '0541234567',  # placeholders
}
ALLOW_FILE_EXACT = set()   # paths that may contain otherwise-blocked text (keep empty unless Karin approves)

def allowed_values():
    """Exact (path, value) pairs Karin approved, from .privacy-allow: '<path> <TAB> <value>  # reason'."""
    out = set()
    try:
        for line in open('.privacy-allow', encoding='utf-8'):
            line = line.split('  #', 1)[0].rstrip('\n').rstrip()
            if not line or line.startswith('#') or '\t' not in line:
                continue
            path, value = line.split('\t', 1)
            out.add((path.strip(), value.strip()))
    except FileNotFoundError:
        pass
    return out
SKIP = re.compile(r'^\.privacy-allow$|(^|/)(node_modules|vendor)/|\.min\.js$|^os/render/media/|\.(png|jpe?g|webp|gif|ico|mp4|mov|mp3|wav|m4a|woff2?|ttf|pdf|task|zip)$', re.I)
APP_CODE = re.compile(r'^(app(\[1\])?\.js|index(\[1\])?\.html|os/[^/]+\.(js|html)|os/fn/.+\.ts|studio/.+\.(js|html)|g/.+\.html|guide/.+\.html)$')

RULES = [
    ('email', re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'), None),
    ('phone', re.compile(r'(?<![\d.])(?:\+?972[- ]?|0)5\d[- ]?\d{3}[- ]?\d{4}(?!\d)'), None),
    ('masked account', re.compile(r'(?:••|\*\*\*\*)\s?\d{4}\b'), None),
    ('IBAN', re.compile(r'\bIL\d{2}\s?\d{4}\s?\d{4}'), None),
    ('card number', re.compile(r'(?<!\d)(?:\d{4}[ -]){3}\d{4}(?!\d)'), None),
    ('money ≥1,000 ₪', re.compile(r'(?:\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\s?(?:₪|ש"ח|ש״ח)|₪\s?(?:\d{1,3}(?:,\d{3})+|\d{4,})|\d+(?:\.\d+)?\s?[KM]\s?₪'), APP_CODE),
    ('secret key', re.compile(r'sk-ant-[A-Za-z0-9_-]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}|sb_secret_[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{35}|(?:ghp_|github_pat_|gho_)[A-Za-z0-9_]{30,}|\bEAA[A-Za-z0-9]{40,}|\bre_[A-Za-z0-9]{20,}_[A-Za-z0-9]+|GOCSPX-[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"role"\s*:\s*"service_role"'), None),
]

def denylist():
    words = []
    words += (os.environ.get('PRIVATE_DENYLIST') or '').splitlines()
    p = os.path.expanduser('~/.config/karin-os/denylist.txt')
    if os.path.exists(p):
        words += open(p, encoding='utf-8').read().splitlines()
    return sorted({w.strip() for w in words if w.strip() and not w.startswith('#')}, key=len, reverse=True)

def files(staged):
    if staged:
        out = subprocess.run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], capture_output=True).stdout
    else:
        out = subprocess.run(['git', 'ls-files', '-z'], capture_output=True).stdout
    return [f for f in out.decode().split('\0') if f and not SKIP.search(f)]

def read(path, staged):
    if staged:
        r = subprocess.run(['git', 'show', ':' + path], capture_output=True)
        data = r.stdout if r.returncode == 0 else b''
    else:
        try:
            data = open(path, 'rb').read()
        except OSError:
            return None
    if b'\0' in data[:8000]:
        return None
    return data.decode('utf-8', 'ignore')

def main():
    staged = '--staged' in sys.argv
    deny = denylist()
    allow = allowed_values()
    problems = []
    for f in files(staged):
        if f in ALLOW_FILE_EXACT:
            continue
        t = read(f, staged)
        if t is None:
            continue
        for name, rx, scope in RULES:
            if scope is not None and not scope.search(f):
                continue
            for m in rx.finditer(t):
                v = m.group(0)
                if name == 'email' and ALLOW_EMAIL.search(v):
                    continue
                if name == 'phone' and re.sub(r'\D', '', v).replace('972', '0', 1) in ALLOW_PHONE:
                    continue
                if (f, v) in allow:
                    continue
                line = t.count('\n', 0, m.start()) + 1
                problems.append((f, line, name, v))
        low = t.lower()
        for w in deny:
            i = low.find(w.lower())
            if i >= 0:
                problems.append((f, t.count('\n', 0, i) + 1, 'private word', '(denylist entry)'))
    if problems:
        print('✗ Personal or financial data found — this repo and its website are PUBLIC. Move it to Supabase (os_private).')
        for f, line, name, v in problems[:200]:
            shown = '' if name == 'private word' else (v[:6] + '…' if name == 'secret key' else v)
            print(f'  {f}:{line}  [{name}]  {shown}')
        print(f'  {len(problems)} finding(s). See CLAUDE.md.')
        return 1
    print(f'✓ privacy check passed ({"staged" if staged else "all tracked"} files, denylist entries: {len(deny)})')
    return 0

if __name__ == '__main__':
    sys.exit(main())
