// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFicmFvcmFv...'; // Mantenha sua key original
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
        if (callback) callback();
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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members?username=eq.${usernameInput}&select=id,username,full_name,is_leader,role`, {
            method: 'GET',
            headers
        });
        const data = await response.json();
        if (data.length > 0) {
            currentUserData = data[0];
            // Busca dados completos em segunda chamada (campos opcionais)
            try {
                const fullRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}&select=*,photo_url,email,phone`, { headers });
                if (fullRes.ok) {
                    const fullData = await fullRes.json();
                    if (fullData.length > 0) currentUserData = { ...currentUserData, ...fullData[0] };
                }
            } catch (e) { /* ignora se campos opcionais não existirem */ }
            
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
    updateHeaderUserInfo();

    const isLeader = currentUserData.is_leader;
    const isMedia = currentUserData.role === 'midia';

    if (isLeader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
        document.getElementById('repertoire-actions').classList.remove('hidden');
        document.getElementById('nav-escalas').classList.remove('hidden');
    } else if (isMedia) {
        document.getElementById('nav-admin').classList.add('hidden');
        document.getElementById('nav-escalas').classList.add('hidden');
        document.getElementById('btn-add-scale').classList.add('hidden');
        document.getElementById('repertoire-actions').classList.remove('hidden');
    } else {
        document.getElementById('nav-admin').classList.add('hidden');
        document.getElementById('btn-add-scale').classList.add('hidden');
        document.getElementById('nav-escalas').classList.remove('hidden');
        document.getElementById('repertoire-actions').classList.remove('hidden');
    }

    navigate('home');
    if (!supabaseClient) initSupabase();
    if (supabaseClient) setupRealtimeSubscriptions();
}

function updateHeaderUserInfo() {
    const displayName = document.getElementById('user-display-name');
    const headerPhoto = document.getElementById('header-user-photo');
    if (displayName) displayName.textContent = currentUserData.full_name;
    
    if (headerPhoto && currentUserData.photo_url) {
        headerPhoto.src = currentUserData.photo_url;
        headerPhoto.style.display = 'block';
    } else if (headerPhoto) {
        headerPhoto.style.display = 'none';
    }
}

function handleLogout() {
    if (realtimeChannels.length > 0 && supabaseClient) {
        realtimeChannels.forEach(ch => {
            try { supabaseClient.removeChannel(ch); } catch (e) { }
        });
        realtimeChannels = [];
    }
    if (carouselInterval) {
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
    
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('nav-escalas').classList.remove('hidden');
    document.getElementById('btn-add-scale').classList.add('hidden');
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + pageId);
    if (targetNav) targetNav.classList.add('active');

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
        if (!m.classList.contains('custom-alert-modal')) m.classList.remove('active');
    });
    document.getElementById('drawer-medley').classList.remove('active');
    document.getElementById('drawer-medley-overlay').classList.remove('active');
    const editingField = document.getElementById('editing-scale-id');
    if (editingField) editingField.value = '';
    const modalTitle = document.getElementById('scale-modal-title');
    if (modalTitle) modalTitle.textContent = 'Nova Escala';
    resetMedleyFlow();
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    const targetSection = document.getElementById('admin-' + section);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        if (section === 'manage-members') loadAdminMembers();
        if (section === 'stats') loadAdminStats();
    }
}

// ==========================================
// SUPABASE REALTIME
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;
    try {
        const memberChannel = supabaseClient
            .channel('member-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
                if (document.getElementById('page-membros').classList.contains('active')) loadMembers();
                if (document.getElementById('page-admin').classList.contains('active')) loadAdminMembers();
                if (currentUserData && payload.new && payload.new.id == currentUserData.id) {
                    currentUserData = payload.new;
                    localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
                    updateHeaderUserInfo();
                    if(document.getElementById('page-perfil').classList.contains('active')) loadProfile();
                }
            })
            .subscribe();
        realtimeChannels.push(memberChannel);
        
        const repChannel = supabaseClient
            .channel('repertoire-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, (payload) => {
                if (document.getElementById('page-repertorio').classList.contains('active')) {
                    loadRepertoire();
                }
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        const folderChannel = supabaseClient
            .channel('folder-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, (payload) => {
                if (document.getElementById('page-repertorio').classList.contains('active')) {
                    loadFolders();
                    loadRepertoire();
                }
            })
            .subscribe();
        realtimeChannels.push(folderChannel);

        console.log('✅ Realtime configurado');
    } catch (e) {
        console.error('Erro realtime:', e);
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

function startCarouselAutoScroll() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        scrollCarousel(1);
    }, 4000);
}

function scrollCarousel(direction) {
    const carousel = document.getElementById('next-scale-team');
    if (carousel) {
        const scrollAmount = 160;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        const currentScroll = carousel.scrollLeft;
        if (direction > 0 && currentScroll >= maxScroll - 10) {
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (direction < 0 && currentScroll <= 10) {
            carousel.scrollTo({ left: maxScroll, behavior: 'smooth' });
        } else {
            carousel.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    }
}

// ==========================================
// MENSAGEM DO DIA
// ==========================================
const bibleVersesPool = [
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" }
];

async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    const today = new Date().toISOString().split('T')[0];
    try {
        const customRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${today}&select=verse_text,verse_ref`, { headers });
        const customData = await customRes.json();
        if (customData.length > 0) {
            container.innerHTML = `<p>"${customData[0].verse_text}"</p><span class="verse-ref">- ${customData[0].verse_ref}</span>`;
            return;
        }
    } catch (e) { }
    
    const randomVerse = bibleVersesPool[Math.floor(Math.random() * bibleVersesPool.length)];
    container.innerHTML = `<p>"${randomVerse.text}"</p><span class="verse-ref">- ${randomVerse.ref}</span>`;
}

// ==========================================
// ÍCONES E NOMES
// ==========================================
function getRoleIcon(role) {
    const icons = {
        'lider': 'star', 'vocal': 'mic', 'baterista': 'music_note',
        'teclado': 'piano', 'violao': 'music_note', 'baixo': 'graphic_eq', 'midia': 'videocam'
    };
    return icons[role] || 'person';
}

function getRoleName(role) {
    const names = {
        'lider': 'Líder', 'vocal': 'Vocal', 'baterista': 'Baterista',
        'teclado': 'Teclado', 'violao': 'Violão', 'baixo': 'Baixo', 'midia': 'Mídia'
    };
    return names[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Membro');
}

async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/rest/v1/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        const scaleData = await scaleRes.json();
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}&select=role,members(id,full_name,photo_url)`, { headers });
            const itemsData = await itemsRes.json();
            
            if (itemsData.length > 0) {
                let html = '';
                itemsData.forEach(item => {
                    const isCurrent = item.members.id === currentUserData.id ? 'current-user' : '';
                    const icon = getRoleIcon(item.role); 
                    const roleName = getRoleName(item.role);
                    const photoUrl = item.members.photo_url;

                    html += `
                    <div class="team-carousel-card ${isCurrent}">
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
    }
}

// ==========================================
// PERFIL
// ==========================================
async function loadProfile() {
    const container = document.getElementById('profile-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-photo-wrapper">
                    ${currentUserData.photo_url ?
                    `<img src="${currentUserData.photo_url}" alt="${currentUserData.full_name}" class="profile-photo" id="current-photo">` :
                    `<div class="photo-placeholder-large">${currentUserData.full_name.charAt(0)}</div>`
                }
                    <label for="photo-upload" class="photo-upload-btn" title="Alterar foto">
                        <span class="material-symbols-outlined">camera_alt</span>
                    </label>
                    <input type="file" id="photo-upload" accept="image/*" style="display:none" onchange="uploadPhoto(event)">
                </div>
                <h2>${currentUserData.full_name}</h2>
                <p class="profile-username">@${currentUserData.username}</p>
                <div class="profile-badges">
                    ${currentUserData.is_leader ? '<span class="badge-role leader">Líder</span>' : ''}
                    ${currentUserData.role === 'midia' ? '<span class="badge-role">Mídia</span>' : ''}
                    ${!currentUserData.is_leader && currentUserData.role !== 'midia' ? `<span class="badge-role">${getRoleName(currentUserData.role || 'membro')}</span>` : ''}
                </div>
            </div>
            <div class="profile-body">
                <div class="profile-section">
                    <h3>Informações Pessoais</h3>
                    <div class="form-grid">
                        <div class="input-group">
                            <label>Nome Completo</label>
                            <input type="text" id="profile-fullname" value="${currentUserData.full_name || ''}">
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

async function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showCustomAlert('A foto deve ter no máximo 5MB.', 'Erro');
        return;
    }
    
    try {
        if (!supabaseClient) {
            showCustomAlert('Erro de inicialização. Recarregue a página.', 'Erro');
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUserData.id}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabaseClient.storage
            .from('member-photos')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('member-photos')
            .getPublicUrl(fileName);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ photo_url: publicUrl })
        });
        
        if (!res.ok) throw new Error('Erro ao atualizar banco');
        
        currentUserData.photo_url = publicUrl;
        localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
        updateHeaderUserInfo();
        showCustomAlert('Foto atualizada com sucesso!', 'Sucesso');
        loadProfile();
    } catch (e) {
        console.error('Erro upload:', e);
        if (e.message.includes('not found') || e.message.includes('not_found')) {
             showCustomAlert('Erro: Bucket "member-photos" não existe no Supabase. Peça ao administrador para criá-lo.', 'Erro de Configuração');
        } else {
            showCustomAlert('Erro ao fazer upload: ' + e.message, 'Erro');
        }
    }
}

async function updateProfile() {
    const fullname = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    
    if (!fullname) {
        showCustomAlert('Nome completo é obrigatório.', 'Erro');
        return;
    }
    try {
        const updateData = { full_name: fullname };
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateData)
        });
        if (!res.ok) throw new Error('Erro ao atualizar');
        
        currentUserData.full_name = fullname;
        if (email) currentUserData.email = email;
        if (phone) currentUserData.phone = phone;
        localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
        updateHeaderUserInfo();
        showCustomAlert('Perfil atualizado com sucesso!', 'Sucesso');
    } catch (e) {
        showCustomAlert('Erro ao atualizar perfil.', 'Erro');
    }
}

// ==========================================
// MEMBROS (CORRIGIDO - QUERY DEFENSIVA)
// ==========================================
async function loadMembers() {
    const container = document.getElementById('members-lineup');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        let members = [];
        
        // Tentativa 1: Query completa
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,email,phone,is_leader,role&order=full_name.asc`, { 
                headers,
                'Prefer': 'return=representation'
            });
            
            if (res.ok) {
                members = await res.json();
            } else if (res.status === 400) {
                console.warn('⚠️ Query completa falhou (400), tentando query mínima...');
                const resMin = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`, { headers });
                if (resMin.ok) members = await resMin.json();
            }
        } catch (e) {
            console.warn('⚠️ Erro na query completa, tentando fallback:', e.message);
            const resMin = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`, { headers });
            if (resMin.ok) members = await resMin.json();
        }
        
        if (members.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">Nenhum membro cadastrado.</p>';
            return;
        }
        
        const leaders = members.filter(m => m.is_leader);
        const vocals = members.filter(m => !m.is_leader && m.role === 'vocal');
        const band = members.filter(m => !m.is_leader && m.role !== 'vocal' && m.role !== 'midia');
        const media = members.filter(m => m.role === 'midia');
        
        let html = '';
        if (leaders.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">👑 Liderança</h3><div class="members-cards-grid">';
            leaders.forEach(m => { html += createMemberCard(m, 'leader'); });
            html += '</div></div>';
        }
        if (vocals.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">🎤 Vocal</h3><div class="members-cards-grid">';
            vocals.forEach(m => { html += createMemberCard(m, 'vocal'); });
            html += '</div></div>';
        }
        if (band.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">🎸 Banda</h3><div class="members-cards-grid">';
            band.forEach(m => { html += createMemberCard(m, 'band'); });
            html += '</div></div>';
        }
        if (media.length > 0) {
            html += '<div class="members-section"><h3 class="section-title">📹 Mídia</h3><div class="members-cards-grid">';
            media.forEach(m => { html += createMemberCard(m, 'media'); });
            html += '</div></div>';
        }
        container.innerHTML = html;
        
    } catch (e) {
        console.error('❌ Erro crítico ao carregar membros:', e);
        container.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <p style="color:var(--danger); margin-bottom:10px;">⚠️ Não foi possível carregar a equipe</p>
                <p style="color:var(--text-muted); font-size:0.9rem;">${e.message}</p>
                <button class="btn-secondary" onclick="loadMembers()" style="margin-top:15px;">🔄 Tentar novamente</button>
            </div>
        `;
    }
}

function createMemberCard(member, type) {
    const photoUrl = member.photo_url || null;
    const role = member.role || 'membro';
    const email = member.email || null;
    const phone = member.phone || null;
    
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
                    ${email ? `<a href="mailto:${email}" class="social-link" title="Email"><span class="material-symbols-outlined">mail</span></a>` : ''}
                    ${phone ? `<a href="tel:${phone}" class="social-link" title="Telefone"><span class="material-symbols-outlined">phone</span></a>` : ''}
                </div>
            </div>
            <div class="member-card-body">
                <h3 class="member-name">${member.full_name}</h3>
                <div class="member-roles">
                    ${member.is_leader ? '<span class="role-badge leader">Líder</span>' : ''}
                    ${role ? `<span class="role-badge ${role}">${getRoleName(role)}</span>` : ''}
                </div>
                ${email ? `<p class="member-contact"><span class="material-symbols-outlined">mail</span> ${email}</p>` : ''}
                ${phone ? `<p class="member-contact"><span class="material-symbols-outlined">phone</span> ${phone}</p>` : ''}
            </div>
        </div>
    `;
}

// ==========================================
// PASTAS DO REPERTÓRIO
// ==========================================
async function loadFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;
    
    try {
        let folders = [];
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=*,members!created_by(full_name)&order=is_general.desc,name.asc`, { headers });
            folders = await res.json();
            allFoldersCache = folders;
        } catch(e) {
            console.warn('Tabela de pastas não encontrada ou erro:', e);
        }

        let html = `
        <div class="folder-wrapper">
            <button class="folder-item ${currentFolderId === null ? 'active' : ''}" onclick="selectFolder(null)">
                <span class="material-symbols-outlined">folder_special</span>
                <div class="folder-info">
                    <span>Pasta Geral</span>
                    <small>Todas as músicas</small>
                </div>
            </button>
        </div>
        `;

        folders.forEach(folder => {
            const creatorName = folder.members ? folder.members.full_name : 'Membro';
            const canEdit = currentUserData.is_leader || (folder.created_by === currentUserData.id);
            
            html += `
            <div class="folder-wrapper">
                <button class="folder-item ${currentFolderId === folder.id ? 'active' : ''}" onclick="selectFolder('${folder.id}')">
                    <span class="material-symbols-outlined">folder</span>
                    <div class="folder-info">
                        <span>${folder.name}</span>
                        <small>Por: ${creatorName}</small>
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

        if (currentUserData.is_leader) {
            html += `
            <button class="btn-create-folder" onclick="openCreateFolderModal()">
                <span class="material-symbols-outlined">create_new_folder</span>
                Nova Pasta
            </button>
            `;
        }
        container.innerHTML = html;

    } catch (e) {
        console.error('Erro ao carregar pastas:', e);
    }
}

function selectFolder(folderId) {
    currentFolderId = folderId;
    loadFolders();
    loadRepertoire();
}

async function openCreateFolderModal() {
    const existingFolder = allFoldersCache.find(f => f.created_by === currentUserData.id);
    if (existingFolder) {
        showCustomAlert('Você já possui uma pasta pessoal. Se quiser criar outra, entre em contato com um líder.', 'Atenção');
        return;
    }

    const name = prompt(`Qual será o nome da sua pasta? (Ex: ${currentUserData.full_name})`);
    if (!name) return;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/folders`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({
                name: name,
                created_by: currentUserData.id,
                is_general: false
            })
        });
        loadFolders();
        showCustomAlert('Pasta criada com sucesso!', 'Sucesso');
    } catch (e) {
        console.error('Erro ao criar pasta:', e);
        showCustomAlert('Erro ao criar pasta.', 'Erro');
    }
}

async function deleteFolder(folderId) {
    if (!confirm('Deseja excluir esta pasta? As músicas voltarão para a Pasta Geral.')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire?folder_id=eq.${folderId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ folder_id: null })
        });
        await fetch(`${SUPABASE_URL}/rest/v1/folders?id=eq.${folderId}`, {
            method: 'DELETE',
            headers
        });
        loadFolders();
        loadRepertoire();
        showCustomAlert('Pasta excluída!', 'Sucesso');
    } catch (e) {
        console.error('Erro ao excluir pasta:', e);
    }
}

// ==========================================
// BUSCA DE LETRAS
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
    selectedVocalists = [];
    updateSelectedVocalists();
}

function normalizeText(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractLyricsFromLetras(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            const element = doc.querySelector('.lyrics-container') || doc.querySelector('.letra') || doc.querySelector('#letra');
            if (element) {
                let lyrics = element.innerText || element.textContent;
                lyrics = lyrics.replace(/\s+/g, '\n').trim();
                if (lyrics.length > 50) return lyrics;
            }
        }
    } catch (e) {
        console.warn('Erro extração letras:', e);
    }
    return null;
}

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if (!query) return;
    msgBox.innerHTML = '<span style="color:var(--primary-color);">🔍 Buscando...</span>';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    let foundAnyValid = false;
    
    try {
        try {
            const letrasRes = await fetch(`https://www.letras.mus.br/api/autocomplete?q=${encodeURIComponent(query)}&limit=10`);
            if (letrasRes.ok) {
                const letrasData = await letrasRes.json();
                if (letrasData && letrasData.length > 0) {
                    for (let item of letrasData.slice(0, 5)) {
                        const artist = item.artista || '';
                        const song = item.nome || '';
                        if (artist && song) {
                            let lyrics = await extractLyricsFromLetras(item.url);
                            if (lyrics) {
                                foundAnyValid = true;
                                const id = `letras_${Math.random()}`;
                                cachedLyricsSearch[id] = { artist, song, lyrics, source: 'Letras.mus.br' };
                                addSearchResultToDOM(song, artist, id);
                            }
                        }
                    }
                }
            }
        } catch (e) { console.warn('Letras.mus.br falhou', e); }

        if (!foundAnyValid) {
             try {
                const vagRes = await fetch(`https://api.vagalume.com.br/search.php?exc=${encodeURIComponent(query)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);
                if(vagRes.ok) {
                    const data = await vagRes.json();
                    if(data.art) {
                        for(let artist of data.art) {
                            if(artist.mus) {
                                for(let mus of artist.mus) {
                                    if(mus.text) {
                                        const id = `vag_${Math.random()}`;
                                        cachedLyricsSearch[id] = { artist: artist.name, song: mus.title || mus.desc, lyrics: mus.text, source: 'Vagalume' };
                                        addSearchResultToDOM(mus.title, artist.name, id);
                                        foundAnyValid = true;
                                    }
                                }
                            }
                        }
                    }
                }
             } catch(e) { console.warn('Vagalume falhou', e); }
        }

        if (!foundAnyValid) {
            msgBox.innerHTML = '<span style="color:var(--danger);">❌ Não encontramos a letra automaticamente.</span>';
        } else {
            msgBox.innerHTML = '<span style="color:var(--success);">✅ Resultados encontrados!</span>';
        }
    } catch (e) {
        msgBox.innerHTML = '<span style="color:var(--danger);">❌ Erro na busca.</span>';
    }
}

function addSearchResultToDOM(song, artist, id) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
        <div style="flex:1; min-width:0;">
            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${song}</strong>
            <small style="color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${artist}</small>
        </div>
        <span class="material-symbols-outlined" style="color:var(--primary-color);">download</span>
    `;
    div.onclick = () => importPreCheckedLyrics(id);
    document.getElementById('search-results').appendChild(div);
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`Letra de "${data.song}" importada!`, "Sucesso");
}

async function searchVocalists(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('vocalist-dropdown');
    if (query.length < 2) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }
    
    if (allMembersCache.length === 0) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
            allMembersCache = await res.json();
        } catch(e) {}
    }
    
    const filtered = allMembersCache.filter(m => m.full_name.toLowerCase().includes(query)).slice(0, 5);
    if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `
            <div class="dropdown-item" onclick="selectVocalist('${m.id}', '${m.full_name}')">
                <span class="material-symbols-outlined">person</span>
                ${m.full_name}
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div class="dropdown-empty">Nenhum membro encontrado</div>';
        dropdown.style.display = 'block';
    }
}

function selectVocalist(id, name) {
    if (!selectedVocalists.find(v => v.id === id)) selectedVocalists.push({ id, name });
    updateSelectedVocalists();
    document.getElementById('vocalist-dropdown').style.display = 'none';
    document.querySelector('.searchable-select .search-input').value = '';
}

function removeVocalist(id) {
    selectedVocalists = selectedVocalists.filter(v => v.id !== id);
    updateSelectedVocalists();
}

function updateSelectedVocalists() {
    const container = document.getElementById('selected-vocalists');
    document.getElementById('rep-vocalist').value = selectedVocalists.map(v => v.name).join(', ');
    if (selectedVocalists.length > 0) {
        container.innerHTML = selectedVocalists.map(v => `
            <span class="selected-item">
                ${v.name}
                <span class="remove-item" onclick="removeVocalist('${v.id}')">×</span>
            </span>
        `).join('');
    } else {
        container.innerHTML = '';
    }
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    const vocalist = document.getElementById('rep-vocalist').value.trim();

    if (!title || !lyrics) {
        showCustomAlert('Título e Letra são obrigatórios!');
        return;
    }

    try {
        const folderId = currentFolderId || null;
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({
                title,
                lyrics_text: lyrics,
                created_by: currentUserData.id,
                vocalist: vocalist || null,
                folder_id: folderId
            })
        });
        const savedData = await res.json();
        if (initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, {
                method: 'POST', headers,
                body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey })
            });
        }
        showCustomAlert('Música salva com sucesso!', "Sucesso");
        closeModals();
        loadRepertoire();
    } catch (e) {
        console.error('Erro ao salvar:', e);
        showCustomAlert('Erro ao salvar no banco.');
    }
}

// ==========================================
// REPERTÓRIO COM PASTAS
// ==========================================
async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-spinner"></div>';

    try {
        let query = `${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton),members!created_by(full_name)`;
        if (currentFolderId) {
            query += `&folder_id=eq.${currentFolderId}`;
        }
        query += '&order=title.asc';
        
        const res = await fetch(query, { headers });
        if (!res.ok) throw new Error('Erro ao buscar repertório');
        
        allRepertoireCache = await res.json();

        if (allRepertoireCache.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Nenhuma música nesta pasta.</p>';
            return;
        }

        let html = '';
        allRepertoireCache.forEach(song => {
            let keysHtml = '';
            if (song.repertoire_keys) {
                song.repertoire_keys.forEach(k => { keysHtml += `<span class="badge tom">${k.ton}</span>`; });
            }

            let vocalistHtml = '';
            if (song.vocalist) {
                vocalistHtml = `<div class="vocalist-badge"><span class="material-symbols-outlined" style="font-size:0.9rem;">mic</span> ${song.vocalist}</div>`;
            }

            const ownerName = song.members ? song.members.full_name : '';
            
            const isSongOwner = song.created_by === currentUserData.id;
            let isFolderOwner = false;
            if (currentFolderId && allFoldersCache.length > 0) {
                const currentFolderObj = allFoldersCache.find(f => f.id === currentFolderId);
                if (currentFolderObj && currentFolderObj.created_by === currentUserData.id) isFolderOwner = true;
            }
            
            const canEdit = isSongOwner || isFolderOwner || currentUserData.is_leader;

            html += `
                <div class="playlist-item" onclick="${canEdit ? `openViewRepertoire('${song.id}', \`${song.title.replace(/`/g, "'")}\`, \`${encodeURIComponent(song.lyrics_text || '')}\`, ${song.is_medley || false}, \`${encodeURIComponent(song.vocalist || '')}\`)` : ''}">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">${song.is_medley ? 'queue_music' : 'music_note'}</span></div>
                        <div class="play-title">
                            <h4>${song.title}</h4>
                            <p>${song.is_medley ? 'Medley' : 'Louvor'} ${vocalistHtml}</p>
                            ${ownerName ? `<small style="color:var(--text-muted); font-size:0.7rem;">Por: ${ownerName}</small>` : ''}
                        </div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                    ${canEdit ? `<button class="btn-edit-rep" onclick="event.stopPropagation(); deleteRepertoire('${song.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>` : ''}
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error('Erro ao carregar repertório:', e);
        list.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro ao carregar.</p>';
    }
}

async function deleteRepertoire(id) {
    if (!confirm('Deseja excluir esta música?')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, { method: 'DELETE', headers });
        loadRepertoire();
        showCustomAlert('Música excluída!', 'Sucesso');
    } catch (e) {
        showCustomAlert('Erro ao excluir.', 'Erro');
    }
}

// ==========================================
// MEDLEY
// ==========================================
function openMedleyModal() {
    document.getElementById('drawer-medley').classList.add('active');
    document.getElementById('drawer-medley-overlay').classList.add('active');
    resetMedleyFlow();
    loadMedleySongsList();
}
function resetMedleyFlow() {
    medleyDraft = [];
    medleyCurrentSongId = null;
    medleyCurrentSongVerses = [];
    renderMedleyPreview();
    document.getElementById('medley-title').value = '';
    document.getElementById('medley-verses-selector').innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Selecione uma música ao lado</p>';
}

async function loadMedleySongsList() {
    const container = document.getElementById('medley-songs-list');
    container.innerHTML = '<p class="loading-text">Carregando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton)&is_medley=eq.false&order=title.asc`, { headers });
        const songs = await res.json();
        allRepertoireCache = songs;
        if (songs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Nenhuma música</p>';
            return;
        }
        let html = '';
        songs.forEach(song => {
            const isSelected = medleyDraft.some(d => d.songId === song.id);
            html += `
                <div class="medley-song-item ${isSelected ? 'active' : ''}" onclick="selectMedleySong('${song.id}')">
                    <div class="medley-song-item-title">${song.title}</div>
                    ${isSelected ? '<div style="font-size:0.75rem; color:var(--success); margin-top:4px;">✓ Adicionada</div>' : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--danger);">Erro ao carregar</p>';
    }
}

async function selectMedleySong(songId) {
    medleyCurrentSongId = songId;
    const song = allRepertoireCache.find(s => s.id === songId);
    if (!song) return;
    const verses = parseLyricsIntoVerses(song.lyrics_text);
    const existingDraft = medleyDraft.find(d => d.songId === songId);
    medleyCurrentSongVerses = verses.map((v, idx) => ({
        ...v,
        id: `${songId}_v${idx}`,
        selected: existingDraft ? existingDraft.sections.some(s => s.label === v.label && s.content === v.content) : false
    }));
    renderVersesSelector(song.title);
}

function parseLyricsIntoVerses(lyrics) {
    if (!lyrics) return [];
    const lines = lyrics.split('\n');
    const verses = [];
    let currentLabel = 'Intro';
    let currentLines = [];
    
    const sectionPatterns = [/^(intro|introdução)/i, /^(verso|verse)/i, /^(pr[eé]-?refr[aã]o)/i, /^(refr[aã]o)/i, /^(ponte|bridge)/i, /^(final|outro)/i];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let newSection = null;
        
        for (let p of sectionPatterns) {
            if (p.test(line.trim())) {
                newSection = line.trim().replace(/[:\[\]()]/g, '');
                break;
            }
        }
        
        if (newSection) {
            if (currentLines.length > 0) verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
            currentLabel = newSection;
            currentLines = [];
        } else if (line.trim() !== '') {
            currentLines.push(line);
        }
    }
    if (currentLines.length > 0) verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
    return verses;
}

function renderVersesSelector(songTitle) {
    const container = document.getElementById('medley-verses-selector');
    if (medleyCurrentSongVerses.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Não foi possível identificar as partes.</p>';
        return;
    }
    let html = `
        <div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
            <strong style="color:var(--primary-color);">${songTitle}</strong>
        </div>
        <button class="btn-secondary" onclick="selectAllVerses()" style="width:100%; margin-bottom:10px; font-size:0.85rem;">✓ Selecionar Todas</button>
    `;
    medleyCurrentSongVerses.forEach((verse, idx) => {
        html += `
            <div class="verse-selector-item ${verse.selected ? 'selected' : ''}" id="verse-item-${idx}">
                <div class="verse-checkbox-wrapper">
                    <input type="checkbox" class="verse-checkbox" id="verse-cb-${idx}" ${verse.selected ? 'checked' : ''} onchange="toggleVerse(${idx})">
                    <div class="verse-label" onclick="toggleVerse(${idx})">
                        <div class="verse-section-title">${verse.label}</div>
                        <div class="verse-content">${verse.content}</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += `<button class="btn-primary" onclick="addSelectedVersesToMedley()" style="margin-top:12px;">+ Adicionar ao Medley</button>`;
    container.innerHTML = html;
}

function toggleVerse(idx) {
    medleyCurrentSongVerses[idx].selected = !medleyCurrentSongVerses[idx].selected;
    const item = document.getElementById(`verse-item-${idx}`);
    const cb = document.getElementById(`verse-cb-${idx}`);
    if (medleyCurrentSongVerses[idx].selected) { item.classList.add('selected'); cb.checked = true; }
    else { item.classList.remove('selected'); cb.checked = false; }
}

function selectAllVerses() {
    const allSelected = medleyCurrentSongVerses.every(v => v.selected);
    medleyCurrentSongVerses.forEach((v, idx) => {
        v.selected = !allSelected;
        const item = document.getElementById(`verse-item-${idx}`);
        const cb = document.getElementById(`verse-cb-${idx}`);
        if (v.selected) { item.classList.add('selected'); cb.checked = true; }
        else { item.classList.remove('selected'); cb.checked = false; }
    });
}

function addSelectedVersesToMedley() {
    const selectedVerses = medleyCurrentSongVerses.filter(v => v.selected);
    if (selectedVerses.length === 0) { showCustomAlert('Selecione pelo menos uma parte.'); return; }
    const song = allRepertoireCache.find(s => s.id === medleyCurrentSongId);
    medleyDraft = medleyDraft.filter(d => d.songId !== medleyCurrentSongId);
    medleyDraft.push({ songId: medleyCurrentSongId, songTitle: song.title, sections: selectedVerses.map(v => ({ label: v.label, content: v.content })) });
    renderMedleyPreview();
    loadMedleySongsList();
    showCustomAlert(`${selectedVerses.length} parte(s) adicionada(s)!`, 'Sucesso');
}

function removeMedleySong(songId) {
    medleyDraft = medleyDraft.filter(d => d.songId !== songId);
    renderMedleyPreview();
    loadMedleySongsList();
}

function renderMedleyPreview() {
    const container = document.getElementById('medley-preview');
    if (medleyDraft.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">O medley aparecerá aqui</p>';
        return;
    }
    let html = '<div class="medley-preview-content">';
    let totalParts = 0;
    medleyDraft.forEach((item, idx) => {
        html += `<div class="medley-preview-song">
            <div class="medley-preview-song-title">
                <span class="material-symbols-outlined" style="font-size:1.1rem;">queue_music</span>
                ${idx + 1}. ${item.songTitle}
                <span class="material-symbols-outlined" style="color:var(--danger); cursor:pointer; font-size:1.1rem; margin-left:auto;" onclick="removeMedleySong('${item.songId}')">delete</span>
            </div>`;
        item.sections.forEach(section => {
            totalParts++;
            html += `<div class="medley-preview-section">
                <div class="medley-preview-section-label">${section.label}</div>
                <div class="medley-preview-section-content">${section.content}</div>
            </div>`;
        });
        html += '</div>';
    });
    html += `</div>
    <div style="margin-top:12px; padding:10px; background:#e3f2fd; border-radius:8px; font-size:0.85rem;">
        <strong>Resumo:</strong> ${medleyDraft.length} música(s), ${totalParts} parte(s)
    </div>`;
    container.innerHTML = html;
}

async function saveNewMedley() {
    const title = document.getElementById('medley-title').value.trim();
    if (!title) { showCustomAlert('Dê um nome ao Medley.'); return; }
    if (medleyDraft.length < 2) { showCustomAlert('O Medley precisa de pelo menos 2 músicas.'); return; }
    
    try {
        const folderId = currentFolderId || null;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, {
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ title: title, is_medley: true, created_by: currentUserData.id, lyrics_text: generateMedleyLyrics(), folder_id: folderId })
        });
        const savedMedley = await res.json();
        const medleyId = savedMedley[0].id;
        for (let item of medleyDraft) {
            for (let section of item.sections) {
                await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ medley_repertoire_id: medleyId, song_repertoire_id: item.songId, section: section.label, section_content: section.content })
                });
            }
        }
        showCustomAlert('Medley criado com sucesso!', 'Sucesso');
        closeModals();
        loadRepertoire();
    } catch (e) {
        console.error(e);
        showCustomAlert('Erro ao salvar medley.');
    }
}

function generateMedleyLyrics() {
    let lyrics = '';
    medleyDraft.forEach((item, idx) => {
        lyrics += `\n=== ${item.songTitle} ===\n`;
        item.sections.forEach(section => { lyrics += `[${section.label}]\n${section.content}\n`; });
    });
    return lyrics.trim();
}

async function openViewRepertoire(id, title, encodedLyrics, isMedley, encodedVocalist = '') {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    const vocalistDisplay = document.getElementById('view-rep-vocalist');
    const currentVocalist = encodedVocalist ? decodeURIComponent(encodedVocalist) : '';
    vocalistDisplay.innerHTML = `
        <div class="vocalist-editor">
            <label><span class="material-symbols-outlined" style="font-size:1rem; vertical-align:middle;">mic</span> Voz / Cantor:</label>
            <div style="display:flex; gap:8px; margin-top:5px;">
                <input type="text" id="edit-vocalist-input" value="${currentVocalist}" placeholder="Ex: Ana Silva" style="flex:1; padding:8px; border-radius:6px; border:1px solid #ccc;">
                <button class="btn-secondary" onclick="saveVocalistToRepertoire('${id}')" style="padding:8px 12px;">💾</button>
            </div>
        </div>
    `;
    document.getElementById('box-add-key').classList.remove('hidden');
    loadKeysForRepertoire(id);
    
    const partsDisplay = document.getElementById('medley-parts-display');
    if (isMedley) {
        partsDisplay.classList.remove('hidden');
        partsDisplay.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,section_content,repertoire!song_repertoire_id(title)&order=created_at.asc`, { headers });
            const parts = await res.json();
            if (parts.length > 0) {
                let html = '<strong>Estrutura do Medley:</strong><br>';
                parts.forEach((p, idx) => {
                    html += `<div style="padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
                        <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em>
                        <span style="color:var(--primary-color); font-weight:600;">→ ${p.section}</span>
                    </div>`;
                });
                partsDisplay.innerHTML = html;
            }
        } catch (e) { partsDisplay.innerHTML = 'Erro ao carregar estrutura.'; }
    } else {
        partsDisplay.classList.add('hidden');
    }
}

async function saveVocalistToRepertoire(id) {
    const input = document.getElementById('edit-vocalist-input');
    if (!input) return;
    const newVocalist = input.value.trim();
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, {
            method: 'PATCH', headers, body: JSON.stringify({ vocalist: newVocalist || null })
        });
        if (res.ok) { showCustomAlert('Voz/Cantor atualizado!', 'Sucesso'); loadRepertoire(); }
        else showCustomAlert('Erro ao atualizar.');
    } catch (e) { showCustomAlert('Erro de conexão.'); }
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys');
    container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        let html = '';
        keys.forEach(k => {
            html += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} <span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span></span>`;
        });
        container.innerHTML = html;
    } catch (e) { }
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if (!newKey || !currentViewingRepertoireId) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, {
            method: 'POST', headers,
            body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey })
        });
        document.getElementById('new-key-input').value = '';
        loadKeysForRepertoire(currentViewingRepertoireId);
        loadRepertoire();
    } catch (e) { showCustomAlert('Erro ao adicionar tom.'); }
}

async function deleteKey(keyId) {
    showCustomConfirm('Deseja remover este tom?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers });
            loadKeysForRepertoire(currentViewingRepertoireId);
            loadRepertoire();
        } catch (e) { }
    });
}

// ==========================================
// ESCALAS
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
    } catch (e) {
        console.error('Erro ao carregar escalas:', e);
        listFuture.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro ao carregar.</p>';
    }
}

function renderScaleCards(scaleArray, isFuture) {
    if (scaleArray.length === 0) return '<p style="text-align:center; color:var(--text-muted); padding:40px;">' + (isFuture ? 'Nenhuma escala programada.' : 'Histórico vazio.') + '</p>';
    let html = '';
    scaleArray.forEach(s => {
        const dateObj = new Date(s.event_date);
        const dateStr = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
        
        let teamHtml = '<div class="scale-team-section">';
        teamHtml += '<h4 class="scale-section-title"><span class="material-symbols-outlined">group</span> Equipe</h4>';
        teamHtml += '<div class="scale-team-list">';
        s.scale_items.forEach(item => {
            const icon = getRoleIcon(item.role);
            const roleName = getRoleName(item.role);
            const photoUrl = item.members.photo_url;
            
            teamHtml += `
                <div class="scale-team-member">
                    <div class="scale-team-photo">
                        ${photoUrl ?
                    `<img src="${photoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="photo-placeholder" style="display:none">${item.members.full_name.charAt(0)}</div>` :
                    `<div class="photo-placeholder">${item.members.full_name.charAt(0)}</div>`
                }
                    </div>
                    <span class="material-symbols-outlined scale-team-icon">${icon}</span>
                    <div class="scale-team-info">
                        <span class="scale-team-name">${item.members.full_name}</span>
                        <span class="scale-team-role">${roleName}</span>
                    </div>
                </div>
            `;
        });
        teamHtml += '</div></div>';

        let songsHtml = '<div class="scale-songs-section">';
        songsHtml += '<h4 class="scale-section-title"><span class="material-symbols-outlined">library_music</span> Repertório</h4>';
        songsHtml += '<div class="scale-songs-list">';
        if (s.scale_songs.length > 0) {
            s.scale_songs.forEach(song => {
                const keys = song.repertoire.repertoire_keys || [];
                const keysStr = keys.length > 0 ? keys.map(k => k.ton).join(', ') : '';
                const keyBadge = keysStr ? `<span class="badge tom">${keysStr}</span>` : '';
                const vocalistBadge = song.repertoire.vocalist ? `<span class="vocalist-mini"><span class="material-symbols-outlined" style="font-size:0.8rem;">mic</span> ${song.repertoire.vocalist}</span>` : '';
                songsHtml += `
                    <div class="scale-song-item">
                        <span class="material-symbols-outlined scale-song-icon">music_note</span>
                        <span class="scale-song-name">${song.repertoire.title}</span>
                        <div class="scale-song-badges">${keyBadge} ${vocalistBadge}</div>
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
    showCustomConfirm('Deseja realmente excluir esta escala?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}`, { method: 'DELETE', headers });
            showCustomAlert('Escala excluída!', 'Sucesso');
            loadScales();
            if (document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
        } catch (e) { showCustomAlert('Erro ao excluir escala.'); }
    });
}

async function openEditScaleModal(scaleId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}&select=*,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`, { headers });
        const data = await res.json();
        if (data.length === 0) { showCustomAlert('Escala não encontrada.'); return; }
        const scale = data[0];
        document.getElementById('modal-add-scale').classList.add('active');
        document.getElementById('editing-scale-id').value = scaleId;
        document.getElementById('scale-modal-title').textContent = 'Editar Escala';
        document.getElementById('scale-date').value = scale.event_date;
        document.getElementById('scale-notes').value = scale.notes || '';
        scaleDraftTeam = scale.scale_items.map(i => ({ memberId: i.member_id, role: i.role, name: i.members.full_name }));
        renderScaleDraftTeam();
        
        if (allMembersCache.length === 0) {
            const resMem = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
            allMembersCache = await resMem.json();
        }
        if (allRepertoireCache.length === 0) {
            const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
            allRepertoireCache = await resRep.json();
        }
        
        const songsContainer = document.getElementById('scale-songs-selectors');
        const selectedSongIds = scale.scale_songs.map(s => s.repertoire_id);
        songsContainer.innerHTML = '';
        allRepertoireCache.forEach(song => {
            const checked = selectedSongIds.includes(song.id) ? 'checked' : '';
            const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
            songsContainer.innerHTML += `<label class="song-checkbox"><input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}><span>${song.title}</span>${vocalistInfo}</label>`;
        });
    } catch (e) { showCustomAlert('Erro ao carregar escala para edição.'); }
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    document.getElementById('editing-scale-id').value = '';
    document.getElementById('scale-modal-title').textContent = 'Nova Escala';
    scaleDraftTeam = [];
    renderScaleDraftTeam();
    if (allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
        allMembersCache = await res.json();
    }
    if (allRepertoireCache.length === 0) {
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
        allRepertoireCache = await resRep.json();
    }
    const songsContainer = document.getElementById('scale-songs-selectors');
    songsContainer.innerHTML = '';
    allRepertoireCache.forEach(song => {
        const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
        songsContainer.innerHTML += `<label class="song-checkbox"><input type="checkbox" value="${song.id}" class="scale-song-cb"><span>${song.title}</span>${vocalistInfo}</label>`;
    });
}

function searchMembersForScale(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('member-scale-dropdown');
    if (query.length < 2) { dropdown.style.display = 'none'; return; }
    const filtered = allMembersCache.filter(m => m.full_name.toLowerCase().includes(query)).slice(0, 5);
    if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `<div class="dropdown-item" onclick="selectMemberForScale('${m.id}', '${m.full_name}')"><span class="material-symbols-outlined">person</span> ${m.full_name}</div>`).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div class="dropdown-empty">Nenhum membro encontrado</div>';
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
    if (!selectedMemberForScale) { showCustomAlert('Selecione um membro da lista.'); return; }
    const role = document.getElementById('scale-draft-role').value;
    if (!scaleDraftTeam.find(m => m.memberId === selectedMemberForScale.id && m.role === role)) {
        scaleDraftTeam.push({ ...selectedMemberForScale, role });
        renderScaleDraftTeam();
    } else {
        showCustomAlert('Este membro já está na equipe com esta função.');
    }
    selectedMemberForScale = null;
    document.querySelector('.searchable-select-member .search-input').value = '';
}

function removeScaleDraftMember(index) {
    scaleDraftTeam.splice(index, 1);
    renderScaleDraftTeam();
}

function renderScaleDraftTeam() {
    const list = document.getElementById('scale-draft-team-list');
    if (scaleDraftTeam.length === 0) {
        list.innerHTML = '<p class="loading-text" style="font-size:0.85rem; text-align:center;">Nenhum membro adicionado.</p>';
        return;
    }
    let html = '';
    scaleDraftTeam.forEach((item, index) => {
        html += `
            <div class="team-member-draft">
                <span class="material-symbols-outlined">${getRoleIcon(item.role)}</span>
                <span>${item.name}</span>
                <span class="role-tag">${getRoleName(item.role)}</span>
                <button class="btn-remove" onclick="removeScaleDraftMember(${index})"><span class="material-symbols-outlined">close</span></button>
            </div>
        `;
    });
    list.innerHTML = html;
}

function searchScaleSongs(input) {
    const query = input.value.toLowerCase();
    document.querySelectorAll('.song-checkbox').forEach(cb => {
        cb.style.display = cb.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
    });
}

async function saveNewScale() {
    const date = document.getElementById('scale-date').value;
    const notes = document.getElementById('scale-notes').value;
    const editingId = document.getElementById('editing-scale-id').value;
    if (!date) { showCustomAlert('A data do culto é obrigatória.'); return; }
    if (scaleDraftTeam.length === 0) { showCustomAlert('Adicione pelo menos 1 membro na equipe.'); return; }
    try {
        let scaleId;
        if (editingId) {
            await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${editingId}`, {
                method: 'PATCH', headers,
                body: JSON.stringify({ event_date: date, notes: notes, time_key: date.substring(0, 7) })
            });
            scaleId = editingId;
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
        } else {
            const resScale = await fetch(`${SUPABASE_URL}/rest/v1/scales`, {
                method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
                body: JSON.stringify({ time_key: date.substring(0, 7), event_date: date, notes: notes, created_by: currentUserData.id })
            });
            const savedScale = await resScale.json();
            scaleId = savedScale[0].id;
        }
        for (let item of scaleDraftTeam) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items`, {
                method: 'POST', headers,
                body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role })
            });
        }
        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for (let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`, {
                method: 'POST', headers,
                body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value })
            });
        }
        showCustomAlert(editingId ? 'Escala atualizada!' : 'Escala criada!', 'Sucesso');
        closeModals();
        loadScales();
        if (document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
    } catch (e) {
        console.error('Erro ao salvar escala:', e);
        showCustomAlert('Erro ao salvar escala.');
    }
}

// ==========================================
// ADMINISTRAÇÃO
// ==========================================
function loadAdminDashboard() {
    showAdminSection('new-member');
}

async function loadAdminStats() {
    const container = document.getElementById('admin-stats-content');
    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
        const [membersRes, repRes, scalesRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/members?select=id`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id`, { headers }),
            fetch(`${SUPABASE_URL}/rest/v1/scales?select=id`, { headers })
        ]);
        const members = await membersRes.json();
        const repertoire = await repRes.json();
        const scales = await scalesRes.json();
        
        container.innerHTML = `
            <div class="stat-card"><div class="stat-icon" style="background: linear-gradient(135deg, #f05a28, #d94d1f);"><span class="material-symbols-outlined">group</span></div><div class="stat-content"><h3>${members.length}</h3><p>Membros</p></div></div>
            <div class="stat-card"><div class="stat-icon" style="background: linear-gradient(135deg, #6c5ce7, #a29bfe);"><span class="material-symbols-outlined">library_music</span></div><div class="stat-content"><h3>${repertoire.length}</h3><p>Músicas</p></div></div>
            <div class="stat-card"><div class="stat-icon" style="background: linear-gradient(135deg, #00b894, #55efc4);"><span class="material-symbols-outlined">calendar_month</span></div><div class="stat-content"><h3>${scales.length}</h3><p>Escalas</p></div></div>
        `;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--danger); text-align:center;">Erro ao carregar estatísticas.</p>';
    }
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
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({ username, full_name: fullname, email: email || null, phone: phone || null, is_leader: isLeader, role: role })
        });
        if (!res.ok) throw new Error('Usuário já existe.');
        const saved = await res.json();
        
        if (role !== 'midia') {
            await fetch(`${SUPABASE_URL}/rest/v1/folders`, {
                method: 'POST', headers,
                body: JSON.stringify({ name: `Repertório de ${fullname}`, created_by: saved[0].id, is_general: false })
            });
        }
        
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso');
        ['new-username', 'new-fullname', 'new-email', 'new-phone'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('new-is-leader').checked = false;
    } catch (e) {
        console.error('Erro ao cadastrar:', e);
        showCustomAlert(e.message, 'Erro');
    }
}

// ==========================================
// ADMIN - MEMBROS (CORRIGIDO - QUERY DEFENSIVA)
// ==========================================
async function loadAdminMembers() {
    const container = document.getElementById('admin-members-list');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        let members = [];
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,email,phone,is_leader,role&order=full_name.asc`, { 
                headers,
                'Prefer': 'return=representation'
            });
            
            if (res.ok) {
                members = await res.json();
            } else if (res.status === 400) {
                console.warn('⚠️ Query admin falhou (400), tentando query mínima...');
                const resMin = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`, { headers });
                if (resMin.ok) members = await resMin.json();
            }
        } catch (e) {
            console.warn('⚠️ Fallback para query mínima:', e.message);
            const resMin = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`, { headers });
            if (resMin.ok) members = await resMin.json();
        }
        
        if (members.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Nenhum membro cadastrado.</p>';
            return;
        }
        
        let html = '<div class="admin-members-grid">';
        members.forEach(m => {
            const email = m.email || '';
            const role = m.role || '';
            
            html += `
                <div class="admin-member-card" data-name="${(m.full_name || '').toLowerCase()}">
                    <div class="member-info">
                        <h4>${m.full_name || 'Sem nome'}</h4>
                        <p class="member-username">@${m.username || 'sem.usuario'}</p>
                        ${email ? `<p class="member-contact"><span class="material-symbols-outlined">mail</span> ${email}</p>` : ''}
                        <div class="member-roles-tags">
                            ${m.is_leader ? '<span class="role-badge leader">Líder</span>' : ''}
                            ${role ? `<span class="role-badge">${getRoleName(role)}</span>` : ''}
                        </div>
                    </div>
                    <div class="member-actions">
                        <button class="btn-icon" onclick="editMember('${m.id}')" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon danger" onclick="deleteMember('${m.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        
    } catch (e) {
        console.error('❌ Erro ao carregar membros no admin:', e);
        container.innerHTML = `
            <p style="text-align:center; color:var(--danger); padding:40px;">
                Erro ao carregar lista.<br>
                <small>${e.message}</small><br>
                <button class="btn-secondary" onclick="loadAdminMembers()" style="margin-top:10px;">🔄 Recarregar</button>
            </p>
        `;
    }
}

function filterAdminMembers() {
    const query = document.getElementById('admin-search').value.toLowerCase();
    document.querySelectorAll('.admin-member-card').forEach(card => {
        card.style.display = card.getAttribute('data-name').includes(query) ? 'flex' : 'none';
    });
}

async function editMember(id) {
    showCustomAlert('Função de edição em desenvolvimento. Use o cadastro para adicionar novos membros.');
}

async function deleteMember(id) {
    showCustomConfirm('Deseja remover este membro?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers });
            showCustomAlert('Membro excluído!', 'Sucesso');
            loadAdminMembers();
        } catch (e) { showCustomAlert('Erro ao excluir membro.'); }
    });
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
