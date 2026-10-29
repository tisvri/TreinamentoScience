// =================================================================
// catalogo.js — Página de catálogo de cursos
// - Exige login
// - Lê o manifesto (dados/cursos.json)
// - Busca progresso do aluno em cada curso
// - Renderiza cards com status e botão de acesso
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ---- 1. Exige login ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const atual = window.location.pathname + window.location.search;
    window.location.href = `/paginas/login.html?redir=${encodeURIComponent(atual)}`;
    return;
  }
  await renderCatalogo(user);
});

// ---- 2. Renderiza o catálogo ----
async function renderCatalogo(user) {

  // Saudação com o nome do aluno
  const saudacao = document.getElementById('saudacao');
  const primeiroNome = (user.displayName || user.email || '').split(' ')[0].split('@')[0];
  saudacao.textContent = `Olá, ${primeiroNome}!`;

  // Buscar manifesto de cursos
  let cursos;
  try {
    const r = await fetch('/dados/cursos.json');
    cursos = (await r.json()).cursos;
  } catch (e) {
    console.error('❌ Erro ao carregar cursos.json:', e);
    document.getElementById('catalogoGrid').innerHTML =
      '<p style="color:red">Erro ao carregar o catálogo.</p>';
    return;
  }

  // Buscar em paralelo: JSON de cada curso (para saber total) + progresso do aluno
  const dados = await Promise.all(cursos.map(async (curso) => {
    let totalAulas = 0;
    try {
      const r = await fetch(`/dados/cursos/${curso.id}.json`);
      const data = await r.json();
      if (Array.isArray(data.aulas)) {
        totalAulas = data.aulas.length;
      } else if (Array.isArray(data.secoes)) {
        totalAulas = data.secoes.reduce((soma, sec) => soma + sec.aulas.length, 0);
      }
    } catch (e) {
      console.warn(`⚠️ Não foi possível carregar ${curso.id}.json:`, e);
    }

    let progresso = null;
    try {
      const snap = await getDoc(doc(db, 'progresso', `${user.uid}_${curso.id}`));
      if (snap.exists()) progresso = snap.data();
    } catch (e) {
      console.warn(`⚠️ Erro ao buscar progresso de ${curso.id}:`, e);
    }

    return { curso, totalAulas, progresso };
  }));

  // Renderizar cards
  const grid = document.getElementById('catalogoGrid');
  grid.innerHTML = '';
  dados.forEach(({ curso, totalAulas, progresso }) => {
    grid.appendChild(criarCard(curso, totalAulas, progresso));
  });

  console.log(`✅ Catálogo renderizado com ${cursos.length} cursos.`);
}

// ---- 3. Cria um card de curso ----
function criarCard(curso, totalAulas, progresso) {
  const aulasAssistidas = progresso?.aulasAssistidas?.length || 0;
  const concluido = progresso?.concluido === true;
  const iniciado = aulasAssistidas > 0;
  const pct = totalAulas > 0 ? (aulasAssistidas / totalAulas) * 100 : 0;

  let statusTexto, statusClasse, btnTexto;
  if (concluido) {
    statusTexto = '✓ Concluído';
    statusClasse = 'concluido';
    btnTexto = 'Revisar';
  } else if (iniciado) {
    statusTexto = `${aulasAssistidas} de ${totalAulas} aulas`;
    statusClasse = 'andamento';
    btnTexto = 'Continuar';
  } else {
    statusTexto = 'Não iniciado';
    statusClasse = 'nao-iniciado';
    btnTexto = 'Iniciar';
  }

  const card = document.createElement('div');
  card.className = 'curso-card';
  card.innerHTML = `
    <img class="curso-capa" src="${curso.capa}" alt="${curso.titulo}" loading="lazy">
    <div class="curso-info">
      <span class="curso-area">${curso.area}</span>
      <h3 class="curso-titulo">${curso.titulo}</h3>
      <p class="curso-descricao">${curso.descricao || ''}</p>
      <div class="curso-progresso">
        <div class="curso-progresso-barra" style="width: ${pct}%"></div>
      </div>
      <span class="curso-status ${statusClasse}">${statusTexto}</span>
      <a class="btn-curso" href="${curso.caminho}">${btnTexto}</a>
    </div>
  `;
  return card;
}