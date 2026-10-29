// =================================================================
// manuais.js — Lista de manuais e documentos de apoio
// =================================================================

import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { registrarAcesso } from './registro.js';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }
  await renderManuais(user);
});

async function renderManuais(user) {

  let manuais;
  try {
    const r = await fetch('/dados/manuais.json');
    manuais = (await r.json()).manuais;
  } catch (e) {
    console.error('❌ Erro ao carregar manuais:', e);
    document.getElementById('listaManuais').innerHTML =
      '<p style="color:red">Erro ao carregar os manuais.</p>';
    return;
  }

  const lista = document.getElementById('listaManuais');
  lista.innerHTML = '';

  manuais.forEach(man => {
    const card = document.createElement('a');
    card.className = 'doc-card';
    card.href = man.arquivo;
    card.target = '_blank';
    card.rel = 'noopener';
    card.innerHTML = `
      <div class="doc-info">
        <span class="doc-tipo">${man.tipo || 'Documento'}</span>
        <h3 class="doc-titulo">${man.titulo}</h3>
        <span class="doc-meta">${man.area || ''}</span>
      </div>
      <span class="doc-abrir">Abrir →</span>
    `;

    card.addEventListener('click', () => {
      console.log('🔥 CLICOU NO CARD');
      registrarAcesso(user, man.id, man.titulo, 'manual');
    });

    lista.appendChild(card);
  });

  console.log(`✅ ${manuais.length} manuais carregados.`);
}