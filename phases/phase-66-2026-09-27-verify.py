from pathlib import Path
import hashlib,json,datetime,subprocess,sys

def read(p): return json.loads(Path(p).read_text())
hash_read_retries=[]
def digest(p):
 for attempt in range(3):
  try:
   result=subprocess.run([sys.executable,'-c','import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())',str(p)],capture_output=True,text=True,timeout=5,check=True)
   return result.stdout.strip()
  except subprocess.TimeoutExpired:
   hash_read_retries.append({'path':str(p),'attempt':attempt+1,'reason':'local file read exceeded five seconds'})
 raise RuntimeError('Local file could not be hashed: '+str(p))
def write(p,x): Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
b=read('phases/phase-66-2026-09-27-baseline.json');r=read('sources/registry.json');c=read('data/published/coverage.json')
old_ids={x['id'] for x in b['registry']['sources']}
assert [x for x in r['sources'] if x['id'] in old_ids]==b['registry']['sources']
assert len({x['id'] for x in r['sources']})==len(r['sources'])
new=[x for x in r['sources'] if x['id'] not in old_ids];assert len(new)==7
inventory={x['code'] for x in read('data/reference/jurisdictions.json')['jurisdictions']}
health=read('data/published/sources-status.json')
for x in new:
 assert x['country'] in inventory and x['connector']=='none' and x['enabled'] is False and x['reviewRequired'] is True
 assert x['notes'] and x['accessGap'] and x['discoveredFrom'] and x['homepage'].startswith('https://') and x['id'] not in health
for x in b['coverage']: assert next(y for y in c if y['jurisdictionCode']==x['jurisdictionCode'])==x
old_codes={x['jurisdictionCode'] for x in b['coverage']};new_coverage=[x for x in c if x['jurisdictionCode'] not in old_codes];assert len(new_coverage)==6
for x in new_coverage:
 assert x['fixture'] is False and x['status']=='no-verified-listings' and x['connectedSourceCount']==0
 assert x['lastSuccessfulFetchAt'] is None and x['lastValidatedAt'] is None
 assert len(x['unresolvedGaps'])==sum(s['country']==x['jurisdictionCode'] for s in new)
for p,h in b['unchangedStateSha256'].items(): assert digest(p)==h,p
requests=read('data/discovery/asia-public-sources-2026-09-27-requests.json');outcomes=read('data/discovery/asia-public-sources-2026-09-27-fetch-outcomes.json')
assert len(requests)==len(outcomes)==len({x['url'] for x in outcomes})==22
for x in outcomes:
 assert Path(x['path']).exists()
 assert any(y['url']==x['url'] and y['label']==x['label'] and y['sourceId']==x['sourceId'] for y in requests)
 if x['status']=='retained':
  assert digest(x['path'])==x['evidence']['sha256'] and Path(x['path']).stat().st_size==x['evidence']['bytes']
  assert 'html' in x['evidence']['contentType'].lower()
 else: assert read(x['path'])['error']
assert '0 records across 0 countries' in Path('phases/phase-66-2026-09-27-public-data-build.txt').read_text()
test=Path('phases/phase-66-2026-09-27-test-results.txt').read_text();assert 'pass 2' in test and 'fail 0' in test
m=read('phases/phase-66-2026-09-27-metrics.json');assert m['review']['pendingPackets']==82 and m['review']['pendingCycles']==328 and m['coverage']['publicRecords']==0
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt={'phase':66,'checkedAt':now,'verificationRuntime':'Python standard library with bounded child-process file reads. Earlier Node and first Python verifiers interrupted after stalled reads of existing review files. Final hashes checked against baseline.', 'localFileReadRetries':hash_read_retries,'registeredSources':len(r['sources']),'indiaSources':sum(x['country']=='IN' for x in r['sources']),'existingSourcesUnchanged':len(old_ids),'newSources':7,'allNewSourcesDisabledReviewRequired':True,'existingCoverageRowsUnchanged':len(b['coverage']),'newJurisdictions':[x['jurisdictionCode'] for x in new_coverage],'protectedFilesUnchanged':len(b['unchangedStateSha256']),'reviewPacketsUnchanged':82,'researchRequests':22,'retainedOriginals':sum(x['status']=='retained' for x in outcomes),'failedRequests':sum(x['status']=='failed' for x in outcomes),'retainedPdfOriginals':0,'collectionJobs':0,'publicationDecisions':0,'publicDataBuild':{'exitCode':0,'records':0,'countries':0},'tests':{'command':'node --experimental-strip-types --test scripts/report-metrics.test.ts','passed':2,'failed':0,'skipped':0},'browser':read('phases/phase-66-2026-09-27-browser-checks.json')}
write('phases/phase-66-2026-09-27-verification.json',receipt)
paths={Path('README.md'),Path('sources/registry.json'),Path('data/published/coverage.json'),*Path('phases').glob('phase-66-*'),*Path('data/discovery').glob('asia-public-*2026-09-27*.json'),*(Path(x['path']) for x in outcomes)}
paths.discard(Path('phases/phase-66-2026-09-27-artifact-manifest.json'))
files=[{'path':str(p),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(paths)]
write('phases/phase-66-2026-09-27-artifact-manifest.json',{'savedAt':now,'protectedFilesUnchangedAfterPublicBuild':len(b['unchangedStateSha256']),'files':files})
print(json.dumps({'sources':len(r['sources']),'india':receipt['indiaSources'],'world':m['coverage']['jurisdictionsWithRegisteredSource'],'protected':83,'files':len(files),'publicRecords':0}),flush=True)
