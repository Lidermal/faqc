// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// Helper para log de erros do Supabase
function logSupabaseError(endpoint, response) {
    response.clone().text().then(text => {
        console.error(`❌ Erro Supabase em ${endpoint}:`, response.status, text);
    }).catch(() => {
        console.error(`❌ Erro Supabase em ${endpoint}:`, response.status);
    });
}

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
        console.error(' Erro ao inicializar Supabase:', e);
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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members?username=eq.${encodeURIComponent(usernameInput)}&select=*`, {
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
    updateHeaderUserInfo();

    const isLeader = currentUserData.is_leader;
    const isMedia = currentUserData.role === 'midia';

    // Prepara o container de ações, mas mantém escondido inicialmente
    const actionsContainer = document.getElementById('repertoire-actions');
    if (actionsContainer) {
        // Remove classes que possam esconder, mas aplica display none inline para controle total via JS
        actionsContainer.classList.remove('hidden');
        actionsContainer.style.display = 'none'; 
    }

    if (isLeader || isMedia) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
        document.getElementById('nav-escalas').classList.remove('hidden');
    } else {
        document.getElementById('nav-admin').classList.add('hidden');
        document.getElementById('nav-escalas').classList.add('hidden');
        document.getElementById('btn-add-scale').classList.add('hidden');
    }

    navigate('home');
    if (!supabaseClient) initSupabase();
    if (supabaseClient) setupRealtimeSubscriptions();
}

// Função auxiliar robusta para mostrar/esconder botões
function updateAddButtonsVisibility(show) {
    const actionsContainer = document.getElementById('repertoire-actions');
    if (actionsContainer) {
        if (show) {
            // Força a exibição usando !important via style inline
            actionsContainer.style.setProperty('display', 'flex', 'important');
        } else {
            actionsContainer.style.display = 'none';
        }
    }
}

function updateHeaderUserInfo() {
    const displayName = document.getElementById('user-display-name');
    const headerPhoto = document.getElementById('header-user-photo');
    if (displayName) displayName.textContent = currentUserData.full_name || 'Usuário';
    
    if (headerPhoto) {
        if (currentUserData.photo_url) {
            headerPhoto.src = currentUserData.photo_url;
            headerPhoto.style.display = 'block';
        } else {
            headerPhoto.style.display = 'none';
        }
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
        goBackToFolders(); 
    } else if (pageId === 'escalas') {
        loadScales();
    } else if (pageId === 'perfil') {
        loadProfile();
    }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => {
        if (!m.classList.contains('custom-alert-modal') && !m.classList.contains('custom-input-modal')) m.classList.remove('active');
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
                    if(document.getElementById('repertoire-list').style.display === 'block') loadRepertoire();
                }
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        const folderChannel = supabaseClient
            .channel('folder-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, (payload) => {
                if (document.getElementById('page-repertorio').classList.contains('active')) {
                    if(document.getElementById('folders-list').style.display === 'block') loadFolders();
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
        if (diff < 0) { document.getElementById('countdown-timer').textContent = "00d 00h 00m 00s"; return; }
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
    if (!carousel) return;
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

// ==========================================
// MENSAGEM DO DIA
// ==========================================
async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${today}&select=verse_text,verse_ref`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.length > 0) {
                container.innerHTML = `<p>"${data[0].verse_text}"</p><span class="verse-ref">- ${data[0].verse_ref}</span>`;
                return;
            }
        }
    } catch (e) { console.warn('Não foi possível buscar mensagem do Supabase'); }
    
    try {
        const seed = today.split('-').join('').slice(-4);
        const verses = [
            { t: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", r: "João 3:16" },
            { t: "O Senhor é o meu pastor; nada me faltará.", r: "Salmos 23:1" },
            { t: "Tudo posso naquele que me fortalece.", r: "Filipenses 4:13" },
            { t: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", r: "Salmos 37:5" },
            { t: "Posso todas as coisas naquele que me fortalece.", r: "Filipenses 4:13" },
            { t: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", r: "Salmos 46:1" },
            { t: "O amor é paciente, o amor é bondoso.", r: "1 Coríntios 13:4" }
        ];
        const verse = verses[parseInt(seed) % verses.length];
        container.innerHTML = `<p>"${verse.t}"</p><span class="verse-ref">- ${verse.r}</span>`;
    } catch (e) {
        container.innerHTML = `<p>"Deus é o nosso refúgio e fortaleza."</p><span class="verse-ref">- Salmos 46:1</span>`;
    }
}

// ==========================================
// ÍCONES E NOMES
// ==========================================
function getRoleIcon(role) {
    const icons = {
        'lider': 'star', 'vocal': 'mic', 'baterista': 'music_note',
        'teclado': 'piano', 'violao': 'music_note', 'baixo': 'graphic_eq', 'midia': 'videocam'
    };
    return icons[role || 'vocal'] || 'person';
}

function getRoleName(role) {
    const names = {
        'lider': 'Líder', 'vocal': 'Vocal', 'baterista': 'Baterista',
        'teclado': 'Teclado', 'violao': 'Violão', 'baixo': 'Baixo', 'midia': 'Mídia'
    };
    return names[role || 'vocal'] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Membro');
}

async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/rest/v1/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        if (!scaleRes.ok) { throw new Error('Erro ao buscar escala'); }
        const scaleData = await scaleRes.json();
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}&select=role,members(id,full_name,photo_url)`, { headers });
            const itemsData = await itemsRes.json();
            
            if (itemsData.length > 0) {
                let html = '';
                itemsData.forEach(item => {
                    const isCurrent = item.members && item.members.id === currentUserData.id ? 'current-user' : '';
                    const icon = getRoleIcon(item.role); 
                    const roleName = getRoleName(item.role);
                    const photoUrl = item.members ? item.members.photo_url : null;
                    const fullName = item.members ? item.members.full_name : 'Desconhecido';

                    html += `
                    <div class="team-carousel-card ${isCurrent}">
                        <div class="team-card-photo">
                            ${photoUrl ?
                        `<img src="${photoUrl}" alt="${fullName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <div class="photo-placeholder" style="display:none">${fullName.charAt(0)}</div>` :
                        `<div class="photo-placeholder">${fullName.charAt(0)}</div>`
                    }
                            <div class="team-card-icon">
                                <span class="material-symbols-outlined">${icon}</span>
                            </div>
                        </div>
                        <div class="team-card-info">
                            <div class="team-card-name">${fullName}</div>
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
        console.error('Erro ao carregar escala home:', e);
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px;">Erro ao carregar equipe.</p>`;
    }
}

// ==========================================
// PERFIL + UPLOAD DE FOTO
// ==========================================
async function loadProfile() {
    const container = document.getElementById('profile-container');
    if (!container) return;
    
    const emailValue = currentUserData.email || '';
    const phoneValue = currentUserData.phone || '';
    
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-photo-wrapper">
                    ${currentUserData.photo_url ?
                    `<img src="${currentUserData.photo_url}" alt="${currentUserData.full_name}" class="profile-photo" id="current-photo">` :
                    `<div class="photo-placeholder-large">${(currentUserData.full_name || 'U').charAt(0)}</div>`
                }
                    <label for="photo-upload" class="photo-upload-btn" title="Alterar foto">
                        <span class="material-symbols-outlined">camera_alt</span>
                    </label>
                    <input type="file" id="photo-upload" accept="image/*" style="display:none" onchange="uploadPhoto(event)">
                </div>
                <h2>${currentUserData.full_name || 'Usuário'}</h2>
                <p class="profile-username">@${currentUserData.username}</p>
                <div class="profile-badges">
                    ${currentUserData.is_leader ? '<span class="badge-role leader">Líder</span>' : ''}
                    ${currentUserData.role === 'midia' ? '<span class="badge-role">Mídia</span>' : ''}
                    ${!currentUserData.is_leader && currentUserData.role !== 'midia' ? `<span class="badge-role">${getRoleName(currentUserData.role || 'vocal')}</span>` : ''}
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
                        ${('email' in currentUserData) ? `
                        <div class="input-group">
                            <label>Email</label>
                            <input type="email" id="profile-email" value="${emailValue}">
                        </div>` : ''}
                        ${('phone' in currentUserData) ? `
                        <div class="input-group">
                            <label>Telefone</label>
                            <input type="tel" id="profile-phone" value="${phoneValue}">
                        </div>` : ''}
                    </div>
                </div>
                <button class="btn-primary" onclick="updateProfile()" style="width:100%; margin-top:1rem;">
                    <span class="material-symbols-outlined">save</span> Salvar Alterações
                </button>
            </div>
        </div>
    `;
}

function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image\/(jpeg|png|webp|jpg)/i)) {
            console.warn("Formato de imagem não otimizável nativamente. Usando arquivo original.");
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
                else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    else resolve(file); 
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file); 
        };
        reader.onerror = () => resolve(file); 
    });
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

        const compressedFile = await compressImage(file);
        let fileExt = compressedFile.name.split('.').pop() || 'jpg';
        const fileName = `${currentUserData.id}_${Date.now()}.${fileExt}`;
        
        const { error } = await supabaseClient.storage
            .from('member-photos')
            .upload(fileName, compressedFile, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) {
            if (error.message.includes('not found') || error.message.includes('not_found')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentUserData.photo_url = e.target.result;
                    localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
                    updateHeaderUserInfo();
                    showCustomAlert('Foto salva localmente (bucket não configurado no Supabase).', 'Aviso');
                    loadProfile();
                };
                reader.readAsDataURL(compressedFile);
                return;
            }
            throw error;
        }

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
        showCustomAlert('Erro ao fazer upload: ' + e.message, 'Erro');
    }
}

async function updateProfile() {
    const fullname = document.getElementById('profile-fullname').value.trim();
    const emailElem = document.getElementById('profile-email');
    const phoneElem = document.getElementById('profile-phone');
    
    if (!fullname) {
        showCustomAlert('Nome completo é obrigatório.', 'Erro');
        return;
    }
    try {
        const updateData = { full_name: fullname };
        
        if (emailElem && ('email' in currentUserData)) updateData.email = emailElem.value.trim() || null;
        if (phoneElem && ('phone' in currentUserData)) updateData.phone = phoneElem.value.trim() || null;
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateData)
        });
        if (!res.ok) throw new Error('Erro ao atualizar');
        
        currentUserData.full_name = fullname;
        if (updateData.email !== undefined) currentUserData.email = updateData.email;
        if (updateData.phone !== undefined) currentUserData.phone = updateData.phone;
        
        localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
        updateHeaderUserInfo();
        showCustomAlert('Perfil atualizado com sucesso!', 'Sucesso');
    } catch (e) {
        showCustomAlert('Erro ao atualizar perfil.', 'Erro');
    }
}

// ==========================================
// MEMBROS
// ==========================================
async function loadMembers() {
    const container = document.getElementById('members-lineup');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*&order=full_name.asc`, { 
            headers
        });
        
        if (!res.ok) throw new Error(`Falha no servidor: ${res.status}`);
        let members = await res.json();
        
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
            html += '<div class="members-section"><h3 class="section-title"> Vocal</h3><div class="members-cards-grid">';
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
        console.error('❌ Erro ao carregar membros:', e);
        container.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <p style="color:var(--danger); margin-bottom:10px;">️ Não foi possível carregar a equipe</p>
                <p style="color:var(--text-muted); font-size:0.9rem;">${e.message}</p>
                <button class="btn-secondary" onclick="loadMembers()" style="margin-top:15px;">🔄 Tentar novamente</button>
            </div>
        `;
    }
}

function createMemberCard(member, type) {
    const photoUrl = member.photo_url || null;
    const role = member.role || 'vocal';
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
// NAVEGAÇÃO DE PASTAS E REPERTÓRIO
// ==========================================
function goBackToFolders() {
    currentFolderId = null;
    const foldersList = document.getElementById('folders-list');
    const repList = document.getElementById('repertoire-list');
    if(foldersList) foldersList.style.display = 'block';
    if(repList) repList.style.display = 'none';
    
    // Esconde os botões de adicionar ao sair da pasta
    updateAddButtonsVisibility(false);
    
    loadFolders();
}

function selectFolder(folderId) {
    currentFolderId = folderId; 
    const foldersList = document.getElementById('folders-list');
    const repList = document.getElementById('repertoire-list');
    if(foldersList) foldersList.style.display = 'none';
    if(repList) repList.style.display = 'block';
    
    // Mostra os botões de adicionar ao entrar na pasta
    updateAddButtonsVisibility(true);
    
    loadRepertoire();
}

async function loadFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;
    
    try {
        let folders = [];
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=id,name,created_by,is_general&order=is_general.desc,name.asc`, { headers });
            if (res.ok) {
                folders = await res.json();
                allFoldersCache = folders;
            }
        } catch(e) {
            console.warn('Tabela de pastas não encontrada ou erro:', e);
        }

        let html = '<div class="folders-grid" style="margin-top: 15px;">';
        
        // Pasta Geral
        const generalCount = await countMusicInFolder(null);
        html += `
            <button class="folder-card" onclick="selectFolder(null)">
                <div class="folder-card-icon"><span class="material-symbols-outlined">folder_special</span></div>
                <div class="folder-card-info">
                    <h4>Pasta Geral</h4>
                    <p>${generalCount} músicas globais</p>
                    <small>Todas as músicas cadastradas</small>
                </div>
            </button>
        `;

        // Pastas personalizadas
        for (const folder of folders) {
            if (folder.is_general) continue;
            const canEdit = currentUserData.is_leader || (folder.created_by === currentUserData.id);
            const musicCount = await countMusicInFolder(folder.id);
            
            html += `
                <button class="folder-card" onclick="selectFolder('${folder.id}')">
                    <div class="folder-card-icon"><span class="material-symbols-outlined">folder</span></div>
                    <div class="folder-card-info">
                        <h4>${folder.name}</h4>
                        <p>${musicCount} músicas</p>
                        <small>Dono(a): ${folder.created_by === currentUserData.id ? 'Você' : 'Membro'}</small>
                    </div>
                    ${canEdit ? `
                        <button class="folder-card-delete" onclick="event.stopPropagation(); confirmDeleteFolder('${folder.id}')" title="Excluir pasta">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    ` : ''}
                </button>
            `;
        }

        // Nova pasta (Líder)
        if (currentUserData.is_leader) {
            html += `
                <button class="folder-card folder-card-create" onclick="openCreateFolderModalCustom()">
                    <div class="folder-card-icon"><span class="material-symbols-outlined">create_new_folder</span></div>
                    <div class="folder-card-info">
                        <h4>Nova Pasta</h4>
                        <p>Criar pasta de membro</p>
                    </div>
                </button>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        console.error('❌ Erro loadFolders:', e);
        container.innerHTML = `<p style="text-align:center; color:var(--danger); padding:20px;">Erro ao carregar pastas.</p>`;
    }
}

async function countMusicInFolder(folderId) {
    try {
        let url = `${SUPABASE_URL}/rest/v1/repertoire?select=id&limit=1`;
        if (folderId) {
            url += `&folder_id=eq.${folderId}`;
        }
        
        const res = await fetch(url, { 
            method: 'GET',
            headers: { ...headers, 'Prefer': 'count=exact' } 
        });
        
        const range = res.headers.get('content-range');
        if (range) {
            return parseInt(range.split('/')[1]);
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

async function confirmDeleteFolder(folderId) {
    const folder = allFoldersCache.find(f => f.id === folderId);
    if (!folder) return;
    
    const musicCount = await countMusicInFolder(folderId);
    showCustomConfirm(`Deseja excluir "${folder.name}"?\n\n${musicCount} música(s) ficarão órfãs de pasta, mas ainda visíveis na Pasta Geral.`, () => deleteFolder(folderId), 'Excluir Pasta');
}

async function deleteFolder(folderId) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire?folder_id=eq.${folderId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ folder_id: null })
        });
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/folders?id=eq.${folderId}`, {
            method: 'DELETE',
            headers
        });
        
        if (!res.ok) throw new Error('Falha ao excluir');
        
        loadFolders();
        showCustomAlert('Pasta excluída com sucesso!', 'Sucesso');
    } catch (e) {
        console.error('Erro ao excluir pasta:', e);
        showCustomAlert('Erro ao excluir pasta.', 'Erro');
    }
}

async function openCreateFolderModalCustom() {
    if (!currentUserData.is_leader) {
        showCustomAlert('Apenas líderes podem designar novas pastas de repertório.', 'Atenção');
        return;
    }

    if (allMembersCache.length === 0) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name&order=full_name.asc`, { headers });
            allMembersCache = await res.json();
        } catch(e) {}
    }

    let selectHtml = `<select id="custom-folder-member" style="width:100%; padding:8px; margin-top:10px; border-radius:6px; border:1px solid #ccc;">
        <option value="">Selecione o membro...</option>`;
    
    allMembersCache.forEach(m => {
        selectHtml += `<option value="${m.id}">${m.full_name}</option>`;
    });
    selectHtml += `</select>`;

    showCustomInputHTML('Nova Pasta de Membro', 'Membro responsável pelo repertório:', selectHtml, async (memberId) => {
        if (!memberId) return;
        const member = allMembersCache.find(m => m.id === memberId);
        if (!member) return;
        
        const existing = allFoldersCache.find(f => f.created_by === memberId && !f.is_general);
        if (existing) {
            showCustomAlert('Este membro já possui uma pasta vinculada!', 'Aviso');
            return;
        }

        createFolder(`Repertório de ${member.full_name}`, memberId);
    });
}

function showCustomInputHTML(title, label, extraHTML, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal custom-input-modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="input-group">
                    <label>${label}</label>
                    ${extraHTML}
                </div>
                <div style="display:flex; gap:10px; margin-top:20px; justify-content:flex-end;">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn-primary" id="custom-input-confirm">Criar Pasta</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const confirmBtn = modal.querySelector('#custom-input-confirm');
    const select = modal.querySelector('#custom-folder-member');
    
    confirmBtn.addEventListener('click', () => {
        const value = select ? select.value : null;
        modal.remove();
        if (value) callback(value);
    });
}

async function createFolder(name, memberId) {
    try {
        const postHeaders = { ...headers };
        delete postHeaders['Prefer']; 

        const res = await fetch(`${SUPABASE_URL}/rest/v1/folders`, {
            method: 'POST',
            headers: postHeaders, 
            body: JSON.stringify({
                name: name.trim(),
                created_by: memberId,
                is_general: false
            })
        });
        
        if (!res.ok) throw new Error('Falha ao criar banco. 401 Unauthorized.');
        
        await loadFolders();
        showCustomAlert(`Pasta "${name}" criada com sucesso!`, 'Sucesso');
    } catch (e) {
        console.error('Erro ao criar pasta:', e);
        showCustomAlert('Erro ao criar pasta. Verifique a política RLS (Insert) no Supabase.', 'Erro');
    }
}

// ==========================================
// REPERTÓRIO
// ==========================================
async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    if (!list) return;
    
    const currentFolder = currentFolderId ? allFoldersCache.find(f => f.id === currentFolderId) : null;
    
    let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:12px; background:#fff9f3; border-radius:10px; border:1px solid var(--border-color);">
            <h3 style="font-size:1.1rem; color:var(--primary-color); display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-outlined">${currentFolderId === null ? 'folder_special' : 'folder_open'}</span>
                ${currentFolderId === null ? 'Pasta Geral' : currentFolder.name}
            </h3>
            <button class="btn-secondary" style="padding:6px 12px; font-size:0.85rem;" onclick="goBackToFolders()">
                ⬅ Voltar às Pastas
            </button>
        </div>
    `;
    
    list.innerHTML = headerHtml + '<div class="loading-spinner"></div>';

    try {
        let query = `${SUPABASE_URL}/rest/v1/repertoire?select=id,title,lyrics_text,is_medley,vocalist,created_by,repertoire_keys(ton)`;
        if (currentFolderId) {
            query += `&folder_id=eq.${currentFolderId}`;
        }
        query += '&order=title.asc';
        
        const res = await fetch(query, { headers });
        if (!res.ok) throw new Error('Erro ao buscar repertório');
        
        allRepertoireCache = await res.json();

        if (allRepertoireCache.length === 0) {
            list.innerHTML = headerHtml + '<p style="text-align:center; color:var(--text-muted); padding:40px;">Nenhuma música nesta pasta.</p>';
            return;
        }

        let html = headerHtml;
        allRepertoireCache.forEach(song => {
            let keysHtml = '';
            if (song.repertoire_keys) {
                song.repertoire_keys.forEach(k => { keysHtml += `<span class="badge tom">${k.ton}</span>`; });
            }

            let vocalistHtml = '';
            if (song.vocalist) {
                vocalistHtml = `<div class="vocalist-badge"><span class="material-symbols-outlined" style="font-size:0.9rem;">mic</span> ${song.vocalist}</div>`;
            }

            const isGeneralFolder = currentFolderId === null;
            const isMedia = currentUserData.role === 'midia';
            
            let isFolderOwner = false;
            if (currentFolderId && currentFolder) {
                if (currentFolder.created_by === currentUserData.id) isFolderOwner = true;
            }
            
            let canEditSong = false;
            if (isGeneralFolder) {
                canEditSong = !isMedia;
            } else {
                canEditSong = isFolderOwner || currentUserData.is_leader;
            }

            const titleEscaped = song.title.replace(/`/g, "'");
            const lyricsEscaped = encodeURIComponent(song.lyrics_text || '');
            const vocalEscaped = encodeURIComponent(song.vocalist || '');

            html += `
                <div class="playlist-item" onclick="${canEditSong ? `openViewRepertoire('${song.id}', \`${titleEscaped}\`, \`${lyricsEscaped}\`, ${song.is_medley || false}, \`${vocalEscaped}\`)` : ''}">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">${song.is_medley ? 'queue_music' : 'music_note'}</span></div>
                        <div class="play-title">
                            <h4>${song.title}</h4>
                            <p>${song.is_medley ? 'Medley' : 'Louvor'} ${vocalistHtml}</p>
                        </div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                    ${canEditSong && (song.created_by === currentUserData.id || currentUserData.is_leader) ? `<button class="btn-edit-rep" onclick="event.stopPropagation(); deleteRepertoire('${song.id}')" title="Excluir"><span class="material-symbols-outlined">delete</span></button>` : ''}
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error('Erro ao carregar repertório:', e);
        list.innerHTML = headerHtml + '<p style="text-align:center; color:var(--danger);">Erro ao carregar.</p>';
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
// SUPER BUSCADOR DE LETRAS
// ==========================================
function openRepertoireModal() {
    document.getElementById('modal-add-repertoire').classList.add('active');
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-msg').textContent = '';
    document.getElementById('search-query').value = '';
    document.getElementById('rep-title').value = '';
    document.getElementById('rep-key').value = '';
    document.getElementById('rep-lyrics').value = '';
    
    // AUTO-PREENCHER VOCALISTA COM O DONO DA PASTA/USUÁRIO LOGADO
    document.getElementById('rep-vocalist').value = currentUserData.full_name || '';
    
    selectedVocalists = [];
    updateSelectedVocalists();
}

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if (!query) return;
    msgBox.innerHTML = '<span style="color:var(--primary-color);">🔍 Buscando intensamente em todas as fontes...</span>';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    let foundAnyValid = false;
    
    try {
        try {
            const vagRes = await fetch(`https://api.vagalume.com.br/search.artmus?q=${encodeURIComponent(query)}&limit=5`);
            const vagData = await vagRes.json();
            
            if (vagData.response && vagData.response.docs) {
                for (let doc of vagData.response.docs) {
                    if (doc.title && doc.band) {
                        const lyricsRes = await fetch(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(doc.band)}&mus=${encodeURIComponent(doc.title)}`);
                        if (lyricsRes.ok) {
                            const lyricsData = await lyricsRes.json();
                            if ((lyricsData.type === 'exact' || lyricsData.type === 'aprox') && lyricsData.mus[0].text) {
                                const text = lyricsData.mus[0].text;
                                if (text.length > 30) {
                                    const id = `vag_${Math.random()}`;
                                    cachedLyricsSearch[id] = { artist: doc.band, song: doc.title, lyrics: text, source: 'Vagalume' };
                                    addSearchResultToDOM(doc.title, doc.band, id, 'Vagalume');
                                    foundAnyValid = true;
                                }
                            }
                        }
                    }
                }
            }
        } catch(e) { console.warn('Vagalume API falhou', e); }

        if (!foundAnyValid) {
            try {
                const letrasRes = await fetch(`https://www.letras.mus.br/api/autocomplete?q=${encodeURIComponent(query)}&limit=5`);
                if (letrasRes.ok) {
                    const letrasData = await letrasRes.json();
                    for (let item of letrasData) {
                        if (item.url && item.artista && item.nome) {
                            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(item.url)}`;
                            const htmlRes = await fetch(proxyUrl);
                            const htmlData = await htmlRes.json();
                            
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(htmlData.contents, 'text/html');
                            
                            const element = doc.querySelector('.lyric-original') || doc.querySelector('.letra') || doc.querySelector('#letra');
                            
                            if (element) {
                                let htmlStr = element.innerHTML.replace(/<br\s*[\/]?>/gi, '\n');
                                let plainText = htmlStr.replace(/<\/?[^>]+(>|$)/g, "");
                                plainText = plainText.trim();
                                
                                if (plainText.length > 50) {
                                    const id = `letras_${Math.random()}`;
                                    cachedLyricsSearch[id] = { artist: item.artista, song: item.nome, lyrics: plainText, source: 'Letras.mus' };
                                    addSearchResultToDOM(item.nome, item.artista, id, 'Letras');
                                    foundAnyValid = true;
                                }
                            }
                        }
                    }
                }
            } catch (e) { console.warn('Letras Scraper falhou', e); }
        }

        if (!foundAnyValid) {
            msgBox.innerHTML = '<span style="color:var(--danger);">❌ Nenhuma fonte encontrou essa música. Digite manualmente.</span>';
        } else {
            msgBox.innerHTML = '<span style="color:var(--success);">✅ Letras encontradas na internet! Clique para baixar.</span>';
        }
    } catch (e) {
        msgBox.innerHTML = '<span style="color:var(--danger);">❌ Falha geral nas buscas. Cole a letra manualmente.</span>';
    }
}

function addSearchResultToDOM(song, artist, id, fonte) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
        <div style="flex:1; min-width:0;">
            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${song}</strong>
            <small style="color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${artist} <span style="background:#eee; padding:2px 4px; border-radius:4px; font-size:0.7rem; margin-left:5px;">via ${fonte}</span></small>
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

async function searchVocalists(input) {
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById('vocalist-dropdown');
    if (query.length < 2) { dropdown.innerHTML = ''; dropdown.style.display = 'none'; return; }
    
    if (allMembersCache.length === 0) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*`, { headers });
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

// ==========================================
// VISUALIZADOR DE REPERTÓRIO E PERMISSÕES
// ==========================================
async function openViewRepertoire(id, title, encodedLyrics, isMedley, encodedVocalist = '') {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    const vocalistDisplay = document.getElementById('view-rep-vocalist');
    const currentVocalist = encodedVocalist ? decodeURIComponent(encodedVocalist) : '';
    
    const isMedia = currentUserData.role === 'midia';
    
    if (!isMedia) {
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
    } else {
        vocalistDisplay.innerHTML = `<p><strong>Voz/Cantor:</strong> ${currentVocalist || 'Não definido'}</p>`;
        document.getElementById('box-add-key').classList.add('hidden');
    }
    
    loadKeysForRepertoire(id, !isMedia);
    
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

async function loadKeysForRepertoire(id, canEdit = true) {
    const container = document.getElementById('view-rep-keys');
    container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        let html = '';
        keys.forEach(k => {
            html += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">
                        ${k.ton} 
                        ${canEdit ? `<span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span>` : ''}
                    </span>`;
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
        loadKeysForRepertoire(currentViewingRepertoireId, true);
        loadRepertoire();
    } catch (e) { showCustomAlert('Erro ao adicionar tom.'); }
}

async function deleteKey(keyId) {
    showCustomConfirm('Deseja remover este tom?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers });
            loadKeysForRepertoire(currentViewingRepertoireId, true);
            loadRepertoire();
        } catch (e) { }
    });
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,lyrics_text,is_medley&is_medley=eq.false&order=title.asc`, { headers });
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=id,event_date,notes,scale_items(role,members(full_name,photo_url)),scale_songs(repertoire(title,repertoire_keys(ton),vocalist))&order=event_date.asc`, { headers });
        if (!res.ok) { throw new Error('Erro ao carregar escalas'); }
        const scales = await res.json();
        const todayStr = new Date().toISOString().split('T')[0];
        const futures = scales.filter(s => s.event_date >= todayStr);
        const pasts = scales.filter(s => s.event_date < todayStr).reverse();
        listFuture.innerHTML = renderScaleCards(futures, true);
        listPast.innerHTML = renderScaleCards(pasts, false);
    } catch (e) {
        console.error('Erro ao carregar escalas:', e);
        listFuture.innerHTML = '<p style="text-align:center; color:var(--danger);">Erro ao carregar.</p>';
        listPast.innerHTML = '';
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
            const photoUrl = item.members ? item.members.photo_url : null;
            const fullName = item.members ? item.members.full_name : 'Desconhecido';
            
            teamHtml += `
                <div class="scale-team-member">
                    <div class="scale-team-photo">
                        ${photoUrl ?
                    `<img src="${photoUrl}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="photo-placeholder" style="display:none">${fullName.charAt(0)}</div>` :
                    `<div class="photo-placeholder">${fullName.charAt(0)}</div>`
                }
                    </div>
                    <span class="material-symbols-outlined scale-team-icon">${icon}</span>
                    <div class="scale-team-info">
                        <span class="scale-team-name">${fullName}</span>
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}&select=id,event_date,notes,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`, { headers });
        if (!res.ok) throw new Error('Falha ao carregar escala');
        const data = await res.json();
        if (data.length === 0) { showCustomAlert('Escala não encontrada.'); return; }
        const scale = data[0];
        document.getElementById('modal-add-scale').classList.add('active');
        document.getElementById('editing-scale-id').value = scaleId;
        document.getElementById('scale-modal-title').textContent = 'Editar Escala';
        document.getElementById('scale-date').value = scale.event_date;
        document.getElementById('scale-notes').value = scale.notes || '';
        scaleDraftTeam = scale.scale_items.map(i => ({ memberId: i.member_id, role: i.role, name: i.members ? i.members.full_name : 'Desconhecido' }));
        renderScaleDraftTeam();
        
        if (allMembersCache.length === 0) {
            const resMem = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*`, { headers });
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*`, { headers });
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
            if (!resScale.ok) throw new Error('Falha ao criar escala');
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
    const emailElem = document.getElementById('new-email');
    const phoneElem = document.getElementById('new-phone');
    const role = document.getElementById('new-role').value;
    const isLeader = document.getElementById('new-is-leader').checked;
    
    if (!username || !fullname) { showCustomAlert('Preencha usuário e nome completo!'); return; }
    try {
        const payload = { username, full_name: fullname, is_leader: isLeader, role: role };
        
        if (currentUserData) {
            if (emailElem && ('email' in currentUserData)) payload.email = emailElem.value.trim() || null;
            if (phoneElem && ('phone' in currentUserData)) payload.phone = phoneElem.value.trim() || null;
        }

        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
            method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Usuário já existe ou erro no banco.');
        const saved = await res.json();
        
        if (role !== 'midia') {
            const postHeaders = { ...headers };
            delete postHeaders['Prefer']; 
            await fetch(`${SUPABASE_URL}/rest/v1/folders`, {
                method: 'POST', headers: postHeaders,
                body: JSON.stringify({ name: `Repertório de ${fullname}`, created_by: saved[0].id, is_general: false })
            });
        }
        
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso');
        ['new-username', 'new-fullname', 'new-email', 'new-phone'].forEach(id => { 
            if(document.getElementById(id)) document.getElementById(id).value = ''; 
        });
        document.getElementById('new-is-leader').checked = false;
    } catch (e) {
        console.error('Erro ao cadastrar:', e);
        showCustomAlert(e.message, 'Erro');
    }
}

async function loadAdminMembers() {
    const container = document.getElementById('admin-members-list');
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*&order=full_name.asc`, { 
            headers
        });
        
        if (!res.ok) throw new Error('Falha ao obter do Supabase');
        let members = await res.json();
        
        if (members.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Nenhum membro cadastrado.</p>';
            return;
        }
        
        let html = '<div class="admin-members-grid">';
        members.forEach(m => {
            const email = m.email || '';
            const role = m.role || 'vocal';
            
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

// ==========================================
// EDIÇÃO DE MEMBROS
// ==========================================
async function editMember(id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}&select=*`, { headers });
        if (!res.ok) throw new Error('Falha ao carregar dados do Supabase');
        
        const memberData = await res.json();
        const member = memberData[0];
        if (!member) {
            showCustomAlert('Membro não encontrado.', 'Erro');
            return;
        }
        
        document.getElementById('edit-member-id').value = member.id;
        document.getElementById('edit-fullname').value = member.full_name || '';
        
        const emailElem = document.getElementById('edit-email');
        const phoneElem = document.getElementById('edit-phone');
        if (emailElem && ('email' in member)) emailElem.value = member.email || '';
        if (phoneElem && ('phone' in member)) phoneElem.value = member.phone || '';
        
        const roleSelect = document.getElementById('edit-role');
        if (roleSelect) roleSelect.value = member.role || 'vocal';
        
        const isLeaderCheck = document.getElementById('edit-is-leader');
        if (isLeaderCheck) isLeaderCheck.checked = !!member.is_leader;
        
        document.getElementById('modal-edit-member').classList.add('active');
        
    } catch (e) {
        console.error('Erro ao carregar membro para edição:', e);
        showCustomAlert('Erro ao tentar editar o membro.', 'Erro');
    }
}

async function saveEditMember() {
    const id = document.getElementById('edit-member-id').value;
    const fullname = document.getElementById('edit-fullname').value.trim();
    
    const emailElem = document.getElementById('edit-email');
    const phoneElem = document.getElementById('edit-phone');
    
    const roleElem = document.getElementById('edit-role');
    const role = roleElem ? roleElem.value : 'vocal';
    
    const isLeaderElem = document.getElementById('edit-is-leader');
    const isLeader = isLeaderElem ? isLeaderElem.checked : false;
    
    if (!fullname) {
        showCustomAlert('O Nome completo é obrigatório.', 'Erro de Validação');
        return;
    }
    
    try {
        const updateData = {
            full_name: fullname,
            role: role,
            is_leader: isLeader
        };
        
        if (currentUserData) {
            if (emailElem && ('email' in currentUserData)) updateData.email = emailElem.value.trim() || null;
            if (phoneElem && ('phone' in currentUserData)) updateData.phone = phoneElem.value.trim() || null;
        }
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateData)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Falha ao atualizar dados no servidor');
        }
        
        showCustomAlert('Membro atualizado com sucesso!', 'Sucesso');
        closeModals();
        loadAdminMembers();
        
        if (id === currentUserData.id) {
            currentUserData = { ...currentUserData, ...updateData };
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            updateHeaderUserInfo();
        }
        
    } catch (e) {
        console.error('Falha grave ao salvar edição de membro:', e);
        showCustomAlert('Erro: ' + e.message, 'Erro de Salvamento');
    }
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
        try {
            currentUserData = JSON.parse(storedUser);
            showSystemScreen();
        } catch (e) {
            console.error(' Erro ao restaurar sessão:', e);
            localStorage.removeItem('sessionUser');
        }
    }
};
