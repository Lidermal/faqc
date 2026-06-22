import React, { useState, useEffect } from 'react';
import { useBibleSearch } from '../hooks/useBibleSearch';

// Criação do canal de transmissão
const canalProjecao = new BroadcastChannel('amor_que_cura_projection');

export default function Operator() {
  const [darkMode, setDarkMode] = useState(true);
  const [versaoAtiva, setVersaoAtiva] = useState('NVI');
  const [busca, setBusca] = useState('');
  const [conexaoHDMI, setConexaoHDMI] = useState('DESCONECTADO');
  const { executarBusca, resultados, carregando } = useBibleSearch();

  // Escuta se a aba do projetor respondeu ao teste de conexão
  useEffect(() => {
    canalProjecao.onmessage = (evento) => {
      if (evento.data.tipo === 'PONG_TESTE') {
        setConexaoHDMI('CONECTADO ✨');
      }
    };
  }, []);

  const handleBuscaKeyDown = (e) => {
    if (e.key === 'Enter') executarBusca(busca, versaoAtiva);
  };

  // Abre a aba do projetor e testa o sinal
  const abrirProjetor = () => {
    window.open('/projection', '_blank', 'width=1280,height=720');
    testarConexao();
  };

  const testarConexao = () => {
    setConexaoHDMI('VERIFICANDO...');
    setTimeout(() => {
      canalProjecao.postMessage({ tipo: 'PING_TESTE' });
    }, 500);
  };

  // Dispara o texto clicado diretamente para o projetor
  const dispararParaProjetor = (textoVersiculo) => {
    canalProjecao.postMessage({
      tipo: 'PROJETAR_TEXTO',
      payload: { texto: textoVersiculo }
    });
  };

  // Controles rápidos de Blackout (F5 e F6)
  const alternarF5 = (status) => canalProjecao.postMessage({ tipo: 'F5_TEXTO', payload: { ativo: status } });
  const alternarF6 = (status) => canalProjecao.postMessage({ tipo: 'F6_BLACKOUT', payload: { ativo: status } });

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-[#121214] text-white' : 'bg-[#f0f2f5] text-[#1c1c1e]'}`}>
      
      {/* BARRA SUPERIOR */}
      <header className={`px-6 py-4 flex justify-between items-center border-b backdrop-blur-md ${darkMode ? 'bg-[#1f1f23]/80 border-[#29292e]' : 'bg-white/80 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${conexaoHDMI.includes('CONECTADO') ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <h1 className="font-bold text-lg tracking-wide uppercase">AQC Mídia Pro</h1>
          <span className="text-xs opacity-60">| Canal HDMI: {conexaoHDMI}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={abrirProjetor}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
          >
            📺 Abrir Tela do Projetor
          </button>

          <button 
            onClick={testarConexao}
            className={`px-3 py-1.5 rounded-lg text-sm border ${darkMode ? 'bg-[#29292e] border-[#3e3e44]' : 'bg-gray-150 border-gray-300'}`}
          >
            🔄 Testar Conexão
          </button>

          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl border ${darkMode ? 'bg-[#29292e] border-[#3e3e44]' : 'bg-gray-150 border-gray-300'}`}
          >
            {darkMode ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </div>
      </header>

      {/* PAINEL DE 3 COLUNAS */}
      <main className="grid grid-cols-12 gap-5 p-5 h-[calc(100vh-73px)]">
        
        {/* COLUNA 1: BUSCA DINÂMICA */}
        <section className={`col-span-4 rounded-2xl p-4 border flex flex-col gap-4 ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white border-gray-200'}`}>
          <input 
            type="text"
            placeholder="Ex: Jo 3:16 ou palavra-chave + Enter..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={handleBuscaKeyDown}
            className={`w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${darkMode ? 'bg-[#121214] border-[#29292e]' : 'bg-gray-50'}`}
          />

          <div className="flex-1 overflow-y-auto text-sm space-y-2">
            {resultados.map((v) => (
              <div 
                key={v.id} 
                onClick={() => dispararParaProjetor(v.texto)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${darkMode ? 'bg-[#29292e]/40 border-[#29292e] hover:border-emerald-500' : 'bg-gray-50 hover:border-emerald-500'}`}
              >
                <span className="font-bold text-xs text-emerald-500 block mb-1">{v.livro_nome} {v.capitulo}:{v.versiculo}</span>
                <p>{v.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COLUNA 2: HISTÓRICO / SLIDES DA MÚSICA */}
        <section className={`col-span-5 rounded-2xl p-4 border flex flex-col justify-center items-center ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white'}`}>
          <p className="text-gray-500 text-sm">Clique em um versículo na esquerda para projetar.</p>
        </section>

        {/* COLUNA 3: CONTROLES RÁPIDOS */}
        <section className="col-span-3 flex flex-col gap-5">
          <div className={`rounded-2xl p-4 border flex-1 flex flex-col gap-3 ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white'}`}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Controles de Emergência</h3>
            <button 
              onMouseDown={() => alternarF5(true)} 
              onMouseUp={() => alternarF5(false)}
              className="w-full py-3 rounded-xl font-medium text-sm bg-amber-500/10 text-amber-500 border border-amber-500/30 active:bg-amber-500/30"
            >
              F5 - Ocultar Texto (Segure)
            </button>
            <button 
              onClick={() => alternarF6(true)}
              className="w-full py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-500 border border-red-500/30 active:bg-red-500/30"
            >
              F6 - Blackout Total (Ligar)
            </button>
            <button 
              onClick={() => alternarF6(false)}
              className="w-full py-3 rounded-xl font-medium text-sm bg-gray-500/10 text-gray-400 border border-gray-500/30"
            >
              Restaurar Projeção
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
