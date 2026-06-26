const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let allRepertoireCache = [];
let allMembersCache = [];

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username').value.trim().toLowerCase();
    const errorSpan = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    errorSpan.textContent = '';
    if (!usernameInput) { errorSpan.textContent = 'Digite seu usuário.'; return; }

    btnLogin.disabled = true; btnLogin.textContent = 'Validando...';

    try {
        const response = await fetch(`${SUPABASE_URL}/members?username=eq.${usernameInput}&select=*`, { method: 'GET', headers });
        if (!response.ok) throw new Error('Erro banco de dados');
        const data = await response.json();

        if (data.length > 0) {
            currentUserData = data[0];
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else { errorSpan.textContent = 'Usuário não encontrado.'; }
    } catch (error) { errorSpan.textContent = 'Erro de conexão.'; } 
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

function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function toggleSidebar() {} // Desnecessário no formato novo mobile, mas mantido p/ PC se precisar

// ==========================================
// INÍCIO (Mensagem e Contador)
// ==========================================
function loadDashboard() { startCountdown(); fetchDailyMessage(); fetchNextScaleHome(); }

function startCountdown() {
    clearInterval(countdownInterval);
    function updateTimer() {
        const now = new Date(); const nextSunday = new Date();
        const daysUntilSunday = (7 - now.getDay()) % 7;
        if (daysUntilSunday === 0 && now.getHours() >= 18) nextSunday.setDate(now.getDate() + 7);
        else nextSunday.setDate(now.getDate() + daysUntilSunday);
        nextSunday.setHours(18, 0, 0, 0);
        const diff = nextSunday - now;
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

async function fetchNextScaleHome() {
    const container = document.getElementById('next-scale-team');
    const today = new Date().toISOString().split('T')[0];
    try {
        const scaleRes = await fetch(`${SUPABASE_URL}/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        const scaleData = await scaleRes.json();
        if (scaleData.length > 0) {
            const scaleId = scaleData[0].id;
            const itemsRes = await fetch(`${SUPABASE_URL}/scale_items?scale_id=eq.${scaleId}&select=role,members(full_name)`, { headers });
            const itemsData = await itemsRes.json();
            if (itemsData.length > 0) {
                let html = '';
                itemsData.forEach(i => { html += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee;"><strong>${i.members.full_name}</strong><span>${i.role.toUpperCase()}</span></div>`; });
                container.innerHTML = html;
            } else container.innerHTML = `<p>Escala vazia.</p>`;
        } else container.innerHTML = `<p>Nenhuma escala programada.</p>`;
    } catch (e) { container.innerHTML = `<p>Erro.</p>`; }
}

// ==========================================
// REPERTÓRIO E BUSCA INTELIGENTE (iTunes API)
// ==========================================
function openRepertoireModal() { 
    document.getElementById('modal-add-repertoire').classList.add('active'); 
    document.getElementById('search-results').innerHTML = '';
}

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { msgBox.textContent = 'Digite algo.'; return; }
    
    msgBox.textContent = 'Buscando opções...';
    resultsContainer.innerHTML = '';
    
    try {
        // API do iTunes é rápida e aceita busca parcial
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        const data = await res.json();
        
        if(data.results.length === 0) { msgBox.textContent = 'Nada encontrado. Tente nomes mais específicos.'; return; }
        
        msgBox.textContent = 'Selecione a música correta abaixo:';
        data.results.forEach(track => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<div><strong>${track.trackName}</strong><br><small>${track.artistName}</small></div> <span class="material-symbols-outlined">download</span>`;
            div.onclick = () => fetchLyricsFromOption(track.artistName, track.trackName);
            resultsContainer.appendChild(div);
        });
    } catch(e) { msgBox.textContent = 'Erro na busca.'; }
}

async function fetchLyricsFromOption(artist, song) {
    const msgBox = document.getElementById('search-msg');
    msgBox.textContent = `Importando letra de "${song}"...`;
    try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${song}`);
        if(res.ok) {
            const data = await res.json();
            document.getElementById('rep-lyrics').value = data.lyrics;
            document.getElementById('rep-title').value = `${song} - ${artist}`;
            msgBox.textContent = 'Letra importada! Pode salvar.';
            msgBox.className = 'admin-message msg-success';
        } else {
            msgBox.textContent = 'Letra não encontrada na base. Digite manualmente abaixo.';
            document.getElementById('rep-title').value = `${song} - ${artist}`;
        }
    } catch(e) { msgBox.textContent = 'Erro ao baixar letra.'; }
}

async function saveNewRepertoire() {
    const title = document.getElementById('rep-title').value.trim();
    const lyrics = document.getElementById('rep-lyrics').value.trim();
    const initialKey = document.getElementById('rep-key').value.trim();
    if(!title || !lyrics) { alert('Título e Letra obrigatórios!'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/repertoire`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ title, lyrics_text: lyrics, created_by: currentUserData.id }) });
        const savedData = await res.json();
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/repertoire_keys`, { method: 'POST', headers, body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) });
        }
        alert('Música salva!'); closeModals(); loadRepertoire();
    } catch(e) { alert('Erro ao salvar.'); }
}

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
        parts.forEach(p => { html += `• <em>${p.section}</em> de ${p.repertoire.title}<br>`; });
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
    } catch(e) { alert('Erro.'); }
}

async function deleteKey(keyId) {
    if(!confirm('Remover tom?')) return;
    try { await fetch(`${SUPABASE_URL}/repertoire_keys?id=eq.${keyId}`, { method: 'DELETE', headers }); loadKeysForRepertoire(currentViewingRepertoireId); loadRepertoire(); } 
    catch(e) {}
}

// ==========================================
// MEDLEY
// ==========================================
function openMedleyModal() {
    document.getElementById('modal-add-medley').classList.add('active');
    const container = document.getElementById('medley-songs-selection');
    container.innerHTML = '';
    
    // Lista apenas músicas que NÃO são medleys
    const songs = allRepertoireCache.filter(s => !s.is_medley);
    songs.forEach(s => {
        const div = document.createElement('div'); div.className = 'medley-song-item';
        div.innerHTML = `
            <label style="font-weight:600;"><input type="checkbox" value="${s.id}" onchange="toggleMedleyPartInput(this, '${s.id}')"> ${s.title}</label>
            <input type="text" id="part-${s.id}" class="medley-part-input hidden" placeholder="Qual parte cantará? (Ex: Refrão, Estrofe 1)">
        `;
        container.appendChild(div);
    });
}

function toggleMedleyPartInput(checkbox, songId) {
    const input = document.getElementById(`part-${songId}`);
    if(checkbox.checked) { input.classList.remove('hidden'); input.focus(); } 
    else { input.classList.add('hidden'); input.value = ''; }
}

async function saveNewMedley() {
    const title = document.getElementById('medley-title').value.trim();
    const msg = document.getElementById('medley-msg');
    
    const checkboxes = document.querySelectorAll('#medley-songs-selection input[type="checkbox"]:checked');
    if(!title || checkboxes.length < 2) { msg.textContent = 'Dê um nome e selecione no mínimo 2 músicas.'; return; }

    msg.textContent = 'Salvando medley...';
    try {
        // 1. Cria a música "Medley" no repertório
        const res = await fetch(`${SUPABASE_URL}/repertoire`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ title: title, is_medley: true, created_by: currentUserData.id }) });
        const savedMedley = await res.json();
        const medleyId = savedMedley[0].id;

        // 2. Salva as partes
        for(let cb of checkboxes) {
            const songId = cb.value;
            const section = document.getElementById(`part-${songId}`).value || 'Parte Completa';
            await fetch(`${SUPABASE_URL}/repertoire_medley_parts`, { method: 'POST', headers, body: JSON.stringify({ medley_repertoire_id: medleyId, song_repertoire_id: songId, section: section }) });
        }
        alert('Medley criado com sucesso!'); closeModals(); loadRepertoire();
    } catch(e) { msg.textContent = 'Erro ao salvar medley.'; }
}

// ==========================================
// ESCALAS (PASSO 5)
// ==========================================
async function loadScales() {
    const list = document.getElementById('scales-list');
    list.innerHTML = '<p>Buscando escalas...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title))&order=event_date.asc`, { headers });
        const scales = await res.json();
        if(scales.length === 0) { list.innerHTML = '<p>Nenhuma escala registrada.</p>'; return; }

        let html = '';
        scales.forEach(s => {
            const dateObj = new Date(s.event_date);
            const dateStr = dateObj.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            
            let teamHtml = ''; s.scale_items.forEach(i => { teamHtml += `<div><span>${i.role.toUpperCase()}</span> <strong>${i.members.full_name}</strong></div>`; });
            let songsHtml = ''; s.scale_songs.forEach(song => { songsHtml += `<span>🎵 ${song.repertoire.title}</span>`; });

            html += `
                <div class="scale-folder">
                    <h3><span class="material-symbols-outlined">event</span> Culto: ${dateStr}</h3>
                    <p>${s.notes || 'Sem observações'}</p>
                    <div class="scale-member-list">${teamHtml}</div>
                    <div class="scale-songs-list">${songsHtml}</div>
                </div>`;
        });
        list.innerHTML = html;
    } catch(e) { list.innerHTML = '<p>Erro.</p>'; }
}

async function openScaleModal() {
    document.getElementById('modal-add-scale').classList.add('active');
    
    // Busca Membros para popular os Selects filtrados pela função
    if(allMembersCache.length === 0) {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,full_name,member_roles(role)`, { headers });
        allMembersCache = await res.json();
    }
    
    // Garante que temos o repertório
    if(allRepertoireCache.length === 0) {
        const resRep = await fetch(`${SUPABASE_URL}/repertoire?select=id,title&order=title.asc`, { headers });
        allRepertoireCache = await resRep.json();
    }

    const teamContainer = document.getElementById('scale-team-selectors');
    teamContainer.innerHTML = '';
    
    const roles = ['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo'];
    roles.forEach(role => {
        // Filtra membros que tem aquela função específica
        const ableMembers = allMembersCache.filter(m => m.member_roles.some(r => r.role === role));
        let options = '<option value="">Não escalado</option>';
        ableMembers.forEach(m => { options += `<option value="${m.id}">${m.full_name}</option>`; });
        
        teamContainer.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <label style="width:80px; font-weight:600; text-transform:capitalize;">${role}</label>
                <select id="scale-role-${role}" style="flex:1; padding:8px;">${options}</select>
            </div>
        `;
    });

    const songsContainer = document.getElementById('scale-songs-selectors');
    songsContainer.innerHTML = '';
    allRepertoireCache.forEach(song => {
        songsContainer.innerHTML += `<label style="display:block; padding:5px; border-bottom:1px solid #eee;"><input type="checkbox" value="${song.id}" class="scale-song-cb"> ${song.title}</label>`;
    });
}

async function saveNewScale() {
    const date = document.getElementById('scale-date').value;
    const notes = document.getElementById('scale-notes').value;
    if(!date) { alert('Data obrigatória.'); return; }

    try {
        // 1. Cria a Escala principal
        const resScale = await fetch(`${SUPABASE_URL}/scales`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ time_key: date.substring(0,7), event_date: date, notes: notes, created_by: currentUserData.id }) });
        const savedScale = await resScale.json();
        const scaleId = savedScale[0].id;

        // 2. Salva a Equipe (pega os selects que tem valor)
        const roles = ['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo'];
        for(let role of roles) {
            const memberId = document.getElementById(`scale-role-${role}`).value;
            if(memberId) {
                await fetch(`${SUPABASE_URL}/scale_items`, { method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, member_id: memberId, role: role }) });
            }
        }

        // 3. Salva as Músicas
        const songCbs = document.querySelectorAll('.scale-song-cb:checked');
        for(let cb of songCbs) {
            await fetch(`${SUPABASE_URL}/scale_songs`, { method: 'POST', headers, body: JSON.stringify({ scale_id: scaleId, repertoire_id: cb.value }) });
        }

        alert('Escala criada com sucesso!'); closeModals(); loadScales();
    } catch(e) { alert('Erro ao salvar escala.'); }
}

// ==========================================
// MEMBROS E ADMINISTRAÇÃO (Mantidos)
// ==========================================
async function loadMembers() {
    const grid = document.getElementById('members-grid'); grid.innerHTML = '<p class="loading-text">Buscando equipe...</p>';
    try {
        const res = await fetch(`${SUPABASE_URL}/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        if (members.length === 0) { grid.innerHTML = '<p>Nenhum membro.</p>'; return; }
        let html = '';
        members.forEach(m => {
            let badges = m.is_leader ? '<span class="badge lider">Líder</span>' : '';
            m.member_roles.forEach(r => { badges += `<span class="badge ${r.role === 'vocal' ? 'vocal' : 'instrumento'}">${r.role.charAt(0).toUpperCase() + r.role.slice(1)}</span>`; });
            let photoContent = m.photo_url ? `<img src="${m.photo_url}" class="member-photo">` : `<div class="member-photo">${m.full_name.charAt(0).toUpperCase()}</div>`;
            html += `<div class="member-card">${photoContent}<div class="member-info"><h4>${m.full_name}</h4><div class="role-badges">${badges || '<span class="badge" style="background:#eee;color:#999;">Membro</span>'}</div></div></div>`;
        });
        grid.innerHTML = html;
    } catch (e) { grid.innerHTML = '<p>Erro.</p>'; }
}

async function createNewMember() {
    const username = document.getElementById('new-username').value.trim().toLowerCase(); const fullname = document.getElementById('new-fullname').value.trim(); const isLeader = document.getElementById('new-is-leader').checked; const msgBox = document.getElementById('admin-msg');
    if (!username || !fullname) { msgBox.textContent = 'Preencha usuário e nome!'; msgBox.className = 'admin-message msg-error'; return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/members`, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ username, full_name: fullname, is_leader: isLeader }) });
        if (!res.ok) throw new Error('Usuário já existe.');
        msgBox.textContent = 'Cadastrado com sucesso!'; msgBox.className = 'admin-message msg-success';
        document.getElementById('new-username').value = ''; document.getElementById('new-fullname').value = ''; document.getElementById('new-is-leader').checked = false; loadAdminMembers();
    } catch (e) { msgBox.textContent = e.message; msgBox.className = 'admin-message msg-error'; }
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
                    <div class="admin-actions"><button class="btn-icon" onclick="document.getElementById('editor-${m.id}').classList.toggle('hidden')"><span class="material-symbols-outlined">edit_attributes</span></button><button class="btn-icon" onclick="deleteMember('${m.id}')"><span class="material-symbols-outlined">delete</span></button></div>
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
    } catch (e) { alert('Erro no banco.'); }
}

async function deleteMember(id) {
    if(!confirm('Deseja remover este membro?')) return;
    try { await fetch(`${SUPABASE_URL}/members?id=eq.${id}`, { method: 'DELETE', headers }); loadAdminMembers(); } catch (e) { alert('Erro ao excluir.'); }
}

window.onload = () => {
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { currentUserData = JSON.parse(storedUser); showSystemScreen(); }
};
