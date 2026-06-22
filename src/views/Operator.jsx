import React, { useState } from 'react';
import { useBibleSearch } from '../hooks/useBibleSearch';

export default function Operator() {
  const [darkMode, setDarkMode] = useState(true);
  const [versaoAtiva, setVersaoAtiva] = useState('NVI');
  const [busca, setBusca] = useState('');
  const { executarBusca, resultados, carregando } = useBibleSearch();

  const handleBuscaKeyDown = (e) => {
    if (e.key === 'Enter') {
      executarBusca(busca, versaoAtiva);
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-[#121214] text-white' : 'bg-[#f0f2f5] text-[#1c1c1e]'}`}>
      
      {/* BARRA SUPERIOR (HEADER) */}
      <header className={`px-6 py-4 flex justify-between items-center border-b backdrop-blur-md ${darkMode ? 'bg-[#1f1f23]/80 border-[#29292e]' : 'bg-white/80 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-bold text-lg tracking-wide uppercase">AQC Mídia Pro</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Seletor Rápido de Versão da Bíblia */}
          <select 
            value={versaoAtiva} 
            onChange={(e) => setVersaoAtiva(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border focus:outline-none transition-all ${darkMode ? 'bg-[#29292e] border-[#3e3e44] text-white' : 'bg-gray-100 border-gray-300 text-gray-800'}`}
          >
            <option value="NVI">NVI (Nova Versão Inter.)</option>
            <option value="ARC">ARC (Almeida Revista Corrigida)</option>
            <option value="NAA">NAA (Nova Almeida Atualizada)</option>
          </select>

          {/* Botão de Tema Sofisticado */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-xl transition-all border ${darkMode ? 'bg-[#29292e] border-[#3e3e44] hover:bg-[#3e3e44]' : 'bg-gray-150 border-gray-300 hover:bg-gray-200'}`}
          >
            {darkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>
        </div>
      </header>

      {/* PAINEL DE 3 COLUNAS */}
      <main className="grid grid-cols-12 gap-5 p-5 h-[calc(100vh-73px)]">
        
        {/* COLUNA 1: BUSCA DINÂMICA (4 Colunas) */}
        <section className={`col-span-3 rounded-2xl p-4 border flex flex-col gap-4 ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="relative">
            <input 
              type="text"
              placeholder="Ex: Jo 3:16 ou 'Deus amou' + Enter..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              className={`w-full pl-4 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${darkMode ? 'bg-[#121214] border-[#29292e] text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
            />
          </div>

          <div className="flex-1 overflow-y-auto text-sm space-y-2 pr-1">
            {carregando && <p className="text-gray-400 animate-pulse text-center py-4">Pesquisando na base da igreja...</p>}
            {!carregando && resultados.map((v) => (
              <div 
                key={v.id} 
                className={`p-3 rounded-xl cursor-pointer transition-all border ${darkMode ? 'bg-[#29292e]/40 border-[#29292e] hover:bg-[#29292e] hover:border-emerald-500/50' : 'bg-gray-50 border-gray-100 hover:bg-emerald-50/30 hover:border-emerald-500/30'}`}
              >
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-500 block mb-1">
                  {v.livro_nome} {v.capitulo}:{v.versiculo} ({v.versao})
                </span>
                <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{v.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COLUNA 2: GERENCIADOR DE SLIDES (6 Colunas) */}
        <section className={`col-span-6 rounded-2xl p-4 border flex flex-col ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="border-b border-dashed pb-3 mb-4 flex justify-between items-center border-[#29292e]">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-400">Projeção Ativa</h2>
            <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full font-medium">Modo Culto</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm border border-dashed rounded-xl border-[#29292e]">
            Nenhum louvor ou versículo disparado para o projetor.
          </div>
        </section>

        {/* COLUNA 3: PREVIEW & CONTROLES DE EMERGÊNCIA (3 Colunas) */}
        <section className="col-span-3 flex flex-col gap-5">
          {/* Preview do Monitor */}
          <div className={`rounded-2xl p-4 border aspect-video flex flex-col justify-between ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white border-gray-200 shadow-sm'}`}>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Preview Projetores HDMI</span>
            <div className="bg-black rounded-lg flex-1 mt-2 flex items-center justify-center text-xs text-gray-600">
              [Tela Preta / Inativa]
            </div>
          </div>

          {/* Botões de Emergência (Estilo Holyrics) */}
          <div className={`rounded-2xl p-4 border flex-1 flex flex-col gap-3 ${darkMode ? 'bg-[#1f1f23] border-[#29292e]' : 'bg-white border-gray-200 shadow-sm'}`}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Controles Rápidos</h3>
            
            <button className="w-full py-3 rounded-xl font-medium text-sm transition-all border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
              F5 - Ocultar Texto (Manter Vídeo)
            </button>
            
            <button className="w-full py-3 rounded-xl font-medium text-sm transition-all border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20">
              F6 - Blackout Total (Apagar Tudo)
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
