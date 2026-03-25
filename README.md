# ⚡ Mestre das Vendas v2.0 — Deploy no Railway

## Por que Railway e não Netlify?

Esta versão usa um **banco de dados real no servidor**. Os usuários ficam salvos
na nuvem e qualquer dispositivo (celular, notebook, tablet) acessa os mesmos dados.
O Railway é gratuito para projetos pequenos e sobe em menos de 5 minutos.

---

## Pré-requisitos

- Conta no GitHub: https://github.com
- Conta no Railway: https://railway.app (pode entrar com o GitHub)
- Sua chave da Anthropic: https://console.anthropic.com

---

## Deploy passo a passo

### 1. Suba o projeto no GitHub

```bash
# Entre na pasta do projeto
cd mestre-server

# Inicie o git e suba para o GitHub
git init
git add .
git commit -m "Mestre das Vendas v2.0"

# Crie um repositório no GitHub (github.com/new)
# Depois conecte e suba:
git remote add origin https://github.com/SEU_USUARIO/mestre-das-vendas.git
git push -u origin main
```

### 2. Crie o projeto no Railway

1. Acesse https://railway.app
2. Clique em **"New Project"**
3. Escolha **"Deploy from GitHub repo"**
4. Selecione o repositório `mestre-das-vendas`
5. Railway detecta o Node.js automaticamente e faz o deploy

### 3. Configure as variáveis de ambiente

No Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-SUA_CHAVE_AQUI` |
| `JWT_SECRET` | Qualquer texto longo e aleatório (ex: `mestre2025xyzabc123secreto`) |

> O Railway define o `PORT` automaticamente — não precisa adicionar.

### 4. Gere a URL pública

1. Vá em **Settings → Networking**
2. Clique em **"Generate Domain"**
3. Você receberá uma URL como `https://mestre-das-vendas-production.up.railway.app`

### 5. Acesse e teste

1. Abra a URL no navegador
2. Login: `admin` / Senha: `admin123`
3. Vá em **Gerenciar Usuários** e crie os usuários dos seus clientes
4. Teste em outro dispositivo — os usuários estarão disponíveis! ✅

---

## Credenciais padrão

| Usuário | Senha | Perfil |
|---|---|---|
| `admin` | `admin123` | Administrador |

> ⚠️ Mude a senha do admin após o primeiro acesso!

---

## Estrutura do Projeto

```
mestre-server/
├── server.js          ← Backend (Express + JWT + banco JSON)
├── public/
│   └── index.html     ← Frontend completo
├── package.json
├── .env.example       ← Modelo de configuração
├── .gitignore
└── README.md
```

---

## Como funciona

```
Usuário abre o app em qualquer dispositivo
         ↓
Faz login → servidor valida e retorna um JWT (token)
         ↓
Token fica salvo no localStorage do browser
         ↓
Toda requisição usa o token: dados do banco, análises, CRM
         ↓
Usuários, histórico, notas e CRM ficam no servidor
         ↓
Qualquer dispositivo vê os mesmos dados ✅
```

---

## Arquivos gerados no servidor (NÃO comite)

- `db.json` — banco de usuários
- `userdata_[id].json` — histórico, notas e CRM de cada usuário

O Railway mantém esses arquivos enquanto o projeto estiver ativo.
Para backup, use o botão **"Exportar Usuários"** no painel Admin.

---

## Atualizar o app

Quando quiser fazer atualizações:
```bash
git add .
git commit -m "descrição da atualização"
git push
```
O Railway faz o redeploy automaticamente em ~1 minuto.
