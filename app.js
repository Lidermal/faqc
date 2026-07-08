// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let allRepertoireCache = [];
let allMembersCache = [];
let realtimeChannels = [];
let supabaseClient = null;

let scaleDraftTeam = [];
let medleyDraft = [];
let medleyCurrentSongId = null;
let medleyCurrentSongVerses = [];
let cachedLyricsSearch = {};

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
        return false;
    } catch (e) {
        console.error('❌ Erro ao inicializar Supabase:', e);
        return false;
    }
}

// ==========================================
// ALERTAS
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
// AUTENTICAÇÃO
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
            method: 'GET', headers 
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

    if (currentUserData.is_leader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
    }
    
    document.getElementById('repertoire-actions').classList.remove('hidden');
    
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
    
    localStorage.removeItem('sessionUser'); 
    currentUserData = null; 
    clearInterval(countdownInterval);
    
    document.getElementById('system-screen').classList.remove('active'); 
    document.getElementById('system-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden'); 
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('username').value = '';
    document.getElementById('nav-admin').classList.add('hidden');
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
    
    if (pageId === 'home') loadDashboard();
    if (pageId === 'membros') loadMembers();
    if (pageId === 'admin') loadAdminMembers();
    if (pageId === 'repertorio') loadRepertoire();
    if (pageId === 'escalas') loadScales();
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

// ==========================================
// REALTIME 100% AO VIVO
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;

    try {
        const repChannel = supabaseClient
            .channel('repertoire-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, (payload) => {
                if(document.getElementById('page-repertorio').classList.contains('active')) loadRepertoire();
                if(document.getElementById('drawer-medley').classList.contains('active')) loadMedleySongsList();
                if(currentViewingRepertoireId && payload.new && payload.new.id == currentViewingRepertoireId) {
                    openViewRepertoire(payload.new.id, payload.new.title, encodeURIComponent(payload.new.lyrics_text || ''), payload.new.is_medley, encodeURIComponent(payload.new.vocalist || ''));
                }
                if(document.getElementById('modal-add-scale').classList.contains('active')) openScaleModalRefreshSongs();
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        const scaleChannel = supabaseClient
            .channel('scale-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, () => {
                if(document.getElementById('page-escalas').classList.contains('active')) loadScales();
                if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
            })
            .subscribe();
        realtimeChannels.push(scaleChannel);

        const scaleItemsChannel = supabaseClient
            .channel('scale-items-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_items' }, () => {
                if(document.getElementById('page-escalas').classList.contains('active')) loadScales();
                if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
            })
            .subscribe();
        realtimeChannels.push(scaleItemsChannel);

        const scaleSongsChannel = supabaseClient
            .channel('scale-songs-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_songs' }, () => {
                if(document.getElementById('page-escalas').classList.contains('active')) loadScales();
            })
            .subscribe();
        realtimeChannels.push(scaleSongsChannel);

        const memberChannel = supabaseClient
            .channel('member-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
                if(document.getElementById('page-membros').classList.contains('active')) loadMembers();
                if(document.getElementById('page-admin').classList.contains('active')) loadAdminMembers();
                if(document.getElementById('page-escalas').classList.contains('active')) loadScales();
                if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
                if(currentUserData && payload.new && payload.new.id == currentUserData.id) {
                    currentUserData = payload.new;
                    document.getElementById('user-display-name').textContent = currentUserData.full_name;
                    localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
                }
            })
            .subscribe();
        realtimeChannels.push(memberChannel);

        const memberRolesChannel = supabaseClient
            .channel('member-roles-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, () => {
                if(document.getElementById('page-membros').classList.contains('active')) loadMembers();
                if(document.getElementById('page-admin').classList.contains('active')) loadAdminMembers();
            })
            .subscribe();
        realtimeChannels.push(memberRolesChannel);
        
        const keyChannel = supabaseClient
            .channel('key-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire_keys' }, (payload) => {
                if(document.getElementById('modal-view-repertoire').classList.contains('active') && payload.new && payload.new.repertoire_id == currentViewingRepertoireId) {
                    loadKeysForRepertoire(currentViewingRepertoireId);
                }
                if(document.getElementById('page-repertorio').classList.contains('active')) loadRepertoire();
            })
            .subscribe();
        realtimeChannels.push(keyChannel);
        
        const medleyPartChannel = supabaseClient
            .channel('medley-part-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire_medley_parts' }, () => {
                if(document.getElementById('modal-view-repertoire').classList.contains('active')) {
                    const partsDisplay = document.getElementById('medley-parts-display');
                    if(!partsDisplay.classList.contains('hidden')) {
                        partsDisplay.innerHTML = 'Atualizando...';
                        setTimeout(() => {
                            const title = document.getElementById('view-rep-title').textContent;
                            const lyrics = document.getElementById('view-rep-lyrics').textContent;
                            openViewRepertoire(currentViewingRepertoireId, title, encodeURIComponent(lyrics), true);
                        }, 500);
                    }
                }
            })
            .subscribe();
        realtimeChannels.push(medleyPartChannel);
        
        const dailyMsgChannel = supabaseClient
            .channel('daily-message-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_message' }, () => {
                if(document.getElementById('page-home').classList.contains('active')) fetchDailyMessage();
            })
            .subscribe();
        realtimeChannels.push(dailyMsgChannel);
        
        console.log('✅ Realtime configurado (100% ao vivo)');
    } catch (e) {
        console.error('❌ Erro realtime:', e);
    }
}

// ==========================================
// DASHBOARD
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

// ==========================================
// MENSAGEM DO DIA
// ==========================================
const bibleVersesPool = [
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "Lançai sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", ref: "1 Pedro 5:7" },
    { text: "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.", ref: "Isaías 40:31" },
    { text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.", ref: "Provérbios 3:5" },
    { text: "Deleita-te também no Senhor, e te concederá os desejos do teu coração.", ref: "Salmos 37:4" },
    { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te esforço, e te ajudo, e te sustento com a destra da minha justiça.", ref: "Isaías 41:10" },
    { text: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?", ref: "Salmos 27:1" }
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
        
        try {
            const bibleRes = await fetch(`https://www.abibliadigital.com.br/api/verses/nvi/random`);
            if(bibleRes.ok) {
                const verseData = await bibleRes.json();
                if(verseData && verseData.text) {
                    const ref = `${verseData.book.name} ${verseData.chapter}:${verseData.number}`;
                    container.innerHTML = `<p>"${verseData.text}"</p><span class="verse-ref">- ${ref}</span>`;
                    return;
                }
            }
        } catch(apiErr) {
            console.warn('API bíblica indisponível');
        }
        
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const verseIndex = dayOfYear % bibleVersesPool.length;
        const verse = bibleVersesPool[verseIndex];
        container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
        
    } catch (e) { 
        console.error('Erro ao buscar versículo:', e);
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const verseIndex = dayOfYear % bibleVersesPool.length;
        const verse = bibleVersesPool[verseIndex];
        container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
    }
}

function getRoleIcon(role) {
    const icons = {
        'lider': 'star',
        'vocal': 'mic',
        'baterista': 'drum',
        'teclado': 'piano',
        'violao': 'guitar',
        'baixo': 'graphic_eq'
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
        'baixo': 'Baixo'
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
                    const icon = getRoleIcon(item.role);
                    const roleName = getRoleName(item.role);
                    const photoUrl = item.members.photo_url || null;
                    
                    html += `
                        <div class="team-carousel-card ${isCurrent}">
                            <div class="team-card-photo">
                                ${photoUrl ? 
                                    `<img src="${photoUrl}" alt="${item.members.full_name}">` : 
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
// MEMBROS - GRID MODERNO
// ==========================================
async function loadMembers() {
    const container = document.getElementById('members-lineup');
    container.innerHTML = '<p class="loading-text">Carregando equipe...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        
        if (members.length === 0) { 
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:40px;">Nenhum membro cadastrado.</p>'; 
            return; 
        }
        
        let html = '<div class="members-grid-cards">';
        
        members.forEach(m => {
            const roles = m.member_roles.map(r => r.role);
            const primaryRole = m.is_leader ? 'Líder' : (roles[0] ? getRoleName(roles[0]) : 'Membro');
            const photoUrl = m.photo_url || null;
            
            html += `
                <div class="member-card-modern">
                    <div class="member-card-photo">
                        ${photoUrl ? 
                            `<img src="${photoUrl}" alt="${m.full_name}">` : 
                            `<div class="photo-placeholder">${m.full_name.charAt(0)}</div>`
                        }
                        ${m.is_leader ? '<div class="leader-badge">★ Líder</div>' : ''}
                    </div>
                    <div class="member-card-body">
                        <h3 class="member-name">${m.full_name}</h3>
                        <div class="member-role-primary">${primaryRole}</div>
                        ${roles.length > 0 && !m.is_leader ? `
                            <div class="member-roles-secondary">
                                ${roles.map(r => `<span class="role-tag">${getRoleName(r)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (e) { 
        container.innerHTML = '<p style="color:var(--danger); text-align:center; padding:40px;">Erro ao carregar equipe.</p>'; 
    }
}

// ==========================================
// BUSCA ULTRA-PODEROSA DE MÚSICAS
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

function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function extractLyricsFromLetras(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        if(data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            
            const lyricSelectors = [
                '.lyrics-container',
                '.lyrics',
                '[data-lyrics-container]',
                '.letra',
                '#letra'
            ];
            
            for(let selector of lyricSelectors) {
                const element = doc.querySelector(selector);
                if(element) {
                    let lyrics = element.innerText || element.textContent;
                    lyrics = lyrics.replace(/\s+/g, '\n').trim();
                    if(lyrics.length > 50) {
                        return lyrics;
                    }
                }
            }
        }
    } catch(e) {
        console.warn('Erro ao extrair do letras.mus.br:', e);
    }
    return null;
}

async function searchYouTubeLyrics(query) {
    try {
        const searchUrl = `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query + ' letra completa')}+site:letras.mus.br&type=video`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if(data && data.length > 0) {
            const video = data[0];
            const description = video.description || '';
            
            const letrasMatch = description.match(/(https?:\/\/www\.letras\.mus\.br\/[^\s]+)/);
            if(letrasMatch) {
                const lyrics = await extractLyricsFromLetras(letrasMatch[1]);
                if(lyrics) {
                    return {
                        artist: video.author || 'Artista',
                        song: video.title.replace(/letra|official|video/gi, '').trim(),
                        lyrics: lyrics,
                        source: 'YouTube + Letras.mus.br'
                    };
                }
            }
        }
    } catch(e) {
        console.warn('Erro na busca YouTube:', e);
    }
    return null;
}

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { 
        showCustomAlert('Digite o nome da música, cantor ou trecho da letra.'); 
        return; 
    }
    
    msgBox.innerHTML = '<span style="color:var(--primary-color);">🔍 Buscando em todas as fontes...</span>';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    let foundAnyValid = false;
    const seen = new Set();
    
    try {
        // FONTE 1: LETRAS.MUS.BR
        try {
            msgBox.innerHTML = '<span style="color:var(--primary-color);">📝 Letras.mus.br...</span>';
            
            const letrasRes = await fetch(`https://www.letras.mus.br/api/autocomplete?q=${encodeURIComponent(query)}&limit=10`);
            if(letrasRes.ok) {
                const letrasData = await letrasRes.json();
                if(letrasData && letrasData.length > 0) {
                    for(let item of letrasData.slice(0, 8)) {
                        const artist = item.artista || item.artist || '';
                        const song = item.nome || item.name || item.title || '';
                        const url = item.url || '';
                        
                        if(artist && song) {
                            const key = normalizeText(`${artist} ${song}`);
                            if(!seen.has(key)) {
                                seen.add(key);
                                
                                let lyrics = '';
                                if(url) {
                                    lyrics = await extractLyricsFromLetras(url);
                                }
                                
                                if(lyrics && lyrics.length > 50) {
                                    foundAnyValid = true;
                                    const uniqueId = `letras_${item.id || Math.random()}`;
                                    cachedLyricsSearch[uniqueId] = { 
                                        artist: artist, 
                                        song: song, 
                                        lyrics: lyrics,
                                        source: 'Letras.mus.br'
                                    };
                                    
                                    const div = document.createElement('div');
                                    div.className = 'search-result-item';
                                    div.innerHTML = `
                                        <div style="flex:1; min-width:0;">
                                            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${song}</strong>
                                            <small style="color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${artist}</small>
                                            <small style="color:var(--success); font-size:0.7rem; display:flex; align-items:center; gap:3px; margin-top:3px;">
                                                <span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span>
                                                Letra completa • Letras.mus.br
                                            </small>
                                        </div> 
                                        <span class="material-symbols-outlined" style="color:var(--primary-color); flex-shrink:0;">download_done</span>
                                    `;
                                    div.onclick = () => importPreCheckedLyrics(uniqueId);
                                    resultsContainer.appendChild(div);
                                }
                            }
                        }
                    }
                }
            }
        } catch(e) {
            console.warn('Letras.mus.br falhou:', e);
        }
        
        // FONTE 2: VAGALUME
        if(!foundAnyValid || resultsContainer.children.length < 3) {
            try {
                msgBox.innerHTML = '<span style="color:var(--primary-color);">🎵 Vagalume...</span>';
                
                const vagRes = await fetch(`https://api.vagalume.com.br/search.php?exc=${encodeURIComponent(query)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);
                if(vagRes.ok) {
                    const vagData = await vagRes.json();
                    if(vagData.art && vagData.art.length > 0) {
                        for(let artist of vagData.art.slice(0, 5)) {
                            if(artist.mus) {
                                for(let music of artist.mus.slice(0, 3)) {
                                    const key = normalizeText(`${artist.name} ${music.desc || music.title}`);
                                    if(!seen.has(key)) {
                                        seen.add(key);
                                        
                                        if(music.text) {
                                            foundAnyValid = true;
                                            const uniqueId = `vagalume_${artist.id}_${music.id}`;
                                            cachedLyricsSearch[uniqueId] = { 
                                                artist: artist.name, 
                                                song: music.desc || music.title, 
                                                lyrics: music.text,
                                                source: 'Vagalume'
                                            };
                                            
                                            const div = document.createElement('div');
                                            div.className = 'search-result-item';
                                            div.innerHTML = `
                                                <div style="flex:1; min-width:0;">
                                                    <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${music.desc || music.title}</strong>
                                                    <small style="color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${artist.name}</small>
                                                    <small style="color:var(--success); font-size:0.7rem; display:flex; align-items:center; gap:3px; margin-top:3px;">
                                                        <span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span>
                                                        Letra completa • Vagalume
                                                    </small>
                                                </div> 
                                                <span class="material-symbols-outlined" style="color:var(--primary-color); flex-shrink:0;">download_done</span>
                                            `;
                                            div.onclick = () => importPreCheckedLyrics(uniqueId);
                                            resultsContainer.appendChild(div);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch(e) {
                console.warn('Vagalume falhou:', e);
            }
        }
        
        // FONTE 3: YOUTUBE
        if(!foundAnyValid || resultsContainer.children.length < 2) {
            try {
                msgBox.innerHTML = '<span style="color:var(--primary-color);">🎬 YouTube...</span>';
                
                const ytResult = await searchYouTubeLyrics(query);
                if(ytResult && ytResult.lyrics) {
                    foundAnyValid = true;
                    const uniqueId = `youtube_${Date.now()}`;
                    cachedLyricsSearch[uniqueId] = ytResult;
                    
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <div style="flex:1; min-width:0;">
                            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ytResult.song}</strong>
                            <small style="color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ytResult.artist}</small>
                            <small style="color:var(--success); font-size:0.7rem; display:flex; align-items:center; gap:3px; margin-top:3px;">
                                <span class="material-symbols-outlined" style="font-size:0.8rem;">check_circle</span>
                                Letra extraída • YouTube
                            </small>
                        </div> 
                        <span class="material-symbols-outlined" style="color:var(--primary-color); flex-shrink:0;">download_done</span>
                    `;
                    div.onclick = () => importPreCheckedLyrics(uniqueId);
                    resultsContainer.appendChild(div);
                }
            } catch(e) {
                console.warn('YouTube falhou:', e);
            }
        }

        if(!foundAnyValid || resultsContainer.children.length === 0) {
            msgBox.innerHTML = '<span style="color:var(--danger);">❌ Nenhuma música encontrada. Tente buscar de outra forma.</span>';
        } else {
            const count = resultsContainer.children.length;
            msgBox.innerHTML = `<span style="color:var(--success);">✅ ${count} música(s) encontrada(s)!</span>`;
        }

    } catch(e) { 
        console.error('Erro na busca:', e);
        msgBox.innerHTML = '<span style="color:var(--danger);">❌ Erro ao buscar.</span>'; 
    }
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`✅ Letra de "${data.song}" importada!`, "Sucesso");
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    const vocalist = document.getElementById('rep-vocalist').value.trim();
    
    if(!title || !lyrics) { 
        showCustomAlert('Título e Letra são obrigatórios!'); 
        return; 
    }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                title, 
                lyrics_text: lyrics, 
                created_by: currentUserData.id,
                vocalist: vocalist || null
            }) 
        });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
                method: 'POST', headers, 
                body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) 
            });
        }
        showCustomAlert('Música salva com sucesso!', "Sucesso"); 
        closeModals(); 
        loadRepertoire();
    } catch(e) { 
        showCustomAlert('Erro ao salvar.'); 
    }
}

// ==========================================
// REPERTÓRIO
// ==========================================
async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    list.innerHTML = '<p class="loading-text">Buscando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton)&order=title.asc`, { headers });
        allRepertoireCache = await res.json();
        if (allRepertoireCache.length === 0) { 
            list.innerHTML = '<p>Nenhuma música.</p>'; 
            return; 
        }
        let html = '';
        allRepertoireCache.forEach(song => {
            let keysHtml = ''; 
            song.repertoire_keys.forEach(k => { 
                keysHtml += `<span class="badge tom">${k.ton}</span>`; 
            });
            
            let vocalistHtml = '';
            if(song.vocalist) {
                vocalistHtml = `<div class="vocalist-badge"><span class="material-symbols-outlined" style="font-size:0.9rem;">mic</span> ${song.vocalist}</div>`;
            }
            
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
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { 
        list.innerHTML = '<p>Erro.</p>'; 
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
    document.getElementById('medley-verses-selector').innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Selecione uma música</p>';
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
            const keysStr = song.repertoire_keys.map(k => k.ton).join(', ');
            const keyBadge = keysStr ? `<span class="badge tom" style="font-size:0.7rem;">${keysStr}</span>` : '';
            const isSelected = medleyDraft.some(d => d.songId === song.id);
            const vocalistBadge = song.vocalist ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px;"><span class="material-symbols-outlined" style="font-size:0.8rem; vertical-align:middle;">mic</span> ${song.vocalist}</div>` : '';
            html += `
                <div class="medley-song-item ${isSelected ? 'active' : ''}" onclick="selectMedleySong('${song.id}')">
                    <div class="medley-song-item-title">${song.title} ${keyBadge}</div>
                    ${vocalistBadge}
                    ${isSelected ? '<div style="font-size:0.75rem; color:var(--success); margin-top:4px;">✓ Adicionada</div>' : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--danger); text-align:center;">Erro</p>';
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
    
    const sectionPatterns = [
        /^(intro|introdução)\s*\d*$/i,
        /^(verso|verse)\s*\d*$/i,
        /^(pr[eé]-?refr[aã]o|pre-?chorus)\s*\d*$/i,
        /^(refr[aã]o|chorus)\s*\d*$/i,
        /^(ponte|bridge)\s*\d*$/i,
        /^(final|outro)\s*\d*$/i
    ];
    
    function detectSection(line) {
        const cleanLine = line.trim().replace(/[:\[\]()]/g, '');
        for (let pattern of sectionPatterns) {
            if (pattern.test(cleanLine)) {
                if (/^intro/i.test(cleanLine)) return 'Intro';
                if (/^verso/i.test(cleanLine)) return 'Verso';
                if (/^pr[eé]/i.test(cleanLine)) return 'Pré-Refrão';
                if (/^refr/i.test(cleanLine)) return 'Refrão';
                if (/^ponte|^bridge/i.test(cleanLine)) return 'Ponte';
                if (/^final|^outro/i.test(cleanLine)) return 'Final';
            }
        }
        return null;
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const detectedSection = detectSection(line);
        
        if (detectedSection) {
            if (currentLines.length > 0) {
                verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
            }
            currentLabel = detectedSection;
            currentLines = [];
        } else if (line.trim() !== '') {
            currentLines.push(line);
        }
    }
    
    if (currentLines.length > 0) {
        verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
    }
    
    return verses;
}

function renderVersesSelector(songTitle) {
    const container = document.getElementById('medley-verses-selector');
    
    if (medleyCurrentSongVerses.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Não foi possível identificar estrofes</p>';
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
    if (medleyCurrentSongVerses[idx].selected) {
        item.classList.add('selected');
        cb.checked = true;
    } else {
        item.classList.remove('selected');
        cb.checked = false;
    }
}

function selectAllVerses() {
    const allSelected = medleyCurrentSongVerses.every(v => v.selected);
    medleyCurrentSongVerses.forEach((v, idx) => {
        v.selected = !allSelected;
        const item = document.getElementById(`verse-item-${idx}`);
        const cb = document.getElementById(`verse-cb-${idx}`);
        if (v.selected) {
            item.classList.add('selected');
            cb.checked = true;
        } else {
            item.classList.remove('selected');
            cb.checked = false;
        }
    });
}

function addSelectedVersesToMedley() {
    const selectedVerses = medleyCurrentSongVerses.filter(v => v.selected);
    if (selectedVerses.length === 0) {
        showCustomAlert('Selecione pelo menos uma parte.');
        return;
    }
    
    const song = allRepertoireCache.find(s => s.id === medleyCurrentSongId);
    
    medleyDraft = medleyDraft.filter(d => d.songId !== medleyCurrentSongId);
    
    medleyDraft.push({
        songId: medleyCurrentSongId,
        songTitle: song.title,
        sections: selectedVerses.map(v => ({ label: v.label, content: v.content }))
    });
    
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
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">As partes aparecerão aqui</p>';
        return;
    }
    
    let html = '<div class="medley-preview-content">';
    let totalParts = 0;
    
    medleyDraft.forEach((item, idx) => {
        html += `
            <div class="medley-preview-song">
                <div class="medley-preview-song-title">
                    ${idx + 1}. ${item.songTitle}
                    <span class="material-symbols-outlined" style="color:var(--danger); cursor:pointer; font-size:1.1rem; margin-left:auto;" onclick="removeMedleySong('${item.songId}')">delete</span>
                </div>
        `;
        
        item.sections.forEach(section => {
            totalParts++;
            html += `
                <div class="medley-preview-section">
                    <div class="medley-preview-section-label">${section.label}</div>
                    <div class="medley-preview-section-content">${section.content}</div>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    html += `</div><div style="margin-top:12px; padding:10px; background:#e3f2fd; border-radius:8px; font-size:0.85rem;"><strong>Resumo:</strong> ${medleyDraft.length} música(s), ${totalParts} parte(s)</div>`;
    
    container.innerHTML = html;
}

async function saveNewMedley() {
    const title = document.getElementById('medley-title').value.trim();
    if(!title) { 
        showCustomAlert('Dê um nome ao Medley.'); 
        return; 
    }
    if(medleyDraft.length < 2) { 
        showCustomAlert('O Medley precisa de pelo menos 2 músicas.'); 
        return; 
    }
    
    for (let item of medleyDraft) {
        if (item.sections.length === 0) {
            showCustomAlert(`"${item.songTitle}" não tem partes selecionadas.`);
            return;
        }
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                title: title, 
                is_medley: true, 
                created_by: currentUserData.id,
                lyrics_text: generateMedleyLyrics()
            }) 
        });
        const savedMedley = await res.json();
        const medleyId = savedMedley[0].id;

        for(let item of medleyDraft) {
            for(let section of item.sections) {
                await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts`, { 
                    method: 'POST', headers, 
                    body: JSON.stringify({ 
                        medley_repertoire_id: medleyId, 
                        song_repertoire_id: item.songId, 
                        section: section.label,
                        section_content: section.content
                    }) 
                });
            }
        }
        
        showCustomAlert('Medley criado!', 'Sucesso'); 
        closeModals(); 
        loadRepertoire();
    } catch(e) { 
        console.error(e);
        showCustomAlert('Erro ao salvar medley.'); 
    }
}

function generateMedleyLyrics() {
    let lyrics = '';
    medleyDraft.forEach((item, idx) => {
        lyrics += `\n\n=== ${item.songTitle} ===\n\n`;
        item.sections.forEach(section => {
            lyrics += `[${section.label}]\n${section.content}\n\n`;
        });
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
                <button class="btn-secondary" onclick="saveVocalistToRepertoire('${id}')" style="padding:8px 12px;">💾 Salvar</button>
            </div>
        </div>
    `;
    
    const addBox = document.getElementById('box-add-key');
    addBox.classList.remove('hidden');
    
    loadKeysForRepertoire(id);

    const partsDisplay = document.getElementById('medley-parts-display');
    if(isMedley) {
        partsDisplay.classList.remove('hidden'); 
        partsDisplay.innerHTML = 'Carregando...';
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,section_content,repertoire!song_repertoire_id(title)&order=created_at.asc`, { headers });
            const parts = await res.json();
            
            if (parts.length > 0) {
                let html = '<strong>Estrutura:</strong><br>';
                parts.forEach((p, idx) => { 
                    html += `<div style="padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
                        <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> → <span style="color:var(--primary-color); font-weight:600;">${p.section}</span>
                    </div>`; 
                });
                partsDisplay.innerHTML = html;
            } else {
                partsDisplay.innerHTML = 'Sem estrutura definida.';
            }
        } catch(e) {
            partsDisplay.innerHTML = 'Erro ao carregar.';
        }
    } else { 
        partsDisplay.classList.add('hidden'); 
    }
}

async function saveVocalistToRepertoire(id) {
    const input = document.getElementById('edit-vocalist-input');
    if(!input) return;
    const newVocalist = input.value.trim();
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ vocalist: newVocalist || null })
        });
        
        if(res.ok) {
            showCustomAlert('✅ Atualizado!', 'Sucesso');
            loadRepertoire();
        } else {
            showCustomAlert('Erro ao atualizar.');
        }
    } catch(e) {
        showCustomAlert('Erro de conexão.');
    }
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys'); 
    container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        let html = '';
        keys.forEach(k => {
            let deleteBtn = `<span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span>`;
            html += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} ${deleteBtn}</span>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if(!newKey || !currentViewingRepertoireId) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
            method: 'POST', headers, 
            body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey }) 
        });
        document.getElementById('new-key-input').value = ''; 
        loadKeysForRepertoire(currentViewingRepertoireId); 
        loadRepertoire();
    } catch(e) { 
        showCustomAlert('Erro ao adicionar tom.'); 
    }
}

async function deleteKey(keyId) {
    showCustomConfirm('Deseja remover este tom?', async () => {
        try { 
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers }); 
            loadKeysForRepertoire(currentViewingRepertoireId); 
            loadRepertoire(); 
        } catch(e) {}
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
    listFuture.innerHTML = '<p>Buscando...</p>'; 
    listPast.innerHTML = '<p>Buscando...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title,repertoire_keys(ton),vocalist))&order=event_date.asc`, { headers });
        const scales = await res.json();
        
        const todayStr = new Date().toISOString().split('T')[0];
        const futures = scales.filter(s => s.event_date >= todayStr);
        const pasts = scales.filter(s => s.event_date < todayStr).reverse();

        listFuture.innerHTML = renderScaleCards(futures, true);
        listPast.innerHTML = renderScaleCards(pasts, false);

    } catch(e) { 
        listFuture.innerHTML = '<p>Erro.</p>'; 
        listPast.innerHTML = '';
    }
}

function renderScaleCards(scaleArray, isFuture) {
    if(scaleArray.length === 0) return isFuture ? '<p>Nenhuma escala.</p>' : '<p>Histórico vazio.</p>';
    
    let html = '';
    scaleArray.forEach(s => {
        const dateObj = new Date(s.event_date);
        const dateStr = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
        
        const leaders = s.scale_items.filter(i => i.role === 'lider');
        const vocals = s.scale_items.filter(i => i.role === 'vocal');
        const band = s.scale_items.filter(i => !['lider', 'vocal'].includes(i.role));
        
        let teamHtml = '<div class="scale-team-section">';
        teamHtml += '<div class="scale-team-title"><span class="material-symbols-outlined">group</span> Equipe</div>';
        teamHtml += '<div class="scale-team-list">';
        
        leaders.forEach(i => {
            teamHtml += `
                <div class="scale-team-member role-lider">
                    <span class="material-symbols-outlined scale-team-icon">star</span>
                    <span class="scale-team-name">${i.members.full_name}</span>
                    <span class="scale-team-role">Líder</span>
                </div>
            `;
        });
        
        vocals.forEach(i => {
            teamHtml += `
                <div class="scale-team-member role-vocal">
                    <span class="material-symbols-outlined scale-team-icon">mic</span>
                    <span class="scale-team-name">${i.members.full_name}</span>
                    <span class="scale-team-role">Vocal</span>
                </div>
            `;
        });
        
        band.forEach(i => {
            const iconName = getRoleIcon(i.role);
            teamHtml += `
                <div class="scale-team-member role-band">
                    <span class="material-symbols-outlined scale-team-icon">${iconName}</span>
                    <span class="scale-team-name">${i.members.full_name}</span>
                    <span class="scale-team-role">${getRoleName(i.role)}</span>
                </div>
            `;
        });
        
        teamHtml += '</div></div>';
        
        let songsHtml = '<div class="scale-songs-section">';
        songsHtml += '<div class="scale-songs-title"><span class="material-symbols-outlined">library_music</span> Repertório</div>';
        songsHtml += '<div class="scale-songs-list">';
        
        if(s.scale_songs.length > 0) {
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
            songsHtml += '<div class="scale-empty">Nenhuma música.</div>';
        }
        
        songsHtml += '</div></div>';

        const actionsHtml = currentUserData.is_leader ? `
            <div class="scale-folder-actions">
                <button class="btn-icon" onclick="openEditScaleModal('${s.id}')"><span class="material-symbols-outlined">edit</span></button>
                <button class="btn-icon danger" onclick="deleteScale('${s.id}')"><span class="material-symbols-outlined">delete</span></button>
            </div>
        ` : '';

        html += `
            <div class="scale-folder">
                <div class="scale-folder-header">
                    <div class="scale-folder-date">
                        <span class="material-symbols-outlined">event</span>
                        <div>
                            <div class="scale-folder-date-text">${dateStr}</div>
                            <div class="scale-folder-notes">${s.notes || 'Sem observações'}</div>
                        </div>
                    </div>
                    ${actionsHtml}
                </div>
                <div class="scale-folder-body">
                    ${teamHtml}
                    ${songsHtml}
                </div>
            </div>
        `;
    });
    return html;
}

async function deleteScale(scaleId) {
    showCustomConfirm('Deseja excluir esta escala?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}`, { method: 'DELETE', headers });
            
            if(!res.ok) throw new Error('Falha');
            
            showCustomAlert('Escala excluída!', 'Sucesso');
            loadScales();
            if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
        } catch (e) { 
            showCustomAlert('Erro ao excluir.'); 
        }
    }, 'Excluir Escala');
}

async function openEditScaleModal(scaleId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}&select=*,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`, { headers });
        const data = await res.json();
        if(data.length === 0) { 
            showCustomAlert('Escala não encontrada.'); 
            return; 
        }
        
        const scale = data[0];
        
        document.getElementById('modal-add-scale').classList.add('active');
        document.getElementById('editing-scale-id').value = scaleId;
        document.getElementById('scale-modal-title').textContent = 'Editar Escala';
        
        document.getElementById('scale-date').value = scale.event_date;
        document.getElementById('scale-notes').value = scale.notes || '';
        
        scaleDraftTeam = scale.scale_items.map(i => ({
            memberId: i.member_id,
            role: i.role,
            name: i.members.full_name
        }));
        renderScaleDraftTeam();
        
        if(allMembersCache.length === 0) {
            const resMem = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,member_roles(role)`, { headers });
            allMembersCache = await resMem.json();
        }
        if(allRepertoireCache.length === 0) {
            const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
            allRepertoireCache = await resRep.json();
        }
        
        const memberSelect = document.getElementById('scale-draft-member');
        memberSelect.innerHTML = '<option value="">Selecionar Membro...</option>';
        allMembersCache.forEach(m => { 
            memberSelect.innerHTML += `<option value="${m.id}">${m.full_name}</option>`; 
        });
        
        const songsContainer = document.getElementById('scale-songs-selectors');
        const selectedSongIds = scale.scale_songs.map(s => s.repertoire_id);
        songsContainer.innerHTML = '';
        allRepertoireCache.forEach(song => {
            const checked = selectedSongIds.includes(song.id) ? 'checked' : '';
            const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
            songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}> ${song.title}${vocalistInfo}</label>`;
        });
        
    } catch (e) { 
        showCustomAlert('Erro ao carregar.'); 
    }
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    document.getElementById('editing-scale-id').value = '';
    document.getElementById('scale-modal-title').textContent = 'Nova Escala';
    scaleDraftTeam = []; 
    renderScaleDraftTeam();
    
    if(allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,member_roles(role)`, { headers });
        allMembersCache = await res.json();
    }
    if(allRepertoireCache.length === 0) {
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
        allRepertoireCache = await resRep.json();
    }

    const memberSelect = document.getElementById('scale-draft-member');
    memberSelect.innerHTML = '<option value="">Selecionar Membro...</option>';
    allMembersCache.forEach(m => { 
        memberSelect.innerHTML += `<option value="${m.id}">${m.full_name}</option>`; 
    });

    const songsContainer = document.getElementById('scale-songs-selectors');
    songsContainer.innerHTML = '';
    allRepertoireCache.forEach(song => {
        const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
        songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb"> ${song.title}${vocalistInfo}</label>`;
    });
}

async function openScaleModalRefreshSongs() {
    if(!document.getElementById('modal-add-scale').classList.contains('active')) return;
    
    try {
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
        const newRepertoire = await resRep.json();
        allRepertoireCache = newRepertoire;
        
        const selectedIds = Array.from(document.querySelectorAll('.scale-song-cb:checked')).map(cb => cb.value);
        
        const songsContainer = document.getElementById('scale-songs-selectors');
        songsContainer.innerHTML = '';
        newRepertoire.forEach(song => {
            const checked = selectedIds.includes(song.id) ? 'checked' : '';
            const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
            songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}> ${song.title}${vocalistInfo}</label>`;
        });
    } catch(e) {
        console.warn('Erro ao atualizar:', e);
    }
}

function addMemberToScaleDraft() {
    const memSel = document.getElementById('scale-draft-member');
    const rolSel = document.getElementById('scale-draft-role');
    const memberId = memSel.value; 
    const role = rolSel.value;
    
    if(!memberId) return;
    const memberName = memSel.options[memSel.selectedIndex].text;
    
    if(!scaleDraftTeam.find(i => i.memberId === memberId && i.role === role)) {
        scaleDraftTeam.push({ memberId, role, name: memberName });
    }
    memSel.value = ''; 
    renderScaleDraftTeam();
}

function removeScaleDraftMember(index) { 
    scaleDraftTeam.splice(index, 1); 
    renderScaleDraftTeam(); 
}

function renderScaleDraftTeam() {
    const list = document.getElementById('scale-draft-team-list');
    if(scaleDraftTeam.length === 0) { 
        list.innerHTML = '<p class="loading-text" style="font-size:0.85rem;">Equipe vazia.</p>'; 
        return; 
    }
    
    let html = '';
    scaleDraftTeam.forEach((item, index) => {
        html += `
            <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border:1px solid #eee; border-radius:6px; margin-bottom:5px;">
                <span><strong>${item.name}</strong> <small>(${item.role.toUpperCase()})</small></span>
                <span class="material-symbols-outlined" style="color:var(--danger); cursor:pointer; font-size:1.2rem;" onclick="removeScaleDraftMember(${index})">close</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

async function saveNewScale() {
    const date = document.getElementById('scale-date').value;
    const notes = document.getElementById('scale-notes').value;
    const editingId = document.getElementById('editing-scale-id').value;
    
    if(!date) { 
        showCustomAlert('Data obrigatória.'); 
        return; 
    }
    if(scaleDraftTeam.length === 0) { 
        showCustomAlert('Adicione pelo menos 1 membro.'); 
        return; 
    }

    try {
        let scaleId;
        
        if(editingId) {
            await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${editingId}`, { 
                method: 'PATCH', headers, 
                body: JSON.stringify({ event_date: date, notes: notes, time_key: date.substring(0,7) }) 
            });
            scaleId = editingId;
            
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
        } else {
            const resScale = await fetch(`${SUPABASE_URL}/rest/v1/scales`, { 
                method: 'POST', 
                headers: { ...headers, 'Prefer': 'return=representation' }, 
                body: JSON.stringify({ time_key: date.substring(0,7), event_date: date, notes: notes, created_by: currentUserData.id }) 
            });
            const savedScale = await resScale.json();
            scaleId = savedScale[0].id;
        }

        for(let item of scaleDraftTeam) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items`, { 
                method: 'POST', headers, 
                body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role }) 
            });
        }

        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for(let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`, { 
                method: 'POST', headers, 
                body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value }) 
            });
        }

        showCustomAlert(editingId ? 'Escala atualizada!' : 'Escala criada!', 'Sucesso'); 
        closeModals(); 
        loadScales();
        if(document.getElementById('page-home').classList.contains('active')) fetchNextScaleHome();
    } catch(e) { 
        showCustomAlert('Erro ao salvar.'); 
    }
}

// ==========================================
// ADMINISTRAÇÃO
// ==========================================
async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase(); 
    const fullname = document.getElementById('new-fullname').value.trim(); 
    const isLeader = document.getElementById('new-is-leader').checked; 
    if (!username || !fullname) { 
        showCustomAlert('Preencha usuário e nome!'); 
        return; 
    }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ username, full_name: fullname, is_leader: isLeader }) 
        });
        if (!res.ok) throw new Error('Usuário já existe.');
        showCustomAlert('Membro cadastrado!', 'Sucesso'); 
        document.getElementById('new-username').value = ''; 
        document.getElementById('new-fullname').value = ''; 
        document.getElementById('new-is-leader').checked = false; 
        loadAdminMembers();
    } catch (e) { 
        showCustomAlert(e.message, 'Erro'); 
    }
}

async function loadAdminMembers() {
    const list = document.getElementById('admin-members-list'); 
    list.innerHTML = '<p>Carregando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json(); 
        let html = '';
        members.forEach(m => {
            const currentRoles = m.member_roles.map(r => r.role);
            html += `<div class="admin-list-item" id="admin-item-${m.id}">
                    <div><strong>${m.full_name}</strong> <span style="font-size:0.8rem">(${m.username})</span></div>
                    <div class="admin-actions"><button class="btn-icon" onclick="document.getElementById('editor-${m.id}').classList.toggle('hidden')"><span class="material-symbols-outlined">edit_attributes</span></button><button class="btn-icon danger" onclick="deleteMember('${m.id}')"><span class="material-symbols-outlined">delete</span></button></div>
                    <div class="roles-editor hidden" id="editor-${m.id}">${['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo'].map(role => `<label class="role-check-item"><input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) || (role==='lider' && m.is_leader) ? 'checked' : ''}>${role.toUpperCase()}</label>`).join('')}</div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { 
        list.innerHTML = '<p>Erro.</p>'; 
    }
}

async function updateRole(memberId, role, isAdding) {
    try {
        if(role === 'lider') { 
            await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${memberId}`, { 
                method: 'PATCH', headers, 
                body: JSON.stringify({ is_leader: isAdding }) 
            }); 
            return; 
        }
        if (isAdding) {
            await fetch(`${SUPABASE_URL}/rest/v1/member_roles`, { 
                method: 'POST', headers, 
                body: JSON.stringify({ member_id: memberId, role: role }) 
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/member_roles?member_id=eq.${memberId}&role=eq.${role}`, { 
                method: 'DELETE', headers 
            });
        }
    } catch (e) { 
        showCustomAlert('Erro ao atualizar.'); 
    }
}

async function deleteMember(id) {
    showCustomConfirm('Deseja remover este membro?', async () => {
        try { 
            await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers }); 
            loadAdminMembers(); 
        } catch (e) { 
            showCustomAlert('Erro ao excluir.'); 
        }
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
