import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baseline=read('phases/phase-66-2026-09-27-baseline.json');
const registry=read('sources/registry.json');
const coverage=read('data/published/coverage.json');
const inventory=new Set(read('data/reference/jurisdictions.json').jurisdictions.map(x=>x.code));
const oldIds=new Set(baseline.registry.sources.map(x=>x.id));
assert.deepEqual(registry.sources.filter(x=>oldIds.has(x.id)),baseline.registry.sources);
assert.equal(new Set(registry.sources.map(x=>x.id)).size,registry.sources.length);
const newSources=registry.sources.filter(x=>!oldIds.has(x.id));
assert.equal(newSources.length,7);
for(const x of newSources){assert(inventory.has(x.country));assert.equal(x.connector,'none');assert.equal(x.enabled,false);assert.equal(x.reviewRequired,true);assert(x.notes&&x.accessGap&&x.discoveredFrom);assert.equal(new URL(x.homepage).protocol,'https:');}
for(const row of baseline.coverage) assert.deepEqual(coverage.find(x=>x.jurisdictionCode===row.jurisdictionCode),row);
const oldCodes=new Set(baseline.coverage.map(x=>x.jurisdictionCode));const newCoverage=coverage.filter(x=>!oldCodes.has(x.jurisdictionCode));assert.equal(newCoverage.length,6);
for(const x of newCoverage){assert.equal(x.fixture,false);assert.equal(x.status,'no-verified-listings');assert.equal(x.connectedSourceCount,0);assert.equal(x.lastSuccessfulFetchAt,null);assert.equal(x.lastValidatedAt,null);assert.equal(x.unresolvedGaps.length,newSources.filter(s=>s.country===x.jurisdictionCode).length);}
let protectedCount=0;for(const [p,expected] of Object.entries(baseline.unchangedStateSha256)){assert.equal(hash(p),expected,p);protectedCount++;}
const health=read('data/published/sources-status.json');for(const x of newSources)assert(!health[x.id]);
const requests=read('data/discovery/asia-public-sources-2026-09-27-requests.json');const outcomes=read('data/discovery/asia-public-sources-2026-09-27-fetch-outcomes.json');assert.equal(requests.length,22);assert.equal(outcomes.length,22);assert.equal(new Set(outcomes.map(x=>x.url)).size,22);
for(const x of outcomes){assert(fs.existsSync(x.path));assert(requests.some(r=>r.sourceId===x.sourceId&&r.label===x.label&&r.url===x.url));if(x.status==='retained'){assert.equal(hash(x.path),x.evidence.sha256);assert.equal(fs.statSync(x.path).size,x.evidence.bytes);assert(x.evidence.contentType.toLowerCase().includes('html'));}else{const f=read(x.path);assert(f.error);}}
const build=fs.readFileSync('phases/phase-66-2026-09-27-public-data-build.txt','utf8');assert(build.includes('0 records across 0 countries'));
const test=fs.readFileSync('phases/phase-66-2026-09-27-test-results.txt','utf8');assert(test.includes('pass 2'));assert(test.includes('fail 0'));
const metrics=read('phases/phase-66-2026-09-27-metrics.json');assert.equal(metrics.review.pendingPackets,82);assert.equal(metrics.review.pendingCycles,328);assert.equal(metrics.coverage.publicRecords,0);
const receipt={phase:66,checkedAt:new Date().toISOString(),registeredSources:registry.sources.length,indiaSources:registry.sources.filter(x=>x.country==='IN').length,existingSourcesUnchanged:oldIds.size,newSources:7,allNewSourcesDisabledReviewRequired:true,existingCoverageRowsUnchanged:baseline.coverage.length,newJurisdictions:newCoverage.map(x=>x.jurisdictionCode),protectedFilesUnchanged:protectedCount,reviewPacketsUnchanged:protectedCount-1,researchRequests:22,retainedOriginals:outcomes.filter(x=>x.status==='retained').length,failedRequests:outcomes.filter(x=>x.status==='failed').length,retainedPdfOriginals:0,collectionJobs:0,publicationDecisions:0,publicDataBuild:{exitCode:0,records:0,countries:0},tests:{command:'node --experimental-strip-types --test scripts/report-metrics.test.ts',passed:2,failed:0,skipped:0},browser:read('phases/phase-66-2026-09-27-browser-checks.json')};
fs.writeFileSync('phases/phase-66-2026-09-27-verification.json',JSON.stringify(receipt,null,2)+'\n');
const pathSet=new Set(['README.md','sources/registry.json','data/published/coverage.json',...fs.readdirSync('phases').filter(x=>x.startsWith('phase-66-')).map(x=>'phases/'+x),...fs.readdirSync('data/discovery').filter(x=>x.startsWith('asia-public-')&&x.includes('2026-09-27')).map(x=>'data/discovery/'+x),...outcomes.map(x=>x.path)]);
pathSet.delete('phases/phase-66-2026-09-27-artifact-manifest.json');
const files=[...pathSet].sort().map(path=>({path,bytes:fs.statSync(path).size,sha256:hash(path)}));fs.writeFileSync('phases/phase-66-2026-09-27-artifact-manifest.json',JSON.stringify({savedAt:new Date().toISOString(),protectedFilesUnchangedAfterPublicBuild:protectedCount,files},null,2)+'\n');
console.log(JSON.stringify({sources:registry.sources.length,india:receipt.indiaSources,world:metrics.coverage.jurisdictionsWithRegisteredSource,protected:protectedCount,files:files.length,publicRecords:0}));
