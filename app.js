const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let allRepertoireCache = [];
let allMembersCache = [];

// Variáveis para os rascunhos (Medley e Escala)
let medleyDraft = []; 
let scaleDraftTeam = [];

// Variáveis do fluxo passo-a-passo do Medley
let medleyCurrentSong = null; // {id, title}
let medleySelectedSection = null; // string

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
        const response = await fetch(`${SUPABASE_URL}/members?username=eq.${usernameInput}&select=*`, { method: 'GET', headers });
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
        document.getElementById('repertoire-actions').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
    }
    navigate('home');
}

function handleLogout() {
    localStorage.removeItem('sessionUser'); currentUserData = null; clearInterval(countdownInterval);
    document.getElementById('system-screen').classList.remove('active'); document.getElementById('system-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('login-screen').classList.add('active');
    document.getElementById('username').value = '';
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('repertoire-actions').classList.add('hidden');
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
    // Reset do modo de edição de escala
    const editingField = document.getElementById('editing-scale-id');
    if(editingField) editingField.value = '';
    const modalTitle = document.getElementById('scale-modal-title');
    if(modalTitle) modalTitle.textContent = 'Nova Escala';
    // Reset do fluxo do medley
    resetMedleyFlow();
}
function toggleSidebar() {} 

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
        const res = await fetch(`${SUPABASE_URL}/daily_message?date=eq.${dateString}&select=*`, { headers });
        const data = await res.json();
        if (data.length > 0) container.innerHTML = `<p>"${data[0].verse_text}"</p><span class="verse-ref">- ${data[0].verse_ref}</span>`;
        else {
            const verse = worshipVerses[new Date().getDate() % worshipVerses.length];
            container.innerHTML = `<p>"${verse.text}"</p><span class="verse-ref">- ${verse.ref}</span>`;
        }
    } catch (e) { container.innerHTML = `<p>Erro na mensagem.</p>`; }
}

// EQUIPE ESCALADA NO DASHBOARD - Formato de Time (Lineup) com destaque do usuário logado
async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        const scaleData = await scaleRes.json();
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}&select=role,members(id,full_name)&order=role.asc`, { headers });
            const itemsData = await itemsRes.json();
            if (itemsData.length > 0) {
                // Agrupar por função
                let team = { lider:[], vocal:[], banda:[] };
                itemsData.forEach(i => {
                    let p = { id: i.members.id, name: i.members.full_name, role: i.role };
                    if(i.role === 'lider') team.lider.push(p);
                    else if(i.role === 'vocal') team.vocal.push(p);
                    else team.banda.push(p);
                });

                let html = '<div class="lineup-field lineup-mini">';
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
                        html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">${p.role}</span></div>`;
                    });
                    html += '</div>';
                }
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
    msgBox.className = 'admin-message';
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
            msgBox.textContent = 'Nenhuma letra completa foi encontrada para essa busca. Digite outra ou adicione manualmente.';
            msgBox.className = 'admin-message msg-error';
        } else {
            msgBox.textContent = 'Opções com letras confirmadas encontradas!';
            msgBox.className = 'admin-message msg-success';
        }

    } catch(e) { msgBox.textContent = 'Erro ao se conectar ao buscador.'; }
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`A letra de "${data.song}" foi importada! Role para baixo para salvar.`, "Letra Importada");
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    if(!title || !lyrics) { showCustomAlert('Título e Letra são obrigatórios!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ title, lyrics_text: lyrics, created_by: currentUserData.id }) });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) });
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
        const res = await fetch(`${SUPABASE_URL}/repertoire?select=*,repertoire_keys(ton)&order=title.asc`, { headers });
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
// MEDLEY - FLUXO PASSO-A-PASSO
// ==========================================
function openMedleyModal() {
    document.getElementById('modal-add-medley').classList.add('active');
    resetMedleyFlow();
    
    const selector = document.getElementById('medley-song-selector');
    selector.innerHTML = '<option value="">Selecione do Repertório...</option>';
    const songs = allRepertoireCache.filter(s => !s.is_medley);
    songs.forEach(s => { selector.innerHTML += `<option value="${s.id}">${s.title}</option>`; });
}

function resetMedleyFlow() {
    medleyDraft = [];
    medleyCurrentSong = null;
    medleySelectedSection = null;
    renderMedleyDraft();
    backToMedleySongStep();
    document.getElementById('medley-title').value = '';
    const selector = document.getElementById('medley-song-selector');
    if(selector) selector.value = '';
}

function renderMedleyDraft() {
    const list = document.getElementById('medley-draft-list');
    if(medleyDraft.length === 0) { 
        list.innerHTML = '<p class="loading-text" style="font-size:0.85rem;">Nenhuma música adicionada ainda. Use os passos abaixo para adicionar.</p>'; 
        return; 
    }
    
    let html = '';
    medleyDraft.forEach((item, index) => {
        html += `
            <div class="medley-draft-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${index+1}. ${item.title}</strong>
                    <span class="material-symbols-outlined" style="color:var(--danger); cursor:pointer; font-size:1.2rem;" onclick="removeMedleyDraftItem(${index})">delete</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:5px;">
                    <span class="material-symbols-outlined" style="color:var(--primary-color); font-size:1rem;">music_note</span>
                    <span style="font-size:0.85rem; color:var(--text-muted);">Seção: <strong style="color:var(--text-main);">${item.part}</strong></span>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function removeMedleyDraftItem(index) { 
    medleyDraft.splice(index, 1); 
    renderMedleyDraft(); 
}

// PASSO 1 → PASSO 2: Avança da seleção de música para seleção de seção
function goToMedleySectionStep() {
    const select = document.getElementById('medley-song-selector');
    const songId = select.value;
    if(!songId) { 
        showCustomAlert('Selecione uma música do repertório antes de avançar.'); 
        return; 
    }
    
    const songObj = allRepertoireCache.find(s => s.id === songId);
    medleyCurrentSong = { id: songObj.id, title: songObj.title };
    
    // Atualiza UI
    document.getElementById('medley-current-song-name').textContent = songObj.title;
    document.getElementById('medley-step-song').classList.add('hidden');
    document.getElementById('medley-step-section').classList.remove('hidden');
    
    // Limpa seleções anteriores
    medleySelectedSection = null;
    document.getElementById('medley-custom-section').value = '';
    document.querySelectorAll('.section-btn').forEach(btn => btn.classList.remove('selected'));
}

// PASSO 2 → PASSO 1: Volta para seleção de música
function backToMedleySongStep() {
    document.getElementById('medley-step-section').classList.add('hidden');
    document.getElementById('medley-step-song').classList.remove('hidden');
    medleyCurrentSong = null;
    medleySelectedSection = null;
    document.getElementById('medley-custom-section').value = '';
    document.querySelectorAll('.section-btn').forEach(btn => btn.classList.remove('selected'));
}

// Seleciona uma seção pré-definida (clicando no botão)
function selectMedleySection(btn, section) {
    document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    medleySelectedSection = section;
    document.getElementById('medley-custom-section').value = section;
}

// Limpa seleção dos botões quando o usuário digita manualmente
function clearMedleySectionButtons() {
    document.querySelectorAll('.section-btn').forEach(b => b.classList.remove('selected'));
    medleySelectedSection = null;
}

// Confirma a seção e adiciona ao draft
function confirmMedleySection() {
    const customSection = document.getElementById('medley-custom-section').value.trim();
    const finalSection = customSection || medleySelectedSection;
    
    if(!finalSection) {
        showCustomAlert('Você precisa escolher ou digitar uma seção/parte para esta música.');
        return;
    }
    
    if(!medleyCurrentSong) {
        showCustomAlert('Erro: nenhuma música selecionada.');
        return;
    }
    
    // Adiciona ao draft
    medleyDraft.push({
        id: medleyCurrentSong.id,
        title: medleyCurrentSong.title,
        part: finalSection
    });
    
    renderMedleyDraft();
    
    // Volta para o passo 1 para adicionar próxima música
    backToMedleySongStep();
    document.getElementById('medley-song-selector').value = '';
    
    showCustomAlert(`"${medleyCurrentSong.title}" adicionada com a seção "${finalSection}". Adicione mais músicas ou salve o Medley.`, 'Música Adicionada');
}

// Salva o Medley completo no banco
async function saveNewMedley() {
    const title = document.getElementById('medley-title').value.trim();
    if(!title) { showCustomAlert('Dê um nome ao Medley.'); return; }
    if(medleyDraft.length < 2) { showCustomAlert('O Medley precisa de pelo menos 2 músicas.'); return; }

    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ title: title, is_medley: true, created_by: currentUserData.id }) });
        const savedMedley = await res.json();
        const medleyId = savedMedley[0].id;

        for(let item of medleyDraft) {
            await fetch(`${SUPABASE_URL}/repertoire_medley_parts`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify({ medley_repertoire_id: medleyId, song_repertoire_id: item.id, section: item.part }) 
            });
        }
        showCustomAlert('Medley criado com sucesso!', 'Sucesso'); 
        closeModals(); 
        loadRepertoire();
    } catch(e) { showCustomAlert('Erro ao salvar medley.'); }
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
        partsDisplay.classList.remove('hidden'); partsDisplay.innerHTML = 'Carregando partes...';
        const res = await fetch(`${SUPABASE_URL}/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,repertoire!song_repertoire_id(title)`, { headers });
        const parts = await res.json();
        let html = '<strong>Estrutura do Medley:</strong><br>';
        parts.forEach((p, idx) => { html += `<div style="padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.05);">• <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> → <span style="color:var(--primary-color); font-weight:600;">${p.section}</span></div>`; });
        partsDisplay.innerHTML = html;
    } else { partsDisplay.classList.add('hidden'); }
}

async function loadKeysForRepertoire(id) {
    const container = document.getElementById('view-rep-keys'); container.innerHTML = '';
    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire_keys?repertoire_id=eq.${id}`, { headers });
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
        await fetch(`${SUPABASE_URL}/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: currentViewingRepertoireId, ton: newKey }) });
        document.getElementById('new-key-input').value = ''; loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire();
    } catch(e) { showCustomAlert('Erro ao adicionar tom.'); }
}

async function deleteKey(keyId) {
    showCustomConfirm('Deseja remover este tom?', async () => {
        try { await fetch(`${SUPABASE_URL}/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers }); loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire(); } 
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
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        if (members.length === 0) { lineup.innerHTML = '<p style="color:white; text-align:center;">Nenhum membro cadastrado.</p>'; return; }
        
        // Agrupar por função principal (cada membro aparece apenas uma vez)
        let team = { lider:[], vocal:[], banda:[], membro:[] };
        members.forEach(m => {
            let p = { id: m.id, name: m.full_name };
            const roles = m.member_roles.map(r => r.role);
            
            if(m.is_leader) {
                team.lider.push(p);
            } else if(roles.includes('vocal')) {
                team.vocal.push(p);
            } else if(roles.length > 0) {
                // Pega o primeiro instrumento
                team.banda.push({...p, role: roles[0]});
            } else {
                team.membro.push(p);
            }
        });
        
        let html = '';
        
        // Linha 1: Líderes
        if(team.lider.length > 0) {
            html += '<div class="lineup-row">';
            team.lider.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar lider ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Líder</span></div>`;
            });
            html += '</div>';
        }
        
        // Linha 2: Vocais
        if(team.vocal.length > 0) {
            html += '<div class="lineup-row">';
            team.vocal.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Vocal</span></div>`;
            });
            html += '</div>';
        }
        
        // Linha 3: Instrumentistas
        if(team.banda.length > 0) {
            html += '<div class="lineup-row">';
            team.banda.forEach(p => {
                const isCurrent = p.id === currentUserData.id ? 'current-user' : '';
                html += `<div class="lineup-player"><div class="player-avatar ${isCurrent}">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">${p.role || 'Membro'}</span></div>`;
            });
            html += '</div>';
        }
        
        // Linha 4: Membros sem função
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
        // Query atualizada para trazer repertoire_keys(ton) junto
        const res = await fetch(`${SUPABASE_URL}/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title,repertoire_keys(ton)))&order=event_date.asc`, { headers });
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

        // NOVO: Renderiza músicas com seus tons
        let songsHtml = ''; 
        s.scale_songs.forEach(song => { 
            const keys = song.repertoire.repertoire_keys || [];
            const keysStr = keys.length > 0 ? keys.map(k => k.ton).join(', ') : '';
            const keyBadge = keysStr ? `<span class="badge tom" style="font-size:0.7rem; padding:2px 8px; margin-left:auto;">${keysStr}</span>` : '';
            songsHtml += `<span>🎵 ${song.repertoire.title} ${keyBadge}</span>`; 
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
            await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            const res = await fetch(`${SUPABASE_URL}/scales?id=eq.${scaleId}`, { method: 'DELETE', headers });
            
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
        const res = await fetch(`${SUPABASE_URL}/scales?id=eq.${scaleId}&select=*,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`, { headers });
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
            const resMem = await fetch(`${SUPABASE_URL}/members?select=id,full_name,member_roles(role)`, { headers });
            allMembersCache = await resMem.json();
        }
        if(allRepertoireCache.length === 0) {
            const resRep = await fetch(`${SUPABASE_URL}/repertoire?select=id,title&order=title.asc`, { headers });
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
        const res = await fetch(`${SUPABASE_URL}/members?select=id,full_name,member_roles(role)`, { headers });
        allMembersCache = await res.json();
    }
    if(allRepertoireCache.length === 0) {
        const resRep = await fetch(`${SUPABASE_URL}/repertoire?select=id,title&order=title.asc`, { headers });
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
            await fetch(`${SUPABASE_URL}/scales?id=eq.${editingId}`, { 
                method: 'PATCH', 
                headers, 
                body: JSON.stringify({ event_date: date, notes: notes, time_key: date.substring(0,7) }) 
            });
            scaleId = editingId;
            
            await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/scale_songs?scale_id=eq.${scaleId}`, { method: 'DELETE', headers });
        } else {
            const resScale = await fetch(`${SUPABASE_URL}/scales`, { 
                method: 'POST', 
                headers: { ...headers, 'Prefer': 'return=representation' }, 
                body: JSON.stringify({ time_key: date.substring(0,7), event_date: date, notes: notes, created_by: currentUserData.id }) 
            });
            const savedScale = await resScale.json();
            scaleId = savedScale[0].id;
        }

        for(let item of scaleDraftTeam) {
            await fetch(`${SUPABASE_URL}/scale_items`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify({ scale_id: scaleId, member_id: item.memberId, role: item.role }) 
            });
        }

        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for(let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/scale_songs`, { 
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
    const username = document.getElementById('new-username').value.trim().toLowerCase(); const fullname = document.getElementById('new-fullname').value.trim(); const isLeader = document.getElementById('new-is-leader').checked; 
    if (!username || !fullname) { showCustomAlert('Preencha usuário e nome!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/members`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ username, full_name: fullname, is_leader: isLeader }) });
        if (!res.ok) throw new Error('Usuário já existe.');
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso'); 
        document.getElementById('new-username').value = ''; document.getElementById('new-fullname').value = ''; document.getElementById('new-is-leader').checked = false; loadAdminMembers();
    } catch (e) { showCustomAlert(e.message, 'Erro'); }
}

async function loadAdminMembers() {
    const list = document.getElementById('admin-members-list'); list.innerHTML = '<p>Carregando...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,is_leader,member_roles(role)&order=full_name.asc`, { headers });
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
        if(role === 'lider') { await fetch(`${SUPABASE_URL}/members?id=eq.${memberId}`, { method: 'PATCH', headers, body: JSON.stringify({ is_leader: isAdding }) }); return; }
        if (isAdding) await fetch(`${SUPABASE_URL}/member_roles`, { method: 'POST', headers, body: JSON.stringify({ member_id: memberId, role: role }) });
        else await fetch(`${SUPABASE_URL}/member_roles?member_id=eq.${memberId}&role=eq.${role}`, { method: 'DELETE', headers });
    } catch (e) { showCustomAlert('Erro ao atualizar banco.'); }
}

async function deleteMember(id) {
    showCustomConfirm('Deseja remover este membro do sistema?', async () => {
        try { await fetch(`${SUPABASE_URL}/members?id=eq.${id}`, { method: 'DELETE', headers }); loadAdminMembers(); } catch (e) { showCustomAlert('Erro ao excluir.'); }
    });
}

window.onload = () => {
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { currentUserData = JSON.parse(storedUser); showSystemScreen(); }
};
