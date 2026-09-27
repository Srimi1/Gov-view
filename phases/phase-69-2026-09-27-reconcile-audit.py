"""Reconcile two successful supplemental reads against the unchanged audited tree."""
from collections import defaultdict
from pathlib import Path
import datetime
import json

ROOT = Path(__file__).resolve().parent.parent
PREFIX = ROOT / 'phases/phase-69-2026-09-27-'
audit = json.loads(Path(str(PREFIX) + 'evidence-storage-audit.json').read_text())
retry = json.loads(Path(str(PREFIX) + 'audit-retry.json').read_text())
rows = {r['path']: r for r in audit['entries'] if 'error' not in r}
for read in retry['files']:
    if read.get('exitCode') == 0:
        row = dict(read['result'])
        row['path'] = read['path']
        rows[row['path']] = row
current = {str(p.relative_to(ROOT)): [p.stat().st_size, p.stat().st_mtime_ns]
           for p in (ROOT / 'data/evidence').rglob('*') if p.is_file()}
changes = [p for p in sorted(set(current) | set(rows))
           if p not in rows or current.get(p) != [rows[p]['bytes'], rows[p]['mtimeNs']]]
groups = defaultdict(list)
for row in rows.values():
    groups[(row['sha256'], row['bytes'])].append(row['path'])
duplicates = [{'sha256': k[0], 'bytesPerCopy': k[1], 'paths': sorted(v),
               'redundantBytes': k[1] * (len(v) - 1)}
              for k, v in groups.items() if len(v) > 1]
complete = (not changes and len(current) == audit['files']
            and sum(r[0] for r in current.values()) == audit['logicalBytes']
            and audit['treeSizesAndModificationTimesUnchanged'])
receipt = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'readOnly': True, 'completeReconciledInventory': complete,
    'originalAuditComplete': audit['complete'],
    'method': 'Original streaming hashes plus two supplemental successful reads; every current path, size and mtime checked against its successful read. Original audit remains unchanged.',
    'auditedFiles': len(rows), 'currentFiles': len(current), 'metadataMismatches': changes,
    'logicalBytes': sum(r[0] for r in current.values()),
    'collectorLimitBytes': audit['collectorLimitBytes'],
    'exactDuplicateRedundantBytes': sum(r['redundantBytes'] for r in duplicates),
    'exactDuplicateGroups': sorted(duplicates, key=lambda r: -r['redundantBytes']),
    'compressibleTextBytes': sum(r['bytes'] for r in rows.values() if 'gzipBytes' in r),
    'textGzipBytes': sum(r['gzipBytes'] for r in rows.values() if 'gzipBytes' in r),
    'collectorBodiesChecked': sum('bodyHashMatchesName' in r for r in rows.values()),
    'collectorBodyHashMismatches': [r for r in rows.values() if r.get('bodyHashMatchesName') is False],
    'limitations': audit['limitations'] + ['Size/mtime comparison detects ordinary changes; this is not a filesystem transaction or independent forensic integrity audit. No physical disk savings are claimed.'],
}
Path(str(PREFIX) + 'audit-reconciliation.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: receipt[k] for k in ['completeReconciledInventory', 'auditedFiles', 'logicalBytes', 'exactDuplicateRedundantBytes', 'compressibleTextBytes', 'textGzipBytes', 'metadataMismatches']}))
