// Variáveis globais
let currentUser = null;
let authToken = null;
let currentTab = 'recepcao';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Verificar autenticação
function checkAuth() {
    authToken = localStorage.getItem('authToken');
    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    
    if (authToken && currentUser) {
        showMainScreen();
        loadUserData();
    } else {
        showLoginScreen();
    }
}

// Event Listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Tabs
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(tab.dataset.tab);
        });
    });
    
    // Recepção
    document.getElementById('saveRecepcao').addEventListener('click', saveRecepcao);
    
    // Atendimentos
    document.getElementById('saveAtendimento').addEventListener('click', saveAtendimento);
    
    // Casos
    document.getElementById('saveCaso').addEventListener('click', saveCaso);
    
    // Documentos
    document.getElementById('saveDocumento').addEventListener('click', saveDocumento);
    
    // Perfil
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('fotoInput').addEventListener('change', previewPhoto);
    
    // Limpar modais ao fechar
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('hidden.bs.modal', () => {
            clearModals();
        });
    });
}

// Autenticação
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showMainScreen();
            loadUserData();
        } else {
            errorDiv.textContent = data.error || 'Erro ao fazer login';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        errorDiv.textContent = 'Erro de conexão. Tente novamente.';
        errorDiv.classList.remove('d-none');
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    showLoginScreen();
}

// Navegação
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('mainScreen').classList.add('d-none');
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('mainScreen').classList.remove('d-none');
    switchTab(currentTab);
}

function switchTab(tabName) {
    currentTab = tabName;
    
    // Atualizar navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Mostrar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('d-none');
    });
    document.getElementById(tabName).classList.remove('d-none');
    
    // Carregar dados da aba
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch(tabName) {
        case 'recepcao':
            loadRecepcao();
            break;
        case 'atendimentos':
            loadAtendimentos();
            break;
        case 'casos':
            loadCasos();
            break;
        case 'documentos':
            loadDocumentos();
            break;
        case 'usuario':
            loadProfile();
            break;
    }
}

// API Helper
async function apiCall(endpoint, options = {}) {
    // Verificar se o body é FormData - se for, não definir Content-Type
    // O navegador definirá automaticamente com o boundary correto
    const isFormData = options.body instanceof FormData;
    
    const defaultOptions = {
        headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    };
    
    const response = await fetch(endpoint, mergedOptions);
    
    if (response.status === 401) {
        handleLogout();
        throw new Error('Sessão expirada');
    }
    
    return response;
}

// Recepção
async function loadRecepcao() {
    try {
        const response = await apiCall('/api/recepcao');
        const data = await response.json();
        renderRecepcaoTable(data);
    } catch (error) {
        console.error('Erro ao carregar recepção:', error);
    }
}

function renderRecepcaoTable(data) {
    const tbody = document.getElementById('recepcaoTableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.nome || ''}</td>
            <td>${item.cpf || ''}</td>
            <td>${item.telefone || ''}</td>
            <td>${formatDateTime(item.createdAt)}</td>
            <td>${item.motivo || ''}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editRecepcao(${item.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecepcao(${item.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function saveRecepcao() {
    const id = document.getElementById('recepcaoId').value;
    const data = {
        nome: document.getElementById('recepcaoNome').value,
        cpf: document.getElementById('recepcaoCpf').value,
        telefone: document.getElementById('recepcaoTelefone').value,
        motivo: document.getElementById('recepcaoMotivo').value
    };
    
    try {
        const endpoint = id ? `/api/recepcao/${id}` : '/api/recepcao';
        const method = id ? 'PUT' : 'POST';
        
        const response = await apiCall(endpoint, {
            method,
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalRecepcao')).hide();
            loadRecepcao();
        }
    } catch (error) {
        console.error('Erro ao salvar recepção:', error);
        alert('Erro ao salvar registro');
    }
}

async function editRecepcao(id) {
    try {
        const response = await apiCall('/api/recepcao');
        const data = await response.json();
        const item = data.find(r => r.id === id);
        
        if (item) {
            document.getElementById('recepcaoId').value = item.id;
            document.getElementById('recepcaoNome').value = item.nome || '';
            document.getElementById('recepcaoCpf').value = item.cpf || '';
            document.getElementById('recepcaoTelefone').value = item.telefone || '';
            document.getElementById('recepcaoMotivo').value = item.motivo || '';
            
            new bootstrap.Modal(document.getElementById('modalRecepcao')).show();
        }
    } catch (error) {
        console.error('Erro ao editar recepção:', error);
    }
}

async function deleteRecepcao(id) {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    
    try {
        const response = await apiCall(`/api/recepcao/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadRecepcao();
        }
    } catch (error) {
        console.error('Erro ao excluir recepção:', error);
        alert('Erro ao excluir registro');
    }
}

// Atendimentos
async function loadAtendimentos() {
    try {
        const response = await apiCall('/api/atendimentos');
        const data = await response.json();
        renderAtendimentosTable(data);
    } catch (error) {
        console.error('Erro ao carregar atendimentos:', error);
    }
}

function renderAtendimentosTable(data) {
    const tbody = document.getElementById('atendimentosTableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum atendimento encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.requerente || ''}</td>
            <td>${formatDateTime(item.data || item.createdAt)}</td>
            <td><span class="badge bg-info">${item.tipo || ''}</span></td>
            <td><span class="badge ${getStatusBadge(item.status)}">${item.status || ''}</span></td>
            <td>${item.responsavel || ''}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editAtendimento(${item.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteAtendimento(${item.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function saveAtendimento() {
    const id = document.getElementById('atendimentoId').value;
    const data = {
        requerente: document.getElementById('atendimentoRequerente').value,
        data: document.getElementById('atendimentoData').value,
        tipo: document.getElementById('atendimentoTipo').value,
        status: document.getElementById('atendimentoStatus').value,
        descricao: document.getElementById('atendimentoDescricao').value,
        responsavel: document.getElementById('atendimentoResponsavel').value
    };
    
    try {
        const endpoint = id ? `/api/atendimentos/${id}` : '/api/atendimentos';
        const method = id ? 'PUT' : 'POST';
        
        const response = await apiCall(endpoint, {
            method,
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalAtendimento')).hide();
            loadAtendimentos();
        }
    } catch (error) {
        console.error('Erro ao salvar atendimento:', error);
        alert('Erro ao salvar atendimento');
    }
}

async function editAtendimento(id) {
    try {
        const response = await apiCall('/api/atendimentos');
        const data = await response.json();
        const item = data.find(a => a.id === id);
        
        if (item) {
            document.getElementById('atendimentoId').value = item.id;
            document.getElementById('atendimentoRequerente').value = item.requerente || '';
            document.getElementById('atendimentoData').value = formatDateTimeLocal(item.data || item.createdAt);
            document.getElementById('atendimentoTipo').value = item.tipo || '';
            document.getElementById('atendimentoStatus').value = item.status || '';
            document.getElementById('atendimentoDescricao').value = item.descricao || '';
            document.getElementById('atendimentoResponsavel').value = item.responsavel || '';
            
            new bootstrap.Modal(document.getElementById('modalAtendimento')).show();
        }
    } catch (error) {
        console.error('Erro ao editar atendimento:', error);
    }
}

async function deleteAtendimento(id) {
    if (!confirm('Deseja realmente excluir este atendimento?')) return;
    
    try {
        const response = await apiCall(`/api/atendimentos/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadAtendimentos();
        }
    } catch (error) {
        console.error('Erro ao excluir atendimento:', error);
        alert('Erro ao excluir atendimento');
    }
}

// Casos
async function loadCasos() {
    try {
        const response = await apiCall('/api/casos');
        const data = await response.json();
        renderCasosTable(data);
    } catch (error) {
        console.error('Erro ao carregar casos:', error);
    }
}

function renderCasosTable(data) {
    const tbody = document.getElementById('casosTableBody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum caso encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.numero || ''}</td>
            <td>${item.requerente || ''}</td>
            <td>${formatDate(item.dataAbertura || item.createdAt)}</td>
            <td><span class="badge ${getStatusBadge(item.status)}">${item.status || ''}</span></td>
            <td><span class="badge ${getPriorityBadge(item.prioridade)}">${item.prioridade || ''}</span></td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editCaso(${item.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteCaso(${item.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function saveCaso() {
    const id = document.getElementById('casoId').value;
    const data = {
        numero: document.getElementById('casoNumero').value,
        dataAbertura: document.getElementById('casoDataAbertura').value,
        requerente: document.getElementById('casoRequerente').value,
        cpfCnpj: document.getElementById('casoCpfCnpj').value,
        status: document.getElementById('casoStatus').value,
        prioridade: document.getElementById('casoPrioridade').value,
        descricao: document.getElementById('casoDescricao').value
    };
    
    try {
        const endpoint = id ? `/api/casos/${id}` : '/api/casos';
        const method = id ? 'PUT' : 'POST';
        
        const response = await apiCall(endpoint, {
            method,
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalCaso')).hide();
            loadCasos();
        }
    } catch (error) {
        console.error('Erro ao salvar caso:', error);
        alert('Erro ao salvar caso');
    }
}

async function editCaso(id) {
    try {
        const response = await apiCall('/api/casos');
        const data = await response.json();
        const item = data.find(c => c.id === id);
        
        if (item) {
            document.getElementById('casoId').value = item.id;
            document.getElementById('casoNumero').value = item.numero || '';
            document.getElementById('casoDataAbertura').value = formatDateInput(item.dataAbertura || item.createdAt);
            document.getElementById('casoRequerente').value = item.requerente || '';
            document.getElementById('casoCpfCnpj').value = item.cpfCnpj || '';
            document.getElementById('casoStatus').value = item.status || '';
            document.getElementById('casoPrioridade').value = item.prioridade || '';
            document.getElementById('casoDescricao').value = item.descricao || '';
            
            new bootstrap.Modal(document.getElementById('modalCaso')).show();
        }
    } catch (error) {
        console.error('Erro ao editar caso:', error);
    }
}

async function deleteCaso(id) {
    if (!confirm('Deseja realmente excluir este caso?')) return;
    
    try {
        const response = await apiCall(`/api/casos/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadCasos();
        }
    } catch (error) {
        console.error('Erro ao excluir caso:', error);
        alert('Erro ao excluir caso');
    }
}

// Documentos
async function loadDocumentos() {
    try {
        const response = await apiCall('/api/documentos');
        const data = await response.json();
        renderDocumentosGrid(data);
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
    }
}

function renderDocumentosGrid(data) {
    const grid = document.getElementById('documentosGrid');
    if (data.length === 0) {
        grid.innerHTML = '<div class="col-12"><div class="empty-state"><i class="bi bi-file-earmark-pdf"></i><p>Nenhum documento encontrado</p></div></div>';
        return;
    }
    
    grid.innerHTML = data.map(item => `
        <div class="col-md-4">
            <div class="document-card">
                <div class="text-center">
                    <i class="bi bi-file-earmark-pdf document-icon"></i>
                    <h5>${item.nome}</h5>
                    <span class="badge bg-primary">${item.tipo}</span>
                </div>
                <p class="text-muted small mt-3">${item.descricao || 'Sem descrição'}</p>
                <p class="text-muted small"><i class="bi bi-calendar me-1"></i>${formatDateTime(item.createdAt)}</p>
                <div class="mt-3">
                    ${item.arquivo ? `<a href="${item.arquivo}" target="_blank" class="btn btn-sm btn-primary w-100 mb-2"><i class="bi bi-download me-1"></i>Baixar</a>` : ''}
                    <button class="btn btn-sm btn-danger w-100" onclick="deleteDocumento(${item.id})">
                        <i class="bi bi-trash me-1"></i>Excluir
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function saveDocumento() {
    const formData = new FormData();
    formData.append('nome', document.getElementById('documentoNome').value);
    formData.append('tipo', document.getElementById('documentoTipo').value);
    formData.append('descricao', document.getElementById('documentoDescricao').value);
    
    const arquivo = document.getElementById('documentoArquivo').files[0];
    if (!arquivo) {
        alert('Por favor, selecione um arquivo PDF');
        return;
    }
    formData.append('arquivo', arquivo);
    
    try {
        const response = await apiCall('/api/documentos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
                // NÃO definir Content-Type - o navegador definirá automaticamente para FormData
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            bootstrap.Modal.getInstance(document.getElementById('modalDocumento')).hide();
            document.getElementById('formDocumento').reset();
            loadDocumentos();
        } else {
            const error = await response.json();
            alert(error.error || 'Erro ao enviar documento');
        }
    } catch (error) {
        console.error('Erro ao salvar documento:', error);
        alert('Erro ao enviar documento: ' + error.message);
    }
}

async function deleteDocumento(id) {
    if (!confirm('Deseja realmente excluir este documento?')) return;
    
    try {
        const response = await apiCall(`/api/documentos/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadDocumentos();
        }
    } catch (error) {
        console.error('Erro ao excluir documento:', error);
        alert('Erro ao excluir documento');
    }
}

// Perfil
function loadUserData() {
    if (currentUser) {
        document.getElementById('userNameDisplay').textContent = currentUser.nomeCompleto || currentUser.username;
    }
}

async function loadProfile() {
    try {
        const response = await apiCall('/api/users/me');
        const user = await response.json();
        
        document.getElementById('profileUsername').value = user.username;
        document.getElementById('profileNomeCompleto').value = user.nomeCompleto || '';
        document.getElementById('profileTelefone').value = user.telefone || '';
        
        const photoImg = document.getElementById('profilePhoto');
        if (user.foto) {
            photoImg.src = user.foto;
        } else {
            photoImg.src = 'https://via.placeholder.com/150?text=Sem+Foto';
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

async function saveProfile(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nomeCompleto', document.getElementById('profileNomeCompleto').value);
    formData.append('telefone', document.getElementById('profileTelefone').value);
    
    const fotoInput = document.getElementById('fotoInput');
    if (fotoInput.files[0]) {
        formData.append('foto', fotoInput.files[0]);
    }
    
    try {
        const response = await apiCall('/api/users/me', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            loadUserData();
            
            const successDiv = document.getElementById('profileSuccess');
            successDiv.textContent = 'Perfil atualizado com sucesso!';
            successDiv.classList.remove('d-none');
            
            setTimeout(() => {
                successDiv.classList.add('d-none');
            }, 3000);
        }
    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        const errorDiv = document.getElementById('profileError');
        errorDiv.textContent = 'Erro ao atualizar perfil';
        errorDiv.classList.remove('d-none');
    }
}

function previewPhoto(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('profilePhoto').src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Utilitários
function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateTimeLocal(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getStatusBadge(status) {
    const badges = {
        'pendente': 'bg-warning',
        'em_andamento': 'bg-info',
        'concluido': 'bg-success',
        'aberto': 'bg-info',
        'em_analise': 'bg-warning',
        'arquivado': 'bg-secondary'
    };
    return badges[status] || 'bg-secondary';
}

function getPriorityBadge(prioridade) {
    const badges = {
        'baixa': 'bg-success',
        'media': 'bg-warning',
        'alta': 'bg-danger',
        'urgente': 'bg-danger'
    };
    return badges[prioridade] || 'bg-secondary';
}

function clearModals() {
    // Limpar formulários
    document.querySelectorAll('form').forEach(form => {
        if (form.id !== 'loginForm' && form.id !== 'profileForm') {
            form.reset();
        }
    });
    
    // Limpar IDs ocultos
    document.querySelectorAll('input[type="hidden"]').forEach(input => {
        if (input.id.includes('Id')) {
            input.value = '';
        }
    });
}

