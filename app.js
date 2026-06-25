const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos'; // INSIRA SUA CHAVE AQUI

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

let currentUserData = null;
let countdownInterval;

// ==========================================
// AUTENTICAÇÃO E ROTEAMENTO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const errorSpan = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    errorSpan.textContent = '';
    if (!usernameInput) { errorSpan.textContent = 'Por favor, digite seu usuário.'; return; }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Validando...';

    try {
        const response = await fetch(`${SUPABASE_URL}/members?username=eq.${usernameInput}&select=*`, { method: 'GET', headers: headers });
        if (!response.ok) throw new Error('Erro banco de dados');
        const data = await response.json();

        if (data.length > 0) {
            currentUserData = data[0];
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else {
            errorSpan.textContent = 'Usuário não encontrado.';
        }
    } catch (error) {
        errorSpan.textContent = 'Erro de conexão.';
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Entrar';
    }
}

function showSystemScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('system-screen').classList.remove('hidden');
    document.getElementById('system-screen').classList.add('active');
    
    document.getElementById('user-display-name').textContent = currentUserData.full_name;

    // Controle de acesso Admin
    if (currentUserData.is_leader) {
        document.getElementById('nav-admin').classList.remove('hidden');
    }

    loadDashboard();
}

function handleLogout() {
    localStorage.removeItem('sessionUser');
    currentUserData = null;
    clearInterval(countdownInterval);
    
    document.getElementById('system-screen').classList.remove('active');
    document.getElementById('system-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('username').value = '';
    document.getElementById('nav-admin').classList.add('hidden');
    
    if (document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(page => page.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-' + pageId).classList.add('active');
    
    if(window.innerWidth <= 768) toggleSidebar();

    // Se clicar em Início, recarrega os dados
    if (pageId === 'home') loadDashboard();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

// ==========================================
// LÓGICA DO DASHBOARD (INÍCIO)
// ==========================================
function loadDashboard() {
    startCountdown();
    fetchDailyMessage();
    fetchNextScale();
}

// 1. Contador para o próximo Domingo (assumindo culto às 18:00)
function startCountdown() {
    clearInterval(countdownInterval);
    
    function updateTimer() {
        const now = new Date();
        const nextSunday = new Date();
        
        // Calcula os dias até o próximo domingo
        const daysUntilSunday = (7 - now.getDay()) % 7;
        
        if (daysUntilSunday === 0 && now.getHours() >= 18) {
            // Se hoje é domingo e já passou das 18h, o próximo é daqui a 7 dias
            nextSunday.setDate(now.getDate() + 7);
        } else {
            nextSunday.setDate(now.getDate() + daysUntilSunday);
        }
        
        nextSunday.setHours(18, 0, 0, 0);

        const diff = nextSunday - now;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('countdown-timer').textContent = 
            `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }

    updateTimer(); // Chama na hora
    countdownInterval = setInterval(updateTimer, 1000); // Atualiza por segundo
}

// 2. Busca Mensagem do Dia
async function fetchDailyMessage() {
    const today = new Date().toISOString().split('T')[0]; // Pega a data YYYY-MM-DD
    const container = document.getElementById('daily-message-content');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/daily_message?date=eq.${today}&select=*`, { method: 'GET', headers: headers });
        const data = await response.json();

        if (data.length > 0) {
            container.innerHTML = `
                <p>"${data[0].verse_text}"</p>
                <span class="verse-ref">- ${data[0].verse_ref}</span>
            `;
        } else {
            container.innerHTML = `<p class="loading-text">Nenhuma mensagem cadastrada para o dia de hoje.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="loading-text" style="color:var(--danger)">Erro ao carregar a mensagem.</p>`;
    }
}

// 3. Busca a Escala mais próxima
async function fetchNextScale() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Busca a próxima escala onde a data seja maior ou igual a hoje
        const scaleRes = await fetch(`${SUPABASE_URL}/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { method: 'GET', headers: headers });
        const scaleData = await scaleRes.json();

        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            
            // Busca os membros atrelados a essa escala juntando com a tabela members
            const itemsRes = await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}&select=role,members(full_name)`, { method: 'GET', headers: headers });
            const itemsData = await itemsRes.json();

            if (itemsData.length > 0) {
                let html = '';
                itemsData.forEach(item => {
                    html += `<div class="scale-member">
                                <strong>${item.members.full_name}</strong>
                                <span>${item.role.charAt(0).toUpperCase() + item.role.slice(1)}</span>
                             </div>`;
                });
                container.innerHTML = html;
            } else {
                container.innerHTML = `<p class="loading-text">Escala criada, mas equipe ainda não definida.</p>`;
            }
        } else {
            container.innerHTML = `<p class="loading-text">Nenhuma escala programada.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="loading-text" style="color:var(--danger)">Erro ao carregar a escala.</p>`;
    }
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
