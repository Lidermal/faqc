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

function updateHeaderAvatar() {
    const headerAvatar = document.getElementById('header-user-avatar');
    if (headerAvatar && currentUserData) {
        if (currentUserData.photo_url) {
            headerAvatar.src = currentUserData.photo_url;
        } else {
            headerAvatar.src = "logo.png";
        }
    }
}

function showSystemScreen() {
    document.getElementById('login-screen').classList.remove('active'); 
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('system-screen').classList.remove('hidden'); 
    document.getElementById('system-screen').classList.add('active');
    document.getElementById('user-display-name').textContent = currentUserData.full_name;
    updateHeaderAvatar();

    const isLeader = currentUserData.is_leader;
    const isMedia = currentUserData.role === 'midia' || currentUserData.is_media;
    
    if (isLeader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
    } else if (isMedia) {
        document.getElementById('nav-escalas').classList.add('hidden');
        document.getElementById('nav-admin').classList.add('hidden');
        document.getElementById('btn-add-scale').classList.add('hidden');
    } else {
        document.getElementById('btn-add-scale').classList.add('hidden');
    }
    
    document.getElementById('repertoire-actions').classList.remove('hidden');
    navigate('home');
    
    if (!supabaseClient) initSupabase();
    if (supabaseClient) setupRealtimeSubscriptions();
}

function handleLogout() {
    if (realtimeChannels.length > 0 && supabaseClient) {
        realtimeChannels.forEach(ch => {
            try { 
                supabaseClient.removeChannel(ch); 
            } catch(e) {
                console.error('Erro ao remover canal:', e);
            }
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
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('nav-escalas').classList.remove('hidden');
    document.getElementById('btn-add-scale').classList.add('hidden');
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
// SUPABASE REALTIME - 100% AO VIVO
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) {
        console.warn('Realtime não disponível');
        return;
    }

    try {
        const repChannel = supabaseClient
            .channel('repertoire-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, (payload) => {
                if(document.getElementById('page-repertorio').classList.contains('active')) {
                    loadRepertoire();
                }
                if(document.getElementById('drawer-medley').classList.contains('active')) {
                    loadMedleySongsList();
                }
                if(currentViewingRepertoireId && payload.new && payload.new.id == currentViewingRepertoireId) {
                    openViewRepertoire(
                        payload.new.id,
                        payload.new.title,
                        encodeURIComponent(payload.new.lyrics_text || ''),
                        payload.new.is_medley,
                        encodeURIComponent(payload.new.vocalist || '')
                    );
                }
                if(document.getElementById('modal-add-scale').classList.contains('active')) {
                    openScaleModalRefreshSongs();
                }
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        const folderChannel = supabaseClient
            .channel('folder-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => {
                if(document.getElementById('page-repertorio').classList.contains('active')) {
                    loadFolders();
                    loadRepertoire();
                }
            })
            .subscribe();
        realtimeChannels.push(folderChannel);

        const scaleChannel = supabaseClient
            .channel('scale-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, (payload) => {
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchNextScaleHome();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleChannel);

        const scaleItemsChannel = supabaseClient
            .channel('scale-items-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_items' }, (payload) => {
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchNextScaleHome();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleItemsChannel);

        const scaleSongsChannel = supabaseClient
            .channel('scale-songs-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_songs' }, (payload) => {
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleSongsChannel);

        const memberChannel = supabaseClient
            .channel('member-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
                if(document.getElementById('page-membros').classList.contains('active')) {
                    loadMembers();
                }
                if(document.getElementById('page-admin').classList.contains('active')) {
                    loadAdminMembers();
                }
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchNextScaleHome();
                }
                if(currentUserData && payload.new && payload.new.id == currentUserData.id) {
                    currentUserData = payload.new;
                    document.getElementById('user-display-name').textContent = currentUserData.full_name;
                    localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
                    updateHeaderAvatar();
                }
            })
            .subscribe();
        realtimeChannels.push(memberChannel);

        const memberRolesChannel = supabaseClient
            .channel('member-roles-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, (payload) => {
                if(document.getElementById('page-membros').classList.contains('active')) {
                    loadMembers();
                }
                if(document.getElementById('page-admin').classList.contains('active')) {
                    loadAdminMembers();
                }
            })
            .subscribe();
        realtimeChannels.push(memberRolesChannel);
        
        const keyChannel = supabaseClient
            .channel('key-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire_keys' }, (payload) => {
                if(document.getElementById('modal-view-repertoire').classList.contains('active') && 
                   payload.new && payload.new.repertoire_id == currentViewingRepertoireId) {
                    loadKeysForRepertoire(currentViewingRepertoireId);
                }
                if(document.getElementById('page-repertorio').classList.contains('active')) {
                    loadRepertoire();
                }
            })
            .subscribe();
        realtimeChannels.push(keyChannel);
        
        console.log('✅ Realtime subscriptions configuradas');
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

function startCarouselAutoScroll() {
    if(carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        scrollCarousel(1);
    }, 4000);
}

function scrollCarousel(direction) {
    const carousel = document.getElementById('next-scale-team');
    if(carousel) {
        const scrollAmount = 160;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        const currentScroll = carousel.scrollLeft;
        
        if(direction > 0 && currentScroll >= maxScroll - 10) {
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else if(direction < 0 && currentScroll <= 10) {
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
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" }
];

async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    try {
        const customRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${dateString}&select=*`, { headers });
        const customData = await customRes.json();
        if (customData.length > 0) {
            container.innerHTML = `<p>"${customData[0].verse_text}"</p><span class="verse-ref">- ${customData[0].verse_ref}</span>`;
            return;
        }
        const verse = bibleVersesPool[Math.floor(Math.random() * bibleVersesPool.length)];
        container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
    } catch (e) { 
        container.innerHTML = `<p>"Tudo posso naquele que me fortalece."</p><span class="verse-ref">- Filipenses 4:13</span>`;
    }
}

// ==========================================
// AUXILIARES DE FUNÇÃO E ÍCONES
// ==========================================
function getRoleIcon(role) {
    const icons = { 'lider': 'star', 'vocal': 'mic', 'baterista': 'music_note', 'teclado': 'piano', 'violao': 'music_note', 'baixo': 'graphic_eq', 'midia': 'videocam' };
    return icons[role] || 'person';
}

function getRoleName(role) {
    const names = { 'lider': 'Líder', 'vocal': 'Vocal', 'baterista': 'Baterista', 'teclado': 'Teclado', 'violao': 'Violão', 'baixo': 'Baixo', 'midia': 'Mídia' };
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
                    const icon = getRoleIcon(item.role);
                    const roleName = getRoleName(item.role);
                    const photoUrl = item.members.photo_url || null;
                    
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
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Erro ao carregar.</p>`; 
    }
}

// ==========================================
// TELA DE PERFIL (CORRIGIDA E ESTRUTURADA)
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

async function uploadPhoto(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    if(file.size > 3 * 1024 * 1024) {
        showCustomAlert('A foto deve ter no máximo 3MB para otimização de banda.', 'Erro');
        return;
    }
    
    try {
        showCustomAlert('Processando imagem...', 'Aguarde');
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64String = reader.result;
            
            // Salvando diretamente no banco Supabase Rest API
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ photo_url: base64String })
            });
            
            if(!res.ok) throw new Error('Falha ao atualizar a imagem no servidor');
            
            currentUserData.photo_url = base64String;
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            updateHeaderAvatar();
            showCustomAlert('Foto atualizada com sucesso!', 'Sucesso');
            loadProfile();
        }
        reader.readAsDataURL(file);
    } catch(e) {
        showCustomAlert('Erro ao processar imagem: ' + e.message, 'Erro');
    }
}

async function updateProfile() {
    const fullname = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    
    if(!fullname) {
        showCustomAlert('Nome completo é obrigatório.', 'Erro');
        return;
    }
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ full_name: fullname, email: email || null, phone: phone || null })
        });
        
        if(!res.ok) throw new Error('Erro na gravação');
        
        currentUserData.full_name = fullname;
        currentUserData.email = email || null;
        currentUserData.phone = phone || null;
        localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
        
        document.getElementById('user-display-name').textContent = fullname;
        showCustomAlert('Perfil salvo com sucesso!', 'Sucesso');
    } catch(e) {
        showCustomAlert('Erro ao atualizar perfil.', 'Erro');
    }
}

// ==========================================
// MOTOR DE BUSCA REFEITO E À PROVA DE FALHAS
// ==========================================
async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { 
        showCustomAlert('Digite o nome do louvor ou cantor.'); 
        return; 
    }
    
    msgBox.innerHTML = '<span style="color:var(--primary-color);">🔍 Fazendo varredura completa na internet...</span>';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    try {
        // Busca na API do Vagalume por termos genéricos
        const targetUrl = `https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(query)}&limit=8`;
        const res = await fetch(targetUrl);
        const data = await res.json();
        
        if (data.response && data.response.docs) {
            const songDocs = data.response.docs.filter(doc => doc.type === 'v');
            
            if(songDocs.length === 0) {
                // Fallback: Tentativa direta via Lyrics.ovh
                msgBox.innerHTML = '<span style="color:var(--danger);">⚠️ Buscando via motor alternativo...</span>';
                const parts = query.split('-');
                const art = parts[1] ? parts[1].trim() : 'Gospel';
                const sng = parts[0] ? parts[0].trim() : query;
                
                const ovhRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(art)}/${encodeURIComponent(sng)}`);
                if(ovhRes.ok) {
                    const ovhData = await ovhRes.json();
                    if(ovhData.lyrics) {
                        renderDirectResult(sng, art, ovhData.lyrics, resultsContainer, msgBox);
                        return;
                    }
                }
                msgBox.innerHTML = '<span style="color:var(--danger);">❌ Nenhuma música encontrada. Insira os dados manualmente.</span>';
                return;
            }
            
            for(let doc of songDocs) {
                const songTitle = doc.title;
                const artistName = doc.band;
                const uid = `id_${doc.id}`;
                
                // Buscar Letra Completa na API de Letras do Vagalume
                const lyricsRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistName)}&mus=${encodeURIComponent(songTitle)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);
                if(lyricsRes.ok) {
                    const lyricsData = await lyricsRes.json();
                    if(lyricsData.type === 'exact' || lyricsData.type === 'approximate') {
                        const lyricText = lyricsData.mus[0].text;
                        
                        cachedLyricsSearch[uid] = {
                            song: songTitle,
                            artist: artistName,
                            lyrics: lyricText,
                            // Geração inteligente do link do Youtube com base no título e artista
                            ytLink: `https://www.youtube.com/results?search_query=${encodeURIComponent(songTitle + ' ' + artistName + ' louvor')}`
                        };
                        
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'search-result-item';
                        itemDiv.innerHTML = `
                            <div style="flex:1; min-width:0;">
                                <strong>${songTitle}</strong>
                                <small style="display:block; color:var(--text-muted);">${artistName}</small>
                                <div style="margin-top:5px; display:flex; gap:8px;">
                                    <a href="${cachedLyricsSearch[uid].ytLink}" target="_blank" style="color:red; font-size:0.75rem; display:flex; align-items:center; gap:2px; text-decoration:none;" onclick="event.stopPropagation();">
                                        <span class="material-symbols-outlined" style="font-size:0.9rem;">video_library</span> Vídeo/Youtube
                                    </a>
                                </div>
                            </div>
                            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; height:fit-content;">📥 Importar</button>
                        `;
                        itemDiv.onclick = () => {
                            document.getElementById('rep-lyrics').value = cachedLyricsSearch[uid].lyrics;
                            document.getElementById('rep-title').value = `${cachedLyricsSearch[uid].song} - ${cachedLyricsSearch[uid].artist}`;
                            showCustomAlert('Letra e vínculo importados com sucesso!', 'Sucesso');
                        };
                        resultsContainer.appendChild(itemDiv);
                    }
                }
            }
            msgBox.innerHTML = `<span style="color:var(--success);">✅ Busca concluída com sucesso!</span>`;
        } else {
            msgBox.innerHTML = '<span style="color:var(--danger);">❌ Falha nos motores de busca.</span>';
        }
    } catch(e) {
        msgBox.innerHTML = '<span style="color:var(--danger);">❌ Nenhuma resposta da rede.</span>';
    }
}

function renderDirectResult(song, artist, lyrics, container, msgBox) {
    const uid = "direct_1";
    cachedLyricsSearch[uid] = { song, artist, lyrics };
    const itemDiv = document.createElement('div');
    itemDiv.className = 'search-result-item';
    itemDiv.innerHTML = `
        <div style="flex:1;">
            <strong>${song}</strong>
            <small style="display:block; color:var(--text-muted);">${artist}</small>
        </div>
        <button class="btn-secondary">Importar Letra</button>
    `;
    itemDiv.onclick = () => {
        document.getElementById('rep-lyrics').value = lyrics;
        document.getElementById('rep-title').value = `${song} - ${artist}`;
    };
    container.appendChild(itemDiv);
    msgBox.innerHTML = `<span style="color:var(--success);">✅ Encontrado via motor secundário!</span>`;
}

// ==========================================
// MEMBROS E LINHAGEM
// ==========================================
async function loadMembers() {
    const container = document.getElementById('members-lineup');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,email,phone,is_leader,role,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        
        if (members.length === 0) { 
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">Nenhum membro cadastrado.</p>'; 
            return; 
        }
        
        const leaders = members.filter(m => m.is_leader);
        const vocals = members.filter(m => !m.is_leader && m.member_roles && m.member_roles.some(r => r.role === 'vocal'));
        const band = members.filter(m => !m.is_leader && (!m.member_roles || !m.member_roles.some(r => r.role === 'vocal')));
        
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
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:40px;">Erro ao carregar equipe.</p>`; 
    }
}

function createMemberCard(member, type) {
    const photoUrl = member.photo_url || null;
    const roles = member.member_roles ? member.member_roles.map(r => r.role) : [];
    
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
            </div>
            <div class="member-card-body">
                <h3 class="member-name">${member.full_name}</h3>
                <div class="member-roles">
                    ${member.is_leader ? '<span class="role-badge leader">Líder</span>' : ''}
                    ${roles.map(r => `<span class="role-badge ${r}">${getRoleName(r)}</span>`).join('')}
                </div>
                ${member.phone ? `<p class="member-contact"><span class="material-symbols-outlined">phone</span> ${member.phone}</p>` : ''}
            </div>
        </div>
    `;
}

// ==========================================
// RESTANTE DAS FUNÇÕES DO SISTEMA (PRESERVADAS)
// ==========================================
async function loadFolders() {
    const container = document.getElementById('folders-list');
    if(!container) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=*,members!created_by(full_name)&order=name.asc`, { headers });
        const folders = await res.json();
        allFoldersCache = folders;
        let html = `<button class="folder-item ${currentFolderId === null ? 'active' : ''}" onclick="selectFolder(null)"><span class="material-symbols-outlined">folder</span><div class="folder-info"><span>Pasta Geral</span><small>Todas as músicas</small></div></button>`;
        folders.forEach(folder => {
            const canEdit = folder.created_by === currentUserData.id || currentUserData.is_leader;
            html += `<div class="folder-wrapper"><button class="folder-item ${currentFolderId === folder.id ? 'active' : ''}" onclick="selectFolder('${folder.id}')"><span class="material-symbols-outlined">folder</span><div class="folder-info"><span>${folder.name}</span><small>Por: ${folder.members ? folder.members.full_name : 'Membro'}</small></div></button>${canEdit ? `<button class="btn-folder-delete" onclick="deleteFolder('${folder.id}')"><span class="material-symbols-outlined">delete</span></button>` : ''}</div>`;
        });
        if(currentUserData.is_leader) {
            html += `<button class="btn-create-folder" onclick="openCreateFolderModal()"><span class="material-symbols-outlined">create_new_folder</span>Nova Pasta</button>`;
        }
        container.innerHTML = html;
    } catch (e) { console.error(e); }
}

function selectFolder(folderId) { currentFolderId = folderId; loadFolders(); loadRepertoire(); }

async function openCreateFolderModal() {
    const name = prompt('Nome da nova pasta:');
    if(!name) return;
    await fetch(`${SUPABASE_URL}/rest/v1/folders`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ name, created_by: currentUserData.id })});
    loadFolders();
}

async function deleteFolder(id) {
    if(!confirm('Deseja excluir a pasta? As músicas voltarão para a geral.')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire?folder_id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ folder_id: null })});
    await fetch(`${SUPABASE_URL}/rest/v1/folders?id=eq.${id}`, { method: 'DELETE', headers });
    loadFolders(); loadRepertoire();
}

async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    if(!list) return;
    list.innerHTML = '<div class="loading-spinner"></div>';
    try {
        let query = `${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton),members!created_by(full_name)`;
        if(currentFolderId) query += `&folder_id=eq.${currentFolderId}`;
        query += '&order=title.asc';
        const res = await fetch(query, { headers });
        allRepertoireCache = await res.json();
        if(allRepertoireCache.length === 0) { list.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum louvor por aqui.</p>'; return; }
        let html = '';
        allRepertoireCache.forEach(song => {
            let tons = (song.repertoire_keys || []).map(k => `<span class="badge tom">${k.ton}</span>`).join(' ');
            const canEdit = song.created_by === currentUserData.id || currentUserData.is_leader;
            html += `
                <div class="playlist-item" onclick="openViewRepertoire('${song.id}', \`${song.title}\`, \`${encodeURIComponent(song.lyrics_text || '')}\`, ${song.is_medley}, \`${encodeURIComponent(song.vocalist || '')}\`)">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">music_note</span></div>
                        <div class="play-title"><h4>${song.title}</h4><p>${song.vocalist ? '🎤 '+song.vocalist : 'Louvor'}</p></div>
                    </div>
                    <div class="play-keys">${tons}</div>
                    ${canEdit ? `<button class="btn-edit-rep" onclick="event.stopPropagation(); deleteRepertoire('${song.id}')"><span class="material-symbols-outlined">delete</span></button>` : ''}
                </div>`;
        });
        list.innerHTML = html;
    } catch(e) { list.innerHTML = '<p>Erro ao carregar repertório.</p>'; }
}

async function deleteRepertoire(id) {
    if(!confirm('Excluir este louvor permanentemente?')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, { method: 'DELETE', headers });
    loadRepertoire();
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    const vocalist = document.getElementById('rep-vocalist').value.trim();
    
    if(!title || !lyrics) { showCustomAlert('Título e Letra obrigatórios!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ title, lyrics_text: lyrics, created_by: currentUserData.id, vocalist: vocalist || null, folder_id: currentFolderId || null }) 
        });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey })});
        }
        closeModals(); loadRepertoire();
    } catch(e) { console.error(e); }
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
            <label>🎤 Ministro / Voz Principal:</label>
            <div style="display:flex; gap:8px; margin-top:5px;">
                <input type="text" id="edit-vocalist-input" value="${currentVocalist}" placeholder="Ex: Ana Silva" style="flex:1; padding:8px; border-radius:6px; border:1px solid #ccc;">
                <button class="btn-secondary" onclick="saveVocalistToRepertoire('${id}')">💾 Salvar</button>
            </div>
        </div>
    `;
    document.getElementById('box-add-key').classList.remove('hidden');
    loadKeysForRepertoire(id);
}

async function saveVocalistToRepertoire(id) {
    const name = document.getElementById('edit-vocalist-input').value.trim();
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ vocalist: name || null })});
    showCustomAlert('Cantor atualizado!'); loadRepertoire();
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys'); 
    container.innerHTML = '';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
    const keys = await res.json();
    keys.forEach(k => {
        container.innerHTML += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} <span style="cursor:pointer; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span></span>`;
    });
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if(!newKey || !currentViewingRepertoireId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey })});
    document.getElementById('new-key-input').value = ''; loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire();
}

async function deleteKey(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${id}`, { method: 'DELETE', headers });
    loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire();
}

// ARQUIVAMENTO DE BUSCAS SECUNDÁRIAS DE CANTOR
async function searchVocalists(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('vocalist-dropdown');
    if(query.length < 2) { dropdown.style.display = 'none'; return; }
    if(allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
        allMembersCache = await res.json();
    }
    const filtered = allMembersCache.filter(m => m.full_name.toLowerCase().includes(query));
    if(filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `<div class="dropdown-item" onclick="selectVocalist('${m.id}', '${m.full_name}')">${m.full_name}</div>`).join('');
        dropdown.style.display = 'block';
    } else { dropdown.style.display = 'none'; }
}

function selectVocalist(id, name) {
    document.getElementById('rep-vocalist').value = name;
    document.getElementById('selected-vocalists').innerHTML = `<span class="selected-item">${name}</span>`;
    document.getElementById('vocalist-dropdown').style.display = 'none';
}

// ESCALAS
function switchScaleTab(tab) {
    document.getElementById('tab-future').classList.remove('active');
    document.getElementById('tab-past').classList.remove('active');
    document.getElementById('scales-list-future').classList.add('hidden');
    document.getElementById('scales-list-past').classList.add('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('scales-list-' + tab).classList.remove('hidden');
}

async function loadScales() {
    const fContainer = document.getElementById('scales-list-future');
    const pContainer = document.getElementById('scales-list-past');
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title,repertoire_keys(ton),vocalist))&order=event_date.asc`, { headers });
        const scales = await res.json();
        const today = new Date().toISOString().split('T')[0];
        
        const futures = scales.filter(s => s.event_date >= today);
        const pasts = scales.filter(s => s.event_date < today).reverse();
        
        fContainer.innerHTML = renderScaleCards(futures, true);
        pContainer.innerHTML = renderScaleCards(pasts, false);
    } catch(e) { fContainer.innerHTML = '<p>Erro ao processar escalas.</p>'; }
}

function renderScaleCards(scaleArray, isFuture) {
    if(scaleArray.length === 0) return '<p style="padding:20px; text-align:center; color:var(--text-muted);">Nenhuma escala registrada.</p>';
    let html = '';
    scaleArray.forEach(s => {
        let team = s.scale_items.map(i => `<div class="scale-team-member"><span class="scale-team-name">${i.members.full_name}</span><span class="scale-team-role">${getRoleName(i.role)}</span></div>`).join('');
        let songs = s.scale_songs.map(sg => `<div class="scale-song-item"><span class="scale-song-name">${sg.repertoire.title}</span></div>`).join('');
        
        html += `
            <div class="scale-card">
                <div class="scale-card-header">
                    <div class="scale-folder-date"><div><div class="scale-folder-date-text">${s.event_date}</div><div class="scale-folder-notes">${s.notes || ''}</div></div></div>
                    ${currentUserData.is_leader ? `<button class="btn-icon danger" onclick="deleteScale('${s.id}')"><span class="material-symbols-outlined">delete</span></button>` : ''}
                </div>
                <div class="scale-card-body">
                    <div class="scale-team-section">${team}</div>
                    <div class="scale-songs-section">${songs || 'Nenhuma música vinculada.'}</div>
                </div>
            </div>
        `;
    });
    return html;
}

async function deleteScale(id) {
    if(!confirm('Deseja deletar permanentemente esta escala?')) return;
    await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${id}`, { method: 'DELETE', headers });
    await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${id}`, { method: 'DELETE', headers });
    loadScales();
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title&order=title.asc`, { headers });
    allRepertoireCache = await res.json();
    const container = document.getElementById('scale-songs-selectors');
    container.innerHTML = allRepertoireCache.map(s => `<label class="song-checkbox"><input type="checkbox" value="${s.id}" class="scale-song-cb"> <span>${s.title}</span></label>`).join('');
}

async function searchMembersForScale(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('member-scale-dropdown');
    if(query.length < 2) { dropdown.style.display = 'none'; return; }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`, { headers });
    const members = await res.json();
    const filtered = members.filter(m => m.full_name.toLowerCase().includes(query));
    dropdown.innerHTML = filtered.map(m => `<div class="dropdown-item" onclick="addMemberToDraft('${m.id}','${m.full_name}')">${m.full_name}</div>`).join('');
    dropdown.style.display = 'block';
}

function addMemberToDraft(id, name) {
    const role = document.getElementById('scale-draft-role').value;
    scaleDraftTeam.push({ memberId: id, name, role });
    renderScaleDraftTeam();
    document.getElementById('member-scale-dropdown').style.display = 'none';
}

function renderScaleDraftTeam() {
    document.getElementById('scale-draft-team-list').innerHTML = scaleDraftTeam.map((m, idx) => `<div>${m.name} (${getRoleName(m.role)}) <button onclick="scaleDraftTeam.splice(${idx},1); renderScaleDraftTeam();">✕</button></div>`).join('');
}

async function saveNewScale() {
    const date = document.getElementById('scale-date').value;
    const notes = document.getElementById('scale-notes').value;
    if(!date) return;
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scales`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ event_date: date, notes, time_key: date.substring(0,7), created_by: currentUserData.id })});
    const scale = await res.json();
    const scaleId = scale[0].id;
    
    for(let item of scaleDraftTeam) {
        await fetch(`${SUPABASE_URL}/rest/v1/scale_items`, { method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role })});
    }
    const cbs = document.querySelectorAll('.scale-song-cb:checked');
    for(let cb of cbs) {
        await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`, { method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value })});
    }
    closeModals(); loadScales();
}

function loadAdminDashboard() { showAdminSection('new-member'); }

async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase();
    const full_name = document.getElementById('new-fullname').value.trim();
    const role = document.getElementById('new-role').value;
    const is_leader = document.getElementById('new-is-leader').checked;
    
    if(!username || !full_name) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ username, full_name, is_leader, role: role === 'midia' ? 'midia' : null })});
    if(res.ok) { showCustomAlert('Membro salvo!'); closeModals(); }
}

// INICIALIZADOR GLOBAL
window.onload = () => {
    initSupabase();
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { 
        currentUserData = JSON.parse(storedUser); 
        showSystemScreen(); 
    }
};
