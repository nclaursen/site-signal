import fs from 'node:fs';
import path from 'node:path';
import {analyticsProvider,configuredOutcomeEvents} from './analytics.js';
import {candidates,comparisonReadiness,config,normalize,periods,queryChanges,reportReadiness,snapshotId,Store} from './core.js';
import {gsc,pageSegments,queryExamples} from './google.js';
import {internalLinkContext,repositoryContext} from './context.js';

function withReadiness(snapshot:any,c:any){
  const gscTruncated=Boolean(snapshot.coverage?.gscTruncated);
  const readiness=comparisonReadiness(c,gscTruncated,{current:snapshot.analytics?.current,previous:snapshot.analytics?.previous},snapshot.createdAt);
  return {...snapshot,coverage:{...snapshot.coverage,gscTruncated,readiness}};
}

export async function sync(refresh=false,windowDays=28){
  if(!Number.isInteger(windowDays)||windowDays<28||windowDays>84)throw Error('windowDays must be a whole number from 28 to 84.');const c=config(),store=new Store(c.dataDir),range=periods(c.lag,windowDays),id=snapshotId(c,range.current),saved=store.get(id);
  if(saved&&!refresh){const snapshot=withReadiness(saved,c);if(!saved.coverage?.readiness)store.save(id,snapshot);return{id,cached:true,...snapshot}}
  const provider=analyticsProvider(c),[a,b,analyticsNow,analyticsBefore]=await Promise.all([gsc(c,range.current),gsc(c,range.previous),provider.landingEvidence(range.current),provider.landingEvidence(range.previous)]);
  const enrich=(rows:any[])=>rows.map(row=>({...row,key:normalize(row.url,c)}));
  const createdAt=new Date().toISOString();
  const snapshot=withReadiness({profile:c.profile,analyticsProvider:c.analyticsProvider,range,gsc:enrich(a.rows),previousGsc:enrich(b.rows),analytics:{current:{...analyticsNow,rows:enrich(analyticsNow.rows)},previous:{...analyticsBefore,rows:enrich(analyticsBefore.rows)}},coverage:{gscTruncated:a.truncated||b.truncated,notes:['GSC returns top rows; query evidence is not attributed to analytics visits, sessions, or conversions.'],gsc:{rowCap:c.cap,currentTruncated:a.truncated,previousTruncated:b.truncated},analytics:{provider:c.analyticsProvider,current:analyticsNow.coverage,previous:analyticsBefore.coverage}},createdAt},c);
  store.save(id,snapshot);return{id,cached:false,...snapshot};
}

export async function pageContext(url:string,snapshotIdValue?:string,limit=5,windowDays=28){
  const c=config(),store=new Store(c.dataDir),raw=snapshotIdValue?store.get(snapshotIdValue):await sync(false,windowDays);
  if(!raw)throw Error(`No local snapshot found for ${snapshotIdValue}.`);
  if(raw.profile&&raw.profile!==c.profile)throw Error(`Snapshot ${snapshotIdValue} belongs to profile ${raw.profile}, not ${c.profile}.`);
  const r=withReadiness(raw,c),key=normalize(url,c),page=r.gsc.find((row:any)=>row.key===key)||r.previousGsc.find((row:any)=>row.key===key);
  if(!page)throw Error(`No page-level GSC row found for ${url} in this snapshot.`);
  const [current,previous]=await Promise.all([queryExamples(c,r.range.current,page.url,limit),queryExamples(c,r.range.previous,page.url,limit)]);
  const prior=r.previousGsc.find((row:any)=>row.key===key);return{profile:c.profile,analyticsProvider:r.analyticsProvider||c.analyticsProvider,snapshotId:snapshotIdValue||r.id,url:page.url,periods:r.range,windowDays,decisionReadiness:prior&&prior.impressions>=c.minimumBaselineImpressions?r.coverage.readiness:{state:'maturing',reasons:[`Prior period has fewer than ${c.minimumBaselineImpressions} impressions.`],reportingLagDays:c.lag},pagePerformance:{current:r.gsc.find((row:any)=>row.key===key)||null,previous:prior||null},analyticsEvidence:{metricLabels:r.analytics.current.metricLabels,current:r.analytics.current.rows.filter((row:any)=>row.key===key),previous:r.analytics.previous.rows.filter((row:any)=>row.key===key),sourceSummaries:{current:r.analytics.current.sourceSummaries,previous:r.analytics.previous.sourceSummaries},coverage:{current:r.analytics.current.coverage,previous:r.analytics.previous.coverage}},queryEvidence:{current,previous,changes:queryChanges(current,previous),limitation:'Examples are limited top GSC rows, not complete coverage, and are not attributed to analytics visits, sessions, or conversions.'}};
}

export async function pageSegmentContext(url:string,dimension:'country'|'device'|'searchAppearance',limit=10,windowDays=28){const context:any=await pageContext(url,undefined,1,windowDays),c=config(),[current,previous]=await Promise.all([pageSegments(c,context.periods.current,context.url,dimension,limit),pageSegments(c,context.periods.previous,context.url,dimension,limit)]),before=new Map(previous.map(x=>[x.value,x]));return{...context,segmentEvidence:{dimension,current,previous,changes:current.map(x=>({value:x.value,current:x,previous:before.get(x.value)||null,clickChange:x.clicks-(before.get(x.value)?.clicks||0),impressionChange:x.impressions-(before.get(x.value)?.impressions||0)})),limitation:'Segment rows are bounded top GSC rows and do not prove cause.'}}}
export async function pageBrief(url:string,windowDays=28){const x:any=await pageContext(url,undefined,5,windowDays),a=x.pagePerformance.current,b=x.pagePerformance.previous,change=(a?.clicks||0)-(b?.clicks||0),action=x.decisionReadiness.state==='maturing'?'monitor':'investigate';return{...x,brief:{observed:[`Clicks: ${b?.clicks??0} → ${a?.clicks??0}`,`Impressions: ${b?.impressions??0} → ${a?.impressions??0}`,`Position: ${b?.position?.toFixed?.(1)??'n/a'} → ${a?.position?.toFixed?.(1)??'n/a'}`],whatItMayMean:change<0?'Search visibility declined; inspect query mix and page intent before changing copy.':'No decline diagnosis is implied; inspect the observed movement before acting.',limitations:[...x.decisionReadiness.reasons,x.queryEvidence.limitation],checklist:[change<0?'Check whether the opening answers the falling query theme.':'Check what is driving the observed query growth before changing the page.','Check reader intent and existing contextual links.','Confirm the page source and implementation scope before editing.'],nextCheck:'Inspect the query movement and current opening together.',recommendedAction:action}}}
export async function pageLifecycle(url:string){const c=config(),key=normalize(url,c),windows=[28,56,84],snapshots=await Promise.all(windows.map(days=>sync(false,days)));const evidence=snapshots.map((snapshot:any,idx)=>{const current=snapshot.gsc.find((row:any)=>row.key===key),previous=snapshot.previousGsc.find((row:any)=>row.key===key),baseline=previous?.impressions||0;return{windowDays:windows[idx],snapshotId:snapshot.id,current:current||null,previous:previous||null,clickChange:(current?.clicks||0)-(previous?.clicks||0),impressionChange:(current?.impressions||0)-baseline,maturity:baseline<c.minimumBaselineImpressions?'maturing':'established',readiness:snapshot.coverage.readiness}});const established=evidence.filter(x=>x.maturity==='established'),declines=established.filter(x=>x.clickChange<0).length,growth=established.filter(x=>x.clickChange>0).length;return{url,windows:evidence,flags:{repeatedDecline:declines>=2,repeatedGrowth:growth>=2,maturing:evidence.every(x=>x.maturity==='maturing'),insufficientEvidence:!established.length},limitation:'Flags are deterministic summaries of selected windows, not predictions or recommendations.'}}
export async function queryEntryExit(url:string,windowDays=28,limit=20){const x:any=await pageContext(url,undefined,limit,windowDays),changes=x.queryEvidence.changes;return{url:x.url,windowDays,periods:x.periods,entered:changes.filter((q:any)=>q.previous.impressions===0&&q.current.impressions>0),exited:changes.filter((q:any)=>q.current.impressions===0&&q.previous.impressions>0),retained:changes.filter((q:any)=>q.previous.impressions>0&&q.current.impressions>0),limitation:x.queryEvidence.limitation}}
export function actionLog(url?:string){const store=new Store(config().dataDir);return{actions:store.actions(url),dueForReview:store.due()}}
export function recordAction(input:any){const store=new Store(config().dataDir);return{actionId:store.action(input)}}
export async function measurementReadiness(){const r:any=await sync(),c=config(),rows=[...r.analytics.current.rows,...r.analytics.previous.rows],sources=rows.map((x:any)=>x.acquisition?.value||''),outcomes=await configuredOutcomeEvents(c,r.range.current);return{profile:r.profile,provider:r.analyticsProvider,lenses:{googleOrganic:sources.some((x:string)=>x.toLowerCase().includes('google / organic')),allOrganic:sources.some((x:string)=>x.toLowerCase().includes('/ organic')),identifiableAiReferrals:sources.filter((x:string)=>/(chatgpt|perplexity|claude|gemini)/i.test(x))},configuredOutcomes:outcomes,gaps:outcomes.available?[]:['Configure GA4_OUTCOME_EVENT_NAMES to inspect explicitly named GA4 events.'],limitations:['Source labels and outcome events remain provider-scoped and are not query-attributed.']}}
export async function pageRepositoryContext(url:string){return repositoryContext(url)}
export async function pageInternalLinkContext(url:string){const x:any=await pageContext(url,undefined,10);return internalLinkContext(url,x.queryEvidence.current.map((q:any)=>q.query))}

export async function report(refresh=false){
  const r=await sync(refresh),c=config(),list=candidates(r.gsc,r.previousGsc,r.coverage.readiness,c),readiness=reportReadiness(r.coverage.readiness,list.length);
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
