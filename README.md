# Contador de Músicos

Sistema web responsivo em PHP, JavaScript e CSS para registrar contagens em vários celulares e gerar um relatório consolidado. O PostgreSQL do Neon centraliza usuários, eventos e contagens.

## Fluxo atual

1. O usuário entra com uma conta armazenada no Neon.
2. Todos os aparelhos preenchem os mesmos dados do evento: data, tipo, nome e local.
3. Cada aparelho registra sua parte da contagem.
4. As alterações ficam no `localStorage` e são sincronizadas automaticamente com o Neon.
5. O banco mantém uma contagem por evento e aparelho; uma nova sincronização substitui a versão anterior do mesmo aparelho.
6. A aba `Consolidar` mostra os demais aparelhos do evento.
7. O relatório soma a contagem local com os registros recebidos do Neon e pode ser impresso ou salvo em PDF.

Não é mais necessário exportar ou importar arquivos JSON para consolidar a contagem.

## Requisitos

- PHP 8.1 ou superior;
- extensão `pdo_pgsql`;
- PostgreSQL no Neon;
- variável de ambiente `DATABASE_URL`;
- HTTPS em produção.

## Configuração do Neon

No desenvolvimento local, use `neonctl link` para gerar `.env.local` automaticamente ou copie `.env.example` para `.env` e informe a cadeia completa de conexão:

```env
DATABASE_URL="postgresql://usuario:senha@endpoint/neondb?sslmode=require"
```

Os arquivos `.env`, `.env.local` e `.neon` estão ignorados pelo Git. Em produção, configure `DATABASE_URL` diretamente no painel da hospedagem.

Crie as tabelas e importe os usuários válidos de `public/data/users.json` na primeira execução:

```powershell
php database/migrate.php
```

Senhas importadas são transformadas em hash por `password_hash` antes de serem gravadas no Neon. Usuários com nomes de login inválidos são ignorados.

Teste a conexão em `/api/health.php`. A resposta esperada é:

```json
{"ok":true,"database":"connected"}
```

## APIs

- `api/auth.php`: login, restauração e encerramento da sessão.
- `api/users.php`: administração central de usuários.
- `api/sync.php`: gravação da contagem e leitura dos aparelhos do evento.
- `api/health.php`: diagnóstico da conexão com o Neon.

A autenticação usa sessão PHP com cookie `HttpOnly` e `SameSite=Lax`. As senhas não são enviadas ao frontend nem armazenadas em texto aberto no banco.

## Funcionamento offline

A contagem continua salva no navegador quando a internet oscila. Quando a conexão retorna, use `Consolidar > Sincronizar agora`; alterações normais também disparam sincronização automática. Login inicial e consolidação central exigem acesso ao servidor.

## Execução local

```powershell
php -S 127.0.0.1:8790 -t public
```

Depois acesse `http://127.0.0.1:8790`.

## Publicação na Vercel

O projeto mantém as APIs PHP para execução local e possui funções Node.js equivalentes em `api/` para a Vercel. A publicação usa o driver HTTP oficial do Neon.

No projeto da Vercel conectado a este repositório, configure para os ambientes Production e Preview:

- `DATABASE_URL`: cadeia de conexão pooled da branch `production` do Neon;
- `SESSION_SECRET`: valor aleatório com pelo menos 32 caracteres.

Use o preset `Other`, mantenha o diretório raiz do repositório e não configure um Output Directory manual. O arquivo `vercel.json` publica automaticamente o conteúdo de `public/` e encaminha as rotas PHP usadas pelo frontend para as funções Node.js.
