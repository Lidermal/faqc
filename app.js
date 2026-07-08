// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 
    'apikey': SUPABASE_KEY, 
    'Authorization': `Bearer ${SUPABASE_KEY}`, 
    'Content-Type': 'application/json' 
};

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let currentFolderId = null;
let allRepertoireCache = [];
let allMembersCache = [];
let allFoldersCache = [];
let realtimeChannels = [];
let supabaseClient = null;

let scaleDraftTeam = [];
let medleyDraft = [];
let medleyCurrentSongId = null;
let medleyCurrentSongVerses = [];
let cachedLyricsSearch = {};
let selectedVocalists = [];
let carouselInterval = null;

// ==========================================
// INICIALIZAÇÃO SUPABASE
// ==========================================
function initSupabase() {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase client inicializado');
            return true;
        }
        console.warn('⚠️ Supabase library não carregada');
        return false;
    } catch (e) {
        console.error('❌ Erro ao inicializar Supabase:', e);
        return false;
    }
}

// ==========================================
// ALERTAS PERSONALIZADOS
// ==========================================
function showCustomAlert(msg, title = "Aviso") {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    document.getElementById('modal-alert').classList.add('active');
}

function closeCustomAlert() { 
    document.getElementById('modal-alert').classList.remove('active'); 
}

function showCustomConfirm(msg, callback, title = "Atenção") {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('modal-confirm').classList.add('active');
    
    document.getElementById('btn-confirm-yes').onclick = () => {
        closeCustomConfirm();
        if(callback) callback();
    };
}

function closeCustomConfirm() { 
    document.getElementById('modal-confirm').classList.remove('active'); 
}

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const btnLogin = document.getElementById('btn-login');

    if (!usernameInput) { 
        showCustomAlert('Por favor, digite seu usuário.'); 
        return; 
    }

    btnLogin.disabled = true; 
    btnLogin.textContent = 'Validando...';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members?username=eq.${usernameInput}&select=*`, { 
            method: 'GET', 
            headers 
        });
        const data = await response.json();

        if (data.length > 0) {
            currentUserData = data[0];
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else { 
            showCustomAlert('Usuário não encontrado.'); 
        }
    } catch (error) { 
        console.error('Erro no login:', error);
        showCustomAlert('Erro de conexão. Verifique sua internet.'); 
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

    // Verificar permissões
    const isLeader = currentUserData.is_leader;
    const isMedia = currentUserData.role === 'midia';
    
    // Controle de Abas
    if (isLeader) {
        document.getElementById('nav-admin').style.display = 'flex';
        document.getElementById('btn-add-scale').classList.remove('hidden');
        document.getElementById('nav-escalas').style.display = 'flex';
    } else if (isMedia) {
        document.getElementById('nav-escalas').style.display = 'none';
        document.getElementById('nav-admin').style.display = 'none';
        document.getElementById('btn-add-scale').classList.add('hidden');
    } else {
        document.getElementById('nav-escalas').style.display = 'flex';
        document.getElementById('nav-admin').style.display = 'none';
        document.getElementById('btn-add-scale').classList.add('hidden');
    }
    
    navigate('home');
    
    if (!supabaseClient) initSupabase();
    if (supabaseClient) setupRealtimeSubscriptions();
}

function handleLogout() {
    if (realtimeChannels.length > 0 && supabaseClient) {
        realtimeChannels.forEach(ch => {
            try { supabaseClient.removeChannel(ch); } catch(e) {}
        });
        realtimeChannels = [];
    }
    
    if(carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
    
    localStorage.removeItem('sessionUser'); 
    currentUserData = null; 
    clearInterval(countdownInterval);
    
    document.getElementById('system-screen').classList.remove('active'); 
    document.getElementById('system-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden'); 
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('username').value = '';
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(page => { 
        page.classList.remove('active'); 
    });
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + pageId);
    if(targetNav) targetNav.classList.add('active');
    
    if (pageId === 'home') {
        loadDashboard();
    } else if (pageId === 'membros') {
        loadMembers();
    } else if (pageId === 'admin') {
        loadAdminDashboard();
    } else if (pageId === 'repertorio') {
        loadFolders();
        loadRepertoire();
    } else if (pageId === 'escalas') {
        loadScales();
    } else if (pageId === 'perfil') {
        loadProfile();
    }
}

function closeModals() { 
    document.querySelectorAll('.modal').forEach(m => {
        if(!m.classList.contains('custom-alert-modal')) m.classList.remove('active'); 
    });
    document.getElementById('drawer-medley').classList.remove('active');
    document.getElementById('drawer-medley-overlay').classList.remove('active');
    
    const editingField = document.getElementById('editing-scale-id');
    if(editingField) editingField.value = '';
    const modalTitle = document.getElementById('scale-modal-title');
    if(modalTitle) modalTitle.textContent = 'Nova Escala';
    resetMedleyFlow();
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    const targetSection = document.getElementById('admin-' + section);
    if(targetSection) {
        targetSection.classList.remove('hidden');
        if(section === 'manage-members') loadAdminMembers();
    }
}

// ==========================================
// SUPABASE REALTIME
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;

    try {
        const repChannel = supabaseClient.channel('repertoire-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, () => {
            if(document.getElementById('page-repertorio').classList.contains('active')) loadRepertoire();
        }).subscribe();
        realtimeChannels.push(repChannel);

        const folderChannel = supabaseClient.channel('folder-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => {
            if(document.getElementById('page-repertorio').classList.contains('active')) { loadFolders(); loadRepertoire(); }
        }).subscribe();
        realtimeChannels.push(folderChannel);

        const scaleChannel = supabaseClient.channel('scale-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, () => {
            if(document.getElementById('page-escalas').classList.contains('active')) loadScales();
            if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
        }).subscribe();
        realtimeChannels.push(scaleChannel);

        const memberChannel = supabaseClient.channel('member-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
            if(document.getElementById('page-membros').classList.contains('active')) loadMembers();
            if(document.getElementById('page-admin').classList.contains('active')) loadAdminMembers();
            if(currentUserData && payload.new && payload.new.id == currentUserData.id) {
                currentUserData = payload.new;
                document.getElementById('user-display-name').textContent = currentUserData.full_name;
                localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            }
        }).subscribe();
        realtimeChannels.push(memberChannel);
        
    } catch (e) {
        console.error('❌ Erro ao configurar realtime:', e);
    }
}

// ==========================================
// INÍCIO (Dashboard)
// ==========================================
function loadDashboard() { 
    startCountdown(); 
    fetchDailyMessage(); 
    fetchNextScaleHome(); 
}

function startCountdown() {
    clearInterval(countdownInterval);
    function updateTimer() {
        const now = new Date(); 
        const target = new Date();
        const daysUntilSunday = (7 - now.getDay()) % 7;
        
        if (daysUntilSunday === 0 && (now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 30))) {
            target.setDate(now.getDate() + 7);
        } else {
            target.setDate(now.getDate() + daysUntilSunday);
        }
        target.setHours(18, 30, 0, 0);
        
        const diff = target - now;
        const d = Math.floor(diff / (1000 * 60 * 60 * 24)); 
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)); 
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        document.getElementById('countdown-timer').textContent = `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    updateTimer(); 
    countdownInterval = setInterval(updateTimer, 1000);
}

// Carrossel Automático Contínuo
function startCarouselAutoScroll() {
    if(carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        const carousel = document.getElementById('next-scale-team');
        if(carousel) {
            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            // Se chegou ao fim, volta suavemente pro inicio
            if(carousel.scrollLeft >= maxScroll - 10) {
                carousel.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                carousel.scrollBy({ left: 160, behavior: 'smooth' });
            }
        }
    }, 3000); 
}

function scrollCarousel(direction) {
    const carousel = document.getElementById('next-scale-team');
    if(carousel) {
        const scrollAmount = 160;
        carousel.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
}

// ==========================================
// MENSAGEM DO DIA
// ==========================================
const bibleVersesPool = [
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "Lançai sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", ref: "1 Pedro 5:7" },
    { text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.", ref: "Provérbios 3:5" }
];

async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const verse = bibleVersesPool[dayOfYear % bibleVersesPool.length];
    container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
}

// ==========================================
// FUNÇÕES / ÍCONES
// ==========================================
function getRoleIcon(role) {
    const icons = {
        'lider': 'star',
        'vocal': 'mic',
        'baterista': 'music_note',  
        'teclado': 'piano',
        'violao': 'music_note',     
        'baixo': 'graphic_eq',
        'midia': 'videocam'
    };
    return icons[role] || 'person';
}

function getRoleName(role) {
    const names = {
        'lider': 'Líder',
        'vocal': 'Vocal',
        'baterista': 'Baterista',
        'teclado': 'Teclado',
        'violao': 'Violão',
        'baixo': 'Baixo',
        'midia': 'Mídia'
    };
    return names[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/rest/v1/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        const scaleData = await scaleRes.json();
        
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}&select=role,members(id,full_name,photo_url)&order=role.asc`, { headers });
            const itemsData = await itemsRes.json();
            
            if (itemsData.length > 0) {
                let html = '';
                
                itemsData.forEach(item => {
                    const isCurrent = item.members.id === currentUserData.id ? 'current-user' : '';
                    // Usamos estritamente a função escalar:
                    const icon = getRoleIcon(item.role);
                    const roleName = getRoleName(item.role);
                    const photoUrl = item.members.photo_url || null;
                    
                    html += `
                        <div class="team-carousel-card ${isCurrent} role-${item.role}">
                            <div class="team-card-photo">
                                ${photoUrl ? 
                                    `<img src="${photoUrl}" alt="${item.members.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                     <div class="photo-placeholder" style="display:none">${item.members.full_name.charAt(0)}</div>` : 
                                    `<div class="photo-placeholder">${item.members.full_name.charAt(0)}</div>`
                                }
                                <div class="team-card-icon">
                                    <span class="material-symbols-outlined">${icon}</span>
                                </div>
                            </div>
                            <div class="team-card-info">
                                <div class="team-card-name">${item.members.full_name}</div>
                                <div class="team-card-role">${roleName}</div>
                            </div>
                            ${isCurrent ? '<div class="current-badge">★ Você</div>' : ''}
                        </div>
                    `;
                });
                
                container.innerHTML = html;
                startCarouselAutoScroll();
            } else {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Escala vazia.</p>`;
            }
        } else {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Nenhuma escala programada.</p>`;
        }
    } catch (e) { 
        console.error('Erro ao carregar escala:', e);
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Erro ao carregar.</p>`; 
    }
}

// ==========================================
// PERFIL DO USUÁRIO
// ==========================================
async function loadProfile() {
    const container = document.getElementById('profile-container');
    if(!container) return;
    
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-photo-wrapper">
                    ${currentUserData.photo_url ? 
                        `<img src="${currentUserData.photo_url}" alt="${currentUserData.full_name}" class="profile-photo" id="current-photo">` : 
                        `<div class="photo-placeholder-large">${currentUserData.full_name.charAt(0)}</div>`
                    }
                </div>
                <h2>${currentUserData.full_name}</h2>
                <p class="profile-username">@${currentUserData.username}</p>
                <div class="profile-badges">
                    ${currentUserData.is_leader ? '<span class="badge-role leader">Líder</span>' : ''}
                    ${currentUserData.role === 'midia' ? '<span class="badge-role">Mídia</span>' : ''}
                    ${currentUserData.role && currentUserData.role !== 'midia' && !currentUserData.is_leader ? `<span class="badge-role">${getRoleName(currentUserData.role)}</span>` : ''}
                </div>
            </div>
            
            <div class="profile-body">
                <div class="profile-section">
                    <h3>Informações Pessoais</h3>
                    <div class="form-grid">
                        <div class="input-group">
                            <label>Nome Completo</label>
                            <input type="text" id="profile-fullname" value="${currentUserData.full_name}">
                        </div>
                        <div class="input-group">
                            <label>Email</label>
                            <input type="email" id="profile-email" value="${currentUserData.email || ''}">
                        </div>
                        <div class="input-group">
                            <label>Telefone</label>
                            <input type="tel" id="profile-phone" value="${currentUserData.phone || ''}">
                        </div>
                    </div>
                </div>
                <button class="btn-primary" onclick="updateProfile()" style="width:100%; margin-top:1rem;">
                    <span class="material-symbols-outlined">save</span> Salvar Alterações
                </button>
            </div>
        </div>
    `;
}

async function updateProfile() {
    const fullname = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    
    if(!fullname) { showCustomAlert('Nome completo é obrigatório.', 'Erro'); return; }
    
    try {
        const updateData = { full_name: fullname, email: email || null, phone: phone || null };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateData)
        });
        
        if(!res.ok) throw new Error('Erro ao atualizar');
        
        currentUserData.full_name = fullname;
        currentUserData.email = email || null;
        currentUserData.phone = phone || null;
        localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
        
        showCustomAlert('Perfil atualizado com sucesso!', 'Sucesso');
        document.getElementById('user-display-name').textContent = fullname;
    } catch(e) {
        showCustomAlert('Erro ao atualizar perfil.', 'Erro');
    }
}

// ==========================================
// MEMBROS (CORRIGIDO ERRO 400 - Sem member_roles)
// ==========================================
async function loadMembers() {
    const container = document.getElementById('members-lineup');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // Query sem member_roles para evitar o 400
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,email,phone,is_leader,role&order=full_name.asc`, { headers });
        if(!res.ok) throw new Error('Erro na requisição: ' + res.status);
        
        const members = await res.json();
        
        if (members.length === 0) { 
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">Nenhum membro cadastrado.</p>'; 
            return; 
        }
        
        const leaders = members.filter(m => m.is_leader);
        const vocals = members.filter(m => !m.is_leader && m.role === 'vocal');
        const band = members.filter(m => !m.is_leader && m.role !== 'vocal' && m.role !== 'midia');
        
        let html = '';
        if(leaders.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">👑 Liderança</h3><div class="members-cards-grid">';
            leaders.forEach(m => html += createMemberCard(m, 'leader'));
            html += '</div></div>';
        }
        if(vocals.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">🎤 Vocal</h3><div class="members-cards-grid">';
            vocals.forEach(m => html += createMemberCard(m, 'vocal'));
            html += '</div></div>';
        }
        if(band.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">🎸 Banda</h3><div class="members-cards-grid">';
            band.forEach(m => html += createMemberCard(m, 'band'));
            html += '</div></div>';
        }
        container.innerHTML = html;
    } catch (e) { 
        console.error('Erro ao carregar membros:', e);
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:40px;">Erro ao carregar: ${e.message}</p>`; 
    }
}

function createMemberCard(member, type) {
    const photoUrl = member.photo_url || null;
    return `
        <div class="member-showcase-card ${type}">
            <div class="member-card-header">
                <div class="member-photo-wrapper">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${member.full_name}" class="member-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                         <div class="photo-placeholder" style="display:none">${member.full_name.charAt(0)}</div>` : 
                        `<div class="photo-placeholder">${member.full_name.charAt(0)}</div>`
                    }
                    ${member.is_leader ? '<div class="leader-crown">★</div>' : ''}
                </div>
                <div class="member-social-links">
                    ${member.email ? `<a href="mailto:${member.email}" class="social-link" title="Email"><span class="material-symbols-outlined">mail</span></a>` : ''}
                    ${member.phone ? `<a href="tel:${member.phone}" class="social-link" title="Telefone"><span class="material-symbols-outlined">phone</span></a>` : ''}
                </div>
            </div>
            <div class="member-card-body">
                <h3 class="member-name">${member.full_name}</h3>
                <div class="member-roles">
                    ${member.is_leader ? '<span class="role-badge leader">Líder</span>' : ''}
                    ${member.role ? `<span class="role-badge">${getRoleName(member.role)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// PASTAS DO REPERTÓRIO
// ==========================================
async function loadFolders() {
    const container = document.getElementById('folders-list');
    if(!container) return;
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=*,members!created_by(full_name)&order=name.asc`, { headers });
        const folders = await res.json();
        
        allFoldersCache = folders;
        
        let html = `
            <button class="folder-item ${currentFolderId === null ? 'active' : ''}" onclick="selectFolder(null)">
                <span class="material-symbols-outlined" style="color:#2d3436">folder_special</span>
                <div class="folder-info">
                    <span>Pasta Geral</span>
                    <small>Todas as músicas</small>
                </div>
            </button>
        `;
        
        folders.forEach(folder => {
            const canEdit = folder.created_by === currentUserData.id || currentUserData.is_leader;
            html += `
                <div class="folder-wrapper">
                    <button class="folder-item ${currentFolderId === folder.id ? 'active' : ''}" onclick="selectFolder('${folder.id}')">
                        <span class="material-symbols-outlined">folder</span>
                        <div class="folder-info">
                            <span>${folder.name}</span>
                            <small>Por: ${folder.members ? folder.members.full_name : 'Desconhecido'}</small>
                        </div>
                    </button>
                    ${canEdit ? `
                        <button class="btn-folder-delete" onclick="deleteFolder('${folder.id}')" title="Excluir pasta">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    ` : ''}
                </div>
            `;
        });
        
        // Apenas o Líder ou o próprio usuário pode criar pasta
        html += `
            <button class="btn-create-folder" onclick="openCreateFolderModal()">
                <span class="material-symbols-outlined">create_new_folder</span>
                Nova Pasta
            </button>
        `;
        
        container.innerHTML = html;
        updateRepertoireActionsVisibility();
        
    } catch (e) {
        console.error('Erro ao carregar pastas:', e);
    }
}

function selectFolder(folderId) {
    currentFolderId = folderId;
    loadFolders();
    loadRepertoire();
    updateRepertoireActionsVisibility();
}

function updateRepertoireActionsVisibility() {
    const actions = document.getElementById('repertoire-actions');
    if (!currentFolderId) {
        actions.classList.remove('hidden'); 
    } else {
        const folder = allFoldersCache.find(f => f.id === currentFolderId);
        // Só mostra se for o dono da pasta ou líder
        if (folder && (folder.created_by === currentUserData.id || currentUserData.is_leader)) {
            actions.classList.remove('hidden');
        } else {
            actions.classList.add('hidden');
        }
    }
}

async function openCreateFolderModal() {
    const name = prompt('Nome da pasta (Ex: Repertório Ana):');
    if(!name) return;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/folders`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ name: name, created_by: currentUserData.id })
        });
        
        loadFolders();
        showCustomAlert('Pasta criada com sucesso!', 'Sucesso');
    } catch(e) {
        showCustomAlert('Erro ao criar pasta.', 'Erro');
    }
}

async function deleteFolder(folderId) {
    if(!confirm('Deseja excluir esta pasta? As músicas ficarão apenas na Pasta Geral.')) return;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire?folder_id=eq.${folderId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ folder_id: null })
        });
        await fetch(`${SUPABASE_URL}/rest/v1/folders?id=eq.${folderId}`, { method: 'DELETE', headers });
        currentFolderId = null;
        loadFolders();
        loadRepertoire();
        showCustomAlert('Pasta excluída!', 'Sucesso');
    } catch(e) {
        showCustomAlert('Erro ao excluir pasta.', 'Erro');
    }
}

// ==========================================
// BUSCA E REPERTÓRIO
// ==========================================
function openRepertoireModal() { 
    document.getElementById('modal-add-repertoire').classList.add('active'); 
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-msg').textContent = '';
    document.getElementById('search-query').value = '';
    document.getElementById('rep-title').value = '';
    document.getElementById('rep-vocalist').value = '';
    document.getElementById('rep-key').value = '';
    document.getElementById('rep-lyrics').value = '';
}

// Funções de letras (simplificadas pra manter o tamanho, mas funcionais como antes)
async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const msgBox = document.getElementById('search-msg');
    const resultsContainer = document.getElementById('search-results');
    
    if(!query) { showCustomAlert('Digite o nome da música.'); return; }
    
    msgBox.innerHTML = '<span style="color:var(--primary-color);">🔍 Buscando Vagalume...</span>';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    try {
        const vagRes = await fetch(`https://api.vagalume.com.br/search.php?exc=${encodeURIComponent(query)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);
        if(vagRes.ok) {
            const vagData = await vagRes.json();
            if(vagData.art && vagData.art.length > 0) {
                for(let artist of vagData.art.slice(0, 5)) {
                    if(artist.mus) {
                        for(let music of artist.mus.slice(0, 3)) {
                            if(music.text) {
                                const uniqueId = `vagalume_${artist.id}_${music.id}`;
                                cachedLyricsSearch[uniqueId] = { artist: artist.name, song: music.desc || music.title, lyrics: music.text };
                                
                                const div = document.createElement('div');
                                div.className = 'search-result-item';
                                div.innerHTML = `
                                    <div style="flex:1; min-width:0;">
                                        <strong style="display:block;">${music.desc || music.title}</strong>
                                        <small style="color:var(--text-muted);">${artist.name}</small>
                                    </div> 
                                    <span class="material-symbols-outlined" style="color:var(--primary-color);">download_done</span>
                                `;
                                div.onclick = () => importPreCheckedLyrics(uniqueId);
                                resultsContainer.appendChild(div);
                            }
                        }
                    }
                }
            }
        }
        msgBox.innerHTML = resultsContainer.children.length > 0 ? `<span style="color:var(--success);">✅ Encontradas!</span>` : `<span style="color:var(--danger);">❌ Nenhuma encontrada.</span>`;
    } catch(e) { 
        msgBox.innerHTML = '<span style="color:var(--danger);">❌ Erro ao buscar.</span>'; 
    }
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`✅ Letra de "${data.song}" importada!`, "Sucesso");
}

async function searchVocalists(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('vocalist-dropdown');
    
    if(query.length < 2) { dropdown.style.display = 'none'; return; }
    
    if(allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
        allMembersCache = await res.json();
    }
    
    const filtered = allMembersCache.filter(m => m.full_name.toLowerCase().includes(query)).slice(0, 5);
    if(filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `
            <div class="dropdown-item" onclick="selectVocalist('${m.id}', '${m.full_name}')">
                <span class="material-symbols-outlined">person</span> ${m.full_name}
            </div>
        `).join('');
        dropdown.style.display = 'block';
    }
}

function selectVocalist(id, name) {
    document.getElementById('rep-vocalist').value = name;
    document.getElementById('vocalist-dropdown').style.display = 'none';
    document.querySelector('.searchable-select .search-input').value = name;
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    const vocalist = document.getElementById('rep-vocalist').value.trim();
    
    if(!title || !lyrics) { showCustomAlert('Título e Letra são obrigatórios!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                title, lyrics_text: lyrics, created_by: currentUserData.id,
                vocalist: vocalist || null, folder_id: currentFolderId || null
            }) 
        });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
                method: 'POST', headers, body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) 
            });
        }
        showCustomAlert('Música salva com sucesso!', "Sucesso"); 
        closeModals(); 
        loadRepertoire();
    } catch(e) { showCustomAlert('Erro ao salvar no banco.'); }
}

async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    if(!list) return;
    
    list.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // Se Pasta Geral (null), não filtramos por folder. Assim pega todas!
        let query = `${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton),members!created_by(full_name)`;
        if(currentFolderId) query += `&folder_id=eq.${currentFolderId}`;
        query += '&order=title.asc';
        
        const res = await fetch(query, { headers });
        allRepertoireCache = await res.json();
        
        if (allRepertoireCache.length === 0) { 
            list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">Nenhuma música nesta pasta.</p>'; 
            return; 
        }
        
        let html = '';
        allRepertoireCache.forEach(song => {
            let keysHtml = song.repertoire_keys ? song.repertoire_keys.map(k => `<span class="badge tom">${k.ton}</span>`).join('') : '';
            let vocalistHtml = song.vocalist ? `<div class="vocalist-badge"><span class="material-symbols-outlined" style="font-size:0.9rem;">mic</span> ${song.vocalist}</div>` : '';
            
            // Permissão de Edit (Excluir/Mudar tom)
            const canEdit = song.created_by === currentUserData.id || 
                            (currentFolderId && allFoldersCache.find(f => f.id === currentFolderId)?.created_by === currentUserData.id) ||
                            currentUserData.is_leader;
            
            html += `
                <div class="playlist-item" onclick="openViewRepertoire('${song.id}', \`${song.title.replace(/`/g, "'")}\`, \`${encodeURIComponent(song.lyrics_text || '')}\`, ${song.is_medley}, \`${encodeURIComponent(song.vocalist || '')}\`)">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">${song.is_medley ? 'queue_music' : 'music_note'}</span></div>
                        <div class="play-title">
                            <h4>${song.title}</h4>
                            <p>${song.is_medley ? 'Medley' : 'Louvor'} ${vocalistHtml}</p>
                        </div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                    ${canEdit ? `<button class="btn-edit-rep" onclick="event.stopPropagation(); deleteRepertoire('${song.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>` : ''}
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro.</p>'; }
}

async function deleteRepertoire(id) {
    if(!confirm('Deseja excluir esta música?')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, { method: 'DELETE', headers });
        loadRepertoire();
    } catch(e) {}
}

async function openViewRepertoire(id, title, encodedLyrics, isMedley, encodedVocalist = '') {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    loadKeysForRepertoire(id);
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys'); 
    container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        container.innerHTML = keys.map(k => `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} <span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span></span>`).join('');
    } catch(e) {}
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if(!newKey || !currentViewingRepertoireId) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
            method: 'POST', headers, body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey }) 
        });
        document.getElementById('new-key-input').value = ''; 
        loadKeysForRepertoire(currentViewingRepertoireId); 
        loadRepertoire();
    } catch(e) {}
}

async function deleteKey(keyId) {
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers });
    loadKeysForRepertoire(currentViewingRepertoireId);
    loadRepertoire();
}

// ==========================================
// ESCALAS (Correção Lider x Função Específica)
// ==========================================
function switchScaleTab(tab) {
    document.getElementById('tab-future').classList.remove('active');
    document.getElementById('tab-past').classList.remove('active');
    document.getElementById('scales-list-future').classList.add('hidden');
    document.getElementById('scales-list-past').classList.add('hidden');

    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('scales-list-' + tab).classList.remove('hidden');
}

async function loadScales() {
    const listFuture = document.getElementById('scales-list-future');
    const listPast = document.getElementById('scales-list-past');
    listFuture.innerHTML = '<div class="loading-spinner"></div>'; 
    listPast.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=*,scale_items(role,members(full_name,photo_url)),scale_songs(repertoire(title,repertoire_keys(ton),vocalist))&order=event_date.asc`, { headers });
        const scales = await res.json();
        
        const todayStr = new Date().toISOString().split('T')[0];
        const futures = scales.filter(s => s.event_date >= todayStr);
        const pasts = scales.filter(s => s.event_date < todayStr).reverse();

        listFuture.innerHTML = renderScaleCards(futures, true);
        listPast.innerHTML = renderScaleCards(pasts, false);

    } catch(e) { 
        listFuture.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro.</p>'; 
        listPast.innerHTML = '';
    }
}

function renderScaleCards(scaleArray, isFuture) {
    if(scaleArray.length === 0) return '<p style="text-align:center; color:var(--text-muted); padding:40px;">' + (isFuture ? 'Nenhuma escala programada.' : 'Histórico vazio.') + '</p>';
    
    let html = '';
    scaleArray.forEach(s => {
        const dateObj = new Date(s.event_date);
        const dateStr = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
        
        let teamHtml = '<div class="scale-team-section"><h4 class="scale-section-title"><span class="material-symbols-outlined">group</span> Equipe</h4><div class="scale-team-list">';
        
        s.scale_items.forEach(item => {
            const icon = getRoleIcon(item.role);
            const roleName = getRoleName(item.role);
            
            // Usamos a classe role-${item.role} para pintar a borda e o ícone de acordo
            teamHtml += `
                <div class="scale-team-member role-${item.role}">
                    <span class="material-symbols-outlined scale-team-icon">${icon}</span>
                    <span class="scale-team-name">${item.members.full_name}</span>
                    <span class="scale-team-role">${roleName}</span>
                </div>
            `;
        });
        
        teamHtml += '</div></div>';
        
        let songsHtml = '<div class="scale-songs-section"><h4 class="scale-section-title"><span class="material-symbols-outlined">library_music</span> Repertório</h4><div class="scale-songs-list">';
        
        if(s.scale_songs.length > 0) {
            s.scale_songs.forEach(song => { 
                const keysStr = song.repertoire.repertoire_keys ? song.repertoire.repertoire_keys.map(k => k.ton).join(', ') : '';
                songsHtml += `
                    <div class="scale-song-item">
                        <span class="material-symbols-outlined scale-song-icon">music_note</span>
                        <span class="scale-song-name">${song.repertoire.title}</span>
                        <div class="scale-song-badges">${keysStr ? `<span class="badge tom">${keysStr}</span>` : ''}</div>
                    </div>
                `; 
            });
        } else {
            songsHtml += '<div class="scale-empty">Nenhuma música definida.</div>';
        }
        songsHtml += '</div></div>';

        const actionsHtml = currentUserData.is_leader ? `
            <div class="scale-folder-actions">
                <button class="btn-icon" onclick="openEditScaleModal('${s.id}')" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                <button class="btn-icon danger" onclick="deleteScale('${s.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
            </div>
        ` : '';

        html += `
            <div class="scale-card">
                <div class="scale-card-header">
                    <div class="scale-folder-date">
                        <span class="material-symbols-outlined">event</span>
                        <div>
                            <div class="scale-folder-date-text">${dateStr}</div>
                            <div class="scale-folder-notes">${s.notes || 'Sem observações'}</div>
                        </div>
                    </div>
                    ${actionsHtml}
                </div>
                <div class="scale-card-body">
                    ${teamHtml}
                    ${songsHtml}
                </div>
            </div>
        `;
    });
    return html;
}

async function deleteScale(scaleId) {
    if(!confirm('Excluir esta escala?')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}`, { method: 'DELETE', headers });
    loadScales();
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    document.getElementById('editing-scale-id').value = '';
    scaleDraftTeam = []; 
    renderScaleDraftTeam();
    
    if(allMembersCache.length === 0) {
        // CORREÇÃO: Sem member_roles
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,role`, { headers });
        allMembersCache = await res.json();
    }
    
    const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
    const repertoires = await resRep.json();
    const songsContainer = document.getElementById('scale-songs-selectors');
    songsContainer.innerHTML = '';
    repertoires.forEach(song => {
        songsContainer.innerHTML += `<label class="song-checkbox"><input type="checkbox" value="${song.id}" class="scale-song-cb"><span>${song.title}</span></label>`;
    });
}

function searchMembersForScale(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('member-scale-dropdown');
    
    if(query.length < 2) { dropdown.style.display = 'none'; return; }
    const filtered = allMembersCache.filter(m => m.full_name.toLowerCase().includes(query)).slice(0, 5);
    
    if(filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `
            <div class="dropdown-item" onclick="selectMemberForScale('${m.id}', '${m.full_name}')">
                <span class="material-symbols-outlined">person</span> ${m.full_name}
            </div>
        `).join('');
        dropdown.style.display = 'block';
    }
}

let selectedMemberForScale = null;
function selectMemberForScale(id, name) {
    selectedMemberForScale = { id, name };
    document.getElementById('member-scale-dropdown').style.display = 'none';
    document.querySelector('.searchable-select-member .search-input').value = name;
}

function addMemberToScaleDraft() {
    if(!selectedMemberForScale) return;
    const role = document.getElementById('scale-draft-role').value;
    
    if(!scaleDraftTeam.find(m => m.memberId === selectedMemberForScale.id && m.role === role)) {
        scaleDraftTeam.push({...selectedMemberForScale, role});
        renderScaleDraftTeam();
    }
    
    selectedMemberForScale = null;
    document.querySelector('.searchable-select-member .search-input').value = '';
}

function removeScaleDraftMember(index) { scaleDraftTeam.splice(index, 1); renderScaleDraftTeam(); }

function renderScaleDraftTeam() {
    const list = document.getElementById('scale-draft-team-list');
    let html = '';
    scaleDraftTeam.forEach((item, index) => {
        html += `
            <div class="team-member-draft role-${item.role}">
                <span class="material-symbols-outlined">${getRoleIcon(item.role)}</span>
                <span>${item.name}</span>
                <span class="role-tag">${getRoleName(item.role)}</span>
                <button class="btn-remove" onclick="removeScaleDraftMember(${index})"><span class="material-symbols-outlined">close</span></button>
            </div>
        `;
    });
    list.innerHTML = html;
}

async function saveNewScale() {
    const date = document.getElementById('scale-date').value;
    if(!date || scaleDraftTeam.length === 0) { showCustomAlert('Data e equipe são obrigatórios'); return; }

    try {
        const resScale = await fetch(`${SUPABASE_URL}/rest/v1/scales`, { 
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ event_date: date, time_key: date.substring(0,7), created_by: currentUserData.id }) 
        });
        const savedScale = await resScale.json();
        const scaleId = savedScale[0].id;

        for(let item of scaleDraftTeam) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items`, { 
                method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role }) 
            });
        }
        
        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for(let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`, { 
                method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value }) 
            });
        }

        showCustomAlert('Escala criada!', 'Sucesso'); 
        closeModals(); 
        loadScales();
    } catch(e) { showCustomAlert('Erro ao salvar escala.'); }
}

// ==========================================
// ADMINISTRAÇÃO MELHORADA
// ==========================================
function loadAdminDashboard() {
    showAdminSection('new-member');
}

async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase(); 
    const fullname = document.getElementById('new-fullname').value.trim(); 
    const email = document.getElementById('new-email').value.trim();
    const phone = document.getElementById('new-phone').value.trim();
    const role = document.getElementById('new-role').value;
    const isLeader = document.getElementById('new-is-leader').checked; 
    
    if (!username || !fullname) { showCustomAlert('Preencha usuário e nome completo!'); return; }
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                username, 
                full_name: fullname, 
                email: email || null,
                phone: phone || null,
                is_leader: isLeader,
                role: role // Salvando diretamente na tabela members
            }) 
        });
        
        if (!res.ok) throw new Error('Usuário já existe.');
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso'); 
        
        document.getElementById('new-username').value = ''; 
        document.getElementById('new-fullname').value = ''; 
        
    } catch (e) { showCustomAlert(e.message, 'Erro'); }
}

async function loadAdminMembers() {
    const container = document.getElementById('admin-members-list'); 
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // SEM member_roles, resolvendo o bug 400
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,email,phone,is_leader,role&order=full_name.asc`, { headers });
        const members = await res.json(); 
        
        if(members.length === 0) {
            container.innerHTML = '<p style="text-align:center;">Nenhum membro cadastrado.</p>';
            return;
        }
        
        let html = '<div class="admin-members-grid">';
        members.forEach(m => {
            html += `
                <div class="admin-member-card" data-name="${m.full_name.toLowerCase()}">
                    <div class="member-info">
                        <h4>${m.full_name}</h4>
                        <p class="member-username">@${m.username}</p>
                        <div class="member-roles-tags">
                            ${m.is_leader ? '<span class="role-badge leader">Líder</span>' : ''}
                            ${m.role ? `<span class="role-badge">${getRoleName(m.role)}</span>` : ''}
                        </div>
                    </div>
                    <div class="member-actions">
                        <button class="btn-icon danger" onclick="deleteMember('${m.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        
    } catch (e) { container.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro ao carregar lista.</p>'; }
}

function filterAdminMembers() {
    const query = document.getElementById('admin-search').value.toLowerCase();
    document.querySelectorAll('.admin-member-card').forEach(card => {
        card.style.display = card.getAttribute('data-name').includes(query) ? 'flex' : 'none';
    });
}

async function deleteMember(id) {
    if(!confirm('Excluir membro?')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers }); 
    loadAdminMembers(); 
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
window.onload = () => {
    initSupabase();
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { 
        currentUserData = JSON.parse(storedUser); 
        showSystemScreen(); 
    }
};
