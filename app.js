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
