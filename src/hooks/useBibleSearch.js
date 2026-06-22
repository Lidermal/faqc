import { useState } from 'react';
import { supabase } from '../supabaseClient'; // Sua configuração do Supabase

export function useBibleSearch() {
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const executarBusca = async (termo, versaoAtiva) => {
    if (!termo.trim()) return;
    setCarregando(true);

    // Expressão regular para detectar formato de referência (Ex: "João 3:16" ou "Jo 3:16")
    const regexReferencia = /^([1-3]?\s?[a-zA-ZçÇáÁéÉíÍóÓúÚ]+)\s+(\d+):(\d+)$/;
    const match = termo.trim().match(regexReferencia);

    try {
      if (match) {
        // 1. BUSCA POR REFERÊNCIA DIRETA (Ex: Jo 3:16)
        const [_, livro, capitulo, versiculo] = match;
        
        // No mundo real, você pode ter uma função para converter "Jo" em "João" se necessário
        const { data, error } = await supabase
          .from('biblias')
          .select('*')
          .eq('versao', versaoAtiva)
          .ilike('livro_sigla', `${livro.substring(0, 2)}%`) // Busca pela sigla do livro
          .eq('capitulo', parseInt(capitulo))
          .eq('versiculo', parseInt(versiculo));

        if (error) throw error;
        setResultados(data || []);
      } else {
        // 2. BUSCA POR PALAVRA-CHAVE / FRASE
        const { data, error } = await supabase
          .from('biblias')
          .select('*')
          .eq('versao', versaoAtiva)
          .ilike('texto', `%${termo}%`) // Busca o termo contido em qualquer parte do texto
          .order('livro_nome', { ascending: true })
          .limit(50); // Limita a 50 resultados para manter a sofisticação e performance

        if (error) throw error;
        setResultados(data || []);
      }
    } catch (err) {
      console.error("Erro na busca da Bíblia:", err.message);
    } finally {
      setCarregando(false);
    }
  };

  return { executarBusca, resultados, carregando };
}
