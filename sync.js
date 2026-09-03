// Sync diario do Oraculo:
//  - agente.json: status dos projetos (Asana)
//  - noticias.json: feed CURADO (IQVIA/medtech, IA, gestao de projetos) + nota do dia (estoico/zen/bushido)
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

// ---- Feed curado por tema (sem noticia generica de governo/fofoca) ----
const TOPICOS = [
  { emoji: '🩺', q: 'IQVIA OR "indústria farmacêutica" OR medtech OR "dispositivos médicos"' },
  { emoji: '🤖', q: 'inteligência artificial OR "IA generativa" OR LLM OR "AI agents"' },
  { emoji: '📊', q: '"gestão de projetos" OR PMO OR liderança OR produtividade' },
];
// ---- Nota do dia: estoico / zen / bushido ----
const NOTAS = [
  'Você tem poder sobre sua mente, não sobre os eventos externos. — Marco Aurélio',
  'Sofremos mais na imaginação do que na realidade. — Sêneca',
  'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que são difíceis. — Sêneca',
  'Não explique sua filosofia. Incorpore-a. — Epicteto',
  'A felicidade da sua vida depende da qualidade dos seus pensamentos. — Marco Aurélio',
  'O obstáculo é o caminho.',
  'Quando andar, apenas ande. Quando sentar, apenas sente. — zen',
  'Antes da iluminação: cortar lenha, carregar água. Depois: cortar lenha, carregar água. — zen',
  'Cai sete vezes, levanta oito. — provérbio japonês',
  'A perfeição do caráter é buscada a cada dia. — Hagakure (Bushidô)',
  'O caminho é treinar de manhã e de noite. — Miyamoto Musashi',
  'Não busque seguir os passos dos sábios; busque o que eles buscaram. — Bashô',
  'Disciplina é escolher entre o que você quer agora e o que você quer mais.',
  'Conheça o inimigo e a si mesmo e não temerá cem batalhas. — Sun Tzu',
  'O bambu que verga é mais forte que o carvalho que resiste.',
  'Fazês o que deves, aconteça o que acontecer. — estoico',
];
function notaDoDia() {
  const d = Math.floor(Date.now() / 86400000);
  return '🧘 ' + NOTAS[d % NOTAS.length];
}
async function noticias() {
  const out = [];
  for (const t of TOPICOS) {
    try {
      const r = await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(t.q) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419');
      const xml = await r.text();
      const m = xml.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/);
      if (m) {
        let titulo = decode(m[1]).replace(/\s+-\s+[^-]+$/, '').trim(); // tira o " - Fonte" no fim
        out.push(t.emoji + ' ' + titulo);
      }
    } catch (e) {}
  }
  out.push(notaDoDia());
  return out;
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
      fs.writeFileSync('noticias.json', JSON.stringify({ updated: today, fonte: 'curado (IQVIA/IA/projetos + nota do dia)', itens: it }, null, 2));
      console.log('noticias.json:', it.length, 'itens');
    }
  } catch (e) { console.error('erro noticias:', e.message); }
})();
