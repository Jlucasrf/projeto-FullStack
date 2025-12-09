const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Função helper para verificar se é multipart
function isMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  return contentType.includes('multipart/form-data');
}

const app = express();
const PORT = 3000;
const SECRET_KEY = 'conselho-tutelar-secret-key-2024';

// Middlewares
app.use(cors());

// SOLUÇÃO DEFINITIVA: NÃO aplicar parsers globalmente
// Aplicar apenas nas rotas específicas que precisam
// Isso garante que multipart/form-data NUNCA seja processado pelos parsers JSON/URL-encoded

// Criar middlewares de parsing para uso específico
const jsonParser = express.json({ limit: '50mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '50mb' });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Upload para documentos PDF
const uploadPDF = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'));
    }
  }
});

// Upload para fotos de perfil (imagens)
const uploadFoto = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// Funções auxiliares para manipulação de JSON
const dataDir = 'data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJSON(file) {
  try {
    const data = fs.readFileSync(path.join(dataDir, file), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), 'utf8');
}

// Inicializar dados se não existirem
function initData() {
  const usersFile = path.join(dataDir, 'users.json');
  if (!fs.existsSync(usersFile)) {
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    const defaultUsers = [
      {
        id: 1,
        username: 'admin',
        password: defaultPassword,
        nomeCompleto: 'Administrador',
        telefone: '(00) 00000-0000',
        foto: '',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ];
    writeJSON('users.json', defaultUsers);
  }
  
  // Inicializar outros arquivos JSON
  ['recepcao.json', 'atendimentos.json', 'casos.json', 'documentos.json'].forEach(file => {
    if (!fs.existsSync(path.join(dataDir, file))) {
      writeJSON(file, []);
    }
  });
}

initData();

// Middleware de autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

// Rotas de Autenticação
app.post('/api/login', jsonParser, async (req, res) => {
  const { username, password } = req.body;
  const users = readJSON('users.json');
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      nomeCompleto: user.nomeCompleto,
      telefone: user.telefone,
      foto: user.foto,
      role: user.role
    }
  });
});

// Rotas de Usuários
app.get('/api/users/me', authenticateToken, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  res.json({
    id: user.id,
    username: user.username,
    nomeCompleto: user.nomeCompleto,
    telefone: user.telefone,
    foto: user.foto,
    role: user.role
  });
});

app.put('/api/users/me', authenticateToken, uploadFoto.single('foto'), async (req, res) => {
  const users = readJSON('users.json');
  const userIndex = users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  // Multer sempre popula req.body como objeto, mas pode estar vazio
  // Garantir que req.body seja um objeto
  const body = req.body || {};
  
  // Atualizar apenas os campos fornecidos
  if (body.nomeCompleto !== undefined) {
    users[userIndex].nomeCompleto = body.nomeCompleto;
  }
  if (body.telefone !== undefined) {
    users[userIndex].telefone = body.telefone;
  }
  
  if (req.file) {
    users[userIndex].foto = `/uploads/${req.file.filename}`;
  }

  writeJSON('users.json', users);
  
  res.json({
    id: users[userIndex].id,
    username: users[userIndex].username,
    nomeCompleto: users[userIndex].nomeCompleto,
    telefone: users[userIndex].telefone,
    foto: users[userIndex].foto,
    role: users[userIndex].role
  });
});

// Rotas de Recepção
app.get('/api/recepcao', authenticateToken, (req, res) => {
  const recepcoes = readJSON('recepcao.json');
  res.json(recepcoes);
});

app.post('/api/recepcao', authenticateToken, jsonParser, (req, res) => {
  const recepcoes = readJSON('recepcao.json');
  const novaRecepcao = {
    id: recepcoes.length > 0 ? Math.max(...recepcoes.map(r => r.id)) + 1 : 1,
    ...req.body,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };
  recepcoes.push(novaRecepcao);
  writeJSON('recepcao.json', recepcoes);
  res.json(novaRecepcao);
});

app.put('/api/recepcao/:id', authenticateToken, jsonParser, (req, res) => {
  const recepcoes = readJSON('recepcao.json');
  const index = recepcoes.findIndex(r => r.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Registro não encontrado' });
  }
  recepcoes[index] = { ...recepcoes[index], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON('recepcao.json', recepcoes);
  res.json(recepcoes[index]);
});

app.delete('/api/recepcao/:id', authenticateToken, (req, res) => {
  const recepcoes = readJSON('recepcao.json');
  const filtered = recepcoes.filter(r => r.id !== parseInt(req.params.id));
  writeJSON('recepcao.json', filtered);
  res.json({ success: true });
});

// Rotas de Atendimentos
app.get('/api/atendimentos', authenticateToken, (req, res) => {
  const atendimentos = readJSON('atendimentos.json');
  res.json(atendimentos);
});

app.post('/api/atendimentos', authenticateToken, jsonParser, (req, res) => {
  const atendimentos = readJSON('atendimentos.json');
  const novoAtendimento = {
    id: atendimentos.length > 0 ? Math.max(...atendimentos.map(a => a.id)) + 1 : 1,
    ...req.body,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };
  atendimentos.push(novoAtendimento);
  writeJSON('atendimentos.json', atendimentos);
  res.json(novoAtendimento);
});

app.put('/api/atendimentos/:id', authenticateToken, jsonParser, (req, res) => {
  const atendimentos = readJSON('atendimentos.json');
  const index = atendimentos.findIndex(a => a.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Atendimento não encontrado' });
  }
  atendimentos[index] = { ...atendimentos[index], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON('atendimentos.json', atendimentos);
  res.json(atendimentos[index]);
});

app.delete('/api/atendimentos/:id', authenticateToken, (req, res) => {
  const atendimentos = readJSON('atendimentos.json');
  const filtered = atendimentos.filter(a => a.id !== parseInt(req.params.id));
  writeJSON('atendimentos.json', filtered);
  res.json({ success: true });
});

// Rotas de Casos
app.get('/api/casos', authenticateToken, (req, res) => {
  const casos = readJSON('casos.json');
  res.json(casos);
});

app.post('/api/casos', authenticateToken, jsonParser, (req, res) => {
  const casos = readJSON('casos.json');
  const novoCaso = {
    id: casos.length > 0 ? Math.max(...casos.map(c => c.id)) + 1 : 1,
    ...req.body,
    createdAt: new Date().toISOString(),
    createdBy: req.user.id
  };
  casos.push(novoCaso);
  writeJSON('casos.json', casos);
  res.json(novoCaso);
});

app.put('/api/casos/:id', authenticateToken, jsonParser, (req, res) => {
  const casos = readJSON('casos.json');
  const index = casos.findIndex(c => c.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Caso não encontrado' });
  }
  casos[index] = { ...casos[index], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON('casos.json', casos);
  res.json(casos[index]);
});

app.delete('/api/casos/:id', authenticateToken, (req, res) => {
  const casos = readJSON('casos.json');
  const filtered = casos.filter(c => c.id !== parseInt(req.params.id));
  writeJSON('casos.json', filtered);
  res.json({ success: true });
});

// Rotas de Documentos
app.get('/api/documentos', authenticateToken, (req, res) => {
  const documentos = readJSON('documentos.json');
  res.json(documentos);
});

app.post('/api/documentos', authenticateToken, uploadPDF.single('arquivo'), (req, res) => {
  try {
    // Multer sempre popula req.body como objeto, mas pode estar vazio
    // Garantir que req.body seja um objeto
    const body = req.body || {};
    
    // Validar campos obrigatórios
    if (!body.nome || body.nome.trim() === '') {
      return res.status(400).json({ error: 'Nome do documento é obrigatório' });
    }
    
    // Validar se arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo PDF é obrigatório' });
    }
    
    const documentos = readJSON('documentos.json');
    const novoDocumento = {
      id: documentos.length > 0 ? Math.max(...documentos.map(d => d.id)) + 1 : 1,
      nome: body.nome.trim(),
      tipo: body.tipo || 'modelo',
      descricao: (body.descricao || '').trim(),
      arquivo: `/uploads/${req.file.filename}`,
      nomeArquivo: req.file.originalname,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    documentos.push(novoDocumento);
    writeJSON('documentos.json', documentos);
    res.json(novoDocumento);
  } catch (error) {
    console.error('Erro ao salvar documento:', error);
    res.status(500).json({ error: 'Erro ao salvar documento: ' + error.message });
  }
});

app.delete('/api/documentos/:id', authenticateToken, (req, res) => {
  const documentos = readJSON('documentos.json');
  const documento = documentos.find(d => d.id === parseInt(req.params.id));
  if (documento && documento.arquivo) {
    const filePath = path.join(__dirname, documento.arquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  const filtered = documentos.filter(d => d.id !== parseInt(req.params.id));
  writeJSON('documentos.json', filtered);
  res.json({ success: true });
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

