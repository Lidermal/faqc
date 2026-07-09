// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// Helper para log de erros
function logSupabaseError(endpoint, response) {
    response.clone().text().then(text => console.error(`❌ Erro Supabase em ${endpoint}:`, response.status, text)).catch(() => console.error(`❌ Erro Supabase em ${endpoint}:`, response.status));
}

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let currentFolderId = null; // null = Pasta Geral
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
    } catch (e) { console.error('❌ Erro ao inicializar Supabase:', e); return false; }
}

// ==========================================
// ALERTAS PERSONALIZADOS
// ==========================================
function showCustomAlert(msg, title = "Aviso") {
    const t = document.getElementById('alert-title'), m = document.getElementById('alert-msg'), mo = document.getElementById('modal-alert');
    if(t) t.textContent = title; if(m) m.textContent = msg; if(mo) mo.classList.add('active');
}
function closeCustomAlert() { const m = document.getElementById('modal-alert'); if(m) m.classList.remove('active'); }
function showCustomConfirm(msg, callback, title = "Atenção") {
    const t = document.getElementById('confirm-title'), m = document.getElementById('confirm-msg'), mo = document.getElementById('modal-confirm'), b = document.getElementById('btn-confirm-yes');
    if(t) t.textContent = title; if(m) m.textContent = msg; if(mo) mo.classList.add('active');
    if(b) b.onclick = () => { closeCustomConfirm(); if (callback) callback(); };
}
function closeCustomConfirm() { const m = document.getElementById('modal-confirm'); if(m) m.classList.remove('active'); }

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
async function handleLogin() {
    const usernameInput = document.getElementById('username')?.value?.trim().toLowerCase();
    const btnLogin = document.getElementById('btn-login');
    if (!usernameInput) { showCustomAlert('Por favor, digite seu usuário.'); return; }
    btnLogin.disabled = true; btnLogin.textContent = 'Validando...';
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/members?username=eq.${encodeURIComponent(usernameInput)}&select=id,username,full_name,is_leader,role`, { method: 'GET', headers });
        const data = await response.json();
        if (data.length > 0) {
            currentUserData = data[0];
            try {
                const fullRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}&select=photo_url,email,phone`, { headers });
                if (fullRes.ok) { const fullData = await fullRes.json(); if (fullData.length > 0) currentUserData = { ...currentUserData, ...fullData[0] }; }
            } catch (e) { console.warn('Campos opcionais indisponíveis'); }
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            showSystemScreen();
        } else { showCustomAlert('Usuário não encontrado.'); }
    } catch (error) { console.error('Erro no login:', error); showCustomAlert('Erro de conexão.'); }
    finally { btnLogin.disabled = false; btnLogin.textContent = 'Entrar'; }
}

function showSystemScreen() {
    const ls = document.getElementById('login-screen'), ss = document.getElementById('system-screen');
    if(ls) { ls.classList.remove('active'); ls.classList.add('hidden'); }
    if(ss) { ss.classList.remove('hidden'); ss.classList.add('active'); }
    updateHeaderUserInfo();

    const isLeader = currentUserData?.is_leader;
    const isMedia = currentUserData?.role === 'midia';
    const navAdmin = document.getElementById('nav-admin'), btnAddScale = document.getElementById('btn-add-scale'), repAct = document.getElementById('repertoire-actions'), navEsc = document.getElementById('nav-escalas');
    if(navAdmin) navAdmin.classList.toggle('hidden', !isLeader);
    if(btnAddScale) btnAddScale.classList.toggle('hidden', !isLeader);
    if(repAct) repAct.classList.toggle('hidden', isMedia && !isLeader);
    if(navEsc) navEsc.classList.toggle('hidden', isMedia);
    navigate('home');
    if (!supabaseClient) initSupabase();
    if (supabaseClient) setupRealtimeSubscriptions();
}

function updateHeaderUserInfo() {
    const dn = document.getElementById('user-display-name'), hp = document.getElementById('header-user-photo');
    if (dn && currentUserData?.full_name) dn.textContent = currentUserData.full_name;
    if (hp) {
        if (currentUserData?.photo_url) { hp.src = currentUserData.photo_url; hp.style.display = 'block'; }
        else { hp.style.display = 'none'; }
    }
}

function handleLogout() {
    if (realtimeChannels.length > 0 && supabaseClient) { realtimeChannels.forEach(ch => { try { supabaseClient.removeChannel(ch); } catch (e) { } }); realtimeChannels = []; }
    if (carouselInterval) { clearInterval(carouselInterval); carouselInterval = null; }
    localStorage.removeItem('sessionUser'); currentUserData = null; clearInterval(countdownInterval);
    const ss = document.getElementById('system-screen'), ls = document.getElementById('login-screen');
    if(ss) { ss.classList.remove('active'); ss.classList.add('hidden'); }
    if(ls) { ls.classList.remove('hidden'); ls.classList.add('active'); }
    const ui = document.getElementById('username'); if(ui) ui.value = '';
    const na = document.getElementById('nav-admin'), ne = document.getElementById('nav-escalas'), ba = document.getElementById('btn-add-scale');
    if(na) na.classList.add('hidden'); if(ne) ne.classList.remove('hidden'); if(ba) ba.classList.add('hidden');
}

function navigate(pageId) {
    document.querySelectorAll('.subpage').forEach(p => p.classList.remove('active'));
    const tp = document.getElementById('page-' + pageId); if (tp) tp.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
    const tn = document.getElementById('nav-' + pageId); if (tn) tn.classList.add('active');
    if (pageId === 'home') loadDashboard();
    else if (pageId === 'membros') loadMembers();
    else if (pageId === 'admin') loadAdminDashboard();
    else if (pageId === 'repertorio') { loadFolders(); loadRepertoire(); }
    else if (pageId === 'escalas') loadScales();
    else if (pageId === 'perfil') loadProfile();
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => { if (!m.classList.contains('custom-alert-modal') && !m.classList.contains('custom-input-modal')) m.classList.remove('active'); });
    const dm = document.getElementById('drawer-medley'), do_ = document.getElementById('drawer-medley-overlay');
    if(dm) dm.classList.remove('active'); if(do_) do_.classList.remove('active');
    const ef = document.getElementById('editing-scale-id'); if(ef) ef.value = '';
    const mt = document.getElementById('scale-modal-title'); if(mt) mt.textContent = 'Nova Escala';
    resetMedleyFlow();
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    const ts = document.getElementById('admin-' + section);
    if (ts) { ts.classList.remove('hidden'); if (section === 'manage-members') loadAdminMembers(); if (section === 'stats') loadAdminStats(); }
}

// ==========================================
// SUPABASE REALTIME
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;
    try {
        const mc = supabaseClient.channel('member-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (p) => {
            if (document.getElementById('page-membros')?.classList.contains('active')) loadMembers();
            if (document.getElementById('page-admin')?.classList.contains('active')) loadAdminMembers();
            if (currentUserData && p.new && p.new.id == currentUserData.id) { currentUserData = p.new; localStorage.setItem('sessionUser', JSON.stringify(currentUserData)); updateHeaderUserInfo(); if(document.getElementById('page-perfil')?.classList.contains('active')) loadProfile(); }
        }).subscribe(); realtimeChannels.push(mc);
        const rc = supabaseClient.channel('repertoire-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, () => { if (document.getElementById('page-repertorio')?.classList.contains('active')) loadRepertoire(); }).subscribe(); realtimeChannels.push(rc);
        const fc = supabaseClient.channel('folder-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => { if (document.getElementById('page-repertorio')?.classList.contains('active')) { loadFolders(); loadRepertoire(); } }).subscribe(); realtimeChannels.push(fc);
        console.log('✅ Realtime configurado');
    } catch (e) { console.error('Erro realtime:', e); }
}

// ==========================================
// DASHBOARD
// ==========================================
function loadDashboard() { startCountdown(); fetchDailyMessage(); fetchNextScaleHome(); }
function startCountdown() {
    clearInterval(countdownInterval);
    function updateTimer() {
        const now = new Date(), target = new Date(), dus = (7 - now.getDay()) % 7;
        if (dus === 0 && (now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 30))) target.setDate(now.getDate() + 7); else target.setDate(now.getDate() + dus);
        target.setHours(18, 30, 0, 0);
        const diff = target - now;
        if (diff < 0) { const t = document.getElementById('countdown-timer'); if(t) t.textContent = "00d 00h 00m 00s"; return; }
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        const t = document.getElementById('countdown-timer');
        if(t) t.textContent = `${String(d).padStart(2,'0')}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
    }
    updateTimer(); countdownInterval = setInterval(updateTimer, 1000);
}
function startCarouselAutoScroll() { if (carouselInterval) clearInterval(carouselInterval); carouselInterval = setInterval(() => scrollCarousel(1), 4000); }
function scrollCarousel(dir) {
    const c = document.getElementById('next-scale-team'); if (!c) return;
    const amt = 160, max = c.scrollWidth - c.clientWidth, cur = c.scrollLeft;
    if (dir > 0 && cur >= max - 10) c.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir < 0 && cur <= 10) c.scrollTo({ left: max, behavior: 'smooth' });
    else c.scrollBy({ left: dir * amt, behavior: 'smooth' });
}

// ==========================================
// MENSAGEM DO DIA
// ==========================================
async function fetchDailyMessage() {
    const con = document.getElementById('daily-message-content'); if (!con) return;
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${today}&select=verse_text,verse_ref`, { headers });
        if (res.ok) { const d = await res.json(); if (d.length > 0) { con.innerHTML = `<p>"${d[0].verse_text}"</p><span class="verse-ref">- ${d[0].verse_ref}</span>`; return; } }
    } catch (e) { console.warn('Supabase mensagem indisponível'); }
    const seed = today.split('-').join('').slice(-4);
    const verses = [
        { t: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r: "João 3:16" },
        { t: "O Senhor é o meu pastor; nada me faltará.", r: "Salmos 23:1" },
        { t: "Tudo posso naquele que me fortalece.", r: "Filipenses 4:13" }
    ];
    const v = verses[parseInt(seed) % verses.length];
    con.innerHTML = `<p>"${v.t}"</p><span class="verse-ref">- ${v.r}</span>`;
}

// ==========================================
// ÍCONES E NOMES
// ==========================================
function getRoleIcon(role) { const i = { 'lider':'star','vocal':'mic','baterista':'music_note','teclado':'piano','violao':'music_note','baixo':'graphic_eq','midia':'videocam' }; return i[role||'vocal']||'person'; }
function getRoleName(role) { const n = { 'lider':'Líder','vocal':'Vocal','baterista':'Baterista','teclado':'Teclado','violao':'Violão','baixo':'Baixo','midia':'Mídia' }; return n[role||'vocal']||(role?role.charAt(0).toUpperCase()+role.slice(1):'Membro'); }

async function fetchNextScaleHome() {
    const con = document.getElementById('next-scale-team'), today = new Date().toISOString().split('T')[0];
    try {
        const sr = await fetch(`${SUPABASE_URL}/rest/v1/scales?event_date=gte.${today}&order=event_date.asc&limit=1`, { headers });
        if (!sr.ok) throw new Error('Erro escala');
        const sd = await sr.json();
        if (sd.length > 0) {
            const ir = await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${sd[0].id}&select=role,members(id,full_name,photo_url)`, { headers });
            const id = await ir.json();
            if (id.length > 0) {
                let h = '';
                id.forEach(item => {
                    const ic = item.members && item.members.id === currentUserData.id ? 'current-user' : '';
                    const icon = getRoleIcon(item.role), rn = getRoleName(item.role), pu = item.members ? item.members.photo_url : null, fn = item.members ? item.members.full_name : '?';
                    h += `<div class="team-carousel-card ${ic}"><div class="team-card-photo">${pu?`<img src="${pu}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="photo-placeholder" style="display:none">${fn.charAt(0)}</div>`:`<div class="photo-placeholder">${fn.charAt(0)}</div>`}<div class="team-card-icon"><span class="material-symbols-outlined">${icon}</span></div></div><div class="team-card-info"><div class="team-card-name">${fn}</div><div class="team-card-role">${rn}</div></div>${ic?'<div class="current-badge">★ Você</div>':''}</div>`;
                });
                con.innerHTML = h; startCarouselAutoScroll();
            } else { con.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">Escala vazia.</p>`; }
        } else { con.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">Nenhuma escala.</p>`; }
    } catch (e) { console.error('Erro escala home:', e); con.innerHTML = `<p style="color:var(--danger);text-align:center;padding:20px;">Erro.</p>`; }
}

// ==========================================
// PERFIL + UPLOAD
// ==========================================
async function loadProfile() {
    const con = document.getElementById('profile-container'); if (!con) return;
    con.innerHTML = `<div class="profile-card"><div class="profile-header"><div class="profile-photo-wrapper">${currentUserData.photo_url?`<img src="${currentUserData.photo_url}" class="profile-photo">`:`<div class="photo-placeholder-large">${(currentUserData.full_name||'U').charAt(0)}</div>`}<label for="photo-upload" class="photo-upload-btn"><span class="material-symbols-outlined">camera_alt</span></label><input type="file" id="photo-upload" accept="image/*" style="display:none" onchange="uploadPhoto(event)"></div><h2>${currentUserData.full_name||'Usuário'}</h2><p class="profile-username">@${currentUserData.username}</p><div class="profile-badges">${currentUserData.is_leader?'<span class="badge-role leader">Líder</span>':''}${currentUserData.role==='midia'?'<span class="badge-role">Mídia</span>':''}${!currentUserData.is_leader&&currentUserData.role!=='midia'?`<span class="badge-role">${getRoleName(currentUserData.role||'vocal')}</span>`:''}</div></div><div class="profile-body"><div class="profile-section"><h3>Informações Pessoais</h3><div class="form-grid"><div class="input-group"><label>Nome Completo</label><input type="text" id="profile-fullname" value="${currentUserData.full_name||''}"></div><div class="input-group"><label>Email</label><input type="email" id="profile-email" value="${currentUserData.email||''}"></div><div class="input-group"><label>Telefone</label><input type="tel" id="profile-phone" value="${currentUserData.phone||''}"></div></div></div><button class="btn-primary" onclick="updateProfile()" style="width:100%;margin-top:1rem;"><span class="material-symbols-outlined">save</span> Salvar</button></div></div>`;
}
function compressImage(file, maxW=800, maxH=800, q=0.8) {
    return new Promise((res, rej) => {
        const r = new FileReader(); r.readAsDataURL(file);
        r.onload = e => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const c = document.createElement('canvas'); let w=img.width, h=img.height;
                if(w>h){if(w>maxW){h*=maxW/w;w=maxW;}}else{if(h>maxH){w*=maxH/h;h=maxH;}}
                c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
                c.toBlob(b => b?res(new File([b],file.name,{type:'image/jpeg',lastModified:Date.now()})):rej('Falha compressão'),'image/jpeg',q);
            }; img.onerror=rej;
        }; r.onerror=rej;
    });
}
async function uploadPhoto(event) {
    const file = event.target.files[0]; if(!file) return;
    if(file.size>5*1024*1024){showCustomAlert('Máx 5MB.','Erro');return;}
    try {
        if(!supabaseClient){showCustomAlert('Erro inicialização.','Erro');return;}
        const cf = await compressImage(file), fn = `${currentUserData.id}_${Date.now()}.jpg`;
        const {error} = await supabaseClient.storage.from('member-photos').upload(fn, cf, {cacheControl:'3600',upsert:true});
        if(error) { if(error.message.includes('not found')){const r=new FileReader();r.onload=e=>{currentUserData.photo_url=e.target.result;localStorage.setItem('sessionUser',JSON.stringify(currentUserData));updateHeaderUserInfo();showCustomAlert('Salva localmente.','Aviso');loadProfile();};r.readAsDataURL(cf);return;} throw error; }
        const {data:{publicUrl}} = supabaseClient.storage.from('member-photos').getPublicUrl(fn);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`,{method:'PATCH',headers,body:JSON.stringify({photo_url:publicUrl})});
        if(!res.ok) throw new Error('DB update fail');
        currentUserData.photo_url=publicUrl; localStorage.setItem('sessionUser',JSON.stringify(currentUserData)); updateHeaderUserInfo(); showCustomAlert('Foto atualizada!','Sucesso'); loadProfile();
    } catch(e){console.error('Upload:',e); showCustomAlert('Erro: '+e.message,'Erro');}
}
async function updateProfile() {
    const fn=document.getElementById('profile-fullname').value.trim(), em=document.getElementById('profile-email').value.trim(), ph=document.getElementById('profile-phone').value.trim();
    if(!fn){showCustomAlert('Nome obrigatório.','Erro');return;}
    try {
        const ud={full_name:fn}; if(em)ud.email=em; if(ph)ud.phone=ph;
        const res=await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${currentUserData.id}`,{method:'PATCH',headers,body:JSON.stringify(ud)});
        if(!res.ok) throw new Error('Update fail');
        currentUserData.full_name=fn; if(em)currentUserData.email=em; if(ph)currentUserData.phone=ph;
        localStorage.setItem('sessionUser',JSON.stringify(currentUserData)); updateHeaderUserInfo(); showCustomAlert('Perfil atualizado!','Sucesso');
    } catch(e){showCustomAlert('Erro ao atualizar.','Erro');}
}

// ==========================================
// MEMBROS
// ==========================================
async function loadMembers() {
    const con=document.getElementById('members-lineup'); con.innerHTML='<div class="loading-spinner"></div>';
    try {
        let members=[];
        try { const res=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,email,phone,is_leader,role&order=full_name.asc`,{headers,'Prefer':'return=representation'}); if(res.ok) members=await res.json(); else if(res.status===400){const rm=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`,{headers});if(rm.ok)members=await rm.json();} }
        catch(e){const rm=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`,{headers});if(rm.ok)members=await rm.json();}
        if(members.length===0){con.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:40px;">Nenhum membro.</p>';return;}
        const leaders=members.filter(m=>m.is_leader), vocals=members.filter(m=>!m.is_leader&&m.role==='vocal'), band=members.filter(m=>!m.is_leader&&m.role!=='vocal'&&m.role!=='midia'), media=members.filter(m=>m.role==='midia');
        let html='';
        if(leaders.length){html+='<div class="members-section"><h3 class="section-title">👑 Liderança</h3><div class="members-cards-grid">';leaders.forEach(m=>{html+=createMemberCard(m,'leader');});html+='</div></div>';}
        if(vocals.length){html+='<div class="members-section"><h3 class="section-title">🎤 Vocal</h3><div class="members-cards-grid">';vocals.forEach(m=>{html+=createMemberCard(m,'vocal');});html+='</div></div>';}
        if(band.length){html+='<div class="members-section"><h3 class="section-title">🎸 Banda</h3><div class="members-cards-grid">';band.forEach(m=>{html+=createMemberCard(m,'band');});html+='</div></div>';}
        if(media.length){html+='<div class="members-section"><h3 class="section-title"> Mídia</h3><div class="members-cards-grid">';media.forEach(m=>{html+=createMemberCard(m,'media');});html+='</div></div>';}
        con.innerHTML=html;
    } catch(e){console.error('Erro membros:',e);con.innerHTML=`<div style="text-align:center;padding:40px;"><p style="color:var(--danger);">⚠️ Erro</p><button class="btn-secondary" onclick="loadMembers()">🔄</button></div>`;}
}
function createMemberCard(m,type){
    const pu=m.photo_url||null, r=m.role||'vocal', em=m.email||null, ph=m.phone||null;
    return `<div class="member-showcase-card ${type}"><div class="member-card-header"><div class="member-photo-wrapper">${pu?`<img src="${pu}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="photo-placeholder" style="display:none">${m.full_name.charAt(0)}</div>`:`<div class="photo-placeholder">${m.full_name.charAt(0)}</div>`}${m.is_leader?'<div class="leader-crown">★</div>':''}</div><div class="member-social-links">${em?`<a href="mailto:${em}" class="social-link"><span class="material-symbols-outlined">mail</span></a>`:''}${ph?`<a href="tel:${ph}" class="social-link"><span class="material-symbols-outlined">phone</span></a>`:''}</div></div><div class="member-card-body"><h3 class="member-name">${m.full_name}</h3><div class="member-roles">${m.is_leader?'<span class="role-badge leader">Líder</span>':''}${r?`<span class="role-badge ${r}">${getRoleName(r)}</span>`:''}</div>${em?`<p class="member-contact"><span class="material-symbols-outlined">mail</span> ${em}</p>`:''}${ph?`<p class="member-contact"><span class="material-symbols-outlined">phone</span> ${ph}</p>`:''}</div></div>`;
}

// ==========================================
// PASTAS & REPERTÓRIO (EXPLORADOR CORRIGIDO)
// ==========================================
async function loadFolders() {
    const con=document.getElementById('folders-list'); if(!con) return;
    try {
        const res=await fetch(`${SUPABASE_URL}/rest/v1/folders?select=id,name,created_by,is_general&order=is_general.desc,name.asc`,{headers});
        if(!res.ok) throw new Error('Falha pastas');
        const folders=await res.json(); allFoldersCache=folders;
        const cf=currentFolderId?allFoldersCache.find(f=>f.id===currentFolderId):null;
        let bh=`<div class="folder-breadcrumb"><button class="breadcrumb-btn ${currentFolderId===null?'active':''}" onclick="selectFolder(null)"><span class="material-symbols-outlined">home</span><span>Pasta Geral</span></button>`;
        if(cf) bh+=`<span class="breadcrumb-separator">/</span><button class="breadcrumb-btn active"><span class="material-symbols-outlined">folder</span><span>${cf.name}</span></button>`;
        bh+=`</div>`;
        let html='<div class="folders-grid">';
        const gc=await countMusicInFolder(null);
        html+=`<button class="folder-card ${currentFolderId===null?'active':''}" onclick="selectFolder(null)"><div class="folder-card-icon"><span class="material-symbols-outlined">folder_special</span></div><div class="folder-card-info"><h4>Pasta Geral</h4><p>${gc} músicas</p><small>Todas as músicas</small></div></button>`;
        for(const f of folders){
            if(f.is_general) continue;
            const ce=currentUserData.is_leader||(f.created_by===currentUserData.id), mc=await countMusicInFolder(f.id);
            html+=`<button class="folder-card ${currentFolderId===f.id?'active':''}" onclick="selectFolder('${f.id}')"><div class="folder-card-icon"><span class="material-symbols-outlined">folder</span></div><div class="folder-card-info"><h4>${f.name}</h4><p>${mc} músicas</p><small>Por: ${f.created_by===currentUserData.id?'Você':'Membro'}</small></div>${ce?`<button class="folder-card-delete" onclick="event.stopPropagation();confirmDeleteFolder('${f.id}')"><span class="material-symbols-outlined">delete</span></button>`:''}</button>`;
        }
        if(currentUserData.is_leader) html+=`<button class="folder-card folder-card-create" onclick="openCreateFolderModalCustom()"><div class="folder-card-icon"><span class="material-symbols-outlined">create_new_folder</span></div><div class="folder-card-info"><h4>Nova Pasta</h4><p>Criar pasta pessoal</p></div></button>`;
        html+='</div>'; con.innerHTML=bh+html;
    } catch(e){console.error('Erro pastas:',e);con.innerHTML=`<p style="text-align:center;color:var(--danger);padding:20px;">Erro pastas.</p>`;}
}
async function countMusicInFolder(fid){
    try{let q=`${SUPABASE_URL}/rest/v1/repertoire?select=id&count=exact`;if(fid)q+=`&folder_id=eq.${fid}`;else q+=`&folder_id=is.null`;const r=await fetch(q,{headers});const c=r.headers.get('content-range');return c?parseInt(c.split('/')[1]):0;}catch(e){return 0;}
}
function selectFolder(fid){currentFolderId=fid;loadFolders();loadRepertoire();}
async function confirmDeleteFolder(fid){const f=allFoldersCache.find(x=>x.id===fid);if(!f)return;const mc=await countMusicInFolder(fid);showCustomConfirm(`Excluir "${f.name}"?\n${mc} música(s) voltarão para Geral.`,()=>deleteFolder(fid),'Excluir Pasta');}
async function deleteFolder(fid){
    try{await fetch(`${SUPABASE_URL}/rest/v1/repertoire?folder_id=eq.${fid}`,{method:'PATCH',headers,body:JSON.stringify({folder_id:null})});const r=await fetch(`${SUPABASE_URL}/rest/v1/folders?id=eq.${fid}`,{method:'DELETE',headers});if(!r.ok)throw new Error('Fail');if(currentFolderId===fid)currentFolderId=null;loadFolders();loadRepertoire();showCustomAlert('Pasta excluída!','Sucesso');}catch(e){console.error('Erro:',e);showCustomAlert('Erro excluir.','Erro');}
}
function openCreateFolderModalCustom(){
    if(allFoldersCache.find(f=>f.created_by===currentUserData.id&&!f.is_general)){showCustomAlert('Você já tem uma pasta.','Atenção');return;}
    showCustomInput('Nome da nova pasta:',`Ex: ${currentUserData.full_name}`,n=>{if(!n||!n.trim())return;createFolder(n.trim());});
}
function showCustomInput(label,ph,cb){
    const m=document.createElement('div');m.className='modal custom-input-modal active';
    m.innerHTML=`<div class="modal-content" style="max-width:400px;"><div class="modal-header"><h3>Nova Pasta</h3><button class="close-btn" onclick="this.closest('.modal').classList.remove('active')">&times;</button></div><div class="modal-body"><div class="input-group"><label>${label}</label><input type="text" id="custom-input-field" placeholder="${ph}" autofocus></div><div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;"><button class="btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Cancelar</button><button class="btn-primary" id="custom-input-confirm">Criar</button></div></div></div>`;
    document.body.appendChild(m);
    const inp=m.querySelector('#custom-input-field'), btn=m.querySelector('#custom-input-confirm');
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click();});
    btn.addEventListener('click',()=>{const v=inp.value.trim();m.remove();if(v)cb(v);});
    setTimeout(()=>inp.focus(),100);
}
async function createFolder(name){
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/folders`,{method:'POST',headers:{...headers,'Prefer':'return=representation'},body:JSON.stringify({name,created_by:currentUserData.id,is_general:false})});if(!r.ok)throw new Error('Fail');const nf=await r.json();allFoldersCache.push(nf[0]);loadFolders();showCustomAlert(`Pasta "${name}" criada!`,'Sucesso');}catch(e){console.error('Erro:',e);showCustomAlert('Erro criar.','Erro');}
}

// ==========================================
// REPERTÓRIO (EXPLORADOR CORRIGIDO)
// ==========================================
async function loadRepertoire() {
    const list=document.getElementById('repertoire-list'); if(!list)return;
    list.innerHTML='<div class="loading-spinner"></div>';
    const cf=currentFolderId?allFoldersCache.find(f=>f.id===currentFolderId):null;
    let hdr='';
    if(cf) hdr=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:10px;background:#fff9f3;border-radius:10px;border:1px solid var(--border-color);"><h3 style="font-size:1rem;color:var(--primary-color);display:flex;align-items:center;gap:8px;"><span class="material-symbols-outlined">folder_open</span>${cf.name}</h3><button class="btn-secondary" style="padding:6px 12px;font-size:0.8rem;" onclick="selectFolder(null)">⬅ Voltar</button></div>`;
    list.innerHTML=hdr+'<div class="loading-spinner"></div>';

    try {
        let q=`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,lyrics_text,is_medley,vocalist,created_by,repertoire_keys(ton)`;
        if(currentFolderId) q+=`&folder_id=eq.${currentFolderId}`; else q+=`&folder_id=is.null`;
        q+='&order=title.asc';
        const res=await fetch(q,{headers}); if(!res.ok){logSupabaseError('loadRepertoire',res);throw new Error('Erro repertório');}
        allRepertoireCache=await res.json();
        if(allRepertoireCache.length===0){list.innerHTML=hdr+'<p style="text-align:center;color:var(--text-muted);padding:40px;">Nenhuma música nesta pasta.</p>';return;}
        let html=hdr;
        allRepertoireCache.forEach(s=>{
            let kh=''; if(s.repertoire_keys)s.repertoire_keys.forEach(k=>{kh+=`<span class="badge tom">${k.ton}</span>`;});
            const vb=s.vocalist?`<span class="vocalist-mini"><span class="material-symbols-outlined" style="font-size:0.8rem;">mic</span> ${s.vocalist}</span>`:'';
            const ce=s.created_by===currentUserData.id||(currentFolderId&&allFoldersCache.find(f=>f.id===currentFolderId)?.created_by===currentUserData.id)||currentUserData.is_leader;
            const te=s.title.replace(/`/g,"'"), le=encodeURIComponent(s.lyrics_text||''), ve=encodeURIComponent(s.vocalist||'');
            html+=`<div class="playlist-item" onclick="${ce?`openViewRepertoire('${s.id}','\`${te}\`','\`${le}\`',${s.is_medley||false},'\`${ve}\`')`:''}"><div class="play-info"><div class="play-icon"><span class="material-symbols-outlined">${s.is_medley?'queue_music':'music_note'}</span></div><div class="play-title"><h4>${s.title}</h4><p>${s.is_medley?'Medley':'Louvor'} ${vb}</p></div></div><div class="play-keys">${kh}</div>${ce?`<button class="btn-edit-rep" onclick="event.stopPropagation();deleteRepertoire('${s.id}')"><span class="material-symbols-outlined">delete</span></button>`:''}</div>`;
        });
        list.innerHTML=html;
    } catch(e){console.error('Erro repertório:',e);list.innerHTML=hdr+'<p style="text-align:center;color:var(--danger);">Erro.</p>';}
}
async function deleteRepertoire(id){if(!confirm('Excluir?'))return;try{await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`,{method:'DELETE',headers});loadRepertoire();showCustomAlert('Excluído!','Sucesso');}catch(e){showCustomAlert('Erro.','Erro');}}

// ==========================================
// BUSCA DE LETRAS
// ==========================================
function openRepertoireModal(){document.getElementById('modal-add-repertoire').classList.add('active');document.getElementById('search-results').innerHTML='';document.getElementById('search-msg').textContent='';document.getElementById('search-query').value='';document.getElementById('rep-title').value='';document.getElementById('rep-vocalist').value='';document.getElementById('rep-key').value='';document.getElementById('rep-lyrics').value='';selectedVocalists=[];updateSelectedVocalists();}
function normalizeText(t){return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
async function extractLyricsFromLetras(url){try{const p=`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,r=await fetch(p),d=await r.json();if(d.contents){const doc=new DOMParser().parseFromString(d.contents,'text/html'),el=doc.querySelector('.lyrics-container')||doc.querySelector('.letra')||doc.querySelector('#letra');if(el){let l=el.innerText||el.textContent;l=l.replace(/\s+/g,'\n').trim();if(l.length>50)return l;}}}catch(e){}return null;}
async function searchMusicList(){
    const q=document.getElementById('search-query').value.trim(),rc=document.getElementById('search-results'),mb=document.getElementById('search-msg');if(!q)return;
    mb.innerHTML='<span style="color:var(--primary-color);">🔍 Buscando...</span>';rc.innerHTML='';cachedLyricsSearch={};let fv=false;
    try{
        try{const lr=await fetch(`https://www.letras.mus.br/api/autocomplete?q=${encodeURIComponent(q)}&limit=10`);if(lr.ok){const ld=await lr.json();if(ld&&ld.length>0){for(let i of ld.slice(0,5)){const a=i.artista||'',s=i.nome||'';if(a&&s){const l=await extractLyricsFromLetras(i.url);if(l){fv=true;const id=`letras_${Math.random()}`;cachedLyricsSearch[id]={artist:a,song:s,lyrics:l,source:'Letras.mus.br'};addSearchResultToDOM(s,a,id);}}}}}catch(e){}
        if(!fv){try{const vr=await fetch(`https://api.vagalume.com.br/search.php?exc=${encodeURIComponent(q)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);if(vr.ok){const d=await vr.json();if(d.art){for(let a of d.art){if(a.mus){for(let m of a.mus){if(m.text){const id=`vag_${Math.random()}`;cachedLyricsSearch[id]={artist:a.name,song:m.title||m.desc,lyrics:m.text,source:'Vagalume'};addSearchResultToDOM(m.title,a.name,id);fv=true;}}}}}}catch(e){}
        if(!fv)mb.innerHTML='<span style="color:var(--danger);">❌ Não encontrada.</span>';else mb.innerHTML='<span style="color:var(--success);">✅ Encontrada!</span>';
    }catch(e){mb.innerHTML='<span style="color:var(--danger);">❌ Erro.</span>';}
}
function addSearchResultToDOM(s,a,id){const d=document.createElement('div');d.className='search-result-item';d.innerHTML=`<div style="flex:1;"><strong>${s}</strong><small style="color:var(--text-muted);display:block;">${a}</small></div><span class="material-symbols-outlined" style="color:var(--primary-color);">download</span>`;d.onclick=()=>importPreCheckedLyrics(id);document.getElementById('search-results').appendChild(d);}
function importPreCheckedLyrics(id){const d=cachedLyricsSearch[id];document.getElementById('rep-lyrics').value=d.lyrics;document.getElementById('rep-title').value=`${d.song} - ${d.artist}`;showCustomAlert(`Importada!`,"Sucesso");}
async function searchVocalists(inp){const q=inp.value.trim().toLowerCase(),dd=document.getElementById('vocalist-dropdown');if(q.length<2){dd.innerHTML='';dd.style.display='none';return;}if(allMembersCache.length===0){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`,{headers});allMembersCache=await r.json();}catch(e){}}const f=allMembersCache.filter(m=>m.full_name.toLowerCase().includes(q)).slice(0,5);if(f.length>0){dd.innerHTML=f.map(m=>`<div class="dropdown-item" onclick="selectVocalist('${m.id}','${m.full_name}')"><span class="material-symbols-outlined">person</span>${m.full_name}</div>`).join('');dd.style.display='block';}else{dd.innerHTML='<div class="dropdown-empty">Nenhum membro</div>';dd.style.display='block';}}
function selectVocalist(id,name){if(!selectedVocalists.find(v=>v.id===id))selectedVocalists.push({id,name});updateSelectedVocalists();document.getElementById('vocalist-dropdown').style.display='none';document.querySelector('.searchable-select .search-input').value='';}
function removeVocalist(id){selectedVocalists=selectedVocalists.filter(v=>v.id!==id);updateSelectedVocalists();}
function updateSelectedVocalists(){const c=document.getElementById('selected-vocalists');document.getElementById('rep-vocalist').value=selectedVocalists.map(v=>v.name).join(', ');c.innerHTML=selectedVocalists.length>0?selectedVocalists.map(v=>`<span class="selected-item">${v.name}<span class="remove-item" onclick="removeVocalist('${v.id}')">×</span></span>`).join(''):'';}
async function saveNewRepertoire(){
    const t=document.getElementById('rep-title').value.trim(),l=document.getElementById('rep-lyrics').value.trim(),k=document.getElementById('rep-key').value.trim(),v=document.getElementById('rep-vocalist').value.trim();
    if(!t||!l){showCustomAlert('Título e Letra obrigatórios!');return;}
    try{const fid=currentFolderId||null,r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire`,{method:'POST',headers:{...headers,'Prefer':'return=representation'},body:JSON.stringify({title:t,lyrics_text:l,created_by:currentUserData.id,vocalist:v||null,folder_id:fid})});const sd=await r.json();if(k&&sd.length>0)await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`,{method:'POST',headers,body:JSON.stringify({repertoire_id:sd[0].id,ton:k})});showCustomAlert('Música salva!',"Sucesso");closeModals();loadRepertoire();}catch(e){console.error('Erro:',e);showCustomAlert('Erro banco.');}
}

// ==========================================
// MEDLEY
// ==========================================
function openMedleyModal(){document.getElementById('drawer-medley').classList.add('active');document.getElementById('drawer-medley-overlay').classList.add('active');resetMedleyFlow();loadMedleySongsList();}
function resetMedleyFlow(){medleyDraft=[];medleyCurrentSongId=null;medleyCurrentSongVerses=[];renderMedleyPreview();document.getElementById('medley-title').value='';document.getElementById('medley-verses-selector').innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;">Selecione uma música</p>';}
async function loadMedleySongsList(){const c=document.getElementById('medley-songs-list');c.innerHTML='<p class="loading-text">Carregando...</p>';try{const r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,lyrics_text,is_medley&is_medley=eq.false&order=title.asc`,{headers});const s=await r.json();allRepertoireCache=s;if(s.length===0){c.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;">Nenhuma música</p>';return;}let h='';s.forEach(sg=>{const sel=medleyDraft.some(d=>d.songId===sg.id);h+=`<div class="medley-song-item ${sel?'active':''}" onclick="selectMedleySong('${sg.id}')"><div class="medley-song-item-title">${sg.title}</div>${sel?'<div style="font-size:0.75rem;color:var(--success);margin-top:4px;">✓</div>':''}</div>`;});c.innerHTML=h;}catch(e){c.innerHTML='<p style="color:var(--danger);">Erro</p>';}}
async function selectMedleySong(id){medleyCurrentSongId=id;const s=allRepertoireCache.find(x=>x.id===id);if(!s)return;const v=parseLyricsIntoVerses(s.lyrics_text),ed=medleyDraft.find(d=>d.songId===id);medleyCurrentSongVerses=v.map((x,i)=>({...x,id:`${id}_v${i}`,selected:ed?ed.sections.some(s=>s.label===x.label&&s.content===x.content):false}));renderVersesSelector(s.title);}
function parseLyricsIntoVerses(l){if(!l)return[];const ls=l.split('\n'),v=[];let cl='Intro',cc=[];const sp=[/^(intro|introdução)/i,/^(verso|verse)/i,/^(pr[eé]-?refr[aã]o)/i,/^(refr[aã]o)/i,/^(ponte|bridge)/i,/^(final|outro)/i];for(let i=0;i<ls.length;i++){const li=ls[i];let ns=null;for(let p of sp){if(p.test(li.trim())){ns=li.trim().replace(/[:\[\]()]/g,'');break;}}if(ns){if(cc.length>0)v.push({label:cl,content:cc.join('\n').trim()});cl=ns;cc=[];}else if(li.trim()!=='')cc.push(li);}if(cc.length>0)v.push({label:cl,content:cc.join('\n').trim()});return v;}
function renderVersesSelector(t){const c=document.getElementById('medley-verses-selector');if(medleyCurrentSongVerses.length===0){c.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;">Sem partes.</p>';return;}let h=`<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border-color);"><strong style="color:var(--primary-color);">${t}</strong></div><button class="btn-secondary" onclick="selectAllVerses()" style="width:100%;margin-bottom:10px;font-size:0.85rem;">✓ Selecionar Todas</button>`;medleyCurrentSongVerses.forEach((v,i)=>{h+=`<div class="verse-selector-item ${v.selected?'selected':''}" id="verse-item-${i}"><div class="verse-checkbox-wrapper"><input type="checkbox" class="verse-checkbox" id="verse-cb-${i}" ${v.selected?'checked':''} onchange="toggleVerse(${i})"><div class="verse-label" onclick="toggleVerse(${i})"><div class="verse-section-title">${v.label}</div><div class="verse-content">${v.content}</div></div></div></div>`;});h+=`<button class="btn-primary" onclick="addSelectedVersesToMedley()" style="margin-top:12px;">+ Adicionar</button>`;c.innerHTML=h;}
function toggleVerse(i){medleyCurrentSongVerses[i].selected=!medleyCurrentSongVerses[i].selected;const it=document.getElementById(`verse-item-${i}`),cb=document.getElementById(`verse-cb-${i}`);if(medleyCurrentSongVerses[i].selected){it.classList.add('selected');cb.checked=true;}else{it.classList.remove('selected');cb.checked=false;}}
function selectAllVerses(){const as=medleyCurrentSongVerses.every(v=>v.selected);medleyCurrentSongVerses.forEach((v,i)=>{v.selected=!as;const it=document.getElementById(`verse-item-${i}`),cb=document.getElementById(`verse-cb-${i}`);if(v.selected){it.classList.add('selected');cb.checked=true;}else{it.classList.remove('selected');cb.checked=false;}});}
function addSelectedVersesToMedley(){const sv=medleyCurrentSongVerses.filter(v=>v.selected);if(sv.length===0){showCustomAlert('Selecione partes.');return;}const s=allRepertoireCache.find(x=>x.id===medleyCurrentSongId);medleyDraft=medleyDraft.filter(d=>d.songId!==medleyCurrentSongId);medleyDraft.push({songId:medleyCurrentSongId,songTitle:s.title,sections:sv.map(v=>({label:v.label,content:v.content}))});renderMedleyPreview();loadMedleySongsList();showCustomAlert(`${sv.length} parte(s) adicionada(s)!`,'Sucesso');}
function removeMedleySong(id){medleyDraft=medleyDraft.filter(d=>d.songId!==id);renderMedleyPreview();loadMedleySongsList();}
function renderMedleyPreview(){const c=document.getElementById('medley-preview');if(medleyDraft.length===0){c.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:20px;">Vazio</p>';return;}let h='<div class="medley-preview-content">';let tp=0;medleyDraft.forEach((it,idx)=>{h+=`<div class="medley-preview-song"><div class="medley-preview-song-title"><span class="material-symbols-outlined" style="font-size:1.1rem;">queue_music</span>${idx+1}. ${it.songTitle}<span class="material-symbols-outlined" style="color:var(--danger);cursor:pointer;font-size:1.1rem;margin-left:auto;" onclick="removeMedleySong('${it.songId}')">delete</span></div>`;it.sections.forEach(sc=>{tp++;h+=`<div class="medley-preview-section"><div class="medley-preview-section-label">${sc.label}</div><div class="medley-preview-section-content">${sc.content}</div></div>`;});h+='</div>';});h+=`</div><div style="margin-top:12px;padding:10px;background:#e3f2fd;border-radius:8px;font-size:0.85rem;"><strong>Resumo:</strong> ${medleyDraft.length} música(s), ${tp} parte(s)</div>`;c.innerHTML=h;}
async function saveNewMedley(){const t=document.getElementById('medley-title').value.trim();if(!t){showCustomAlert('Nome do Medley.');return;}if(medleyDraft.length<2){showCustomAlert('Mínimo 2 músicas.');return;}try{const fid=currentFolderId||null,r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire`,{method:'POST',headers:{...headers,'Prefer':'return=representation'},body:JSON.stringify({title:t,is_medley:true,created_by:currentUserData.id,lyrics_text:generateMedleyLyrics(),folder_id:fid})});const sm=await r.json(),mid=sm[0].id;for(let it of medleyDraft){for(let sc of it.sections){await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts`,{method:'POST',headers,body:JSON.stringify({medley_repertoire_id:mid,song_repertoire_id:it.songId,section:sc.label,section_content:sc.content})});}}showCustomAlert('Medley criado!','Sucesso');closeModals();loadRepertoire();}catch(e){console.error(e);showCustomAlert('Erro medley.');}}
function generateMedleyLyrics(){let l='';medleyDraft.forEach((it,idx)=>{l+=`\n=== ${it.songTitle} ===\n`;it.sections.forEach(sc=>{l+=`[${sc.label}]\n${sc.content}\n`;});});return l.trim();}

// ==========================================
// VIEW REPERTÓRIO & KEYS
// ==========================================
async function openViewRepertoire(id,t,el,im,ev=''){
    currentViewingRepertoireId=id;document.getElementById('view-rep-title').textContent=t;document.getElementById('view-rep-lyrics').textContent=el?decodeURIComponent(el):'';document.getElementById('modal-view-repertoire').classList.add('active');
    const vd=document.getElementById('view-rep-vocalist'),cv=ev?decodeURIComponent(ev):'';
    vd.innerHTML=`<div class="vocalist-editor"><label><span class="material-symbols-outlined" style="font-size:1rem;vertical-align:middle;">mic</span> Voz/Cantor:</label><div style="display:flex;gap:8px;margin-top:5px;"><input type="text" id="edit-vocalist-input" value="${cv}" placeholder="Ex: Ana" style="flex:1;padding:8px;border-radius:6px;border:1px solid #ccc;"><button class="btn-secondary" onclick="saveVocalistToRepertoire('${id}')" style="padding:8px 12px;">💾</button></div></div>`;
    document.getElementById('box-add-key').classList.remove('hidden');loadKeysForRepertoire(id);
    const pd=document.getElementById('medley-parts-display');
    if(im){pd.classList.remove('hidden');pd.innerHTML='<div class="loading-spinner"></div>';try{const r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,section_content,repertoire!song_repertoire_id(title)&order=created_at.asc`,{headers});const p=await r.json();if(p.length>0){let h='<strong>Estrutura:</strong><br>';p.forEach((x,i)=>{h+=`<div style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.08);"><strong>${i+1}.</strong> <em>${x.repertoire.title}</em><span style="color:var(--primary-color);font-weight:600;">→ ${x.section}</span></div>`;});pd.innerHTML=h;}}catch(e){pd.innerHTML='Erro estrutura.';}}else{pd.classList.add('hidden');}
}
async function saveVocalistToRepertoire(id){const i=document.getElementById('edit-vocalist-input');if(!i)return;const nv=i.value.trim();try{const r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`,{method:'PATCH',headers,body:JSON.stringify({vocalist:nv||null})});if(r.ok){showCustomAlert('Atualizado!','Sucesso');loadRepertoire();}else showCustomAlert('Erro.');}catch(e){showCustomAlert('Erro conexão.');}}
async function loadKeysForRepertoire(id){const c=document.getElementById('view-rep-keys');c.innerHTML='';try{const r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`,{headers});const k=await r.json();let h='';k.forEach(x=>{h+=`<span class="badge tom" style="font-size:1rem;padding:6px 12px;border-radius:20px;">${x.ton} <span style="cursor:pointer;color:#ff7675;margin-left:8px;" onclick="deleteKey('${x.id}')"></span></span>`;});c.innerHTML=h;}catch(e){}}
async function addKeyToRepertoire(){const nk=document.getElementById('new-key-input').value.trim();if(!nk||!currentViewingRepertoireId)return;try{await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`,{method:'POST',headers,body:JSON.stringify({repertoire_id:currentViewingRepertoireId,ton:nk})});document.getElementById('new-key-input').value='';loadKeysForRepertoire(currentViewingRepertoireId);loadRepertoire();}catch(e){showCustomAlert('Erro tom.');}}
async function deleteKey(kid){showCustomConfirm('Remover tom?',async()=>{try{await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?id=eq.${kid}`,{method:'DELETE',headers});loadKeysForRepertoire(currentViewingRepertoireId);loadRepertoire();}catch(e){}});}

// ==========================================
// ESCALAS
// ==========================================
function switchScaleTab(t){document.getElementById('tab-future').classList.remove('active');document.getElementById('tab-past').classList.remove('active');document.getElementById('scales-list-future').classList.add('hidden');document.getElementById('scales-list-past').classList.add('hidden');document.getElementById('tab-'+t).classList.add('active');document.getElementById('scales-list-'+t).classList.remove('hidden');}
async function loadScales(){const lf=document.getElementById('scales-list-future'),lp=document.getElementById('scales-list-past');lf.innerHTML=lp.innerHTML='<div class="loading-spinner"></div>';try{const r=await fetch(`${SUPABASE_URL}/rest/v1/scales?select=id,event_date,notes,scale_items(role,members(full_name,photo_url)),scale_songs(repertoire(title,repertoire_keys(ton),vocalist))&order=event_date.asc`,{headers});if(!r.ok)throw new Error('Erro');const sc=await r.json(),ts=new Date().toISOString().split('T')[0],fu=sc.filter(s=>s.event_date>=ts),pa=sc.filter(s=>s.event_date<ts).reverse();lf.innerHTML=renderScaleCards(fu,true);lp.innerHTML=renderScaleCards(pa,false);}catch(e){console.error('Erro escalas:',e);lf.innerHTML=lp.innerHTML='<p style="text-align:center;color:var(--danger);">Erro.</p>';}}
function renderScaleCards(a,isF){if(a.length===0)return`<p style="text-align:center;color:var(--text-muted);padding:40px;">${isF?'Nenhuma escala.','Histórico vazio.'}</p>`;let h='';a.forEach(s=>{const d=new Date(s.event_date),ds=new Date(d.getTime()+d.getTimezoneOffset()*60000).toLocaleDateString('pt-BR');let th='<div class="scale-team-section"><h4 class="scale-section-title"><span class="material-symbols-outlined">group</span> Equipe</h4><div class="scale-team-list">';s.scale_items.forEach(it=>{const ic=getRoleIcon(it.role),rn=getRoleName(it.role),pu=it.members?it.members.photo_url:null,fn=it.members?it.members.full_name:'?';th+=`<div class="scale-team-member"><div class="scale-team-photo">${pu?`<img src="${pu}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="photo-placeholder" style="display:none">${fn.charAt(0)}</div>`:`<div class="photo-placeholder">${fn.charAt(0)}</div>`}</div><span class="material-symbols-outlined scale-team-icon">${ic}</span><div class="scale-team-info"><span class="scale-team-name">${fn}</span><span class="scale-team-role">${rn}</span></div></div>`;});th+='</div></div>';let sh='<div class="scale-songs-section"><h4 class="scale-section-title"><span class="material-symbols-outlined">library_music</span> Repertório</h4><div class="scale-songs-list">';if(s.scale_songs.length>0){s.scale_songs.forEach(so=>{const ks=so.repertoire.repertoire_keys||[],ksr=ks.length>0?ks.map(k=>k.ton).join(', '):'',kb=ksr?`<span class="badge tom">${ksr}</span>`:'',vb=so.repertoire.vocalist?`<span class="vocalist-mini"><span class="material-symbols-outlined" style="font-size:0.8rem;">mic</span> ${so.repertoire.vocalist}</span>`:'';sh+=`<div class="scale-song-item"><span class="material-symbols-outlined scale-song-icon">music_note</span><span class="scale-song-name">${so.repertoire.title}</span><div class="scale-song-badges">${kb} ${vb}</div></div>`;});}else sh+='<div class="scale-empty">Nenhuma música.</div>';sh+='</div></div>';const ah=currentUserData.is_leader?`<div class="scale-folder-actions"><button class="btn-icon" onclick="openEditScaleModal('${s.id}')"><span class="material-symbols-outlined">edit</span></button><button class="btn-icon danger" onclick="deleteScale('${s.id}')"><span class="material-symbols-outlined">delete</span></button></div>`:'';h+=`<div class="scale-card"><div class="scale-card-header"><div class="scale-folder-date"><span class="material-symbols-outlined">event</span><div><div class="scale-folder-date-text">${ds}</div><div class="scale-folder-notes">${s.notes||'-'}</div></div></div>${ah}</div><div class="scale-card-body">${th}${sh}</div></div>`;});return h;}
async function deleteScale(sid){showCustomConfirm('Excluir escala?',async()=>{try{await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${sid}`,{method:'DELETE',headers});await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${sid}`,{method:'DELETE',headers});await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${sid}`,{method:'DELETE',headers});showCustomAlert('Excluída!','Sucesso');loadScales();if(document.getElementById('page-home')?.classList.contains('active'))fetchNextScaleHome();}catch(e){showCustomAlert('Erro.');}});}
async function openEditScaleModal(sid){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${sid}&select=id,event_date,notes,scale_items(member_id,role,members(full_name)),scale_songs(repertoire_id)`,{headers});if(!r.ok)throw new Error('Fail');const d=await r.json();if(d.length===0){showCustomAlert('Não encontrada.');return;}const sc=d[0];document.getElementById('modal-add-scale').classList.add('active');document.getElementById('editing-scale-id').value=sid;document.getElementById('scale-modal-title').textContent='Editar Escala';document.getElementById('scale-date').value=sc.event_date;document.getElementById('scale-notes').value=sc.notes||'';scaleDraftTeam=sc.scale_items.map(i=>({memberId:i.member_id,role:i.role,name:i.members?i.members.full_name:'?'}));renderScaleDraftTeam();if(allMembersCache.length===0){const rm=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`,{headers});allMembersCache=await rm.json();}if(allRepertoireCache.length===0){const rr=await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`,{headers});allRepertoireCache=await rr.json();}const ss=document.getElementById('scale-songs-selectors'),si=sc.scale_songs.map(s=>s.repertoire_id);ss.innerHTML='';allRepertoireCache.forEach(so=>{const ch=si.includes(so.id)?'checked':'',vi=so.vocalist?` <small style="color:var(--text-muted);">🎤 ${so.vocalist}</small>`:'';ss.innerHTML+=`<label class="song-checkbox"><input type="checkbox" value="${so.id}" class="scale-song-cb" ${ch}><span>${so.title}</span>${vi}</label>`;});}catch(e){showCustomAlert('Erro edição.');}}
async function openScaleModal(){document.getElementById('modal-add-scale').classList.add('active');document.getElementById('editing-scale-id').value='';document.getElementById('scale-modal-title').textContent='Nova Escala';scaleDraftTeam=[];renderScaleDraftTeam();if(allMembersCache.length===0){const r=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name`,{headers});allMembersCache=await r.json();}if(allRepertoireCache.length===0){const r=await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`,{headers});allRepertoireCache=await r.json();}const ss=document.getElementById('scale-songs-selectors');ss.innerHTML='';allRepertoireCache.forEach(so=>{const vi=so.vocalist?` <small style="color:var(--text-muted);">🎤 ${so.vocalist}</small>`:'';ss.innerHTML+=`<label class="song-checkbox"><input type="checkbox" value="${so.id}" class="scale-song-cb"><span>${so.title}</span>${vi}</label>`;});}
function searchMembersForScale(inp){const q=inp.value.trim().toLowerCase(),dd=document.getElementById('member-scale-dropdown');if(q.length<2){dd.style.display='none';return;}const f=allMembersCache.filter(m=>m.full_name.toLowerCase().includes(q)).slice(0,5);if(f.length>0){dd.innerHTML=f.map(m=>`<div class="dropdown-item" onclick="selectMemberForScale('${m.id}','${m.full_name}')"><span class="material-symbols-outlined">person</span>${m.full_name}</div>`).join('');dd.style.display='block';}else{dd.innerHTML='<div class="dropdown-empty">Nenhum</div>';dd.style.display='block';}}
let selectedMemberForScale=null;function selectMemberForScale(id,name){selectedMemberForScale={id,name};document.getElementById('member-scale-dropdown').style.display='none';document.querySelector('.searchable-select-member .search-input').value=name;}
function addMemberToScaleDraft(){if(!selectedMemberForScale){showCustomAlert('Selecione membro.');return;}const r=document.getElementById('scale-draft-role').value;if(!scaleDraftTeam.find(m=>m.memberId===selectedMemberForScale.id&&m.role===r)){scaleDraftTeam.push({...selectedMemberForScale,role});renderScaleDraftTeam();}else{showCustomAlert('Já na equipe.');}selectedMemberForScale=null;document.querySelector('.searchable-select-member .search-input').value='';}
function removeScaleDraftMember(i){scaleDraftTeam.splice(i,1);renderScaleDraftTeam();}
function renderScaleDraftTeam(){const l=document.getElementById('scale-draft-team-list');if(scaleDraftTeam.length===0){l.innerHTML='<p class="loading-text" style="font-size:0.85rem;text-align:center;">Vazio</p>';return;}let h='';scaleDraftTeam.forEach((it,i)=>{h+=`<div class="team-member-draft"><span class="material-symbols-outlined">${getRoleIcon(it.role)}</span><span>${it.name}</span><span class="role-tag">${getRoleName(it.role)}</span><button class="btn-remove" onclick="removeScaleDraftMember(${i})"><span class="material-symbols-outlined">close</span></button></div>`;});l.innerHTML=h;}
function searchScaleSongs(inp){const q=inp.value.toLowerCase();document.querySelectorAll('.song-checkbox').forEach(cb=>{cb.style.display=cb.textContent.toLowerCase().includes(q)?'flex':'none';});}
async function saveNewScale(){const d=document.getElementById('scale-date').value,n=document.getElementById('scale-notes').value,ei=document.getElementById('editing-scale-id').value;if(!d){showCustomAlert('Data obrigatória.');return;}if(scaleDraftTeam.length===0){showCustomAlert('Adicione membro.');return;}try{let sid;if(ei){await fetch(`${SUPABASE_URL}/rest/v1/scales?id=eq.${ei}`,{method:'PATCH',headers,body:JSON.stringify({event_date:d,notes:n,time_key:d.substring(0,7)})});sid=ei;await fetch(`${SUPABASE_URL}/rest/v1/scale_items?scale_id=eq.${sid}`,{method:'DELETE',headers});await fetch(`${SUPABASE_URL}/rest/v1/scale_songs?scale_id=eq.${sid}`,{method:'DELETE',headers});}else{const rs=await fetch(`${SUPABASE_URL}/rest/v1/scales`,{method:'POST',headers:{...headers,'Prefer':'return=representation'},body:JSON.stringify({time_key:d.substring(0,7),event_date:d,notes:n,created_by:currentUserData.id})});if(!rs.ok)throw new Error('Fail');const ss=await rs.json();sid=ss[0].id;}for(let it of scaleDraftTeam){await fetch(`${SUPABASE_URL}/rest/v1/scale_items`,{method:'POST',headers,body:JSON.stringify({scale_id:sid,member_id:it.memberId,role:it.role})});}const cbs=document.querySelectorAll('.scale-song-cb:checked');for(let cb of cbs){await fetch(`${SUPABASE_URL}/rest/v1/scale_songs`,{method:'POST',headers,body:JSON.stringify({scale_id:sid,repertoire_id:cb.value})});}showCustomAlert(ei?'Atualizada!':'Criada!','Sucesso');closeModals();loadScales();if(document.getElementById('page-home')?.classList.contains('active'))fetchNextScaleHome();}catch(e){console.error('Erro escala:',e);showCustomAlert('Erro.');}}

// ==========================================
// ADMINISTRAÇÃO
// ==========================================
function loadAdminDashboard(){showAdminSection('new-member');}
async function loadAdminStats(){const c=document.getElementById('admin-stats-content');c.innerHTML='<div class="loading-spinner"></div>';try{const[mr,rr,sr]=await Promise.all([fetch(`${SUPABASE_URL}/rest/v1/members?select=id`,{headers}),fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id`,{headers}),fetch(`${SUPABASE_URL}/rest/v1/scales?select=id`,{headers})]);const m=await mr.json(),r=await rr.json(),s=await sr.json();c.innerHTML=`<div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#f05a28,#d94d1f);"><span class="material-symbols-outlined">group</span></div><div class="stat-content"><h3>${m.length}</h3><p>Membros</p></div></div><div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe);"><span class="material-symbols-outlined">library_music</span></div><div class="stat-content"><h3>${r.length}</h3><p>Músicas</p></div></div><div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#00b894,#55efc4);"><span class="material-symbols-outlined">calendar_month</span></div><div class="stat-content"><h3>${s.length}</h3><p>Escalas</p></div></div>`;}catch(e){c.innerHTML='<p style="color:var(--danger);text-align:center;">Erro.</p>';}}
async function createNewMember(){const u=document.getElementById('new-username')?.value?.trim().toLowerCase(),f=document.getElementById('new-fullname')?.value?.trim(),e=document.getElementById('new-email')?.value?.trim(),p=document.getElementById('new-phone')?.value?.trim(),r=document.getElementById('new-role')?.value||'vocal',l=document.getElementById('new-is-leader')?.checked||false;if(!u||!f){showCustomAlert('Preencha usuário e nome.');return;}try{const res=await fetch(`${SUPABASE_URL}/rest/v1/members`,{method:'POST',headers:{...headers,'Prefer':'return=representation'},body:JSON.stringify({username:u,full_name:f,email:e||null,phone:p||null,is_leader:l,role:r})});if(!res.ok)throw new Error('Já existe ou erro.');const sv=await res.json();if(r!=='midia')await fetch(`${SUPABASE_URL}/rest/v1/folders`,{method:'POST',headers,body:JSON.stringify({name:`Repertório de ${f}`,created_by:sv[0].id,is_general:false})});showCustomAlert('Cadastrado!','Sucesso');document.getElementById('new-username').value='';document.getElementById('new-fullname').value='';document.getElementById('new-is-leader').checked=false;}catch(e){console.error('Erro:',e);showCustomAlert('Erro: '+e.message,'Erro');}}
async function loadAdminMembers(){const c=document.getElementById('admin-members-list');c.innerHTML='<div class="loading-spinner"></div>';try{let m=[];try{const r=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,email,phone,is_leader,role&order=full_name.asc`,{headers,'Prefer':'return=representation'});if(r.ok)m=await r.json();else if(r.status===400){const rm=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`,{headers});if(rm.ok)m=await rm.json();}}catch(e){const rm=await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,full_name,username,is_leader,role&order=full_name.asc`,{headers});if(rm.ok)m=await rm.json();}if(m.length===0){c.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:40px;">Nenhum membro.</p>';return;}let h='<div class="admin-members-grid">';m.forEach(x=>{const em=x.email||'',ro=x.role||'vocal';h+=`<div class="admin-member-card" data-name="${(x.full_name||'').toLowerCase()}"><div class="member-info"><h4>${x.full_name||'?'}</h4><p class="member-username">@${x.username||'-'}</p>${em?`<p class="member-contact"><span class="material-symbols-outlined">mail</span> ${em}</p>`:''}<div class="member-roles-tags">${x.is_leader?'<span class="role-badge leader">Líder</span>':''}${ro?`<span class="role-badge">${getRoleName(ro)}</span>`:''}</div></div><div class="member-actions"><button class="btn-icon" onclick="editMember('${x.id}')"><span class="material-symbols-outlined">edit</span></button><button class="btn-icon danger" onclick="deleteMember('${x.id}')"><span class="material-symbols-outlined">delete</span></button></div></div>`;});h+='</div>';c.innerHTML=h;}catch(e){console.error('Erro admin:',e);c.innerHTML=`<p style="text-align:center;color:var(--danger);padding:40px;">Erro.<br><button class="btn-secondary" onclick="loadAdminMembers()">🔄</button></p>`;}}
function filterAdminMembers(){const q=document.getElementById('admin-search').value.toLowerCase();document.querySelectorAll('.admin-member-card').forEach(c=>{c.style.display=c.getAttribute('data-name').includes(q)?'flex':'none';});}

// ==========================================
// EDIÇÃO DE MEMBROS (CORRIGIDA)
// ==========================================
async function editMember(id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}&select=id,username,full_name,email,phone,is_leader,role`, { headers });
        if (!res.ok) throw new Error('Falha ao carregar');
        const member = (await res.json())[0];
        if (!member) return showCustomAlert('Membro não encontrado.');

        // Preenche modal corretamente
        document.getElementById('edit-member-id').value = member.id;
        document.getElementById('edit-fullname').value = member.full_name || '';
        document.getElementById('edit-email').value = member.email || '';
        document.getElementById('edit-phone').value = member.phone || '';
        document.getElementById('edit-role').value = member.role || 'vocal';
        document.getElementById('edit-is-leader').checked = member.is_leader || false;

        // Abre modal
        document.getElementById('modal-edit-member').classList.add('active');
    } catch (e) {
        console.error('Erro editar membro:', e);
        showCustomAlert('Erro ao carregar dados.', 'Erro');
    }
}

async function saveEditMember() {
    const id = document.getElementById('edit-member-id').value;
    const fullname = document.getElementById('edit-fullname').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const role = document.getElementById('edit-role').value;
    const isLeader = document.getElementById('edit-is-leader').checked;

    if (!fullname) return showCustomAlert('Nome completo é obrigatório.', 'Erro');

    try {
        const updateData = { full_name: fullname, email: email || null, phone: phone || null, role, is_leader: isLeader };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updateData)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Falha ao atualizar');
        }

        showCustomAlert('Membro atualizado com sucesso!', 'Sucesso');
        closeModals(); // Fecha o modal
        loadAdminMembers(); // Recarrega a lista
        
        // Atualiza cache se for o usuário logado
        if (id === currentUserData.id) {
            currentUserData = { ...currentUserData, ...updateData };
            localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
            updateHeaderUserInfo();
        }
    } catch (e) {
        console.error('Erro ao atualizar membro:', e);
        showCustomAlert('Erro: ' + e.message, 'Erro');
    }
}

async function deleteMember(id) {
    showCustomConfirm('Remover este membro?', async () => {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${id}`, { method: 'DELETE', headers });
            showCustomAlert('Membro excluído!', 'Sucesso');
            loadAdminMembers();
        } catch (e) { showCustomAlert('Erro ao excluir.', 'Erro'); }
    });
}

// ==========================================
// INICIALIZAÇÃO SEGURA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM pronto. Vinculando eventos...');
    const lb = document.getElementById('btn-login');
    if (lb) { lb.addEventListener('click', handleLogin); console.log('✅ Login vinculado.'); }
    const su = localStorage.getItem('sessionUser');
    if (su) {
        try {
            currentUserData = JSON.parse(su);
            console.log('✅ Sessão:', currentUserData.full_name);
            showSystemScreen();
        } catch (e) { console.error('❌ Sessão:', e); localStorage.removeItem('sessionUser'); }
    }
    initSupabase();
});

// EXPORTAÇÃO GLOBAL PARA ONCLICKS DO HTML
window.handleLogin = handleLogin;
window.showSystemScreen = showSystemScreen;
window.updateHeaderUserInfo = updateHeaderUserInfo;
window.handleLogout = handleLogout;
window.navigate = navigate;
window.closeModals = closeModals;
window.showAdminSection = showAdminSection;
window.showCustomAlert = showCustomAlert;
window.closeCustomAlert = closeCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.closeCustomConfirm = closeCustomConfirm;
window.loadDashboard = loadDashboard;
window.startCountdown = startCountdown;
window.startCarouselAutoScroll = startCarouselAutoScroll;
window.scrollCarousel = scrollCarousel;
window.fetchDailyMessage = fetchDailyMessage;
window.getRoleIcon = getRoleIcon;
window.getRoleName = getRoleName;
window.fetchNextScaleHome = fetchNextScaleHome;
window.loadProfile = loadProfile;
window.compressImage = compressImage;
window.uploadPhoto = uploadPhoto;
window.updateProfile = updateProfile;
window.loadMembers = loadMembers;
window.createMemberCard = createMemberCard;
window.loadFolders = loadFolders;
window.countMusicInFolder = countMusicInFolder;
window.selectFolder = selectFolder;
window.confirmDeleteFolder = confirmDeleteFolder;
window.deleteFolder = deleteFolder;
window.openCreateFolderModal = openCreateFolderModal;
window.openCreateFolderModalCustom = openCreateFolderModalCustom;
window.showCustomInput = showCustomInput;
window.createFolder = createFolder;
window.openRepertoireModal = openRepertoireModal;
window.normalizeText = normalizeText;
window.extractLyricsFromLetras = extractLyricsFromLetras;
window.searchMusicList = searchMusicList;
window.addSearchResultToDOM = addSearchResultToDOM;
window.importPreCheckedLyrics = importPreCheckedLyrics;
window.searchVocalists = searchVocalists;
window.selectVocalist = selectVocalist;
window.removeVocalist = removeVocalist;
window.updateSelectedVocalists = updateSelectedVocalists;
window.saveNewRepertoire = saveNewRepertoire;
window.loadRepertoire = loadRepertoire;
window.deleteRepertoire = deleteRepertoire;
window.openMedleyModal = openMedleyModal;
window.resetMedleyFlow = resetMedleyFlow;
window.loadMedleySongsList = loadMedleySongsList;
window.selectMedleySong = selectMedleySong;
window.parseLyricsIntoVerses = parseLyricsIntoVerses;
window.renderVersesSelector = renderVersesSelector;
window.toggleVerse = toggleVerse;
window.selectAllVerses = selectAllVerses;
window.addSelectedVersesToMedley = addSelectedVersesToMedley;
window.removeMedleySong = removeMedleySong;
window.renderMedleyPreview = renderMedleyPreview;
window.saveNewMedley = saveNewMedley;
window.generateMedleyLyrics = generateMedleyLyrics;
window.openViewRepertoire = openViewRepertoire;
window.saveVocalistToRepertoire = saveVocalistToRepertoire;
window.loadKeysForRepertoire = loadKeysForRepertoire;
window.addKeyToRepertoire = addKeyToRepertoire;
window.deleteKey = deleteKey;
window.switchScaleTab = switchScaleTab;
window.loadScales = loadScales;
window.renderScaleCards = renderScaleCards;
window.deleteScale = deleteScale;
window.openEditScaleModal = openEditScaleModal;
window.openScaleModal = openScaleModal;
window.searchMembersForScale = searchMembersForScale;
window.selectMemberForScale = selectMemberForScale;
window.addMemberToScaleDraft = addMemberToScaleDraft;
window.removeScaleDraftMember = removeScaleDraftMember;
window.renderScaleDraftTeam = renderScaleDraftTeam;
window.searchScaleSongs = searchScaleSongs;
window.saveNewScale = saveNewScale;
window.loadAdminDashboard = loadAdminDashboard;
window.loadAdminStats = loadAdminStats;
window.createNewMember = createNewMember;
window.loadAdminMembers = loadAdminMembers;
window.filterAdminMembers = filterAdminMembers;
window.editMember = editMember;
window.saveEditMember = saveEditMember;
window.deleteMember = deleteMember;

console.log('✅ Todas as funções expostas no escopo global (window)');
