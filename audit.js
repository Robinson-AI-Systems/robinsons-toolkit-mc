import { readFileSync, readdirSync, existsSync } from 'fs';

const prefixMap = {
  cloudflare: ['cf_'],
  google: ['gmail_','drive_','calendar_','sheets_','docs_','slides_','tasks_','people_','admin_','forms_','contacts_','google_'],
  search: ['brave_','tavily_','search_'],
};

const handlers = readdirSync('handlers').filter(f=>f.endsWith('.js')).sort();
let total = 0, allOk = true;

for (const hf of handlers) {
  const ns = hf.replace('.js','');
  const reg = `registry/${ns}.json`;
  if (!existsSync(reg)) { console.log(ns.padEnd(14), '❌ NO REGISTRY'); allOk=false; continue; }
  const h = readFileSync(`handlers/${hf}`, 'utf-8');
  const r = JSON.parse(readFileSync(reg, 'utf-8'));

  const allH = [...h.matchAll(/tool === '([^']+)'/g)].map(m=>m[1]);
  const patterns = prefixMap[ns] || [ns + '_'];
  const hT = new Set(allH.filter(t => patterns.some(p => t.startsWith(p))));
  const rT = new Set(r.map(t=>t.name));

  const inHnotR = [...hT].filter(t=>!rT.has(t));
  const inRnotH = [...rT].filter(t=>!hT.has(t));
  const gaps = inHnotR.length + inRnotH.length;
  total += rT.size;

  if (gaps > 0) {
    allOk = false;
    console.log(ns.padEnd(14), '❌', gaps, 'gap(s)');
    if (inHnotR.length) console.log('  H not R:', inHnotR.join(', '));
    if (inRnotH.length) console.log('  R not H:', inRnotH.join(', '));
  } else {
    console.log(ns.padEnd(14), '✅', rT.size);
  }
}
console.log('---');
console.log(`TOTAL: ${total} | ${allOk ? '✅ ALL SYNCED' : '❌ ISSUES FOUND'}`);
