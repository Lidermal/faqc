const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
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

    if (currentUserData.is_leader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-music').classList.remove('hidden');
    }

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
    document.getElementById('btn-add-music').classList.add('hidden');
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) toggleSidebar();
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(page => {
        page.classList.remove('active');
        page.classList.remove('hidden'); 
    });
    
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + pageId);
    if(targetNav) targetNav.classList.add('active');
    
    if(window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if(sidebar.classList.contains('open')) toggleSidebar();
    }

    if (pageId === 'home') loadDashboard();
    if (pageId === 'membros') loadMembers();
    if (pageId === 'admin') loadAdminMembers();
    if (pageId === 'repertorio') loadRepertoire();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// ==========================================
// INÍCIO (Mensagem do Dia Inteligente e Escala)
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

        document.getElementById('countdown-timer').textContent = `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

// Lista fixa de versículos fortes focados em adoração caso o banco não tenha para o dia
const worshipVerses = [
    { text: "Venham! Cantemos ao Senhor com alegria! Aclamemos a Rocha da nossa salvação.", ref: "Salmos 95:1" },
    { text: "Prestem culto ao Senhor com alegria; entrem na sua presença com cânticos alegres.", ref: "Salmos 100:2" },
    { text: "Tudo o que tem vida louve o Senhor! Aleluia!", ref: "Salmos 150:6" },
    { text: "Está chegando a hora, e de fato já chegou, em que os verdadeiros adoradores adorarão o Pai em espírito e em verdade.", ref: "João 4:23" },
    { text: "Habite ricamente em vocês a palavra de Cristo; ensinem e aconselhem-se uns aos outros com toda a sabedoria, e cantem salmos, hinos e cânticos espirituais com gratidão a Deus.", ref: "Colossenses 3:16" },
    { text: "Cantem ao Senhor um novo cântico; cantem ao Senhor, todos os habitantes da terra!", ref: "Salmos 96:1" },
    { text: "Por meio de Jesus, portanto, ofereçamos continuamente a Deus um sacrifício de louvor, que é fruto de lábios que confessam o seu nome.", ref: "Hebreus 13:15" }
];

async function fetchDailyMessage() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const container = document.getElementById('daily-message-content');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/daily_message?date=eq.${dateString}&select=*`, { method: 'GET', headers: headers });
        const data = await response.json();

        if (data.length > 0) {
            container.innerHTML = `<p>"${data[0].verse_text}"</p><span class="verse-ref">- ${data[0].verse_ref}</span>`;
        } else {
            // Se não tiver no banco, pega o automático baseado no dia do mês
            const verse = worshipVerses[today.getDate() % worshipVerses.length];
            container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
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
                itemsData.forEach(item => { html += `<div class="scale-member"><strong>${item.members.full_name}</strong><span>${item.role.charAt(0).toUpperCase() + item.role.slice(1)}</span></div>`; });
                container.innerHTML = html;
            } else { container.innerHTML = `<p class="loading-text">Escala criada, mas equipe não definida.</p>`; }
        } else { container.innerHTML = `<p class="loading-text">Nenhuma escala programada.</p>`; }
    } catch (error) { container.innerHTML = `<p class="loading-text" style="color:var(--danger)">Erro ao carregar a escala.</p>`; }
}

// ==========================================
// REPERTÓRIO (Vibe Playlist e Buscador Fiel)
// ==========================================
async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    list.innerHTML = '<p class="loading-text">Buscando músicas...</p>';

    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire?select=*,repertoire_keys(ton)&order=title.asc`, { headers: headers });
        const repertoire = await res.json();

        if (repertoire.length === 0) {
            list.innerHTML = '<p class="loading-text">Nenhuma música cadastrada no ministério.</p>';
            return;
        }

        let html = '';
        repertoire.forEach(song => {
            let keysHtml = '';
            song.repertoire_keys.forEach(k => { keysHtml += `<span class="badge tom">${k.ton}</span>`; });

            html += `
                <div class="playlist-item" onclick="openViewRepertoire('${song.id}', \`${song.title.replace(/`/g, "'")}\`, \`${encodeURIComponent(song.lyrics_text)}\`)">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">music_note</span></div>
                        <div class="play-title">
                            <h4>${song.title}</h4>
                            <p>${song.is_medley ? 'Medley Especial' : 'Louvor Único'}</p>
                        </div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<p class="loading-text" style="color:var(--danger)">Erro ao carregar repertório.</p>';
    }
}

function openRepertoireModal() { document.getElementById('modal-add-repertoire').classList.add('active'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }

// Consumo de API Pública de Letras
async function searchLyrics() {
    const artist = document.getElementById('search-artist').value.trim();
    const song = document.getElementById('search-song').value.trim();
    const msgBox = document.getElementById('search-msg');
    
    if(!artist || !song) {
        msgBox.textContent = 'Preencha cantor e música para buscar.';
        msgBox.className = 'admin-message msg-error';
        return;
    }

    msgBox.textContent = 'Buscando letra na internet...';
    msgBox.className = 'admin-message';
    document.getElementById('btn-search-lyrics').disabled = true;

    try {
        const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${song}`);
        if(response.ok) {
            const data = await response.json();
            document.getElementById('rep-lyrics').value = data.lyrics;
            document.getElementById('rep-title').value = `${song} - ${artist}`;
            msgBox.textContent = 'Letra importada com sucesso!';
            msgBox.className = 'admin-message msg-success';
        } else {
            msgBox.textContent = 'Música não encontrada. Digite a letra manualmente abaixo.';
            msgBox.className = 'admin-message msg-error';
        }
    } catch(e) {
        msgBox.textContent = 'Erro no buscador. Digite a letra manualmente.';
        msgBox.className = 'admin-message msg-error';
    } finally {
        document.getElementById('btn-search-lyrics').disabled = false;
    }
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();

    if(!title || !lyrics) { alert('Título e Letra são obrigatórios!'); return; }

    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ title: title, lyrics_text: lyrics, created_by: currentUserData.id })
        });
        
        const savedData = await res.json();
        
        // Se digitou um tom inicial, salva ele também
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/repertoire_keys`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey })
            });
        }

        alert('Música salva com sucesso!');
        closeModals();
        
        // Limpar inputs
        document.getElementById('rep-title').value = '';
        document.getElementById('rep-lyrics').value = '';
        document.getElementById('rep-key').value = '';
        document.getElementById('search-artist').value = '';
        document.getElementById('search-song').value = '';
        document.getElementById('search-msg').textContent = '';

        loadRepertoire();
    } catch(e) {
        alert('Erro ao salvar música.');
    }
}

// Modal de Visualizar Letra e Gerenciar Tons
async function openViewRepertoire(id, title, encodedLyrics) {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = decodeURIComponent(encodedLyrics);
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    // Libera adicionar tom apenas para líder
    const addBox = document.getElementById('box-add-key');
    if(currentUserData.is_leader) { addBox.classList.remove('hidden'); } 
    else { addBox.classList.add('hidden'); }

    loadKeysForRepertoire(id);
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys');
    container.innerHTML = 'Buscando...';
    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire_keys?repertoire_id=eq.${id}`, { headers: headers });
        const keys = await res.json();
        
        if(keys.length === 0) {
            container.innerHTML = '<span>Nenhum tom definido.</span>';
            return;
        }

        let html = '';
        keys.forEach(k => {
            let deleteBtn = currentUserData.is_leader ? `<span style="cursor:pointer; color:red; margin-left:5px;" onclick="deleteKey('${k.id}')">✕</span>` : '';
            html += `<span class="badge tom" style="font-size: 1rem; padding: 5px 10px;">${k.ton} ${deleteBtn}</span>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = 'Erro'; }
}

async function addKeyToRepertoire() {
    const keyInput = document.getElementById('new-key-input');
    const newKey = keyInput.value.trim();
    if(!newKey || !currentViewingRepertoireId) return;

    try {
        await fetch(`${SUPABASE_URL}/repertoire_keys`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey })
        });
        keyInput.value = '';
        loadKeysForRepertoire(currentViewingRepertoireId);
        loadRepertoire(); // Atualiza na lista de trás também
    } catch(e) { alert('Erro ao adicionar tom.'); }
}

async function deleteKey(keyId) {
    if(!confirm('Remover este tom?')) return;
    try {
        await fetch(`${SUPABASE_URL}/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers: headers });
        loadKeysForRepertoire(currentViewingRepertoireId);
        loadRepertoire();
    } catch(e) { alert('Erro ao deletar tom.'); }
}

// ==========================================
// MEMBROS E ADMINISTRAÇÃO (Já prontos do Passo 3)
// ==========================================
async function loadMembers() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<p class="loading-text">Buscando equipe...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers: headers });
        const members = await res.json();
        if (members.length === 0) { grid.innerHTML = '<p class="loading-text">Nenhum membro cadastrado.</p>'; return; }
        let html = '';
        members.forEach(m => {
            let badges = m.is_leader ? '<span class="badge lider">Líder</span>' : '';
            m.member_roles.forEach(r => {
                let badgeClass = r.role === 'vocal' ? 'vocal' : 'instrumento';
                let roleName = r.role.charAt(0).toUpperCase() + r.role.slice(1);
                badges += `<span class="badge ${badgeClass}">${roleName}</span>`;
            });
            let photoContent = m.photo_url ? `<img src="${m.photo_url}" class="member-photo">` : `<div class="member-photo">${m.full_name.charAt(0).toUpperCase()}</div>`;
            html += `<div class="member-card">${photoContent}<div class="member-info"><h4>${m.full_name}</h4><div class="role-badges">${badges || '<span class="badge" style="background:#eee;color:#999;">Membro</span>'}</div></div></div>`;
        });
        grid.innerHTML = html;
    } catch (error) { grid.innerHTML = '<p class="loading-text" style="color:var(--danger)">Erro ao carregar membros.</p>'; }
}

async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase();
    const fullname = document.getElementById('new-fullname').value.trim();
    const isLeader = document.getElementById('new-is-leader').checked;
    const msgBox = document.getElementById('admin-msg');
    if (!username || !fullname) { msgBox.textContent = 'Preencha usuário e nome!'; msgBox.className = 'admin-message msg-error'; return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/members`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ username: username, full_name: fullname, is_leader: isLeader }) });
        if (!res.ok) throw new Error('Usuário já existe.');
        msgBox.textContent = 'Cadastrado com sucesso!'; msgBox.className = 'admin-message msg-success';
        document.getElementById('new-username').value = ''; document.getElementById('new-fullname').value = ''; document.getElementById('new-is-leader').checked = false;
        loadAdminMembers();
    } catch (error) { msgBox.textContent = error.message; msgBox.className = 'admin-message msg-error'; }
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
                    <div><strong>${m.full_name}</strong> <span style="color:var(--text-muted);font-size:0.8rem">(${m.username})</span></div>
                    <div class="admin-actions"><button class="btn-icon" onclick="toggleRoleEditor('${m.id}')"><span class="material-symbols-outlined">edit_attributes</span></button><button class="btn-icon delete" onclick="deleteMember('${m.id}')"><span class="material-symbols-outlined">delete</span></button></div>
                    <div class="roles-editor hidden" id="editor-${m.id}">${['vocal', 'baterista', 'teclado', 'violao', 'baixo'].map(role => `<label class="role-check-item"><input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) ? 'checked' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</label>`).join('')}</div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p class="loading-text msg-error">Erro ao carregar lista.</p>'; }
}

function toggleRoleEditor(memberId) { document.getElementById(`editor-${memberId}`).classList.toggle('hidden'); }
async function updateRole(memberId, role, isAdding) {
    try {
        if (isAdding) await fetch(`${SUPABASE_URL}/member_roles`, { method: 'POST', headers: headers, body: JSON.stringify({ member_id: memberId, role: role }) });
        else await fetch(`${SUPABASE_URL}/member_roles?member_id=eq.${memberId}&role=eq.${role}`, { method: 'DELETE', headers: headers });
    } catch (e) { alert('Erro no banco.'); }
}
async function deleteMember(id) {
    if(!confirm('Deseja remover este membro?')) return;
    try { await fetch(`${SUPABASE_URL}/members?id=eq.${id}`, { method: 'DELETE', headers: headers }); loadAdminMembers(); } 
    catch (e) { alert('Erro ao excluir.'); }
}

window.onload = () => {
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { currentUserData = JSON.parse(storedUser); showSystemScreen(); }
};
