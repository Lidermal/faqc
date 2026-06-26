const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

let currentUserData = null;
let countdownInterval;

// ==========================================
// AUTENTICAÇÃO
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

    // Força carregar a dashboard na primeira tela
    navigate('home');
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
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) toggleSidebar();
}

// ==========================================
// CONTROLE DE INTERFACE (UI & SPA)
// ==========================================
function navigate(pageId) {
    // 1. Remove a classe 'active' de TODAS as subpáginas
    document.querySelectorAll('.subpage').forEach(page => {
        page.classList.remove('active');
        page.classList.remove('hidden'); // Prevenção para garantir que a classe não volte
    });
    
    // 2. Adiciona a classe 'active' apenas na página clicada
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) {
        targetPage.classList.add('active');
    }

    // 3. Muda a cor do menu clicado
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + pageId);
    if(targetNav) {
        targetNav.classList.add('active');
    }
    
    // 4. Fecha o menu lateral se estiver num celular
    if(window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if(sidebar.classList.contains('open')) toggleSidebar();
    }

    // 5. Carrega os dados referentes a cada aba
    if (pageId === 'home') loadDashboard();
    if (pageId === 'membros') loadMembers();
    if (pageId === 'admin') loadAdminMembers();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth <= 768) {
        // Mobile behavior
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    } else {
        // Desktop behavior
        sidebar.classList.toggle('collapsed');
    }
}

// ==========================================
// LÓGICA DO DASHBOARD (INÍCIO)
// ==========================================
function loadDashboard() {
    startCountdown();
    fetchDailyMessage();
    fetchNextScale();
}

function startCountdown() {
    clearInterval(countdownInterval);
    
    function updateTimer() {
        const now = new Date();
        const nextSunday = new Date();
        const daysUntilSunday = (7 - now.getDay()) % 7;
        
        if (daysUntilSunday === 0 && now.getHours() >= 18) {
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

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

async function fetchDailyMessage() {
    const today = new Date().toISOString().split('T')[0];
    const container = document.getElementById('daily-message-content');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/daily_message?date=eq.${today}&select=*`, { method: 'GET', headers: headers });
        const data = await response.json();

        if (data.length > 0) {
            container.innerHTML = `<p>"${data[0].verse_text}"</p><span class="verse-ref">- ${data[0].verse_ref}</span>`;
        } else {
            container.innerHTML = `<p class="loading-text">Nenhuma mensagem cadastrada para hoje.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="loading-text" style="color:var(--danger)">Erro ao carregar a mensagem.</p>`;
    }
}

async function fetchNextScale() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { method: 'GET', headers: headers });
        const scaleData = await scaleRes.json();

        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}&select=role,members(full_name)`, { method: 'GET', headers: headers });
            const itemsData = await itemsRes.json();

            if (itemsData.length > 0) {
                let html = '';
                itemsData.forEach(item => {
                    html += `<div class="scale-member"><strong>${item.members.full_name}</strong><span>${item.role.charAt(0).toUpperCase() + item.role.slice(1)}</span></div>`;
                });
                container.innerHTML = html;
            } else {
                container.innerHTML = `<p class="loading-text">Escala criada, mas equipe não definida.</p>`;
            }
        } else {
            container.innerHTML = `<p class="loading-text">Nenhuma escala programada.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="loading-text" style="color:var(--danger)">Erro ao carregar a escala.</p>`;
    }
}

// ==========================================
// ABA DE MEMBROS
// ==========================================
async function loadMembers() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<p class="loading-text">Buscando equipe...</p>';

    try {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers: headers });
        const members = await res.json();

        if (members.length === 0) {
            grid.innerHTML = '<p class="loading-text">Nenhum membro cadastrado.</p>';
            return;
        }

        let html = '';
        members.forEach(m => {
            let badges = m.is_leader ? '<span class="badge lider">Líder</span>' : '';
            
            m.member_roles.forEach(r => {
                let badgeClass = r.role === 'vocal' ? 'vocal' : 'instrumento';
                let roleName = r.role.charAt(0).toUpperCase() + r.role.slice(1);
                badges += `<span class="badge ${badgeClass}">${roleName}</span>`;
            });

            let photoContent = m.photo_url 
                ? `<img src="${m.photo_url}" class="member-photo">` 
                : `<div class="member-photo">${m.full_name.charAt(0).toUpperCase()}</div>`;

            html += `
                <div class="member-card">
                    ${photoContent}
                    <div class="member-info">
                        <h4>${m.full_name}</h4>
                        <div class="role-badges">${badges || '<span class="badge" style="background:#eee;color:#999;">Membro</span>'}</div>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
    } catch (error) {
        grid.innerHTML = '<p class="loading-text" style="color:var(--danger)">Erro ao carregar membros.</p>';
    }
}

// ==========================================
// ABA DE ADMINISTRAÇÃO
// ==========================================
async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase();
    const fullname = document.getElementById('new-fullname').value.trim();
    const isLeader = document.getElementById('new-is-leader').checked;
    const msgBox = document.getElementById('admin-msg');

    if (!username || !fullname) {
        msgBox.textContent = 'Preencha usuário e nome!';
        msgBox.className = 'admin-message msg-error';
        return;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/members`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ username: username, full_name: fullname, is_leader: isLeader })
        });

        if (!res.ok) throw new Error('Usuário já existe ou erro no banco.');

        msgBox.textContent = 'Membro cadastrado com sucesso!';
        msgBox.className = 'admin-message msg-success';
        
        document.getElementById('new-username').value = '';
        document.getElementById('new-fullname').value = '';
        document.getElementById('new-is-leader').checked = false;
        loadAdminMembers();

    } catch (error) {
        msgBox.textContent = error.message;
        msgBox.className = 'admin-message msg-error';
    }
}

async function loadAdminMembers() {
    const list = document.getElementById('admin-members-list');
    list.innerHTML = '<p class="loading-text">Carregando...</p>';

    try {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,is_leader,member_roles(role)&order=full_name.asc`, { headers: headers });
        const members = await res.json();

        let html = '';
        members.forEach(m => {
            const currentRoles = m.member_roles.map(r => r.role);
            
            html += `
                <div class="admin-list-item" id="admin-item-${m.id}">
                    <div>
                        <strong>${m.full_name}</strong> <span style="color:var(--text-muted);font-size:0.8rem">(${m.username})</span>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-icon" onclick="toggleRoleEditor('${m.id}')" title="Editar Funções"><span class="material-symbols-outlined">edit_attributes</span></button>
                        <button class="btn-icon delete" onclick="deleteMember('${m.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                    
                    <div class="roles-editor hidden" id="editor-${m.id}">
                        ${['vocal', 'baterista', 'teclado', 'violao', 'baixo'].map(role => `
                            <label class="role-check-item">
                                <input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) ? 'checked' : ''}>
                                ${role.charAt(0).toUpperCase() + role.slice(1)}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<p class="loading-text msg-error">Erro ao carregar lista.</p>';
    }
}

function toggleRoleEditor(memberId) {
    document.getElementById(`editor-${memberId}`).classList.toggle('hidden');
}

async function updateRole(memberId, role, isAdding) {
    try {
        if (isAdding) {
            await fetch(`${SUPABASE_URL}/member_roles`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ member_id: memberId, role: role })
            });
        } else {
            await fetch(`${SUPABASE_URL}/member_roles?member_id=eq.${memberId}&role=eq.${role}`, {
                method: 'DELETE',
                headers: headers
            });
        }
    } catch (e) {
        alert('Erro ao atualizar função no banco.');
    }
}

async function deleteMember(id) {
    if(!confirm('Tem certeza que deseja remover este membro?')) return;
    
    try {
        await fetch(`${SUPABASE_URL}/members?id=eq.${id}`, { method: 'DELETE', headers: headers });
        loadAdminMembers();
    } catch (e) {
        alert('Erro ao excluir.');
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
