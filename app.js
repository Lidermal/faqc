// URLs do Supabase
const SUPABASE_URL = 'https://jinyoffunabdraoqbzpq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbnlvZmZ1bmFiZHJhb3FienBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTExOTYsImV4cCI6MjA5Nzk4NzE5Nn0.u81W_jPaeFTEVDJUgULq8tfNfKO61J5nTW_3kwl2xos';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

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
    // Fechar drawer
    document.getElementById('drawer-medley').classList.remove('active');
    document.getElementById('drawer-medley-overlay').classList.remove('active');
    
    const editingField = document.getElementById('editing-scale-id');
    if(editingField) editingField.value = '';
    const modalTitle = document.getElementById('scale-modal-title');
    if(modalTitle) modalTitle.textContent = 'Nova Escala';
    resetMedleyFlow();
}

function toggleSidebar() {} 

// ==========================================
// SUPABASE REALTIME - 100% AO VIVO
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
                console.log('🔄 Mudança no repertório:', payload);
                if(document.getElementById('page-repertorio').classList.contains('active')) {
                    loadRepertoire();
                }
                if(document.getElementById('drawer-medley').classList.contains('active')) {
                    loadMedleySongsList();
                }
                // Atualiza visualização aberta em tempo real
                if(currentViewingRepertoireId && payload.new && payload.new.id == currentViewingRepertoireId) {
                    openViewRepertoire(
                        payload.new.id,
                        payload.new.title,
                        encodeURIComponent(payload.new.lyrics_text || ''),
                        payload.new.is_medley,
                        payload.new.vocalist
                    );
                }
                // Atualiza lista de músicas nas escalas se modal aberto
                if(document.getElementById('modal-add-scale').classList.contains('active')) {
                    openScaleModalRefreshSongs();
                }
            })
            .subscribe();
        realtimeChannels.push(repChannel);

        // Canal para mudanças nas escalas
        const scaleChannel = supabaseClient
            .channel('scale-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, (payload) => {
                console.log('🔄 Mudança nas escalas:', payload);
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchNextScaleHome();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleChannel);

        // Canal para mudanças nos itens de escala
        const scaleItemsChannel = supabaseClient
            .channel('scale-items-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_items' }, (payload) => {
                console.log('🔄 Mudança em scale_items:', payload);
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchNextScaleHome();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleItemsChannel);

        // Canal para mudanças nas músicas das escalas
        const scaleSongsChannel = supabaseClient
            .channel('scale-songs-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_songs' }, (payload) => {
                console.log('🔄 Mudança em scale_songs:', payload);
                if(document.getElementById('page-escalas').classList.contains('active')) {
                    loadScales();
                }
            })
            .subscribe();
        realtimeChannels.push(scaleSongsChannel);

        // Canal para mudanças nos membros
        const memberChannel = supabaseClient
            .channel('member-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
                console.log('🔄 Mudança nos membros:', payload);
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
                // Atualiza nome do usuário logado se alterado
                if(currentUserData && payload.new && payload.new.id == currentUserData.id) {
                    currentUserData = payload.new;
                    document.getElementById('user-display-name').textContent = currentUserData.full_name;
                    localStorage.setItem('sessionUser', JSON.stringify(currentUserData));
                }
            })
            .subscribe();
        realtimeChannels.push(memberChannel);

        // Canal para mudanças nos papéis dos membros
        const memberRolesChannel = supabaseClient
            .channel('member-roles-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, (payload) => {
                console.log('🔄 Mudança em member_roles:', payload);
                if(document.getElementById('page-membros').classList.contains('active')) {
                    loadMembers();
                }
                if(document.getElementById('page-admin').classList.contains('active')) {
                    loadAdminMembers();
                }
            })
            .subscribe();
        realtimeChannels.push(memberRolesChannel);
        
        // Canal para mudanças nas chaves de tom
        const keyChannel = supabaseClient
            .channel('key-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire_keys' }, (payload) => {
                console.log('🔄 Mudança nas chaves:', payload);
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
        
        // Canal para mudanças nas partes de medley
        const medleyPartChannel = supabaseClient
            .channel('medley-part-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'repertoire_medley_parts' }, (payload) => {
                console.log('🔄 Mudança nas partes de medley:', payload);
                if(document.getElementById('modal-view-repertoire').classList.contains('active')) {
                    // Recarrega estrutura do medley
                    const partsDisplay = document.getElementById('medley-parts-display');
                    if(!partsDisplay.classList.contains('hidden')) {
                        partsDisplay.innerHTML = 'Atualizando estrutura...';
                        setTimeout(() => {
                            const title = document.getElementById('view-rep-title').textContent;
                            const lyrics = document.getElementById('view-rep-lyrics').textContent;
                            openViewRepertoire(
                                currentViewingRepertoireId,
                                title,
                                encodeURIComponent(lyrics),
                                true
                            );
                        }, 500);
                    }
                }
            })
            .subscribe();
        realtimeChannels.push(medleyPartChannel);
        
        // Canal para mudanças nas mensagens diárias
        const dailyMsgChannel = supabaseClient
            .channel('daily-message-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_message' }, (payload) => {
                console.log('🔄 Mudança na mensagem do dia:', payload);
                if(document.getElementById('page-home').classList.contains('active')) {
                    fetchDailyMessage();
                }
            })
            .subscribe();
        realtimeChannels.push(dailyMsgChannel);
        
        console.log('✅ Realtime subscriptions configuradas (100% ao vivo)');
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

// ==========================================
// MENSAGEM DO DIA - VERSÍCULOS BÍBLICOS DIÁRIOS
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
    { text: "Bem-aventurado o homem que acha sabedoria, e o homem que adquire conhecimento.", ref: "Provérbios 3:13" },
    { text: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; de quem me recearei?", ref: "Salmos 27:1" },
    { text: "Em paz também me deitarei e dormirei, porque só tu, Senhor, me fazes habitar em segurança.", ref: "Salmos 4:8" },
    { text: "Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim.", ref: "João 14:6" },
    { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", ref: "Mateus 11:28" },
    { text: "Porque onde estiverem dois ou três reunidos em meu nome, aí estou eu no meio deles.", ref: "Mateus 18:20" },
    { text: "E conhecereis a verdade, e a verdade vos libertará.", ref: "João 8:32" },
    { text: "Porque o salário do pecado é a morte, mas o dom gratuito de Deus é a vida eterna, por Cristo Jesus nosso Senhor.", ref: "Romanos 6:23" },
    { text: "Mas Deus prova o seu amor para conosco, em que Cristo morreu por nós, sendo nós ainda pecadores.", ref: "Romanos 5:8" },
    { text: "Se confessarmos os nossos pecados, ele é fiel e justo para nos perdoar os pecados, e nos purificar de toda a injustiça.", ref: "1 João 1:9" },
    { text: "Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.", ref: "Eclesiastes 3:1" },
    { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", ref: "Filipenses 4:4" },
    { text: "Não se aparte da tua boca a palavra desta lei; antes medita nela dia e noite, para que tenhas cuidado de fazer conforme a tudo quanto nela está escrito.", ref: "Josué 1:8" },
    { text: "Sede fortes e corajosos; não temais, nem vos espanteis diante deles, porque o Senhor vosso Deus é quem vai convosco.", ref: "Deuteronômio 31:6" },
    { text: "O nome do Senhor é torre forte; o justo corre para ela, e está seguro.", ref: "Provérbios 18:10" },
    { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", ref: "Salmos 37:5" },
    { text: "Clama a mim, e responder-te-ei, e anunciar-te-ei coisas grandes e firmes, que não sabes.", ref: "Jeremias 33:3" },
    { text: "Porque os meus pensamentos não são os vossos pensamentos, nem os vossos caminhos os meus caminhos, diz o Senhor.", ref: "Isaías 55:8" },
    { text: "Bem-aventurados os puros de coração, porque eles verão a Deus.", ref: "Mateus 5:8" },
    { text: "Vós sois a luz do mundo; não se pode esconder uma cidade edificada sobre um monte.", ref: "Mateus 5:14" },
    { text: "Buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
    { text: "E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.", ref: "Colossenses 3:23" },
    { text: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus.", ref: "Efésios 2:8" },
    { text: "Posso todas as coisas naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "Mas buscai primeiro o seu reino e a sua justiça, e todas estas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
    { text: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não vêem.", ref: "Hebreus 11:1" },
    { text: "Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.", ref: "2 Timóteo 1:7" },
    { text: "Amai-vos cordialmente uns aos outros com amor fraternal, preferindo-vos em honra uns aos outros.", ref: "Romanos 12:10" },
    { text: "Porque onde está o teu tesouro, aí estará também o teu coração.", ref: "Mateus 6:21" },
    { text: "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.", ref: "Romanos 12:2" },
    { text: "A tua palavra é lâmpada para os meus pés e luz para o meu caminho.", ref: "Salmos 119:105" },
    { text: "Esforcei-me, e avancei, e combati o bom combate, e acabei a carreira, e guardei a fé.", ref: "2 Timóteo 4:7" },
    { text: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.", ref: "Gálatas 5:22" },
    { text: "Porque onde estiver o vosso tesouro, aí estará também o vosso coração.", ref: "Lucas 12:34" },
    { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
    { text: "Os céus declaram a glória de Deus e o firmamento anuncia a obra das suas mãos.", ref: "Salmos 19:1" },
    { text: "Bem-aventurados os que têm fome e sede de justiça, porque eles serão fartos.", ref: "Mateus 5:6" },
    { text: "E eis que eu estou convosco todos os dias, até a consumação dos séculos.", ref: "Mateus 28:20" },
    { text: "Porque eu, o Senhor teu Deus, te tomo pela tua mão direita, e te digo: Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "Alegrem-se sempre os que buscam a tua proteção; exultem para sempre aqueles que amam a tua salvação.", ref: "Salmos 70:4" },
    { text: "O Senhor está perto dos que têm o coração quebrantado e salva os de espírito abatido.", ref: "Salmos 34:18" },
    { text: "Não to mandei eu? Esforça-te, e tem bom ânimo; não temas, nem te espantes.", ref: "Josué 1:9" },
    { text: "Porque nada temos trazido para este mundo, e manifesto é que nada podemos levar dele.", ref: "1 Timóteo 6:7" },
    { text: "O coração alegre é bom remédio, mas o espírito abatido faz secar os ossos.", ref: "Provérbios 17:22" },
    { text: "Ensina-nos a contar os nossos dias, de tal maneira que alcancemos coração sábio.", ref: "Salmos 90:12" },
    { text: "Deus é amor; e quem está em amor está em Deus, e Deus nele.", ref: "1 João 4:16" },
    { text: "Se Deus é por nós, quem será contra nós?", ref: "Romanos 8:31" },
    { text: "Porque a palavra de Deus é viva e eficaz, e mais penetrante do que espada alguma de dois gumes.", ref: "Hebreus 4:12" },
    { text: "Graças ao Senhor, porque é bom; porque a sua benignidade dura para sempre.", ref: "Salmos 107:1" },
    { text: "O Senhor pelejará por vós, e vos calareis.", ref: "Êxodo 14:14" },
    { text: "Porque o Senhor dá a sabedoria; da sua boca vem o conhecimento e o entendimento.", ref: "Provérbios 2:6" },
    { text: "O céu e a terra passarão, mas as minhas palavras não hão de passar.", ref: "Mateus 24:35" },
    { text: "Bem-aventurados os misericordiosos, porque eles alcançarão misericórdia.", ref: "Mateus 5:7" },
    { text: "Porque eu sou o Senhor, teu Deus, que te segura pela tua mão direita e te diz: Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "A misericórdia do Senhor é de eternidade a eternidade sobre os que o temem.", ref: "Salmos 103:17" },
    { text: "O temor do Senhor é o princípio da sabedoria, e o conhecimento do Santo o entendimento.", ref: "Provérbios 9:10" },
    { text: "Bem-aventurados os pacificadores, porque eles serão chamados filhos de Deus.", ref: "Mateus 5:9" },
    { text: "Porque o Senhor conhece o caminho dos justos; porém o caminho dos ímpios perecerá.", ref: "Salmos 1:6" },
    { text: "A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.", ref: "2 Coríntios 12:9" },
    { text: "E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.", ref: "Filipenses 4:7" },
    { text: "Não se turbe o vosso coração; credes em Deus, crede também em mim.", ref: "João 14:1" },
    { text: "E tudo o que fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.", ref: "Colossenses 3:23" },
    { text: "Mas em todas estas coisas somos mais do que vencedores, por aquele que nos amou.", ref: "Romanos 8:37" },
    { text: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti, e tenha misericórdia de ti.", ref: "Números 6:24-25" },
    { text: "Os que semeiam em lágrimas segarão com alegria.", ref: "Salmos 126:5" },
    { text: "Porque o Senhor corrige a quem ama, assim como o pai ao filho a quem quer bem.", ref: "Provérbios 3:12" },
    { text: "Dá-me entendimento, e guardarei a tua lei e observá-la-ei de todo o coração.", ref: "Salmos 119:34" },
    { text: "A tua palavra escondi no meu coração, para eu não pecar contra ti.", ref: "Salmos 119:11" },
    { text: "Bem-aventurados os que choram, porque eles serão consolados.", ref: "Mateus 5:4" },
    { text: "Não vos sobreveio tentação, senão humana; mas fiel é Deus, que não vos deixará tentar acima do que podeis.", ref: "1 Coríntios 10:13" },
    { text: "Mas Deus, que é riquíssimo em misericórdia, pelo seu muito amor com que nos amou.", ref: "Efésios 2:4" },
    { text: "Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.", ref: "Romanos 12:12" },
    { text: "Porque o Senhor é quem dá a sabedoria; da sua boca vem o conhecimento e o entendimento.", ref: "Provérbios 2:6" },
    { text: "Eu te louvarei, porque de um modo assombrosamente tão maravilhoso fui feito.", ref: "Salmos 139:14" },
    { text: "Bendize, ó minha alma, ao Senhor, e tudo o que há em mim bendiga o seu santo nome.", ref: "Salmos 103:1" },
    { text: "O Senhor é bom, ele serve de fortaleza no dia da angústia, e conhece os que confiam nele.", ref: "Naum 1:7" },
    { text: "Porque eu, o Senhor teu Deus, te tomo pela tua mão direita e te digo: Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "Bem-aventurados os perseguidos por causa da justiça, porque deles é o reino dos céus.", ref: "Mateus 5:10" },
    { text: "Mas o fruto do Espírito é amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio.", ref: "Gálatas 5:22-23" },
    { text: "Porque Deus não é Deus de confusão, senão de paz.", ref: "1 Coríntios 14:33" },
    { text: "O Senhor é grande e muito digno de louvor na cidade do nosso Deus.", ref: "Salmos 48:1" },
    { text: "Perto está o Senhor dos que têm o coração quebrantado, e salva os contritos de espírito.", ref: "Salmos 34:18" },
    { text: "Porque eu sou o Senhor teu Deus, que te toma pela mão direita e te diz: Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", ref: "Filipenses 4:4" },
    { text: "O Senhor te abençoará e te guardará.", ref: "Números 6:24" },
    { text: "Porque eu bem sei os pensamentos que tenho a vosso respeito, pensamentos de paz, e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
    { text: "Bem-aventurado o homem que sofre a tentação; porque, quando for provado, receberá a coroa da vida.", ref: "Tiago 1:12" },
    { text: "Porque não me envergonho do evangelho de Cristo, pois é o poder de Deus para salvação de todo aquele que crê.", ref: "Romanos 1:16" },
    { text: "A tua palavra é muito pura; portanto, o teu servo a ama.", ref: "Salmos 119:140" },
    { text: "O Senhor é o meu rochedo, e o meu lugar forte, e o meu libertador.", ref: "Salmos 18:2" },
    { text: "Porque nada trouxemos para este mundo, e manifesto é que nada podemos levar dele.", ref: "1 Timóteo 6:7" },
    { text: "O Senhor é bom para todos, e as suas misericórdias são sobre todas as suas obras.", ref: "Salmos 145:9" },
    { text: "Bem-aventurados os limpos de coração, porque eles verão a Deus.", ref: "Mateus 5:8" },
    { text: "O Senhor te abençoará e te guardará; o Senhor fará resplandecer o seu rosto sobre ti.", ref: "Números 6:24-25" },
    { text: "Porque o Senhor é justo, e ama a justiça; os seus olhos amam os retos.", ref: "Salmos 11:7" },
    { text: "E a paz de Deus, que excede todo o entendimento, guardará os vossos corações.", ref: "Filipenses 4:7" },
    { text: "O Senhor te abençoará e te guardará.", ref: "Números 6:24" },
    { text: "Porque eu estou bem certo de que nem a morte, nem a vida, nem anjos, nem principados, nem potestades, nem o presente, nem o porvir, nem a altura, nem a profundidade, nem alguma outra criatura nos poderá separar do amor de Deus, que está em Cristo Jesus nosso Senhor.", ref: "Romanos 8:38-39" },
    { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
    { text: "Porque eu te hei de fortalecer, e te ajudarei, e te sustentarei com a destra da minha justiça.", ref: "Isaías 41:10" },
    { text: "Mas os que esperam no Senhor renovarão as suas forças.", ref: "Isaías 40:31" },
    { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", ref: "Filipenses 4:4" },
    { text: "O Senhor é a minha rocha, e o meu lugar forte, e o meu libertador; o meu Deus, a minha fortaleza.", ref: "Salmos 18:2" },
    { text: "Bem-aventurado o homem que encontra sabedoria, e o homem que adquire conhecimento.", ref: "Provérbios 3:13" },
    { text: "Porque o Senhor dá a sabedoria, da sua boca vem o conhecimento e o entendimento.", ref: "Provérbios 2:6" },
    { text: "Deleita-te também no Senhor, e te concederá os desejos do teu coração.", ref: "Salmos 37:4" },
    { text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.", ref: "Provérbios 3:5" },
    { text: "Não to mandei eu? Esforça-te e tem bom ânimo; não temas, nem te espantes.", ref: "Josué 1:9" },
    { text: "Porque eu, o Senhor teu Deus, te tomo pela tua mão direita e te digo: Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.", ref: "2 Timóteo 1:7" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "O Senhor pelejará por vós, e vos calareis.", ref: "Êxodo 14:14" },
    { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
    { text: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.", ref: "Jeremias 29:11" },
    { text: "O Senhor é a minha luz e a minha salvação; a quem temerei?", ref: "Salmos 27:1" },
    { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", ref: "Filipenses 4:4" },
    { text: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus.", ref: "Efésios 2:8" },
    { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", ref: "Salmos 37:5" },
    { text: "Não se turbe o vosso coração; credes em Deus, crede também em mim.", ref: "João 14:1" },
    { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", ref: "Mateus 11:28" },
    { text: "Porque onde estiverem dois ou três reunidos em meu nome, aí estou eu no meio deles.", ref: "Mateus 18:20" },
    { text: "E eis que eu estou convosco todos os dias, até a consumação dos séculos.", ref: "Mateus 28:20" },
    { text: "Porque o salário do pecado é a morte, mas o dom gratuito de Deus é a vida eterna, por Cristo Jesus nosso Senhor.", ref: "Romanos 6:23" },
    { text: "Mas Deus prova o seu amor para conosco, em que Cristo morreu por nós, sendo nós ainda pecadores.", ref: "Romanos 5:8" },
    { text: "Se confessarmos os nossos pecados, ele é fiel e justo para nos perdoar os pecados.", ref: "1 João 1:9" },
    { text: "Sede fortes e corajosos; não temais.", ref: "Deuteronômio 31:6" },
    { text: "O nome do Senhor é torre forte; o justo corre para ela, e está seguro.", ref: "Provérbios 18:10" },
    { text: "Clama a mim, e responder-te-ei.", ref: "Jeremias 33:3" },
    { text: "A tua palavra é lâmpada para os meus pés e luz para o meu caminho.", ref: "Salmos 119:105" },
    { text: "Bem-aventurados os que têm fome e sede de justiça, porque eles serão fartos.", ref: "Mateus 5:6" },
    { text: "Buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
    { text: "E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.", ref: "Colossenses 3:23" },
    { text: "Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não vêem.", ref: "Hebreus 11:1" },
    { text: "Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.", ref: "2 Timóteo 1:7" },
    { text: "Amai-vos cordialmente uns aos outros com amor fraternal.", ref: "Romanos 12:10" },
    { text: "E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.", ref: "Romanos 12:2" },
    { text: "A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.", ref: "2 Coríntios 12:9" },
    { text: "E a paz de Deus, que excede todo o entendimento, guardará os vossos corações.", ref: "Filipenses 4:7" },
    { text: "Mas em todas estas coisas somos mais do que vencedores, por aquele que nos amou.", ref: "Romanos 8:37" },
    { text: "Os que semeiam em lágrimas segarão com alegria.", ref: "Salmos 126:5" },
    { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", ref: "Filipenses 4:4" },
    { text: "Porque eu estou bem certo de que nem a morte, nem a vida nos poderá separar do amor de Deus.", ref: "Romanos 8:38-39" },
    { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
    { text: "O Senhor te abençoará e te guardará.", ref: "Números 6:24" },
    { text: "Bem-aventurado o homem que acha sabedoria.", ref: "Provérbios 3:13" },
    { text: "O céu e a terra passarão, mas as minhas palavras não hão de passar.", ref: "Mateus 24:35" },
    { text: "Bem-aventurados os misericordiosos, porque eles alcançarão misericórdia.", ref: "Mateus 5:7" },
    { text: "Graças ao Senhor, porque é bom; porque a sua benignidade dura para sempre.", ref: "Salmos 107:1" },
    { text: "Porque o Senhor dá a sabedoria; da sua boca vem o conhecimento e o entendimento.", ref: "Provérbios 2:6" },
    { text: "O Senhor é bom para todos, e as suas misericórdias são sobre todas as suas obras.", ref: "Salmos 145:9" },
    { text: "Bem-aventurados os limpos de coração, porque eles verão a Deus.", ref: "Mateus 5:8" },
    { text: "Porque eu te hei de fortalecer, e te ajudarei.", ref: "Isaías 41:10" },
    { text: "Mas os que esperam no Senhor renovarão as suas forças.", ref: "Isaías 40:31" },
    { text: "Alegrai-vos sempre no Senhor.", ref: "Filipenses 4:4" },
    { text: "O Senhor é a minha rocha, e o meu lugar forte.", ref: "Salmos 18:2" },
    { text: "Deleita-te também no Senhor, e te concederá os desejos do teu coração.", ref: "Salmos 37:4" },
    { text: "Confia no Senhor de todo o teu coração.", ref: "Provérbios 3:5" },
    { text: "Esforça-te e tem bom ânimo; não temas.", ref: "Josué 1:9" },
    { text: "Não temas, eu te ajudo.", ref: "Isaías 41:13" },
    { text: "Porque Deus não nos deu o espírito de temor.", ref: "2 Timóteo 1:7" },
    { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
    { text: "O Senhor pelejará por vós.", ref: "Êxodo 14:14" },
    { text: "Deus é o nosso refúgio e fortaleza.", ref: "Salmos 46:1" },
    { text: "Porque eu bem sei os pensamentos que tenho a vosso respeito.", ref: "Jeremias 29:11" },
    { text: "O Senhor é a minha luz e a minha salvação.", ref: "Salmos 27:1" },
    { text: "Alegrai-vos sempre no Senhor.", ref: "Filipenses 4:4" },
    { text: "Porque pela graça sois salvos, por meio da fé.", ref: "Efésios 2:8" },
    { text: "Porque Deus amou o mundo de tal maneira.", ref: "João 3:16" },
    { text: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
    { text: "Entrega o teu caminho ao Senhor.", ref: "Salmos 37:5" },
    { text: "Não se turbe o vosso coração.", ref: "João 14:1" },
    { text: "Vinde a mim, todos os que estais cansados.", ref: "Mateus 11:28" },
    { text: "Porque onde estiverem dois ou três reunidos em meu nome, aí estou eu.", ref: "Mateus 18:20" },
    { text: "E eis que eu estou convosco todos os dias.", ref: "Mateus 28:20" }
];

async function fetchDailyMessage() {
    const container = document.getElementById('daily-message-content');
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    try {
        // Tenta buscar mensagem personalizada do banco primeiro
        const customRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_message?date=eq.${dateString}&select=*`, { headers });
        const customData = await customRes.json();
        if (customData.length > 0) {
            container.innerHTML = `<p>"${customData[0].verse_text}"</p><span class="verse-ref">- ${customData[0].verse_ref}</span>`;
            return;
        }
        
        // Tenta API bíblica externa (A Bíblia Digital - gratuita e em português)
        try {
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
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
            console.warn('API bíblica indisponível, usando pool local');
        }
        
        // Fallback: usa pool local rotacionando pelo dia do ano (garante versículo diferente todo dia)
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
            } else {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">Escala vazia.</p>`;
            }
        } else {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:10px 0;">Nenhuma escala programada.</p>`;
        }
    } catch (e) { 
        container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:10px 0;">Erro ao carregar.</p>`; 
    }
}

// ==========================================
// BUSCADOR GOSPEL BRASIL - AMPLA E EFICAZ
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

let cachedLyricsSearch = {};

// Função auxiliar para normalizar texto (remover acentos)
function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Função auxiliar para verificar se é música gospel/brasileira
function isGospelOrBrazilian(artist, title) {
    const gospelKeywords = ['jesus', 'cristo', 'deus', 'senhor', 'adoracao', 'adorar', 'louvor', 'louvar', 
                           'espirito santo', 'biblia', 'evangelho', 'graca', 'fe', 'igreja', 'pai', 'celestial',
                           'salvador', 'redentor', 'messias', 'altar', 'santo', 'santidade', 'ungido', 'reino',
                           'oracao', 'clamar', 'clamor', 'exaltar', 'gloria', 'glorificar'];
    
    const brazilianArtists = ['aline barros', 'fernandinho', 'gabriel guedes', 'morada', 'isaac saad',
                             'helena tannara', 'alessandro vilas boas', 'bruna karla', 'davi saffer',
                             'davi sacer', 'eyshila', 'kleber lucas', 'mara lima', 'regis danese',
                             'cassiane', 'damares', 'andre valadao', 'pregador luo', 'thalles roberto',
                             'roberta santana', 'nivea soares', 'marcelo marques', 'roger resnik',
                             'ministry Zoe', 'delino marcal', 'daniel mastral', 'marcelo aguiar',
                             'livres para adorar', 'morada', 'casa worship', 'betania lima',
                             'gabriela rocha', 'rodrigo silva', 'marcelo markes', 'kemuel',
                             'isaias saad', 'voz da verdade', 'som e louvor', 'diante do trono',
                             'apostolo petronio', 'jozyanne', 'bruna karla', 'stella del rey',
                             'davi ferreira', 'mariana sa', 'priscilla alcantara', 'midian lima',
                             'raquel mello', 'nathália Braga', 'marcelo aguiar', 'ton carfi',
                             'alexandre apolinario', 'corinhos', 'hino', 'hinario', 'harpa cristã'];
    
    const text = normalizeText(`${artist} ${title}`);
    
    // Verifica se é artista brasileiro gospel conhecido
    for(let brazilian of brazilianArtists) {
        if(text.includes(normalizeText(brazilian))) return true;
    }
    
    // Verifica palavras-chave gospel
    for(let keyword of gospelKeywords) {
        if(text.includes(normalizeText(keyword))) return true;
    }
    
    // Se contém palavras em português (comum em música brasileira)
    const portugueseWords = ['amor', 'deus', 'jesus', 'senhor', 'vida', 'coracao', 'alma', 'paz', 'fe', 'luz',
                            'esperanca', 'graca', 'salvacao', 'adorar', 'louvar', 'exaltar', 'gloria'];
    for(let word of portugueseWords) {
        if(text.includes(word)) return true;
    }
    
    return false;
}

async function searchMusicList() {
    const query = document.getElementById('search-query').value.trim();
    const resultsContainer = document.getElementById('search-results');
    const msgBox = document.getElementById('search-msg');
    
    if(!query) { 
        showCustomAlert('Digite o nome da música, cantor ou trecho da letra.'); 
        return; 
    }
    
    msgBox.textContent = '🔍 Buscando músicas gospel brasileiras...';
    resultsContainer.innerHTML = '';
    cachedLyricsSearch = {};
    
    let allResults = [];
    let foundAnyValid = false;
    
    try {
        // ===== FONTE 1: iTunes Search API (rápida e confiável) =====
        try {
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15&country=br`);
            if(itunesRes.ok) {
                const itunesData = await itunesRes.json();
                if(itunesData.results && itunesData.results.length > 0) {
                    // Filtra apenas músicas gospel/brasileiras
                    const filtered = itunesData.results.filter(track => {
                        return isGospelOrBrazilian(track.artistName, track.trackName);
                    });
                    
                    // Se não filtrou nada, pega os primeiros 5 do Brasil (prioriza BR)
                    const toUse = filtered.length > 0 ? filtered : itunesData.results.slice(0, 5);
                    
                    for(let track of toUse.slice(0, 8)) {
                        allResults.push({
                            id: `itunes_${track.trackId}`,
                            artist: track.artistName,
                            song: track.trackName,
                            source: 'iTunes Brasil'
                        });
                    }
                }
            }
        } catch(e) {
            console.warn('iTunes falhou:', e);
        }
        
        // ===== FONTE 2: API Letras.mus.br (via proxy CORS) =====
        try {
            const letrasRes = await fetch(`https://www.letras.mus.br/api/autocomplete?q=${encodeURIComponent(query)}&limit=10`);
            if(letrasRes.ok) {
                const letrasData = await letrasRes.json();
                if(letrasData && letrasData.length > 0) {
                    for(let item of letrasData.slice(0, 5)) {
                        allResults.push({
                            id: `letras_${item.id || Math.random()}`,
                            artist: item.artista || item.artist || 'Artista',
                            song: item.nome || item.name || item.title || 'Música',
                            url: item.url,
                            source: 'Letras.mus.br'
                        });
                    }
                }
            }
        } catch(e) {
            console.warn('Letras.mus.br falhou:', e);
        }
        
        // ===== FONTE 3: Vagalume (API brasileira oficial) =====
        try {
            const vagalumeRes = await fetch(`https://api.vagalume.com.br/search.php?exc=${encodeURIComponent(query)}&apikey=a53a6c27f726a530cd8c5cfe161bccda`);
            if(vagalumeRes.ok) {
                const vagalumeData = await vagalumeRes.json();
                if(vagalumeData && vagalumeData.art && vagalumeData.art.length > 0) {
                    for(let artist of vagalumeData.art.slice(0, 3)) {
                        if(artist.mus && artist.mus.length > 0) {
                            for(let music of artist.mus.slice(0, 3)) {
                                allResults.push({
                                    id: `vagalume_${artist.id}_${music.id}`,
                                    artist: artist.name,
                                    song: music.desc || music.title,
                                    url: music.url,
                                    source: 'Vagalume'
                                });
                            }
                        }
                    }
                }
            }
        } catch(e) {
            console.warn('Vagalume falhou:', e);
        }
        
        // ===== FONTE 4: Deezer API (tem muitas músicas brasileiras) =====
        try {
            const deezerRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`);
            if(deezerRes.ok) {
                const deezerData = await deezerRes.json();
                if(deezerData && deezerData.data && deezerData.data.length > 0) {
                    for(let track of deezerData.data.slice(0, 5)) {
                        if(isGospelOrBrazilian(track.artist.name, track.title)) {
                            allResults.push({
                                id: `deezer_${track.id}`,
                                artist: track.artist.name,
                                song: track.title,
                                source: 'Deezer'
                            });
                        }
                    }
                }
            }
        } catch(e) {
            console.warn('Deezer falhou:', e);
        }
        
        // Remove duplicatas
        const uniqueResults = [];
        const seen = new Set();
        for(let result of allResults) {
            const key = normalizeText(`${result.artist} ${result.song}`);
            if(!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(result);
            }
        }
        
        if(uniqueResults.length === 0) {
            msgBox.textContent = '❌ Nenhuma música encontrada. Tente outro termo.';
            return;
        }
        
        // Agora busca as letras de cada resultado
        msgBox.textContent = `🎵 ${uniqueResults.length} músicas encontradas. Buscando letras...`;
        
        for(let track of uniqueResults) {
            try {
                let lyrics = '';
                
                // Tenta obter letra via lyrics.ovh (API gratuita)
                try {
                    const lyrRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.song)}`);
                    if(lyrRes.ok) {
                        const lyrData = await lyrRes.json();
                        if(lyrData.lyrics && lyrData.lyrics.length > 30) {
                            lyrics = lyrData.lyrics;
                        }
                    }
                } catch(e) {}
                
                // Se não encontrou letra, tenta Vagalume específico
                if(!lyrics && track.url && track.url.includes('vagalume')) {
                    try {
                        const vagRes = await fetch(track.url);
                        if(vagRes.ok) {
                            const html = await vagRes.text();
                            const match = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                            if(match) {
                                lyrics = match[1].replace(/<[^>]+>/g, '').trim();
                            }
                        }
                    } catch(e) {}
                }
                
                // Se encontrou letra válida, adiciona aos resultados
                if(lyrics && lyrics.length > 30) {
                    foundAnyValid = true;
                    const uniqueId = track.id;
                    cachedLyricsSearch[uniqueId] = { 
                        artist: track.artist, 
                        song: track.song, 
                        lyrics: lyrics,
                        source: track.source
                    };
                    
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `
                        <div style="flex:1;">
                            <strong>${track.song}</strong>
                            <br><small style="color:var(--text-muted);">${track.artist}</small>
                            <br><small style="color:var(--success); font-size:0.7rem;">✓ Letra completa • ${track.source}</small>
                        </div> 
                        <span class="material-symbols-outlined" style="color:var(--primary-color);">download_done</span>
                    `;
                    div.onclick = () => importPreCheckedLyrics(uniqueId);
                    resultsContainer.appendChild(div);
                }
            } catch(err) {
                console.warn('Erro ao buscar letra de:', track.song, err);
            }
        }

        if(!foundAnyValid) {
            msgBox.textContent = '⚠️ Músicas encontradas, mas sem letras completas. Tente outro termo.';
        } else {
            const count = resultsContainer.children.length;
            msgBox.textContent = `✅ ${count} música(s) com letras completas encontradas!`;
        }

    } catch(e) { 
        console.error('Erro na busca:', e);
        msgBox.textContent = '❌ Erro ao buscar músicas. Verifique sua internet.'; 
    }
}

function importPreCheckedLyrics(id) {
    const data = cachedLyricsSearch[id];
    document.getElementById('rep-lyrics').value = data.lyrics;
    document.getElementById('rep-title').value = `${data.song} - ${data.artist}`;
    showCustomAlert(`✅ Letra de "${data.song}" importada com sucesso!`, "Letra Importada");
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
            
            // Badge de voz/cantor
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
            const vocalistBadge = song.vocalist ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px;"><span class="material-symbols-outlined" style="font-size:0.8rem; vertical-align:middle;">mic</span> ${song.vocalist}</div>` : '';
            html += `
                <div class="medley-song-item ${isSelected ? 'active' : ''}" onclick="selectMedleySong('${song.id}')">
                    <div class="medley-song-item-title">${song.title} ${keyBadge}</div>
                    ${vocalistBadge}
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

async function openViewRepertoire(id, title, encodedLyrics, isMedley, encodedVocalist = '') {
    currentViewingRepertoireId = id;
    document.getElementById('view-rep-title').textContent = title;
    document.getElementById('view-rep-lyrics').textContent = encodedLyrics ? decodeURIComponent(encodedLyrics) : '';
    document.getElementById('modal-view-repertoire').classList.add('active');
    
    // Exibe voz/cantor - TODOS OS MEMBROS PODEM EDITAR
    const vocalistDisplay = document.getElementById('view-rep-vocalist');
    const currentVocalist = encodedVocalist ? decodeURIComponent(encodedVocalist) : '';
    vocalistDisplay.innerHTML = `
        <div class="vocalist-editor">
            <label><span class="material-symbols-outlined" style="font-size:1rem; vertical-align:middle;">mic</span> Voz / Cantor:</label>
            <div style="display:flex; gap:8px; margin-top:5px;">
                <input type="text" id="edit-vocalist-input" value="${currentVocalist}" placeholder="Ex: Ana Silva, João Santos" style="flex:1; padding:8px; border-radius:6px; border:1px solid #ccc;">
                <button class="btn-secondary" onclick="saveVocalistToRepertoire('${id}')" style="padding:8px 12px;">💾 Salvar</button>
            </div>
        </div>
    `;
    
    // MOSTRA O CAMPO DE ADIÇÃO DE TOM PARA TODOS OS USUÁRIOS
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
                    html += `<div style="padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.08);">
                        <strong>${idx+1}.</strong> <em>${p.repertoire.title}</em> 
                        <span style="color:var(--primary-color); font-weight:600;">→ ${p.section}</span>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:3px; white-space:pre-wrap; max-height:80px; overflow:hidden;">${p.section_content}</div>
                    </div>`; 
                });
                partsDisplay.innerHTML = html;
            } else {
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

// Função para salvar voz/cantor de uma música (qualquer membro pode)
async function saveVocalistToRepertoire(id) {
    const input = document.getElementById('edit-vocalist-input');
    if(!input) return;
    const newVocalist = input.value.trim();
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ vocalist: newVocalist || null })
        });
        
        if(res.ok) {
            showCustomAlert('✅ Voz/Cantor atualizado com sucesso!', 'Sucesso');
            loadRepertoire();
        } else {
            showCustomAlert('Erro ao atualizar voz/cantor.');
        }
    } catch(e) {
        console.error(e);
        showCustomAlert('Erro de conexão ao salvar.');
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
        } catch(e) {}
    });
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
            team.vocal.forEach(p => lineupHtml += `<div class="lineup-player"><div class="player-avatar vocal-role">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">Vocal</span></div>`);
            lineupHtml += '</div>';
        }
        if(team.banda.length > 0) {
            lineupHtml += '<div class="lineup-row">';
            team.banda.forEach(p => lineupHtml += `<div class="lineup-player"><div class="player-avatar band-role">${p.name.charAt(0)}</div><span class="player-name">${p.name.split(' ')[0]}</span><span class="player-role">${p.role}</span></div>`);
            lineupHtml += '</div>';
        }
        lineupHtml += '</div>';

        let songsHtml = ''; 
        s.scale_songs.forEach(song => { 
            const keys = song.repertoire.repertoire_keys || [];
            const keysStr = keys.length > 0 ? keys.map(k => k.ton).join(', ') : '';
            const keyBadge = keysStr ? `<span class="badge tom" style="font-size:0.7rem; padding:2px 8px; margin-left:auto;">${keysStr}</span>` : '';
            const vocalistBadge = song.repertoire.vocalist ? `<span class="vocalist-mini"><span class="material-symbols-outlined" style="font-size:0.8rem;">mic</span> ${song.repertoire.vocalist}</span>` : '';
            songsHtml += `<span>🎵 ${song.repertoire.title} ${keyBadge} ${vocalistBadge}</span>`; 
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

// Função para atualizar só as músicas no modal (chamada pelo realtime)
async function openScaleModalRefreshSongs() {
    if(!document.getElementById('modal-add-scale').classList.contains('active')) return;
    
    try {
        const resRep = await fetch(`${SUPABASE_URL}/rest/v1/repertoire?select=id,title,vocalist&order=title.asc`, { headers });
        const newRepertoire = await resRep.json();
        allRepertoireCache = newRepertoire;
        
        // Mantém as músicas já selecionadas
        const selectedIds = Array.from(document.querySelectorAll('.scale-song-cb:checked')).map(cb => cb.value);
        
        const songsContainer = document.getElementById('scale-songs-selectors');
        songsContainer.innerHTML = '';
        newRepertoire.forEach(song => {
            const checked = selectedIds.includes(song.id) ? 'checked' : '';
            const vocalistInfo = song.vocalist ? ` <small style="color:var(--text-muted);">🎤 ${song.vocalist}</small>` : '';
            songsContainer.innerHTML += `<label style="display:block; padding:8px; border-bottom:1px solid #eee; cursor:pointer;"><input type="checkbox" value="${song.id}" class="scale-song-cb" ${checked}> ${song.title}${vocalistInfo}</label>`;
        });
    } catch(e) {
        console.warn('Erro ao atualizar músicas no modal:', e);
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
            html += `<div class="admin-list-item" id="admin-item-${m.id}">
                    <div><strong>${m.full_name}</strong> <span style="font-size:0.8rem">(${m.username})</span></div>
                    <div class="admin-actions"><button class="btn-icon" onclick="document.getElementById('editor-${m.id}').classList.toggle('hidden')"><span class="material-symbols-outlined">edit_attributes</span></button><button class="btn-icon danger" onclick="deleteMember('${m.id}')"><span class="material-symbols-outlined">delete</span></button></div>
                    <div class="roles-editor hidden" id="editor-${m.id}">${['lider', 'vocal', 'baterista', 'teclado', 'violao', 'baixo'].map(role => `<label class="role-check-item"><input type="checkbox" onchange="updateRole('${m.id}', '${role}', this.checked)" ${currentRoles.includes(role) || (role==='lider' && m.is_leader) ? 'checked' : ''}>${role.toUpperCase()}</label>`).join('')}</div>
                </div>`;
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
