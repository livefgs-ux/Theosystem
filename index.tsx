import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('Index.tsx: Iniciando aplicação v1.3...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Erro Crítico: Elemento #root não encontrado no HTML.");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('Index.tsx: React montado com sucesso.');
} catch (error) {
  console.error("Erro ao montar React:", error);
}
