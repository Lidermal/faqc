const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// Inicializar Supabase Client com Realtime
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let allRepertoireCache = [];
let allMembersCache = [];
let realtimeChannels = [];

// Variáveis para os rascunhos (Medley e Escala)
let scaleDraftTeam = [];

// Variáveis do Medley com estrofes
let medleyDraft = []; // [{songId, songTitle, sections: [{label, content}]}]
let medleyCurrentSongId = null;
let medleyCurrentSongVerses = []; // [{label, content, selected}]

// ==========================================
// ALERTAS PERSONALIZADOS
// ==========================================
function showCustomAlert(msg, title = "Aviso") {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    document.getElementById('modal-alert').classList.add('active');
}
function closeCustomAlert() { document.getElementById('modal-alert').classList.remove('active'); }

function showCustomConfirm(msg, callback, title = "Atenção") {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('modal-confirm').classList.add('active');
    
    document.getElementById('btn-confirm-yes').onclick = () => {
        closeCustomConfirm();
        if(callback) callback();
    };
}
function closeCustomConfirm() { document.getElementById('modal-confirm').classList.remove('active'); }


// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const btnLogin = document.getElementById('btn-login');

    if (!usernameInput) { showCustomAlert('Por favor, digite seu usuário.'); return; }

    btnLogin.disabled = true; btnLogin.textContent = 'Validando...';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members?username=eq.${usernameInput}&select=*`, { method: 'GET', headers });
        const data = await response.json();

        if (data.length > 0) {
            currentUserData = data[0];
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else { showCustomAlert('Usuário não encontrado.'); }
    } catch (error) { showCustomAlert('Erro de conexão. Verifique sua internet.'); } 
    finally { btnLogin.disabled = false; btnLogin.textContent = 'Entrar'; }
}

function showSystemScreen() {
    document.getElementById('login-screen').classList.remove('active'); document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('system-screen').classList.remove('hidden'); document.getElementById('system-screen').classList.add('active');
    document.getElementById('user-display-name').textContent = currentUserData.full_name;

    if (currentUserData.is_leader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
    }
    // Todos podem adicionar música e medley
    document.getElementById('repertoire-actions').classList.remove('hidden');
    
    navigate('home');
    setupRealtimeSubscriptions();
}

function handleLogout() {
    // Desinscrever dos canais realtime
    realtimeChannels.forEach(ch => {
        try { supabase.removeChannel(ch); } catch(e) {}
    });
    realtimeChannels = [];
    
    localStorage.removeItem('sessionUser'); currentUserData = null; clearInterval(countdownInterval);
    document.getElementById('system-screen').classList.remove('active'); document.getElementById('system-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('login-screen').classList.add('active');
    document.getElementById('username').value = '';
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('btn-add-scale').classList.add('hidden');
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(page => { page.classList.remove('active'); page.classList.remove('hidden'); });
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
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
    const editingField = document.getElementById('editing-scale-id');
    if(editingField) editingField.value = '';
    const modalTitle = document.getElementById('scale-modal-title');
    if(modalTitle) modalTitle.textContent = 'Nova Escala';
    resetMedleyFlow();
}
function toggleSidebar() {} 

// ==========================================
// SUPABASE REALTIME - Sincronização ao vivo
// ==========================================
function setupRealtimeSubscriptions() {
    // Canal para mudanças no repertório
    const repChannel = supabase
        .channel('repertoire-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, (payload) => {
            console.log('Mudança no repertório:', payload);
            if(document.getElementById('page-repertorio').classList.contains('active')) {
                loadRepertoire();
            }
            // Atualizar o seletor de músicas do medley se estiver aberto
            if(document.getElementById('modal-add-medley').classList.contains('active')) {
                loadMedleySongsList();
            }
        })
        .subscribe();
    realtimeChannels.push(repChannel);

    // Canal para mudanças nas escalas
    const scaleChannel = supabase
        .channel('scale-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, (payload) => {
            console.log('Mudança nas escalas:', payload);
            if(document.getElementById('page-escalas').classList.contains('active')) {
                loadScales();
            }
            if(document.getElementById('page-home').classList.contains('active')) {
                fetchNextScaleHome();
            }
        })
        .subscribe();
    realtimeChannels.push(scaleChannel);

    // Canal para mudanças nos membros
    const memberChannel = supabase
        .channel('member-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
            console.log('Mudança nos membros:', payload);
            if(document.getElementById('page-membros').classList.contains('active')) {
                loadMembers();
            }
            if(document.getElementById('page-admin').classList.contains('active')) {
                loadAdminMembers();
            }
        })
        .subscribe();
    realtimeChannels.push(memberChannel);
}

// ==========================================
// INÍCIO (Relógio para 18:30)
// ==========================================
function loadDashboard() { startCountdown(); fetchDailyMessage(); fetchNextScaleHome(); }

function startCountdown() {
    clearInterval(countdownInterval);
    function updateTimer() {
        const now = new Date(); const target = new Date();
        const daysUntilSunday = (7 - now.getDay()) % 7;
        
        if (daysUntilSunday === 0 && (now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 30))) {
            target.setDate(now.getDate() + 7);
        } else {
            target.setDate(now.getDate() + daysUntilSunday);
        }
        target.setHours(18, 30, 0, 0);
        
        const diff = target - now;
        const d = Math.floor(diff / (1000 * 60 * 60 * 24)); const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((diff % (1000 * 60)) / 1000);
        document.getElementById('countdown-timer').textContent = `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    updateTimer(); countdownInterval = setInterval(updateTimer, 1000);
}

const worshipVerses = [
    { text: "Tudo o que tem vida louve o Senhor! Aleluia!", ref: "Salmos 150:6" },
    { text: "Os verdadeiros adoradores adorarão o Pai em espírito e em verdade.", ref: "João 4:23" },
    { text: "Cantem ao Senhor um novo cântico; cantem ao Senhor, toda a terra!", ref: "Salmos 96:1" }
];

async function fetchDailyMessage() {
    const dateString = new Date().toISOString().split('T')[0];
    const container = document.getElementById('daily-message-content');
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${dateString}&select=*`, { headers });
        const data = await res.json();
        if (data.length > 0) container.innerHTML = `<p>"${data[0].verse_text}"</p><span class="verse-ref">- ${data[0].verse_ref}</span>`;
        else {
            const verse = worshipVerses[new Date().getDate() % worshipVerses.length];
            container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
        }
    } catch (e) { container.innerHTML = `<p>Erro na mensagem.</p>`; }
}

// EQUIPE ESCALADA NO DASHBOARD - NOVO DESIGN
async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/rest/v1/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        const scaleData = await scaleRes.json();
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}&select=role,members(id,full_name)&order=role.asc`, { headers });
            const itemsData = await itemsRes.json();
            if (itemsData.length > 0) {
                let html = '<div class="team-scale-container">';
                
                const leaders = itemsData.filter(i => i.role === 'lider');
                const vocals = itemsData.filter(i => i.role === 'vocal');
                const band = itemsData.filter(i => !['lider', 'vocal'].includes(i.role));
                
                leaders.forEach(i => {
                    const isCurrent = i.members.id === currentUserData.id ? 'current-user' : '';
                    html += `
                        <div class="team-scale-row ${isCurrent}">
                            <div class="team-scale-avatar lider ${isCurrent}">${i.members.full_name.charAt(0)}</div>
                            <div class="team-scale-info">
                                <div class="team-scale-name">${i.members.full_name}</div>
                                <div class="team-scale-role">Líder</div>
                            </div>
                        </div>
                    `;
                });
                
                vocals.forEach(i => {
                    const isCurrent = i.members.id === currentUserData.id ? 'current-user' : '';
                    html += `
                        <div class="team-scale-row ${isCurrent}">
                            <div class="team-scale-avatar vocal ${isCurrent}">${i.members.full_name.charAt(0)}</div>
                            <div class="team-scale-info">
                                <div class="team-scale-name">${i.members.full_name}</div>
                                <div class="team-scale-role">Vocal</div>
                            </div>
                        </div>
                    `;
                });
                
                band.forEach(i => {
                    const isCurrent = i.members.id === currentUserData.id ? 'current-user' : '';
                    const roleName = i.role.charAt(0).toUpperCase() + i.role.slice(1);
                    html += `
                        <div class="team-scale-row ${isCurrent}">
                            <div class="team-scale-avatar instrumento ${isCurrent}">${i.members.full_name.charAt(0)}</div>
                            <div class="team-scale-info">
                                <div class="team-scale-name">${i.members.full_name}</div>
                                <div class="team-scale-role">${roleName}</div>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
                container.innerHTML = html;
            } else container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">Escala vazia.</p>`;
        } else container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">Nenhuma escala programada.</p>`;
    } catch (e) { container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:10px 0;">Erro ao carregar.</p>`; }
}

// ==========================================
// BUSCADOR 100% FIEL
// ==========================================
function openRepertoireModal() { 
    document.getElementById('modal-add-repertoire').classList.add('active'); 
    document.getElementById('search-results').innerHTML = '';
}

let cachedLyricsSearch = {};

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { showCustomAlert('Digite o nome da música ou cantor.'); return; }
    
    msgBox.textContent = 'Buscando e testando letras... Aguarde.';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        const data = await res.json();
        
        if(data.results.length === 0) { msgBox.textContent = 'Nada encontrado.'; return; }
        
        let foundAnyValid = false;

        for(let track of data.results) {
            try {
                const lyrRes = await fetch(`https://api.lyrics.ovh/v1/${track.artistName}/${track.trackName}`);
                if(lyrRes.ok) {
                    const lyrData = await lyrRes.json();
                    if(lyrData.lyrics && lyrData.lyrics.length > 20) {
                        foundAnyValid = true;
                        const uniqueId = track.trackId;
                        cachedLyricsSearch[uniqueId] = { artist: track.artistName, song: track.trackName, lyrics: lyrData.lyrics };
                        
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        div.innerHTML = `<div><strong>${track.trackName}</strong><br><small>${track.artistName}</small></div> <span class="material-symbols-outlined" style="color:var(--primary-color);">download_done</span>`;
                        div.onclick = () => importPreCheckedLyrics(uniqueId);
                        resultsContainer.appendChild(div);
                    }
                }
            } catch(err) {}
        }

        if(!foundAnyValid) {
            msgBox.textContent = 'Nenhuma letra completa foi encontrada. Tente outra busca.';
        } else {
            msgBox.textContent = 'Opções com letras confirmadas encontradas!';
        }

    } catch(e) { msgBox.textContent = 'Erro ao se conectar ao buscador.'; }
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`A letra de "${data.song}" foi importada!`, "Letra Importada");
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    if(!title || !lyrics) { showCustomAlert('Título e Letra são obrigatórios!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ title, lyrics_text: lyrics, created_by: currentUserData.id }) });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) });
        }
        showCustomAlert('Música salva com sucesso!', "Sucesso"); closeModals(); loadRepertoire();
    } catch(e) { showCustomAlert('Erro ao salvar no banco.'); }
}

// ==========================================
// REPERTÓRIO
// ==========================================
async function loadRepertoire() {
    const list = document.getElementById('repertoire-list');
    list.innerHTML = '<p class="loading-text">Buscando músicas...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton)&order=title.asc`, { headers });
        allRepertoireCache = await res.json();
        if (allRepertoireCache.length === 0) { list.innerHTML = '<p>Nenhuma música.</p>'; return; }
        let html = '';
        allRepertoireCache.forEach(song => {
            let keysHtml = ''; song.repertoire_keys.forEach(k => { keysHtml += `<span class="badge tom">${k.ton}</span>`; });
            html += `
                <div class="playlist-item" onclick="openViewRepertoire('${song.id}', \`${song.title.replace(/`/g, "'")}\`, \`${encodeURIComponent(song.lyrics_text || '')}\`, ${song.is_medley})">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">${song.is_medley ? 'queue_music' : 'music_note'}</span></div>
                        <div class="play-title"><h4>${song.title}</h4><p>${song.is_medley ? 'Medley' : 'Louvor'}</p></div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p>Erro.</p>'; }
}

// ==========================================
// MEDLEY - SELEÇÃO DE ESTROFES
// ==========================================

// Parser de estrofes: detecta padrões como "Verso 1", "Refrão", "Ponte", etc.
function parseLyricsIntoVerses(lyrics) {
    if (!lyrics) return [];
    
    const lines = lyrics.split('\n');
    const verses = [];
    let currentLabel = 'Intro';
    let currentLines = [];
    
    // Padrões conhecidos de seções
    const sectionPatterns = [
        /^(intro|introdução)\s*\d*$/i,
        /^(verso|verse)\s*\d*$/i,
        /^(pr[eé]-?refr[aã]o|pre-?chorus)\s*\d*$/i,
        /^(refr[aã]o|chorus)\s*\d*$/i,
        /^(ponte|bridge)\s*\d*$/i,
        /^(final|outro|encerramento)\s*\d*$/i,
        /^(interlúdio|interlude)\s*\d*$/i,
        /^(solo)\s*\d*$/i
    ];
    
    function detectSection(line) {
        const cleanLine = line.trim().replace(/[:\[\]()]/g, '');
        for (let pattern of sectionPatterns) {
            if (pattern.test(cleanLine)) {
                // Normalizar o label
                if (/^intro/i.test(cleanLine)) return 'Intro';
                if (/^verso/i.test(cleanLine)) {
                    const num = cleanLine.match(/\d+/);
                    return num ? `Verso ${num[0]}` : 'Verso';
                }
                if (/^pr[eé]/i.test(cleanLine)) return 'Pré-Refrão';
                if (/^refr/i.test(cleanLine)) {
                    const num = cleanLine.match(/\d+/);
                    return num ? `Refrão ${num[0]}` : 'Refrão';
                }
                if (/^ponte|^bridge/i.test(cleanLine)) return 'Ponte';
                if (/^final|^outro/i.test(cleanLine)) return 'Final';
                if (/^inter/i.test(cleanLine)) return 'Interlúdio';
                if (/^solo/i.test(cleanLine)) return 'Solo';
            }
        }
        return null;
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const detectedSection = detectSection(line);
        
        if (detectedSection) {
            // Salvar seção anterior se tiver conteúdo
            if (currentLines.length > 0) {
                verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
            }
            currentLabel = detectedSection;
            currentLines = [];
        } else if (line.trim() === '') {
            // Linha em branco pode indicar separação
            if (currentLines.length > 0 && i + 1 < lines.length && lines[i+1].trim() !== '') {
                // Verificar se a próxima linha é uma nova seção
                const nextDetected = detectSection(lines[i+1]);
                if (!nextDetected) {
                    // Não é nova seção, continua
                }
            }
        } else {
            currentLines.push(line);
        }
    }
    
    // Salvar última seção
    if (currentLines.length > 0) {
        verses.push({ label: currentLabel, content: currentLines.join('\n').trim() });
    }
    
    // Se não detectou nada, dividir por blocos de texto
    if (verses.length <= 1 && lyrics.trim().split(/\n\s*\n/).length > 1) {
        const blocks = lyrics.trim().split(/\n\s*\n/);
        return blocks.map((block, idx) => ({
            label: `Parte ${idx + 1}`,
            content: block.trim()
        }));
    }
    
    return verses;
}

function openMedleyModal() {
    document.getElementById('modal-add-medley').classList.add('active');
    resetMedleyFlow();
    loadMedleySongsList();
}

function resetMedleyFlow() {
    medleyDraft = [];
    medleyCurrentSongId = null;
    medleyCurrentSongVerses = [];
    renderMedleyPreview();
    document.getElementById('medley-title').value = '';
    document.getElementById('medley-verses-selector').innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Selecione uma música ao lado para escolher as partes</p>';
}

async function loadMedleySongsList() {
    const container = document.getElementById('medley-songs-list');
    container.innerHTML = '<p class="loading-text">Carregando...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton)&is_medley=eq.false&order=title.asc`, { headers });
        const songs = await res.json();
        allRepertoireCache = songs; // Atualiza cache
        
        if (songs.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Nenhuma música no repertório</p>';
            return;
        }
        
        let html = '';
        songs.forEach(song => {
            const keysStr = song.repertoire_keys.map(k => k.ton).join(', ');
            const keyBadge = keysStr ? `<span class="badge tom" style="font-size:0.7rem;">${keysStr}</span>` : '';
            const isSelected = medleyDraft.some(d => d.songId === song.id);
            html += `
                <div class="medley-song-item ${isSelected ? 'active' : ''}" onclick="selectMedleySong('${song.id}')">
                    <div class="medley-song-item-title">${song.title} ${keyBadge}</div>
                    ${isSelected ? '<div style="font-size:0.75rem; color:var(--success); margin-top:4px;">✓ Já adicionada ao medley</div>' : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--danger); text-align:center;">Erro ao carregar músicas</p>';
    }
}

async function selectMedleySong(songId) {
    medleyCurrentSongId = songId;
    const song = allRepertoireCache.find(s => s.id === songId);
    if (!song) return;
    
    // Parse da letra em estrofes
    const verses = parseLyricsIntoVerses(song.lyrics_text);
    
    // Verificar se já está no draft (para manter seleções anteriores)
    const existingDraft = medleyDraft.find(d => d.songId === songId);
    
    medleyCurrentSongVerses = verses.map((v, idx) => ({
        ...v,
        id: `${songId}_v${idx}`,
        selected: existingDraft ? existingDraft.sections.some(s => s.label === v.label && s.content === v.content) : false
    }));
    
    renderVersesSelector(song.title);
}

function renderVersesSelector(songTitle) {
    const container = document.getElementById('medley-verses-selector');
    
    if (medleyCurrentSongVerses.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Não foi possível identificar as estrofes desta música</p>';
        return;
    }
    
    let html = `
        <div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
            <strong style="color:var(--primary-color);">${songTitle}</strong>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Selecione as partes que deseja incluir no medley:</div>
        </div>
        <button class="btn-secondary" onclick="selectAllVerses()" style="width:100%; margin-bottom:10px; font-size:0.85rem;">✓ Selecionar Todas</button>
    `;
    
    medleyCurrentSongVerses.forEach((verse, idx) => {
        html += `
            <div class="verse-selector-item ${verse.selected ? 'selected' : ''}" id="verse-item-${idx}">
                <div class="verse-checkbox-wrapper">
                    <input type="checkbox" class="verse-checkbox" id="verse-cb-${idx}" ${verse.selected ? 'checked' : ''} onchange="toggleVerse(${idx})">
                    <div class="verse-label" onclick="toggleVerse(${idx})">
                        <div class="verse-section-title">
                            <span class="material-symbols-outlined" style="font-size:1rem;">music_note</span>
                            ${verse.label}
                        </div>
                        <div class="verse-content">${verse.content}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `<button class="btn-primary" onclick="addSelectedVersesToMedley()" style="margin-top:12px;">+ Adicionar Partes Selecionadas ao Medley</button>`;
    
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
        showCustomAlert('Selecione pelo menos uma parte para adicionar ao medley.');
        return;
    }
    
    const song = allRepertoireCache.find(s => s.id === medleyCurrentSongId);
    
    // Remover entrada anterior desta música se existir
    medleyDraft = medleyDraft.filter(d => d.songId !== medleyCurrentSongId);
    
    // Adicionar nova entrada
    medleyDraft.push({
        songId: medleyCurrentSongId,
        songTitle: song.title,
        sections: selectedVerses.map(v => ({ label: v.label, content: v.content }))
    });
    
    renderMedleyPreview();
    loadMedleySongsList(); // Atualiza para mostrar "Já adicionada"
    
    showCustomAlert(`${selectedVerses.length} parte(s) de "${song.title}" adicionada(s) ao medley!`, 'Partes Adicionadas');
}

function removeMedleySong(songId) {
    medleyDraft = medleyDraft.filter(d => d.songId !== songId);
    renderMedleyPreview();
    loadMedleySongsList();
}

function renderMedleyPreview() {
    const container = document.getElementById('medley-preview');
    
    if (medleyDraft.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">As partes selecionadas aparecerão aqui</p>';
        return;
    }
    
    let html = '<div class="medley-preview-content">';
    let totalParts = 0;
    
    medleyDraft.forEach((item, idx) => {
        html += `
            <div class="medley-preview-song">
                <div class="medley-preview-song-title">
                    <span class="material-symbols-outlined" style="font-size:1.1rem;">queue_music</span>
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
    
    html += `
        </div>
        <div style="margin-top:12px; padding:10px; background:#e3f2fd; border-radius:8px; font-size:0.85rem;">
            <strong>Resumo:</strong> ${medleyDraft.length} música(s), ${totalParts} parte(s) selecionada(s)
        </div>
    `;
    
    container.innerHTML = html;
}

async function saveNewMedley() {
    const title = document.getElementById('medley-title').value.trim();
    if(!title) { showCustomAlert('Dê um nome ao Medley.'); return; }
    if(medleyDraft.length < 2) { showCustomAlert('O Medley precisa de pelo menos 2 músicas.'); return; }
    
    // Verificar se todas as músicas têm pelo menos uma seção
    for (let item of medleyDraft) {
        if (item.sections.length === 0) {
            showCustomAlert(`A música "${item.songTitle}" não tem partes selecionadas.`);
            return;
        }
    }

    try {
        // Criar o medley no repertório
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                title: title, 
                is_medley: true, 
                created_by: currentUserData.id,
                lyrics_text: generateMedleyLyrics() // Letra completa do medley
            }) 
        });
        const savedMedley = await res.json();
        const medleyId = savedMedley[0].id;

        // Salvar cada parte no repertoire_medley_parts
        for(let item of medleyDraft) {
            for(let section of item.sections) {
                await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts`, { 
                    method: 'POST', 
                    headers, 
                    body: JSON.stringify({ 
                        medley_repertoire_id: medleyId, 
                        song_repertoire_id: item.songId, 
                        section: section.label,
                        section_content: section.content
                    }) 
                });
            }
        }
        
        showCustomAlert('Medley criado com sucesso!', 'Sucesso'); 
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

async function openViewRepertoire(id, title, encodedLyrics, isMedley) {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    const addBox = document.getElementById('box-add-key');
    if(currentUserData.is_leader) addBox.classList.remove('hidden'); else addBox.classList.add('hidden');
    loadKeysForRepertoire(id);

    const partsDisplay = document.getElementById('medley-parts-display');
    if(isMedley) {
        partsDisplay.classList.remove('hidden'); 
        partsDisplay.innerHTML = 'Carregando estrutura...';
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,section_content,repertoire!song_repertoire_id(title)&order=created_at.asc`, { headers });
            const parts = await res.json();
            
            if (parts.length > 0 && parts[0].section_content) {
                // Nova estrutura com conteúdo das seções
                let html = '<strong>Estrutura do Medley:</strong><br>';
                parts.forEach((p, idx) => { 
                    html += `<div style="padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
                        <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> 
                        <span style="color:var(--primary-color); font-weight:600;">→ ${p.section}</span>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:3px; white-space:pre-wrap; max-height:80px; overflow:hidden;">${p.section_content}</div>
                    </div>`; 
                });
                partsDisplay.innerHTML = html;
            } else {
                // Estrutura antiga (sem conteúdo)
                let html = '<strong>Estrutura do Medley:</strong><br>';
                parts.forEach((p, idx) => { 
                    html += `<div style="padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                        • <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> → <span style="color:var(--primary-color); font-weight:600;">${p.section}</span>
                    </div>`; 
                });
                partsDisplay.innerHTML = html;
            }
        } catch(e) {
            partsDisplay.innerHTML = 'Erro ao carregar estrutura.';
        }
    } else { 
        partsDisplay.classList.add('hidden'); 
    }
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys'); container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        let html = '';
        keys.forEach(k => {
            let deleteBtn = currentUserData.is_leader ? `<span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span>` : '';
            html += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} ${deleteBtn}</span>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if(!newKey || !currentViewingRepertoireId) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey }) });
        document.getElementById('new-key-input').value = ''; loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire();
    } catch(e) { showCustomAlert('Erro ao adicionar tom.'); }
}

async function deleteKey(keyId) {
    showCustomConfirm('Deseja remover este tom?', async () => {
        try { await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers }); loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire(); } 
        catch(e) {}
    });
}

// ==========================================
// MEMBROS - Visualização em Formação de Time
// ==========================================
async function loadMembers() {
    const lineup = document.getElementById('members-lineup');
    lineup.innerHTML = '<p class="loading-text" style="color:white;">Buscando equipe...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        if (members.length === 0) { lineup.innerHTML = '<p style="color:white; text-align:center;">Nenhum membro cadastrado.</p>'; return; }
        
        let team = { lider:[], vocal:[], banda:[], membro:[] };
        members.forEach(m => {
            let p = { id: m.id, name: m.full_name };
            const roles = m.member_roles.map(r => r.role);
            
            if(m.is_leader) team.lider.push(p);
            else if(roles.includes('vocal')) team.vocal.push(p);
            else if(roles.length > 0) team.banda.push({...p, role: roles[0]});
            else team.membro.push(p);
        });
        
        let html = '';
        
        if(team.lider.length > 0) {
            html += '<div class="lineup-row">';
            team.lider.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar lider ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Líder</span></div>`;
            });
            html += '</div>';
        }
        
        if(team.vocal.length > 0) {
            html += '<div class="lineup-row">';
            team.vocal.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Vocal</span></div>`;
            });
            html += '</div>';
        }
        
        if(team.banda.length > 0) {
            html += '<div class="lineup-row">';
            team.banda.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">${p.role || 'Membro'}</span></div>`;
            });
            html += '</div>';
        }
        
        if(team.membro.length > 0) {
            html += '<div class="lineup-row">';
            team.membro.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Membro</span></div>`;
            });
            html += '</div>';
        }
        
        lineup.innerHTML = html || '<p style="color:white; text-align:center;">Nenhum membro encontrado.</p>';
    } catch (e) { lineup.innerHTML = '<p style="color:white; text-align:center;">Erro ao carregar equipe.</p>'; }
}

// ==========================================
// ESCALAS (com Tom nas músicas)
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
    listFuture.innerHTML = '<p>Buscando...</p>'; listPast.innerHTML = '<p>Buscando...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title,repertoire_keys(ton)))&order=event_date.asc`, { headers });
        const scales = await res.json();
        
        const todayStr = new Date().toISOString().split('T')[0];
        const futures = scales.filter(s => s.event_date >= todayStr);
        const pasts = scales.filter(s => s.event_date < todayStr).reverse();

        listFuture.innerHTML = renderScaleCards(futures, true);
        listPast.innerHTML = renderScaleCards(pasts, false);

    } catch(e) { listFuture.innerHTML = '<p>Erro.</p>'; listPast.innerHTML = '';}
}

function renderScaleCards(scaleArray, isFuture) {
    if(scaleArray.length === 0) return isFuture ? '<p>Nenhuma escala programada.</p>' : '<p>O histórico está vazio.</p>';
    
    let html = '';
    scaleArray.forEach(s => {
        const dateObj = new Date(s.event_date);
        const dateStr = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
        
        let team = { lider:[], vocal:[], banda:[] };
        s.scale_items.forEach(i => {
            let p = { name: i.members.full_name, role: i.role };
            if(i.role === 'lider') team.lider.push(p);
            else if(i.role === 'vocal') team.vocal.push(p);
            else team.banda.push(p);
        });

        let lineupHtml = '<div class="lineup-field">';
        if(team.lider.length > 0) {
            lineupHtml += '<div class="lineup-row">';
            team.lider.forEach(p => lineupHtml += `<div class="lineup-player"><div class="player-avatar lider">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Líder</span></div>`);
            lineupHtml += '</div>';
        }
        if(team.vocal.length > 0) {
            lineupHtml += '<div class="lineup-row">';
            team.vocal.forEach(p => lineupHtml += `<div class="lineup-player"><div class="player-avatar">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Vocal</span></div>`);
            lineupHtml += '</div>';
        }
        if(team.banda.length > 0) {
            lineupHtml += '<div class="lineup-row">';
            team.banda.forEach(p => lineupHtml += `<div class="lineup-player"><div class="player-avatar">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">${p.role}</span></div>`);
            lineupHtml += '</div>';
        }
        lineupHtml += '</div>';

        let songsHtml = ''; 
        s.scale_songs.forEach(song => { 
            const keys = song.repertoire.repertoire_keys || [];
            const keysStr = keys.length > 0 ? keys.map(k => k.ton).join(', ') : '';
            const keyBadge = keysStr ? `<span class="badge tom" style="font-size:0.7rem; padding:2px 8px; margin-left:auto;">${keysStr}</span>` : '';
            songsHtml += `<span> ${song.repertoire.title} ${keyBadge}</span>`; 
        });

        const actionsHtml = currentUserData.is_leader ? `
            <div class="scale-folder-actions">
                <button class="btn-icon" onclick="openEditScaleModal('${s.id}')" title="Editar Escala"><span class="material-symbols-outlined" style="font-size:1.1rem;">edit</span></button>
                <button class="btn-icon danger" onclick="deleteScale('${s.id}')" title="Excluir Escala"><span class="material-symbols-outlined" style="font-size:1.1rem;">delete</span></button>
            </div>
        ` : '';

        html += `
            <div class="scale-folder">
                <div class="scale-folder-header">
                    <div class="scale-folder-header-text">
                        <h3><span class="material-symbols-outlined">${isFuture ? 'event' : 'inventory_2'}</span> Culto: ${dateStr}</h3>
                        <p>${s.notes || 'Sem observações'}</p>
                    </div>
                    ${actionsHtml}
                </div>
                ${lineupHtml}
                <div class="scale-songs-list">${songsHtml || 'Nenhuma música definida.'}</div>
            </div>`;
    });
    return html;
}

async function deleteScale(scaleId) {
    showCustomConfirm('Deseja realmente excluir esta escala? Esta ação removerá a equipe e o repertório vinculados e não pode ser desfeita.', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}`, { method: 'DELETE', headers });
            
            if(!res.ok) throw new Error('Falha ao excluir');
            
            showCustomAlert('Escala excluída com sucesso!', 'Sucesso');
            loadScales();
            if(document.getElementById('page-home').classList.contains('active')) {
                fetchNextScaleHome();
            }
        } catch (e) { 
            showCustomAlert('Erro ao excluir escala. Verifique sua conexão.'); 
        }
    }, 'Excluir Escala');
}

async function openEditScaleModal(scaleId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${scaleId}&select=*,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`, { headers });
        const data = await res.json();
        if(data.length === 0) { showCustomAlert('Escala não encontrada.'); return; }
        
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
            const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title&order=title.asc`, { headers });
            allRepertoireCache = await resRep.json();
        }
        
        const memberSelect = document.getElementById('scale-draft-member');
        memberSelect.innerHTML = '<option value="">Selecionar Membro...</option>';
        allMembersCache.forEach(m => { memberSelect.innerHTML += `<option value="${m.id}">${m.full_name}</option>`; });
        
        const songsContainer = document.getElementById('scale-songs-selectors');
        const selectedSongIds = scale.scale_songs.map(s => s.repertoire_id);
        songsContainer.innerHTML = '';
        allRepertoireCache.forEach(song => {
            const checked = selectedSongIds.includes(song.id) ? 'checked' : '';
            songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}> ${song.title}</label>`;
        });
        
    } catch (e) { 
        showCustomAlert('Erro ao carregar escala para edição.'); 
    }
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    document.getElementById('editing-scale-id').value = '';
    document.getElementById('scale-modal-title').textContent = 'Nova Escala';
    scaleDraftTeam = []; renderScaleDraftTeam();
    
    if(allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,member_roles(role)`, { headers });
        allMembersCache = await res.json();
    }
    if(allRepertoireCache.length === 0) {
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title&order=title.asc`, { headers });
        allRepertoireCache = await resRep.json();
    }

    const memberSelect = document.getElementById('scale-draft-member');
    memberSelect.innerHTML = '<option value="">Selecionar Membro...</option>';
    allMembersCache.forEach(m => { memberSelect.innerHTML += `<option value="${m.id}">${m.full_name}</option>`; });

    const songsContainer = document.getElementById('scale-songs-selectors');
    songsContainer.innerHTML = '';
    allRepertoireCache.forEach(song => {
        songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb"> ${song.title}</label>`;
    });
}

function addMemberToScaleDraft() {
    const memSel = document.getElementById('scale-draft-member');
    const rolSel = document.getElementById('scale-draft-role');
    const memberId = memSel.value; const role = rolSel.value;
    
    if(!memberId) return;
    const memberName = memSel.options[memSel.selectedIndex].text;
    
    if(!scaleDraftTeam.find(i => i.memberId === memberId && i.role === role)) {
        scaleDraftTeam.push({ memberId, role, name: memberName });
    }
    memSel.value = ''; renderScaleDraftTeam();
}

function removeScaleDraftMember(index) { scaleDraftTeam.splice(index, 1); renderScaleDraftTeam(); }

function renderScaleDraftTeam() {
    const list = document.getElementById('scale-draft-team-list');
    if(scaleDraftTeam.length === 0) { list.innerHTML = '<p class="loading-text" style="font-size:0.85rem;">Equipe vazia.</p>'; return; }
    
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
    
    if(!date) { showCustomAlert('A data do culto é obrigatória.'); return; }
    if(scaleDraftTeam.length === 0) { showCustomAlert('Escalone pelo menos 1 membro na equipe.'); return; }

    try {
        let scaleId;
        
        if(editingId) {
            await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${editingId}`, { 
                method: 'PATCH', 
                headers, 
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
                method: 'POST', 
                headers, 
                body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role }) 
            });
        }

        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for(let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value }) 
            });
        }

        const successMsg = editingId ? 'Escala atualizada e sincronizada com sucesso!' : 'Escala criada e salva com sucesso!';
        showCustomAlert(successMsg, 'Sucesso'); 
        closeModals(); 
        loadScales();
        if(document.getElementById('page-home').classList.contains('active')) {
            fetchNextScaleHome();
        }
    } catch(e) { showCustomAlert('Erro ao salvar escala. Verifique a conexão.'); }
}

// ==========================================
// MEMBROS E ADMINISTRAÇÃO 
// ==========================================
async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase(); 
    const fullname = document.getElementById('new-fullname').value.trim(); 
    const isLeader = document.getElementById('new-is-leader').checked; 
    if (!username || !fullname) { showCustomAlert('Preencha usuário e nome!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ username, full_name: fullname, is_leader: isLeader }) });
        if (!res.ok) throw new Error('Usuário já existe.');
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso'); 
        document.getElementById('new-username').value = ''; 
        document.getElementById('new-fullname').value = ''; 
        document.getElementById('new-is-leader').checked = false; 
        loadAdminMembers();
    } catch (e) { showCustomAlert(e.message, 'Erro'); }
}

async function loadAdminMembers() {
    const list = document.getElementById('admin-members-list'); list.innerHTML = '<p>Carregando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json(); let html = '';
        members.forEach(m => {
            const currentRoles = m.member_roles.map(r => r.role);
            html += `<div class="admin-list-item" id="admin-item-${m.id}">
                    <div><strong>${m.full_name}</strong> <span style="font-size:0.8rem">(${m.username})</span></div>
                    <div class="admin-actions"><button class="btn-icon" onclick="document.getElementById('editor-${m.id}').classList.toggle('hidden')"><span class="material-symbols-outlined">edit_attributes</span></button><button class="btn-icon danger" onclick="deleteMember('${m.id}')"><span class="material-symbols-outlined">delete</span></button></div>
                    <div class="roles-editor hidden" id="editor-${m.id}">${['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo'].map(role => `<label class="role-check-item"><input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) || (role==='lider' && m.is_leader) ? 'checked' : ''}>${role.toUpperCase()}</label>`).join('')}</div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = '<p>Erro ao carregar lista.</p>'; }
}

async function updateRole(memberId, role, isAdding) {
    try {
        if(role === 'lider') { await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${memberId}`, { method: 'PATCH', headers, body: JSON.stringify({ is_leader: isAdding }) }); return; }
        if (isAdding) await fetch(`${SUPABASE_URL}/rest/v1/member_roles`, { method: 'POST', headers, body: JSON.stringify({ member_id: memberId, role: role }) });
        else await fetch(`${SUPABASE_URL}/rest/v1/member_roles?member_id=eq.${memberId}&role=eq.${role}`, { method: 'DELETE', headers });
    } catch (e) { showCustomAlert('Erro ao atualizar banco.'); }
}

async function deleteMember(id) {
    showCustomConfirm('Deseja remover este membro do sistema?', async () => {
        try { await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers }); loadAdminMembers(); } catch (e) { showCustomAlert('Erro ao excluir.'); }
    });
}

window.onload = () => {
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { currentUserData = JSON.parse(storedUser); showSystemScreen(); }
};
