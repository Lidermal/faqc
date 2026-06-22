import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Operator from './views/Operator';
import Projection from './views/Projection';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota do Painel de Controle Principal do Operador */}
        <Route path="/" element={<Operator />} />
        
        {/* Rota Limpa da Projeção que vai para os dois projetores HDMI */}
        <Route path="/projection" element={<Projection />} />
        
        {/* Redireciona qualquer rota errada de volta para o operador */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
