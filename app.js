// Configurações do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

// Objeto para guardar os dados do usuário logado na sessão
let currentUserData = null;

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const errorSpan = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    errorSpan.textContent = '';

    if (!usernameInput) {
        errorSpan.textContent = 'Por favor, digite seu usuário.';
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Validando...';

    try {
        // Busca o membro no Supabase pelo username
        const response = await fetch(`${SUPABASE_URL}/members?username=eq.${usernameInput}&select=*`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) throw new Error('Erro ao conectar ao banco de dados.');

        const data = await response.json();

        if (data.length > 0) {
            // Login bem-sucedido
            currentUserData = data[0];
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else {
            errorSpan.textContent = 'Usuário não encontrado no sistema.';
        }
    } catch (error) {
        console.error(error);
        errorSpan.textContent = 'Erro de conexão. Tente novamente.';
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Entrar';
    }
}

function handleLogout() {
    localStorage.removeItem('sessionUser');
    currentUserData = null;
    
    document.getElementById('system-screen').classList.remove('active');
    document.getElementById('system-screen').classList.add('hidden');
    
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');
    
    document.getElementById('username').value = '';
    
    // Fecha a sidebar se estiver no mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) {
        toggleSidebar();
    }
}

// ==========================================
// CONTROLE DE INTERFACE (UI)
// ==========================================
function showSystemScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    
    document.getElementById('system-screen').classList.remove('hidden');
    document.getElementById('system-screen').classList.add('active');
    
    // Exibe o nome completo do usuário logado vindo do banco
    document.getElementById('user-display-name').textContent = currentUserData.full_name;
}

function navigate(pageId) {
    const pages = document.querySelectorAll('.subpage');
    pages.forEach(page => page.classList.remove('active'));

    document.getElementById('page-' + pageId).classList.add('active');

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => btn.classList.remove('active'));

    document.getElementById('nav-' + pageId).classList.add('active');
    
    // No mobile, fecha o menu ao clicar em um link
    if(window.innerWidth <= 768) {
        toggleSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
window.onload = () => {
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) {
        currentUserData = JSON.parse(storedUser);
        showSystemScreen();
    }
};

// Lista provisória de usuários autorizados
const allowedUsers = ['janaelson.silva', 'danilo.cruz', 'pr.junior'];

function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const errorSpan = document.getElementById('login-error');

    // Limpa erros anteriores
    errorSpan.textContent = '';

    if (!usernameInput) {
        errorSpan.textContent = 'Por favor, digite seu usuário.';
        return;
    }

    if (allowedUsers.includes(usernameInput)) {
        // Login bem-sucedido
        localStorage.setItem('currentUser', usernameInput);
        showSystemScreen(usernameInput);
    } else {
        // Falha no login
        errorSpan.textContent = 'Usuário não encontrado no sistema.';
    }
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    
    document.getElementById('system-screen').classList.remove('active');
    document.getElementById('system-screen').classList.add('hidden');
    
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');
    
    document.getElementById('username').value = '';
}

function showSystemScreen(username) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    
    document.getElementById('system-screen').classList.remove('hidden');
    document.getElementById('system-screen').classList.add('active');
    
    document.getElementById('user-display-name').textContent = username;
}

// Verifica se já está logado ao recarregar a página
window.onload = () => {
    const loggedUser = localStorage.getItem('currentUser');
    if (loggedUser) {
        showSystemScreen(loggedUser);
    }
};

// Função para alternar entre as subpáginas (SPA)
function navigate(pageId) {
    // Esconde todas as subpáginas
    const pages = document.querySelectorAll('.subpage');
    pages.forEach(page => page.classList.remove('active'));

    // Mostra a subpágina clicada
    document.getElementById('page-' + pageId).classList.add('active');

    // Remove a classe 'active' de todos os botões do menu
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => btn.classList.remove('active'));

    // Adiciona a classe 'active' ao botão clicado
    document.getElementById('nav-' + pageId).classList.add('active');
}
