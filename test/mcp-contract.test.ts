import fs from 'node:fs';import path from 'node:path';import{describe,expect,it}from'vitest';
const source=fs.readFileSync(path.join(process.cwd(),'src/mcp.ts'),'utf8');
const required=['get_site_status','find_content_opportunities','get_page_context','get_page_segments','get_page_lifecycle','get_query_entry_exit','get_measurement_readiness','get_repository_context','get_internal_link_context','review_local_actions','record_local_action'];
describe('MCP contract',()=>it('keeps the public evidence tools registered',()=>{for(const tool of required)expect(source).toContain(`registerTool('${tool}'`)}));
