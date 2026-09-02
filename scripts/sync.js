// Sync diario do Oraculo: gera agente.json (Asana) e noticias.json (Google News RSS).
// Roda no GitHub Actions. Precisa do secret ASANA_TOKEN para a parte do Asana.
const fs = require('fs');
const TOKEN = process.env.ASANA_TOKEN;
const WS = '1203608578502603';
const H = { headers: { Authorization: 'Bearer ' + TOKEN } };

async function aj(path) {
  const r = await fetch('https://app.asana.com/api/1.0' + path, H);
  if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
  return (await r.json()).data;
}
function farol(p) {
  if (p >= 100) return 'concluido';
  if (p >= 50) return 'verde';
  if (p >= 20) return 'amarelo';
  return 'neutro';
}
async function projetos() {
  const ps = await aj('/projects?workspace=' + WS + '&opt_fields=name,archived&limit=100');
  const out = [];
  for (const p of ps) {
    if (p.archived) continue;
    let tc;
    try { tc = await aj('/projects/' + p.gid + '/task_counts?opt_fields=num_tasks,num_completed_tasks'); }
    catch (e) { continue; }
    const total = tc.num_tasks || 0, done = tc.num_completed_tasks || 0;
    if (total === 0) continue;
    const pct = Math.round(done / total * 100);
    let prox = '';
    try {
      const ts = await aj('/projects/' + p.gid + '/tasks?opt_fields=name,completed&limit=50');
      const nx = ts.find(t => !t.completed);
      if (nx) prox = nx.name;
    } catch (e) {}
    out.push({ n: p.name, pct, done, total, farol: farol(pct), prox });
  }
  out.sort((a, b) => b.pct - a.pct);
  return out;
}
function decode(s) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim();
}
async function noticias() {
  const r = await fetch('https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419');
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
    .map(m => decode(m[1]));
  return items.filter(Boolean).slice(0, 7);
}
(async () => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (TOKEN) {
      const pj = await projetos();
      fs.writeFileSync('agente.json', JSON.stringify({ updated: today, fonte: 'Asana', projetos: pj }, null, 2));
      console.log('agente.json:', pj.length, 'projetos');
    } else { console.log('sem ASANA_TOKEN -> agente.json nao atualizado'); }
  } catch (e) { console.error('erro agente:', e.message); }
  try {
    const it = await noticias();
    if (it.length) {
      fs.writeFileSync('noticias.json', JSON.stringify({ updated: today, fonte: 'Google News BR', itens: it }, null, 2));
      console.log('noticias.json:', it.length, 'itens');
    }
  } catch (e) { console.error('erro noticias:', e.message); }
})();
