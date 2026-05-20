import { readFileSync, readdirSync, existsSync } from 'fs';

const prefixMap = {
  cloudflare: ['cf_'],
  google: ['gmail_','drive_','calendar_','sheets_','docs_','slides_','tasks_','people_','admin_','forms_','contacts_','google_'],
  search: ['brave_','tavily_','search_','serp_'],
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

  // Catch duplicate registry entries (Set would silently collapse them)
  const rNames = r.map(t=>t.name);
  const rT = new Set(rNames);
  const dupCounts = {};
  for (const n of rNames) dupCounts[n] = (dupCounts[n]||0) + 1;
  const dups = Object.entries(dupCounts).filter(([,c])=>c>1).map(([n,c])=>`${n} x${c}`);

  const inHnotR = [...hT].filter(t=>!rT.has(t));
  const inRnotH = [...rT].filter(t=>!hT.has(t));
  const gaps = inHnotR.length + inRnotH.length + dups.length;
  total += rT.size;

  if (gaps > 0) {
    allOk = false;
    console.log(ns.padEnd(14), '❌', gaps, 'issue(s)');
    if (inHnotR.length) console.log('  H not R:', inHnotR.join(', '));
    if (inRnotH.length) console.log('  R not H:', inRnotH.join(', '));
    if (dups.length) console.log('  DUPLICATES in registry:', dups.join(', '));
  } else {
    console.log(ns.padEnd(14), '✅', rT.size);
  }
}

// Cross-namespace duplicate detection
const crossNames = new Map();
for (const hf of handlers) {
  const ns = hf.replace('.js','');
  const reg = `registry/${ns}.json`;
  if (!existsSync(reg)) continue;
  const r = JSON.parse(readFileSync(reg, 'utf-8'));
  for (const t of r) {
    if (!crossNames.has(t.name)) crossNames.set(t.name, new Set());
    crossNames.get(t.name).add(ns);
  }
}
const crossDups = [...crossNames.entries()].filter(([,s]) => s.size > 1);
if (crossDups.length) {
  allOk = false;
  console.log('---');
  console.log('❌ CROSS-NAMESPACE DUPLICATES:');
  crossDups.forEach(([n,s]) => console.log(`  ${n} → ${[...s].join(', ')}`));
}
console.log('---');
console.log(`TOTAL: ${total} | ${allOk ? '✅ ALL SYNCED' : '❌ ISSUES FOUND'}`);
