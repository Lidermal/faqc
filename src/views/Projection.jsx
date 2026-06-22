import React, { useState, useEffect } from 'react';

export default function Projection() {
  const [texto, setTexto] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [blackout, setBlackout] = useState(false);
  const [ocultarTexto, setOcultarTexto] = useState(false);

  useEffect(() => {
    // Abre o canal de comunicação local com o mesmo nome do Operador
    const canalReceptor = new BroadcastChannel('amor_que_cura_projection');

    canalReceptor.onmessage = (evento) => {
      const { tipo, payload } = evento.data;

      switch (tipo) {
        case 'PROJETAR_TEXTO':
          setTexto(payload.texto);
          setBlackout(false);
          setOcultarTexto(false);
          break;
        case 'PROJETAR_VIDEO':
          setVideoUrl(payload.url);
          break;
        case 'F5_TEXTO':
          setOcultarTexto(payload.ativo);
          break;
        case 'F6_BLACKOUT':
          setBlackout(payload.ativo);
          break;
        case 'PING_TESTE':
          // Responde ao operador que a conexão HDMI está ativa
          canalReceptor.postMessage({ tipo: 'PONG_TESTE', payload: { status: 'ONLINE' } });
          break;
        default:
          break;
      }
    };

    return () => canalReceptor.close();
  }, []);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative flex items-center justify-center select-none">
      
      {/* CAMADA DO VÍDEO DE FUNDO (Estilo Resolume) */}
      {videoUrl && !blackout && (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        />
      )}

      {/* CAMADA DO TEXTO (Estilo Holyrics) */}
      <div 
        className={`relative z-10 w-[90%] text-center font-bold px-8 transition-all duration-300 ${
          blackout || ocultarTexto ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{
          fontSize: 'clamp(2rem, 5vw, 4.5rem)',
          lineHeight: '1.2',
          color: '#ffffff',
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.85), -2px -2px 0px rgba(0,0,0,0.5)',
        }}
      >
        {texto.split('\n').map((linha, idx) => (
          <p key={idx} className="mb-2">{linha}</p>
        ))}
      </div>

      {/* Indicador visual de tela preta total (Apenas se houver blackout) */}
      {blackout && <div className="absolute inset-0 bg-black z-50 transition-opacity duration-300" />}
    </div>
  );
}
