# 🗾 Oráculo — Ilha da Mente

Um **sistema operacional pessoal** em forma de ilha japonesa 3D. Cada lugar da ilha é uma área da vida (carreira, jiu-jitsu, estudos, família, viagem, pessoal), um agente sincroniza o andamento dos projetos a partir do Asana, um jornal vintage traz as notícias curadas do dia, e as finanças ficam num cofre separado e protegido.

**No ar:** `https://cauesashihara.github.io/oraculo-ilha/`

---

## 1. O que é cada peça

| Peça | Arquivo | Função |
|------|---------|--------|
| 🏝️ A ilha 3D | `index.html` / `ilha.html` | Cena Three.js. Cada ponto abre o painel de uma área da vida. |
| 🗂️ Painel | `painel.html` | Agenda, calendário, treinos e notas pessoais. Salva por usuário logado no Supabase. |
| 🛰️ Arquitetura | `arquitetura.html` | Diagrama de como os sistemas conversam e a segurança usada. |
| 🤖 Agente de projetos | `agente.json` | Progresso dos projetos, sincronizado do Asana todo dia às 5h20. |
| 📰 Jornal do dia | `noticias.json` | 3 manchetes curadas (IQVIA, IA, projetos) + pensamento do dia. Atualiza às 5h20. |
| ⚙️ Robô de sincronização | `scripts/sync.js` | Script Node que gera `agente.json` e `noticias.json`. |
| ⏰ Automação | `.github/workflows/oraculo.yml` | GitHub Action agendada (cron 5h20 BRT) que roda o robô. |
| 🌾 Finanças | *(app separado)* | Fora deste repositório. Cofre no Lovable + Supabase, com login e RLS. |

---

## 2. Arquitetura — passo a passo

O sistema tem **duas metades separadas de propósito**: uma pública (a ilha) e uma privada (as finanças). Elas nunca se misturam.

### Metade pública — a Ilha
```
Você → GitHub (repo oraculo-ilha) → GitHub Pages → navegador (ilha 3D)
```
1. O código da ilha vive num repositório **público** no GitHub.
2. O **GitHub Pages** serve esse repositório como site (por isso ele precisa ser público — é uma exigência do plano gratuito).
3. Quem abre o link recebe HTML/JS estático. Não há servidor nem banco atrás da ilha em si.

### Sincronização diária (o "5h20")
```
GitHub Action (cron) → scripts/sync.js → { Asana API + Google News RSS } → agente.json + noticias.json → commit no repo → ilha lê os JSON
```
1. Todo dia às **05:20 BRT** (`cron: '20 8 * * *'` em UTC) o **GitHub Actions** acorda.
2. Ele roda `scripts/sync.js` no Node 20.
3. O script consulta a **API do Asana** (progresso dos projetos) e o **Google News RSS** (3 temas curados), monta a nota estoica/zen/bushido do dia, e escreve `agente.json` e `noticias.json`.
4. O Action faz `commit` desses dois arquivos de volta no repositório.
5. Na próxima vez que alguém abre a ilha, o front lê os JSON atualizados. O agente e o jornal ficam "vivos" sem servidor.

### Painel pessoal (estado por usuário)
```
painel.html → Supabase (login + tabela store) → volta pro painel
```
1. O painel usa a **chave pública (anon)** do Supabase para conectar.
2. O usuário faz **login** (Supabase Auth).
3. Estado (treinos, notas, etc.) é salvo na tabela `store`, sempre amarrado ao `user_id` de quem está logado.

### Metade privada — as Finanças
```
oraculo-financas (Lovable) → Supabase PRÓPRIO (login + RLS) → só você vê
```
1. As finanças **não estão neste repositório**. São um app à parte, feito no **Lovable**, com um **projeto Supabase próprio** (diferente do painel).
2. Só abre com **login por e-mail**. Os dados ficam nas tabelas `snapshots` e `holdings`, protegidos por **Row Level Security**.
3. A ilha só tem um link "cofre" apontando pro app — **nenhum número financeiro** trafega ou fica guardado na parte pública.

---

## 3. Onde estão as seguranças 🔒

| # | Trava | Onde | O que protege |
|---|-------|------|----------------|
| 1 | **Separação público × privado** | Dois repos + dois projetos Supabase | A ilha é pública; as finanças vivem em outro app, com outra base e outras chaves. A parte pública não tem como acessar a privada. |
| 2 | **Login + Row Level Security (RLS)** | Supabase (finanças e painel) | Mesmo com a chave pública `anon`, o banco só devolve as linhas de quem está logado — a regra é `auth.uid() = user_id`. Sem login, não vê nada. |
| 3 | **Chave certa exposta** | `painel.html` | A chave que aparece no código é a `anon` (pública por design, feita pra ficar no front). A chave `service_role` (que ignora o RLS) **nunca** entra em arquivo público. |
| 4 | **Token do Asana criptografado** | GitHub → Settings → Secrets → `ASANA_TOKEN` | O token que lê seus projetos fica como *secret* do GitHub, criptografado. O `sync.js` lê de `process.env.ASANA_TOKEN` — o valor nunca aparece no código nem no log. |
| 5 | **HTTPS em tudo** | GitHub Pages, Supabase, Asana | Todo o tráfego é criptografado em trânsito. |
| 6 | **Repo antigo fechado** | GitHub (repo `Oraculo`) | A versão anterior, que tinha dados sensíveis, foi tornada privada. |

**Regra de ouro:** um arquivo público (qualquer coisa neste repo) nunca pode conter número financeiro, senha, token, nem a chave `service_role`. As únicas coisas "abertas" aqui são: código do front, chave `anon` (segura), status dos projetos e as notícias.

> ⚠️ **Nota de privacidade:** o `painel.html` mostra sua agenda pessoal (aniversários, viagens, compromissos) numa página pública. Não é falha de segurança, mas é informação pessoal visível a qualquer um com o link — vale decidir se quer manter assim ou pôr o calendário atrás do login também.

---

## 4. Como alguém pode replicar

### Pré-requisitos
- Conta no **GitHub** (grátis)
- Conta no **Asana** (grátis) — opcional, só se quiser o agente de projetos
- Conta no **Supabase** (grátis) — só se quiser login/estado salvo
- Conta no **Lovable** (opcional) — só pra parte de finanças

### Passo a passo

**A) Publicar a ilha**
1. Crie um repositório **público** no GitHub (ex.: `minha-ilha`).
2. Suba os arquivos: `index.html`, `painel.html`, `arquitetura.html`, `agente.json`, `noticias.json`, `scripts/sync.js`, `.github/workflows/oraculo.yml`.
3. Vá em **Settings → Pages** e ative o Pages na branch `main`.
4. Pronto: `https://SEU-USUARIO.github.io/minha-ilha/`.

**B) Ligar o agente do Asana (opcional)**
1. No Asana: **My Settings → Apps → Developer → Personal Access Token**. Copie o token.
2. No GitHub do repo: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `ASANA_TOKEN`
   - Secret: *(cole o token)*
3. Em `scripts/sync.js`, ajuste o ID do workspace (`WS`) para o seu.
4. Rode manualmente em **Actions → Oraculo daily sync → Run workflow** pra testar. Depois ele roda sozinho às 5h20.

**C) Ligar o login/estado no Supabase (opcional)**
1. Crie um projeto no Supabase.
2. Crie a tabela `store` com colunas: `user_id` (uuid), `k` (text), `v` (jsonb).
3. **Ative o RLS** na tabela e crie uma policy: `auth.uid() = user_id` (para select, insert e update).
4. Em **Project Settings → API**, copie a **URL** e a **anon/public key**.
5. Cole esses dois valores no `painel.html` (variáveis `URL` e `KEY`). **Só a anon key** — nunca a `service_role`.

**D) Finanças num cofre separado (opcional)**
1. Faça um app à parte (ex.: no Lovable) com **seu próprio** projeto Supabase.
2. Tabelas `snapshots` / `holdings`, sempre com coluna `user_id`.
3. Ative **Auth por e-mail** e **RLS** com `auth.uid() = user_id`.
4. Na ilha, coloque só um **link** pro app — nenhum dado financeiro no repo público.

### Checklist de segurança antes de subir
- [ ] Nenhum número financeiro nos arquivos públicos
- [ ] Nenhuma senha ou token colado no código (token só via GitHub Secret)
- [ ] Só a chave **anon** no front — nunca a `service_role`
- [ ] **RLS ligado** em todas as tabelas do Supabase, com policy `auth.uid() = user_id`
- [ ] Finanças num projeto/app separado do público

---

## 5. Stack

**Front:** HTML + Three.js (r128) · **Automação:** GitHub Actions + Node 20 · **Dados de projeto:** Asana API · **Notícias:** Google News RSS · **Login/estado:** Supabase (Auth + RLS) · **Finanças:** Lovable + Supabase (app separado) · **Hospedagem:** GitHub Pages.

*Feito para uso pessoal. A prioridade do projeto é simples: as finanças não vazam.*
