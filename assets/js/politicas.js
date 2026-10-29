// =================================================================
// politicas.js — Lista de políticas com indicador de aceite
// Layout idêntico ao de manuais
// =================================================================

import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { buscarAceites } from './aceite.js';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }
  await renderPoliticas(user);
});

async function renderPoliticas(user) {

  let politicas;
  try {
    const r = await fetch('/dados/politicas.json');
    politicas = (await r.json()).politicas;
  } catch (e) {
    console.error('❌ Erro ao carregar políticas:', e);
    document.getElementById('listaPoliticas').innerHTML =
      '<p style="color:red">Erro ao carregar as políticas.</p>';
    return;
  }

  const aceites = await buscarAceites(user);

  const lista = document.getElementById('listaPoliticas');
  lista.innerHTML = '';

  politicas.forEach(pol => {
    const aceite = aceites[`${pol.id}_${pol.versao}`];
    const jaAceitou = !!aceite;

    const card = document.createElement('a');
    card.className = 'doc-card';
    card.href = `/paginas/politica.html?id=${pol.id}`;
    card.innerHTML = `
      <div class="doc-info">
        <span class="doc-tipo">
          ${pol.tipo || 'Documento'}
          ${jaAceitou
            ? '<span class="doc-badge aceito">✅ Aceita</span>'
            : '<span class="doc-badge pendente">⚠️ Pendente</span>'}
        </span>
        <h3 class="doc-titulo">${pol.titulo}</h3>
        <span class="doc-meta">${pol.area || ''} · Versão ${pol.versao || '1.0'} · ${formatarData(pol.data)}</span>
      </div>
      <span class="doc-abrir">Ler →</span>
    `;

    lista.appendChild(card);
  });

  console.log(`✅ ${politicas.length} políticas carregadas.`);
}

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}