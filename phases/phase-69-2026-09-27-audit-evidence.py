"""Read-only storage audit. Never removes, rewrites, or relocates evidence."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import datetime
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'phases/phase-69-2026-09-27-evidence-storage-audit.json'
WORKER = r'''
import gzip,hashlib,json,os,sys,zlib
p=sys.argv[1]
before=os.stat(p)
sha=hashlib.sha256()
size=0
compressor=zlib.compressobj(level=9,wbits=31) if p.endswith(('.html','.htm','.txt','.js','.xml')) else None
compressed_size=0
with open(p,'rb') as f:
 while True:
  chunk=f.read(1024*1024)
  if not chunk: break
  size+=len(chunk)
  sha.update(chunk)
  if compressor: compressed_size+=len(compressor.compress(chunk))
if compressor: compressed_size+=len(compressor.flush())
row={'path':p,'bytes':size,'sha256':sha.hexdigest(),'mtimeNs':before.st_mtime_ns}
if compressor: row['gzipBytes']=compressed_size
if '/bodies/' in p:
 name=os.path.basename(p).split('.')[0]
 if len(name)==64:
  original_sha=sha.hexdigest()
  original_size=size
  if p.endswith('.txt.gz'):
   decoded_sha=hashlib.sha256()
   original_size=0
   with gzip.open(p,'rb') as f:
    while True:
     chunk=f.read(1024*1024)
     if not chunk: break
     original_size+=len(chunk)
     if original_size>128*1024*1024: raise RuntimeError('Decoded body exceeds 128 MiB audit bound')
     decoded_sha.update(chunk)
   original_sha=decoded_sha.hexdigest()
  row['originalBytes']=original_size
  row['originalSha256']=original_sha
  row['bodyHashMatchesName']=original_sha==name
after=os.stat(p)
if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
 raise RuntimeError('File changed while being audited')
print(json.dumps(row))
'''


def inspect(path):
    failures = []
    for attempt in range(3):
        try:
            result = subprocess.run([sys.executable, '-c', WORKER, str(path)], capture_output=True, text=True, timeout=10, check=True)
            row = json.loads(result.stdout)
            row['path'] = str(path.relative_to(ROOT))
            if failures:
                row['readRetries'] = failures
            return row
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as error:
            failures.append({'attempt': attempt + 1, 'error': type(error).__name__})
    return {'path': str(path.relative_to(ROOT)), 'error': 'File could not be audited with bounded reads', 'readRetries': failures}


evidence = ROOT / 'data/evidence'
paths = sorted(p for p in evidence.rglob('*') if p.is_file())
before = {str(p.relative_to(ROOT)): [p.stat().st_size, p.stat().st_mtime_ns] for p in paths}
rows = []
with ThreadPoolExecutor(max_workers=4) as pool:
    pending = [pool.submit(inspect, p) for p in paths]
    for future in as_completed(pending):
        rows.append(future.result())
        if len(rows) % 200 == 0:
            print(f'Audited {len(rows)}/{len(paths)} evidence files', flush=True)
after = {str(p.relative_to(ROOT)): [p.stat().st_size, p.stat().st_mtime_ns] for p in sorted(p for p in evidence.rglob('*') if p.is_file())}
changed = [{'path': path, 'before': before.get(path), 'after': after.get(path)}
           for path in sorted(set(before) | set(after)) if before.get(path) != after.get(path)]
good = [r for r in rows if 'error' not in r]
groups = defaultdict(list)
suffixes = defaultdict(lambda: {'files': 0, 'bytes': 0})
for row in good:
    groups[(row['sha256'], row['bytes'])].append(row['path'])
    suffixes[Path(row['path']).suffix]['files'] += 1
    suffixes[Path(row['path']).suffix]['bytes'] += row['bytes']
duplicates = sorted([
    {'sha256': key[0], 'bytesPerCopy': key[1], 'paths': sorted(value), 'redundantBytes': key[1] * (len(value) - 1)}
    for key, value in groups.items() if len(value) > 1
], key=lambda x: -x['redundantBytes'])
disk = subprocess.run(['df', '-k', str(ROOT)], capture_output=True, text=True, check=True).stdout
total = sum(v[0] for v in before.values())
receipt = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'readOnly': True, 'files': len(paths), 'auditedFiles': len(good),
    'unreadFiles': [r for r in rows if 'error' in r], 'complete': len(good) == len(paths) and not changed,
    'metadataChangesDuringAudit': changed,
    'runtime': 'Streaming 1 MiB chunks; 128 MiB decoded body bound; four workers; up to three 10-second child read attempts.',
    'logicalBytes': total, 'collectorLimitBytes': 800 * 1024 * 1024,
    'overLimitBytes': max(0, total - 800 * 1024 * 1024),
    'treeSizesAndModificationTimesUnchanged': not changed,
    'bySuffix': dict(sorted(suffixes.items())),
    'exactDuplicateGroups': duplicates,
    'exactDuplicateRedundantBytes': sum(r['redundantBytes'] for r in duplicates),
    'compressibleTextBytes': sum(r['bytes'] for r in good if 'gzipBytes' in r),
    'textGzipBytes': sum(r['gzipBytes'] for r in good if 'gzipBytes' in r),
    'collectorBodiesChecked': sum('bodyHashMatchesName' in r for r in good),
    'collectorBodyHashMismatches': [r for r in good if r.get('bodyHashMatchesName') is False],
    'diskSnapshot': disk,
    'limitations': [
        'Logical file sizes match the collector quota. They are not APFS physical allocated space or iCloud remote capacity.',
        'Duplicate contents do not make their URL receipts, source identity, review links or historical manifests interchangeable.',
        'Compression sizes are estimates from exact text bytes; no evidence was compressed in place.',
        'No evidence path was deleted, relocated, replaced with a link or excluded from quota.',
        'Objects stored outside this directory need an explicit storage contract and quota; directory relocation alone is not a remedy.',
        'If file metadata changed or any file was unread, this is an incomplete snapshot and duplicate/compression totals are not a complete stable-store measurement.',
    ],
    'entries': sorted(rows, key=lambda r: r['path']),
}
OUTPUT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: receipt[k] for k in ['files', 'auditedFiles', 'complete', 'logicalBytes', 'overLimitBytes', 'exactDuplicateRedundantBytes', 'collectorBodiesChecked', 'collectorBodyHashMismatches']}), flush=True)
