/**
 * MESTRE DAS VENDAS — Servidor Backend v2.0
 * Express + JWT + banco JSON persistente
 * Deploy: Railway.app
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const fetch    = require('node-fetch');
const fs       = require('fs');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mestre_dev_secret_change_in_prod';

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' })); // 10mb para suportar avatares base64
app.use(express.static(path.join(__dirname, 'public')));

// ── Banco de dados (arquivo JSON) ──────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch(e) {
    console.error('Erro ao carregar DB:', e.message);
  }
  return createDefaultDB();
}

function createDefaultDB() {
  return {
    users: [
      {
        id: 'admin-001',
        name: 'admin',
        displayName: 'Administrador',
        password: bcrypt.hashSync('admin123', 10),
        niche: 'Administrador',
        limit: 999,
        used: 0,
        isAdmin: true,
        active: true,
        avatar: '',
        globalSlots: 50,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Erro ao salvar DB:', e.message);
  }
}

let db = loadDB();

// Garante que o admin sempre existe
if (!db.users) db.users = [];
if (!db.users.find(u => u.isAdmin)) {
  db.users.unshift(createDefaultDB().users[0]);
  saveDB(db);
}

console.log(`✅ Banco carregado: ${db.users.length} usuário(s)`);

// ── Auth Middleware ────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token não enviado.' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Recarrega o usuário do banco para ter dados frescos
    const user = db.users.find(u => u.id === decoded.id && u.active);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado ou desativado.' });
    req.user = user;
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  next();
}

// ── Remover senha dos objetos antes de enviar ──────────────
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ═══════════════════════════════════════════════════════════
// ROTAS DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

  // Busca case-insensitive
  const user = db.users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());

  if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
  if (!user.active) return res.status(401).json({ error: 'Conta desativada. Contate o administrador.' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });

  const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '30d' });

  // Atualiza último login
  user.lastLogin = new Date().toISOString();
  saveDB(db);

  res.json({ token, user: safeUser(user) });
});

// GET /api/auth/me — valida token e retorna dados frescos do usuário
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ═══════════════════════════════════════════════════════════
// ROTAS DE USUÁRIO (perfil próprio)
// ═══════════════════════════════════════════════════════════

// PATCH /api/auth/profile — atualiza perfil do usuário logado
app.patch('/api/auth/profile', authMiddleware, (req, res) => {
  const { displayName, currentPassword, newPassword, avatar } = req.body;
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  // Se está tentando mudar a senha, valida a senha atual
  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Informe a senha atual para alterar.' });
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    if (newPassword.length < 4) return res.status(400).json({ error: 'Nova senha deve ter pelo menos 4 caracteres.' });
    user.password = bcrypt.hashSync(newPassword, 10);
  }

  if (displayName) user.displayName = displayName.trim();
  if (avatar !== undefined) user.avatar = avatar; // avatar em base64 ou string vazia

  saveDB(db);
  res.json({ user: safeUser(user) });
});

// ═══════════════════════════════════════════════════════════
// ROTAS ADMIN — GERENCIAR USUÁRIOS
// ═══════════════════════════════════════════════════════════

// GET /api/admin/users — lista todos os usuários
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  res.json(db.users.map(safeUser));
});

// GET /api/admin/slots — configuração de slots
app.get('/api/admin/slots', authMiddleware, adminMiddleware, (req, res) => {
  const admin = db.users.find(u => u.isAdmin);
  const slots = admin?.globalSlots || 50;
  const used  = db.users.filter(u => !u.isAdmin).length;
  res.json({ slots, used });
});

// PATCH /api/admin/slots — atualiza slots
app.patch('/api/admin/slots', authMiddleware, adminMiddleware, (req, res) => {
  const { slots } = req.body;
  const val = parseInt(slots);
  if (isNaN(val) || val < 1) return res.status(400).json({ error: 'Valor inválido.' });
  const admin = db.users.find(u => u.isAdmin);
  if (admin) { admin.globalSlots = val; saveDB(db); }
  res.json({ slots: val });
});

// POST /api/admin/users — cria novo usuário
app.post('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const { name, password, displayName, niche, limit } = req.body;
  if (!name || !password || !niche) {
    return res.status(400).json({ error: 'Nome, senha e nicho são obrigatórios.' });
  }

  // Verifica slots
  const admin   = db.users.find(u => u.isAdmin);
  const slots   = admin?.globalSlots || 50;
  const nonAdmin = db.users.filter(u => !u.isAdmin).length;
  if (nonAdmin >= slots) {
    return res.status(400).json({ error: `Limite de ${slots} slots atingido. Aumente os slots disponíveis.` });
  }

  // Verifica duplicata (case-insensitive)
  if (db.users.find(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Este login já está em uso.' });
  }

  const newUser = {
    id: uuidv4(),
    name: name.trim(),
    displayName: (displayName || name).trim(),
    password: bcrypt.hashSync(password, 10),
    niche,
    limit: parseInt(limit) || 10,
    used: 0,
    isAdmin: false,
    active: true,
    avatar: '',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDB(db);
  console.log(`✅ Usuário criado: ${newUser.name} (${newUser.niche})`);
  res.status(201).json({ user: safeUser(newUser) });
});

// PATCH /api/admin/users/:id — edita usuário
app.patch('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (user.isAdmin) return res.status(403).json({ error: 'Não é possível editar o administrador por esta rota.' });

  const { name, password, displayName, niche, limit, active } = req.body;

  if (name) {
    const dup = db.users.find(u => u.name.toLowerCase() === name.trim().toLowerCase() && u.id !== user.id);
    if (dup) return res.status(400).json({ error: 'Login já em uso por outro usuário.' });
    user.name = name.trim();
  }
  if (displayName) user.displayName = displayName.trim();
  if (niche)       user.niche = niche;
  if (limit !== undefined) user.limit = parseInt(limit) || 10;
  if (active !== undefined) user.active = !!active;
  if (password)    user.password = bcrypt.hashSync(password, 10);

  saveDB(db);
  res.json({ user: safeUser(user) });
});

// DELETE /api/admin/users/:id — remove usuário
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (user.isAdmin) return res.status(403).json({ error: 'O administrador não pode ser removido.' });
  db.users = db.users.filter(u => u.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// ROTA DE ANÁLISE IA (proxy Anthropic)
// ═══════════════════════════════════════════════════════════

app.post('/api/analyze', authMiddleware, async (req, res) => {
  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'Campo messages obrigatório.' });

  const user = db.users.find(u => u.id === req.user.id);

  // Verifica limite
  if (user.limit !== 999 && user.used >= user.limit) {
    return res.status(429).json({ error: 'Limite de análises atingido. Contate o administrador.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Erro na API Anthropic.' });
    }

    // Incrementa uso do usuário
    user.used = (user.used || 0) + 1;
    saveDB(db);

    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'Erro ao conectar com a IA: ' + e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// DADOS PESSOAIS (histórico, notas, crm) — por usuário
// ═══════════════════════════════════════════════════════════

// Arquivo de dados pessoais por usuário
function getUserDataFile(userId) {
  return path.join(__dirname, `userdata_${userId}.json`);
}
function loadUserData(userId) {
  try {
    const f = getUserDataFile(userId);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch(e) {}
  return { history: [], notes: [], crm: [] };
}
function saveUserData(userId, data) {
  try { fs.writeFileSync(getUserDataFile(userId), JSON.stringify(data)); } catch(e) {}
}

// GET /api/data — carrega todos os dados do usuário
app.get('/api/data', authMiddleware, (req, res) => {
  res.json(loadUserData(req.user.id));
});

// POST /api/data — salva todos os dados do usuário
app.post('/api/data', authMiddleware, (req, res) => {
  const { history, notes, crm } = req.body;
  const current = loadUserData(req.user.id);
  if (history !== undefined) current.history = history;
  if (notes   !== undefined) current.notes   = notes;
  if (crm     !== undefined) current.crm     = crm;
  saveUserData(req.user.id, current);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    users: db.users.length,
    anthropic: !!process.env.ANTHROPIC_API_KEY ? '✅' : '❌ Ausente',
    uptime: Math.round(process.uptime()) + 's'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Mestre das Vendas v2.0 rodando na porta ${PORT}`);
  console.log(`   Usuários: ${db.users.length}`);
  console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ Defina ANTHROPIC_API_KEY'}`);
  console.log(`   JWT Secret: ${process.env.JWT_SECRET ? '✅' : '⚠️  Usando chave padrão (defina JWT_SECRET)'}\n`);
});
