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
