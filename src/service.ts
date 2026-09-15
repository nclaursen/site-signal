import fs from 'node:fs';
import path from 'node:path';
import {analyticsProvider} from './analytics.js';
import {candidates,comparisonReadiness,config,normalize,periods,queryChanges,reportReadiness,snapshotId,Store} from './core.js';
import {gsc,queryExamples} from './google.js';

function withReadiness(snapshot:any,c:any){
  const gscTruncated=Boolean(snapshot.coverage?.gscTruncated);
  const readiness=comparisonReadiness(c,gscTruncated,{current:snapshot.analytics?.current,previous:snapshot.analytics?.previous},snapshot.createdAt);
  return {...snapshot,coverage:{...snapshot.coverage,gscTruncated,readiness}};
}

export async function sync(refresh=false){
  const c=config(),store=new Store(c.dataDir),range=periods(c.lag),id=snapshotId(c,range.current),saved=store.get(id);
  if(saved&&!refresh){const snapshot=withReadiness(saved,c);if(!saved.coverage?.readiness)store.save(id,snapshot);return{id,cached:true,...snapshot}}
  const provider=analyticsProvider(c),[a,b,analyticsNow,analyticsBefore]=await Promise.all([gsc(c,range.current),gsc(c,range.previous),provider.landingEvidence(range.current),provider.landingEvidence(range.previous)]);
  const enrich=(rows:any[])=>rows.map(row=>({...row,key:normalize(row.url,c)}));
  const createdAt=new Date().toISOString();
  const snapshot=withReadiness({profile:c.profile,analyticsProvider:c.analyticsProvider,range,gsc:enrich(a.rows),previousGsc:enrich(b.rows),analytics:{current:{...analyticsNow,rows:enrich(analyticsNow.rows)},previous:{...analyticsBefore,rows:enrich(analyticsBefore.rows)}},coverage:{gscTruncated:a.truncated||b.truncated,notes:['GSC returns top rows; query evidence is not attributed to analytics visits, sessions, or conversions.'],gsc:{rowCap:c.cap,currentTruncated:a.truncated,previousTruncated:b.truncated},analytics:{provider:c.analyticsProvider,current:analyticsNow.coverage,previous:analyticsBefore.coverage}},createdAt},c);
  store.save(id,snapshot);return{id,cached:false,...snapshot};
}

export async function pageContext(url:string,snapshotIdValue?:string,limit=5){
  const c=config(),store=new Store(c.dataDir),raw=snapshotIdValue?store.get(snapshotIdValue):await sync();
  if(!raw)throw Error(`No local snapshot found for ${snapshotIdValue}.`);
  if(raw.profile&&raw.profile!==c.profile)throw Error(`Snapshot ${snapshotIdValue} belongs to profile ${raw.profile}, not ${c.profile}.`);
  const r=withReadiness(raw,c),key=normalize(url,c),page=r.gsc.find((row:any)=>row.key===key)||r.previousGsc.find((row:any)=>row.key===key);
  if(!page)throw Error(`No page-level GSC row found for ${url} in this snapshot.`);
  const [current,previous]=await Promise.all([queryExamples(c,r.range.current,page.url,limit),queryExamples(c,r.range.previous,page.url,limit)]);
  return{profile:c.profile,analyticsProvider:r.analyticsProvider||c.analyticsProvider,snapshotId:snapshotIdValue||r.id,url:page.url,periods:r.range,decisionReadiness:r.coverage.readiness,pagePerformance:{current:r.gsc.find((row:any)=>row.key===key)||null,previous:r.previousGsc.find((row:any)=>row.key===key)||null},analyticsEvidence:{metricLabels:r.analytics.current.metricLabels,current:r.analytics.current.rows.filter((row:any)=>row.key===key),previous:r.analytics.previous.rows.filter((row:any)=>row.key===key),sourceSummaries:{current:r.analytics.current.sourceSummaries,previous:r.analytics.previous.sourceSummaries},coverage:{current:r.analytics.current.coverage,previous:r.analytics.previous.coverage}},queryEvidence:{current,previous,changes:queryChanges(current,previous),limitation:'Examples are limited top GSC rows, not complete coverage, and are not attributed to analytics visits, sessions, or conversions.'}};
}

export async function report(refresh=false){
  const r=await sync(refresh),c=config(),list=candidates(r.gsc,r.previousGsc,r.coverage.readiness),readiness=reportReadiness(r.coverage.readiness,list.length);
  fs.mkdirSync(c.reportDir,{recursive:true,mode:0o700});
  const details=await Promise.all(list.slice(0,3).map(async candidate=>{try{return await pageContext(candidate.url,r.id,5)}catch(error){return{url:candidate.url,error:error instanceof Error?error.message:String(error)}}}));
  const lines=['# Site Signal report','',`Profile: \`${r.profile}\``, `Analytics provider: \`${r.analyticsProvider}\``, `Snapshot: \`${r.id}\` (${r.cached?'cached':'fresh'})`,'',`Periods: ${r.range.current.start}–${r.range.current.end} versus ${r.range.previous.start}–${r.range.previous.end}.`,'','## Evidence readiness','',`- State: ${readiness.state}`,`- Reporting lag: ${readiness.reportingLagDays} complete days`,...readiness.reasons.map((reason:string)=>`- Reason: ${reason}`),'','## Evidence-backed investigations',''];
  if(!list.length)lines.push('No candidate met the configured review gates. This is an insufficient-evidence result, not a recommendation to change content.');
  for(const [index,candidate]of list.slice(0,10).entries()){
    lines.push(`### ${candidate.url}`,'',`- Decision readiness: ${candidate.decisionReadiness?.state||'incomplete_coverage'}`,...(candidate.decisionReadiness?.reasons||['Snapshot readiness is unavailable; refresh the snapshot before acting.']).map((reason:string)=>`- Readiness reason: ${reason}`),`- Click change: ${candidate.clickChange}`,`- Impression change: ${candidate.impressionChange}`,`- Position change: ${candidate.positionChange.toFixed(1)}`);
    const detail=details[index] as any;
    if(detail?.queryEvidence?.changes?.length)lines.push('- Query examples with the largest observed movement:',...detail.queryEvidence.changes.slice(0,5).map((query:any)=>`  - ${query.query}: clicks ${query.previous.clicks} → ${query.current.clicks}; impressions ${query.previous.impressions} → ${query.current.impressions}; position ${query.baseline==='comparable'?`${query.previous.position.toFixed(1)} → ${query.current.position.toFixed(1)}`:'new/no baseline'}`));
    lines.push('- Limitation: query examples are top returned GSC rows, not complete coverage, and are not attributed to analytics visits, sessions, or conversions.','');
  }
  const out=path.join(c.reportDir,`report-${r.id}.md`),payload={profile:r.profile,analyticsProvider:r.analyticsProvider,snapshotId:r.id,decisionReadiness:readiness,coverage:r.coverage,candidates:list,details};
  fs.writeFileSync(out,lines.join('\n'));fs.writeFileSync(out.replace('.md','.json'),JSON.stringify(payload,null,2));
  return{profile:r.profile,analyticsProvider:r.analyticsProvider,path:out,snapshotId:r.id,decisionReadiness:readiness,candidates:list.length};
}

export async function status(){
  const c=config(),providerMissing=c.analyticsProvider==='ga4'?['ga4PropertyId']:c.analyticsProvider==='matomo'?['matomoUrl','matomoSiteId','matomoTokenAuth']:[],missing=['domain','gscProperty',...providerMissing].filter(key=>!c[key as keyof typeof c]),capabilities=missing.length?[]:analyticsProvider(c).capabilities();
  return{profile:c.profile,analyticsProvider:c.analyticsProvider,configured:!missing.length,missingSetup:missing,dataDir:c.dataDir,reportingLagDays:c.lag,capabilities:['read-only GSC page data',...capabilities,'local reports and snapshots','stdio MCP']};
}
