import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AddRepository from './components/AddRepository';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { RootNoiseFilter } from './components/primitives';
import './index.css';

// Atlas es una SPA sin router: la app es una sola página y el catálogo vive en
// los query params. `/add` es la única ruta aparte, así que alcanza con mirar
// el pathname en vez de agregar una dependencia de enrutado por una vista.
// En dev la sirve Vite desde el index; en producción el rewrite de
// vercel.json manda `/add` al mismo index.html.
function AddPage() {
  return (
    <div className="relative min-h-screen bg-sand text-teal-ink">
      <RootNoiseFilter />
      <Navbar />
      <main className="relative z-10 px-6 md:px-10 py-16 md:py-24">
        <AddRepository />
      </main>
      <Footer />
    </div>
  );
}

const isAddRoute = /^\/add\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isAddRoute ? <AddPage /> : <App />}</React.StrictMode>,
);
