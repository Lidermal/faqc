// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 
    'apikey': SUPABASE_KEY, 
    'Authorization': `Bearer ${SUPABASE_KEY}`, 
    'Content-Type': 'application/json' 
};

// Variáveis globais
let currentUserData = null;
let countdownInterval;
let currentViewingRepertoireId = null;
let allRepertoireCache = [];
let allMembersCache = [];
let realtimeChannels = [];
let supabaseClient = null;

// Variáveis para os rascunhos
let scaleDraftTeam = [];
let medleyDraft = [];
let medleyCurrentSongId = null;
let medleyCurrentSongVerses = [];

// ==========================================
// INICIALIZAÇÃO SEGURA DO SUPABASE
// ==========================================
function initSupabase() {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase client inicializado');
            return true;
        } else {
            console.warn('⚠️ Supabase library não carregada, realtime desativado');
            return false;
        }
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

    if (currentUserData.is_leader) {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('btn-add-scale').classList.remove('hidden');
    }
    
    document.getElementById('repertoire-actions').classList.remove('hidden');
    
    navigate('home');
    
    // Inicializar realtime após login bem-sucedido
    if (!supabaseClient) {
        initSupabase();
    }
    if (supabaseClient) {
        setupRealtimeSubscriptions();
    }
}

function handleLogout() {
    // Desinscrever dos canais realtime
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
        page.classList.remove('hidden'); 
    });
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) {
        targetPage.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + pageId);
    if(targetNav) {
        targetNav.classList.add('active');
    }
    
    if (pageId === 'home') loadDashboard();
    if (pageId === 'membros') loadMembers();
    if (pageId === 'admin') loadAdminMembers();
    if (pageId === 'repertorio') loadRepertoire();
    if (pageId === 'escalas') loadScales();
}

function closeModals() { 
    document.querySelectorAll('.modal').forEach(m => {
        if(!m.classList.contains('custom-alert-modal')) {
            m.classList.remove('active'); 
        }
    });
    
    // Fechar drawer
    document.getElementById('drawer-medley').classList.remove('active');
    document.getElementById('drawer-medley-overlay').classList.remove('active');
    
    const editingField = document.getElementById('editing-scale-id');
    if(editingField) {
        editingField.value = '';
    }
    const modalTitle = document.getElementById('scale-modal-title');
    if(modalTitle) {
        modalTitle.textContent = 'Nova Escala';
    }
    resetMedleyFlow();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth <= 768) {
        // Lógica de toggle não afeta o sidebar de rodapé em dispositivos móveis
    }
} 

// ==========================================
// SUPABASE REALTIME
// ==========================================
function setupRealtimeSubscriptions() {
    if (!supabaseClient) {
        console.warn('Realtime não disponível');
        return;
    }

    try {
        // Canal para mudanças no repertório
        const repChannel = supabaseClient
            .channel('repertoire-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire' }, (payload) => {
                console.log('Mudança no repertório:', payload);
                if(document.getElementById('page-repertorio').classList.contains('active')) {
                    loadRepertoire();
                }
                if(document.getElementById('drawer-medley').classList.contains('active')) {
                    loadMedleySongsList();
                }
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        // Canal para mudanças nas escalas
        const scaleChannel = supabaseClient
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
        const memberChannel = supabaseClient
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
        
        console.log('✅ Realtime subscriptions configuradas');
    } catch (e) {
        console.error('❌ Erro ao configurar realtime:', e);
    }
}

// ==========================================
// INÍCIO (Relógio para 18:30)
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

// Lista de 31 versículos (um para cada dia do mês) para não repetir
const worshipVerses = [
    { text: "Cantem ao Senhor um novo cântico; cantem ao Senhor, toda a terra!", ref: "Salmos 96:1" },
    { text: "Adorem o Senhor na beleza da sua santidade; tremam diante dele, todos os habitantes da terra.", ref: "Salmos 96:9" },
    { text: "Tudo o que tem vida louve o Senhor! Aleluia!", ref: "Salmos 150:6" },
    { text: "Os verdadeiros adoradores adorarão o Pai em espírito e em verdade.", ref: "João 4:23" },
    { text: "Rendam graças ao Senhor, pois ele é bom; o seu amor dura para sempre.", ref: "1 Crônicas 16:34" },
    { text: "Bendirei o Senhor o tempo todo! Os meus lábios sempre o louvarão.", ref: "Salmos 34:1" },
    { text: "Cantarei ao Senhor toda a minha vida; louvarei ao meu Deus enquanto eu viver.", ref: "Salmos 104:33" },
    { text: "Porque dele e por ele, e para ele, são todas as coisas; glória, pois, a ele eternamente. Amém.", ref: "Romanos 11:36" },
    { text: "Habite ricamente em vocês a palavra de Cristo... cantando salmos, hinos e cânticos espirituais com gratidão a Deus.", ref: "Colossenses 3:16" },
    { text: "Louvai ao Senhor. Louvai a Deus no seu santuário; louvai-o no firmamento do seu poder.", ref: "Salmos 150:1" },
    { text: "Alegrem-se no Senhor, justos, e louvem o seu santo nome.", ref: "Salmos 97:12" },
    { text: "Deem ao Senhor a glória devida ao seu nome; adorem o Senhor no esplendor da sua santidade.", ref: "Salmos 29:2" },
    { text: "Tu és digno, Senhor e Deus nosso, de receber a glória, a honra e o poder...", ref: "Apocalipse 4:11" },
    { text: "Por meio de Jesus, portanto, ofereçamos continuamente a Deus um sacrifício de louvor.", ref: "Hebreus 13:15" },
    { text: "Bom é render graças ao Senhor e cantar louvores ao teu nome, ó Altíssimo.", ref: "Salmos 92:1" },
    { text: "Exaltem o Senhor, o nosso Deus, prostre-se diante do estrado de seus pés. Ele é santo!", ref: "Salmos 99:5" },
    { text: "Entrem por suas portas com ações de graças, e em seus átrios, com louvor.", ref: "Salmos 100:4" },
    { text: "Cantem para Deus, louvem o seu nome, exaltem aquele que cavalga sobre as nuvens...", ref: "Salmos 68:4" },
    { text: "A minha boca falará o louvor do Senhor, e toda a carne louvará o seu santo nome.", ref: "Salmos 145:21" },
    { text: "Cantai-lhe um cântico novo; tocai bem e com júbilo.", ref: "Salmos 33:3" },
    { text: "Engrandecei ao Senhor comigo; e juntos exaltemos o seu nome.", ref: "Salmos 34:3" },
    { text: "Elevo os meus olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor.", ref: "Salmos 121:1-2" },
    { text: "Que a paz de Cristo seja o juiz em seus corações... E sejam agradecidos.", ref: "Colossenses 3:15" },
    { text: "Falando entre vós em salmos, e hinos, e cânticos espirituais; cantando e salmodiando ao Senhor...", ref: "Efésios 5:19" },
    { text: "A ti, ó Deus dos meus pais, eu rendo graças e te louvo...", ref: "Daniel 2:23" },
    { text: "Proclamem a sua glória entre as nações, seus maravilhosos feitos entre todos os povos.", ref: "Salmos 96:3" },
    { text: "Cantem ao Senhor, bendigam o seu nome; cada dia proclamem a sua salvação!", ref: "Salmos 96:2" },
    { text: "Louvem o nome do Senhor, pois só o seu nome é exaltado; a sua majestade está acima da terra e dos céus.", ref: "Salmos 148:13" },
    { text: "Ele pôs em minha boca um cântico novo, um hino de louvor ao nosso Deus.", ref: "Salmos 40:3" },
    { text: "O Senhor é a minha força e o meu escudo; nele o meu coração confia...", ref: "Salmos 28:7" },
    { text: "Todo o meu ser louve o Senhor; louvarei o seu santo nome de todo o meu coração.", ref: "Salmos 103:1" }
];

async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    
    // Obtém o dia atual (1 a 31)
    const today = new Date().getDate();
    
    // Seleciona o versículo com base no dia do mês
    const verse = worshipVerses[(today - 1) % worshipVerses.length];
    
    container.innerHTML = `
        <div style="padding: 10px; text-align: center;">
            <p style="font-size: 1.1rem; font-style: italic; color: var(--text-main); margin-bottom:10px;">"${verse.text}"</p>
            <span class="verse-ref" style="font-weight: 700; color: var(--primary-color);">- ${verse.ref}</span>
        </div>
    `;
}

// Icones por cargo para o dashboard e escalas
const roleIcons = {
    'lider': 'star',
    'vocal': 'mic',
    'violao': 'gite',
    'guitarra': 'electric_guitar', // fallback adicionado
    'baixo': 'graphic_eq',
    'teclado': 'piano',
    'baterista': 'album' 
};

function getRoleIcon(role) {
    const r = role.toLowerCase();
    if(r.includes('lider')) return 'star';
    if(r.includes('vocal')) return 'mic';
    if(r.includes('teclado') || r.includes('piano')) return 'piano';
    if(r.includes('baixo')) return 'graphic_eq';
    if(r.includes('bateria') || r.includes('baterista')) return 'album';
    return 'music_note'; // fallback geral
}

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
                const leaders = itemsData.filter(i => i.role === 'lider');
                const vocals = itemsData.filter(i => i.role === 'vocal');
                const band = itemsData.filter(i => !['lider', 'vocal'].includes(i.role));
                
                let html = '<div class="stage-container">';
                
                // Trás (Banda)
                if (band.length > 0) {
                    html += '<div class="stage-row back">';
                    band.forEach(i => {
                        const icon = getRoleIcon(i.role);
                        html += `
                            <div class="stage-player">
                                <div class="stage-avatar banda"><span class="material-symbols-outlined">${icon}</span></div>
                                <span class="stage-name">${i.members.full_name.split(' ')[0]}</span>
                                <span class="stage-role">${i.role}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
                
                // Frente (Vocais e Líder)
                if (leaders.length > 0 || vocals.length > 0) {
                    html += '<div class="stage-row front">';
                    leaders.forEach(i => {
                        html += `
                            <div class="stage-player">
                                <div class="stage-avatar lider"><span class="material-symbols-outlined">star</span></div>
                                <span class="stage-name" style="font-weight:700; color:var(--primary-color);">${i.members.full_name.split(' ')[0]}</span>
                                <span class="stage-role">Líder</span>
                            </div>
                        `;
                    });
                    vocals.forEach(i => {
                        html += `
                            <div class="stage-player">
                                <div class="stage-avatar vocal"><span class="material-symbols-outlined">mic</span></div>
                                <span class="stage-name">${i.members.full_name.split(' ')[0]}</span>
                                <span class="stage-role">Vocal</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
                
                html += '</div>';
                container.innerHTML = html;
            } else {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">A equipe ainda não foi definida para este culto.</p>`;
            }
        } else {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">Nenhum culto programado para os próximos dias.</p>`;
        }
    } catch (e) { 
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:10px 0;">Erro ao carregar escala.</p>`; 
    }
}

// ==========================================
// BUSCADOR OTIMIZADO PARA BRASIL/GOSPEL
// ==========================================
function openRepertoireModal() { 
    document.getElementById('modal-add-repertoire').classList.add('active'); 
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-msg').textContent = '';
    document.getElementById('search-query').value = '';
}

let cachedLyricsSearch = {};

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { 
        showCustomAlert('Digite o nome da música ou cantor.'); 
        return; 
    }
    
    msgBox.style.color = 'var(--text-main)';
    msgBox.textContent = 'Buscando melhor letra correspondente...';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    try {
        // Lyrist API: API excelente que varre letras, inclusive músicas baseadas no YouTube
        const lyristRes = await fetch(`https://lyrist.vercel.app/api/${encodeURIComponent(query)}`);
        
        if(lyristRes.ok) {
            const lyristData = await lyristRes.json();
            
            if(lyristData && lyristData.lyrics) {
                const uniqueId = Date.now().toString();
                cachedLyricsSearch[uniqueId] = { 
                    artist: lyristData.artist, 
                    song: lyristData.title, 
                    lyrics: lyristData.lyrics 
                };
                
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                    <div>
                        <strong>${lyristData.title}</strong><br>
                        <small>${lyristData.artist}</small>
                    </div> 
                    <span class="material-symbols-outlined" style="color:var(--success);">download_done</span>
                `;
                div.onclick = () => importPreCheckedLyrics(uniqueId);
                resultsContainer.appendChild(div);
                
                msgBox.style.color = 'var(--success)';
                msgBox.textContent = 'Música encontrada com sucesso!';
                
                return; // Achou na API principal, sai da função
            }
        }
    } catch(e) {
        console.log('Lyrist API falhou, tentando fallback...');
    }

    // Fallback: Busca via iTunes filtrando para o Brasil e adicionando "gospel" se necessário
    try {
        const searchTerm = encodeURIComponent(query + " gospel");
        const res = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&country=BR&limit=6`);
        const data = await res.json();
        
        if(data.results.length === 0) { 
            msgBox.style.color = 'var(--danger)';
            msgBox.textContent = 'Nada encontrado. Tente buscar pelo título exato.'; 
            return; 
        }
        
        msgBox.textContent = 'Encontramos artistas, testando as letras...';
        let foundAnyValid = false;

        for(let track of data.results) {
            try {
                const lyrRes = await fetch(`https://api.lyrics.ovh/v1/${track.artistName}/${track.trackName}`);
                if(lyrRes.ok) {
                    const lyrData = await lyrRes.json();
                    if(lyrData.lyrics && lyrData.lyrics.length > 20) {
                        foundAnyValid = true;
                        const uniqueId = track.trackId;
                        cachedLyricsSearch[uniqueId] = { 
                            artist: track.artistName, 
                            song: track.trackName, 
                            lyrics: lyrData.lyrics 
                        };
                        
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        div.innerHTML = `
                            <div>
                                <strong>${track.trackName}</strong><br>
                                <small>${track.artistName}</small>
                            </div> 
                            <span class="material-symbols-outlined" style="color:var(--success);">download_done</span>
                        `;
                        div.onclick = () => importPreCheckedLyrics(uniqueId);
                        resultsContainer.appendChild(div);
                    }
                }
            } catch(err) {
                // Continua testando a próxima
            }
        }

        if(!foundAnyValid) {
            msgBox.style.color = 'var(--danger)';
            msgBox.textContent = 'Músicas encontradas, mas sem letras públicas registradas nos bancos.';
        } else {
            msgBox.style.color = 'var(--success)';
            msgBox.textContent = 'Opções com letras confirmadas encontradas!';
        }

    } catch(e) { 
        msgBox.style.color = 'var(--danger)';
        msgBox.textContent = 'Erro de conexão com o buscador secundário.'; 
    }
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
    
    if(!title || !lyrics) { 
        showCustomAlert('Título e Letra são obrigatórios!'); 
        return; 
    }
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire`, { 
            method: 'POST', 
            headers: { ...headers, 'Prefer': 'return=representation' }, 
            body: JSON.stringify({ 
                title: title, 
                lyrics_text: lyrics, 
                created_by: currentUserData.id 
            }) 
        });
        
        const savedData = await res.json();
        
        if(initialKey && savedData.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify({ repertoire_id: savedData[0].id, ton: initialKey }) 
            });
        }
        
        showCustomAlert('Música salva com sucesso!', "Sucesso"); 
        closeModals(); 
        loadRepertoire();
    } catch(e) { 
        showCustomAlert('Erro ao salvar no banco.'); 
    }
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
            
            html += `
                <div class="playlist-item" onclick="openViewRepertoire('${song.id}', \`${song.title.replace(/`/g, "'")}\`, \`${encodeURIComponent(song.lyrics_text || '')}\`, ${song.is_medley})">
                    <div class="play-info">
                        <div class="play-icon"><span class="material-symbols-outlined">${song.is_medley ? 'queue_music' : 'music_note'}</span></div>
                        <div class="play-title">
                            <h4>${song.title}</h4>
                            <p>${song.is_medley ? 'Medley' : 'Louvor'}</p>
                        </div>
                    </div>
                    <div class="play-keys">${keysHtml}</div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    } catch (e) { 
        list.innerHTML = '<p>Erro.</p>'; 
    }
}

async function openViewRepertoire(id, title, encodedLyrics, isMedley) {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    // Todos os usuários agora podem visualizar e adicionar tons (Restrição de líder removida visualmente)
    const addBox = document.getElementById('box-add-key');
    addBox.classList.remove('hidden'); 
    
    loadKeysForRepertoire(id);

    const partsDisplay = document.getElementById('medley-parts-display');
    if(isMedley) {
        partsDisplay.classList.remove('hidden'); 
        partsDisplay.innerHTML = 'Carregando estrutura...';
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_medley_parts?medley_repertoire_id=eq.${id}&select=section,section_content,repertoire!song_repertoire_id(title)&order=created_at.asc`, { headers });
            const parts = await res.json();
            
            if (parts.length > 0 && parts[0].section_content) {
                let html = '<strong>Estrutura do Medley:</strong><br>';
                parts.forEach((p, idx) => { 
                    html += `
                        <div style="padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
                            <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> 
                            <span style="color:var(--primary-color); font-weight:600;">→ ${p.section}</span>
                            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:3px; white-space:pre-wrap; max-height:80px; overflow:hidden;">${p.section_content}</div>
                        </div>
                    `; 
                });
                partsDisplay.innerHTML = html;
            } else {
                let html = '<strong>Estrutura do Medley:</strong><br>';
                parts.forEach((p, idx) => { 
                    html += `
                        <div style="padding:4px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                            • <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> → <span style="color:var(--primary-color); font-weight:600;">${p.section}</span>
                        </div>
                    `; 
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
    const container = document.getElementById('view-rep-keys'); 
    container.innerHTML = '';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys?repertoire_id=eq.${id}`, { headers });
        const keys = await res.json();
        
        let html = '';
        keys.forEach(k => {
            // Apenas líderes podem DELETAR o tom por segurança
            let deleteBtn = currentUserData.is_leader ? `<span style="cursor:pointer; color:#ff7675; margin-left:8px;" onclick="deleteKey('${k.id}')">✕</span>` : '';
            html += `<span class="badge tom" style="font-size:1rem; padding:6px 12px; border-radius:20px;">${k.ton} ${deleteBtn}</span>`;
        });
        
        container.innerHTML = html;
    } catch(e) {
        console.error('Erro ao carregar tons:', e);
    }
}

async function addKeyToRepertoire() {
    const newKey = document.getElementById('new-key-input').value.trim();
    if(!newKey || !currentViewingRepertoireId) return;
    
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/repertoire_keys`, { 
            method: 'POST', 
            headers, 
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
        } catch(e) {
            console.error('Erro ao deletar tom:', e);
        }
    });
}

// ==========================================
// MEDLEY - SELEÇÃO DE ESTROFES
// ==========================================
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
        /^(final|outro|encerramento)\s*\d*$/i,
        /^(interlúdio|interlude)\s*\d*$/i,
        /^(solo)\s*\d*$/i
    ];
    
    function detectSection(line) {
        const cleanLine = line.trim().replace(/[:\[\]()]/g, '');
        for (let pattern of sectionPatterns) {
            if (pattern.test(cleanLine)) {
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
    document.getElementById('medley-verses-selector').innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Selecione uma música ao lado para escolher as partes</p>';
}

async function loadMedleySongsList() {
    const container = document.getElementById('medley-songs-list');
    container.innerHTML = '<p class="loading-text">Carregando...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=*,repertoire_keys(ton)&is_medley=eq.false&order=title.asc`, { headers });
        const songs = await res.json();
        allRepertoireCache = songs;
        
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
    
    const verses = parseLyricsIntoVerses(song.lyrics_text);
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
    
    medleyDraft = medleyDraft.filter(d => d.songId !== medleyCurrentSongId);
    
    medleyDraft.push({
        songId: medleyCurrentSongId,
        songTitle: song.title,
        sections: selectedVerses.map(v => ({ label: v.label, content: v.content }))
    });
    
    renderMedleyPreview();
    loadMedleySongsList();
    
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
            showCustomAlert(`A música "${item.songTitle}" não tem partes selecionadas.`);
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

// ==========================================
// MEMBROS
// ==========================================
async function loadMembers() {
    const lineup = document.getElementById('members-lineup');
    lineup.innerHTML = '<p class="loading-text" style="color:white;">Buscando equipe...</p>';
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id,username,full_name,photo_url,is_leader,member_roles(role)&order=full_name.asc`, { headers });
        const members = await res.json();
        
        if (members.length === 0) { 
            lineup.innerHTML = '<p style="color:white; text-align:center;">Nenhum membro cadastrado.</p>'; 
            return; 
        }
        
        let team = { lider:[], vocal:[], banda:[], membro:[] };
        
        members.forEach(m => {
            let p = { id: m.id, name: m.full_name };
            const roles = m.member_roles.map(r => r.role);
            
            if(m.is_leader) {
                team.lider.push(p);
            } else if(roles.includes('vocal')) {
                team.vocal.push(p);
            } else if(roles.length > 0) {
                team.banda.push({...p, role: roles[0]});
            } else {
                team.membro.push(p);
            }
        });
        
        let html = '';
        
        // Trás (Banda)
        if(team.banda.length > 0) {
            html += '<div class="stage-row back">';
            team.banda.forEach(p => {
                const icon = getRoleIcon(p.role);
                html += `
                    <div class="stage-player">
                        <div class="stage-avatar banda">
                            <span class="material-symbols-outlined">${icon}</span>
                        </div>
                        <span class="stage-name">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">${p.role}</span>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Frente (Vocais e Líderes)
        if(team.lider.length > 0 || team.vocal.length > 0) {
            html += '<div class="stage-row front">';
            team.lider.forEach(p => {
                html += `
                    <div class="stage-player">
                        <div class="stage-avatar lider">
                            <span class="material-symbols-outlined">star</span>
                        </div>
                        <span class="stage-name" style="font-weight:700; color:var(--primary-color);">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">Líder</span>
                    </div>
                `;
            });
            
            team.vocal.forEach(p => {
                html += `
                    <div class="stage-player">
                        <div class="stage-avatar vocal">
                            <span class="material-symbols-outlined">mic</span>
                        </div>
                        <span class="stage-name">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">Vocal</span>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        lineup.innerHTML = html || '<p style="color:white; text-align:center;">Nenhum membro encontrado.</p>';
    } catch (e) { 
        lineup.innerHTML = '<p style="color:white; text-align:center;">Erro ao carregar equipe.</p>'; 
    }
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=*,scale_items(role,members(full_name)),scale_songs(repertoire(title,repertoire_keys(ton)))&order=event_date.asc`, { headers });
        const scales = await res.json();
        
        const todayStr = new Date().toISOString().split('T')[0];
        const futures = scales.filter(s => s.event_date >= todayStr);
        const pasts = scales.filter(s => s.event_date < todayStr).reverse();

        listFuture.innerHTML = renderScaleCards(futures, true);
        listPast.innerHTML = renderScaleCards(pasts, false);

    } catch(e) { 
        listFuture.innerHTML = '<p>Erro ao carregar escalas.</p>'; 
        listPast.innerHTML = '';
    }
}

function renderScaleCards(scaleArray, isFuture) {
    if(scaleArray.length === 0) {
        return isFuture ? '<p>Nenhuma escala programada.</p>' : '<p>O histórico está vazio.</p>';
    }
    
    let html = '';
    
    scaleArray.forEach(s => {
        const dateObj = new Date(s.event_date);
        const dateStr = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
        
        let band = []; 
        let vocals = []; 
        let leaders = [];
        
        s.scale_items.forEach(i => {
            let p = { name: i.members.full_name, role: i.role };
            if(i.role === 'lider') leaders.push(p); 
            else if(i.role === 'vocal') vocals.push(p); 
            else band.push(p);
        });

        // Layout de Stage na Escala Card
        let lineupHtml = '<div class="stage-container" style="border-radius:0; border-left:none; border-right:none;">';
        
        if(band.length > 0) {
            lineupHtml += '<div class="stage-row back" style="transform: scale(0.85);">';
            band.forEach(p => {
                lineupHtml += `
                    <div class="stage-player">
                        <div class="stage-avatar banda">
                            <span class="material-symbols-outlined">${getRoleIcon(p.role)}</span>
                        </div>
                        <span class="stage-name">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">${p.role}</span>
                    </div>
                `;
            });
            lineupHtml += '</div>';
        }
        
        if(leaders.length > 0 || vocals.length > 0) {
            lineupHtml += '<div class="stage-row front" style="transform: scale(0.95);">';
            leaders.forEach(p => {
                lineupHtml += `
                    <div class="stage-player">
                        <div class="stage-avatar lider">
                            <span class="material-symbols-outlined">star</span>
                        </div>
                        <span class="stage-name" style="font-weight:700; color:var(--primary-color);">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">Líder</span>
                    </div>
                `;
            });
            vocals.forEach(p => {
                lineupHtml += `
                    <div class="stage-player">
                        <div class="stage-avatar vocal">
                            <span class="material-symbols-outlined">mic</span>
                        </div>
                        <span class="stage-name">${p.name.split(' ')[0]}</span>
                        <span class="stage-role">Vocal</span>
                    </div>
                `;
            });
            lineupHtml += '</div>';
        }
        
        lineupHtml += '</div>';

        let songsHtml = ''; 
        s.scale_songs.forEach(song => { 
            const keys = song.repertoire.repertoire_keys || [];
            const keysStr = keys.length > 0 ? keys.map(k => k.ton).join(', ') : '';
            const keyBadge = keysStr ? `<span class="badge tom" style="margin-left:auto;">${keysStr}</span>` : '';
            
            songsHtml += `
                <span>
                    <span class="material-symbols-outlined" style="font-size:1.1rem; color:var(--text-muted);">music_note</span> 
                    ${song.repertoire.title} 
                    ${keyBadge}
                </span>
            `; 
        });

        const actionsHtml = currentUserData.is_leader ? `
            <div class="scale-folder-actions">
                <button class="btn-icon" onclick="openEditScaleModal('${s.id}')" title="Editar Escala">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn-icon danger" onclick="deleteScale('${s.id}')" title="Excluir">
                    <span class="material-symbols-outlined">delete</span>
                </button>
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
            </div>
        `;
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
            const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title&order=title.asc`, { headers });
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
            songsContainer.innerHTML += `
                <label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;">
                    <input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}> ${song.title}
                </label>
            `;
        });
        
    } catch (e) { 
        showCustomAlert('Erro ao carregar escala para edição.'); 
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
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title&order=title.asc`, { headers });
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
        songsContainer.innerHTML += `
            <label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;">
                <input type="checkbox" value="${song.id}" class="scale-song-cb"> ${song.title}
            </label>
        `;
    });
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
        showCustomAlert('A data do culto é obrigatória.'); 
        return; 
    }
    
    if(scaleDraftTeam.length === 0) { 
        showCustomAlert('Escalone pelo menos 1 membro na equipe.'); 
        return; 
    }

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
    } catch(e) { 
        showCustomAlert('Erro ao salvar escala. Verifique a conexão.'); 
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
        
        showCustomAlert('Membro cadastrado com sucesso!', 'Sucesso'); 
        
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
            
            // Adicionado a role "guitarra" na administração
            html += `
                <div class="admin-list-item" id="admin-item-${m.id}">
                    <div>
                        <strong>${m.full_name}</strong> 
                        <span style="font-size:0.8rem">(${m.username})</span>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-icon" onclick="document.getElementById('editor-${m.id}').classList.toggle('hidden')">
                            <span class="material-symbols-outlined">edit_attributes</span>
                        </button>
                        <button class="btn-icon danger" onclick="deleteMember('${m.id}')">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                    <div class="roles-editor hidden" id="editor-${m.id}">
                        ${['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo', 'guitarra'].map(role => `
                            <label class="role-check-item">
                                <input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) || (role==='lider' && m.is_leader) ? 'checked' : ''}>
                                ${role.toUpperCase()}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        list.innerHTML = html;
    } catch (e) { 
        list.innerHTML = '<p>Erro ao carregar lista.</p>'; 
    }
}

async function updateRole(memberId, role, isAdding) {
    try {
        if(role === 'lider') { 
            await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${memberId}`, { 
                method: 'PATCH', 
                headers, 
                body: JSON.stringify({ is_leader: isAdding }) 
            }); 
            return; 
        }
        
        if (isAdding) {
            await fetch(`${SUPABASE_URL}/rest/v1/member_roles`, { 
                method: 'POST', 
                headers, 
                body: JSON.stringify({ member_id: memberId, role: role }) 
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/member_roles?member_id=eq.${memberId}&role=eq.${role}`, { 
                method: 'DELETE', 
                headers 
            });
        }
    } catch (e) { 
        showCustomAlert('Erro ao atualizar banco.'); 
    }
}

async function deleteMember(id) {
    showCustomConfirm('Deseja remover este membro do sistema?', async () => {
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
    // Inicializar Supabase de forma segura
    initSupabase();
    
    const storedUser = localStorage.getItem('sessionUser');
    if (storedUser) { 
        currentUserData = JSON.parse(storedUser); 
        showSystemScreen(); 
    }
};
