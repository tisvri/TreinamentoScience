// =================================================================
// inicio.js — Painel de pendências na home
// - Busca os setores do usuário
// - Lê o catálogo de cursos
// - Filtra cursos obrigatórios não concluídos
// - Mostra o painel (ou mensagem de "tudo em dia")
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }
  await carregarPendencias(user);
});

async function carregarPendencias(user) {

  // 1. Setores do usuário
  let setoresUsuario = [];
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) setoresUsuario = snap.data().setores || [];
  } catch (e) {
    console.warn('⚠️ Erro ao buscar setores:', e);
  }

  // 2. Catálogo
  let cursos = [];
  try {
    const r = await fetch('/dados/cursos.json');
    cursos = (await r.json()).cursos;
  } catch (e) {
    console.error('❌ Erro ao carregar cursos:', e);
    return;
  }

  // 3. Filtrar só os obrigatórios (excluir Capital Humano — sem progresso rastreável)
  const obrigatorios = cursos.filter(c => {
    if (c.id === 'capital-humano') return false;
    if (!c.publico || !c.publico.obrigatorio) return false;

    const obrig = c.publico.obrigatorio;
    return obrig.includes('todos') || obrig.some(s => setoresUsuario.includes(s));
  });

  // 4. Buscar progresso de cada obrigatório
  const pendencias = [];
  await Promise.all(obrigatorios.map(async (curso) => {
    try {
      const snap = await getDoc(doc(db, 'progresso', `${user.uid}_${curso.id}`));
      const concluido = snap.exists() && snap.data().concluido === true;
      if (!concluido) {
        pendencias.push({
          curso,
          iniciado: snap.exists() && (snap.data().aulasAssistidas?.length || 0) > 0
        });
      }
    } catch (e) {
      console.warn(`⚠️ Erro ao buscar progresso de ${curso.id}:`, e);
    }
  }));

  renderPainel(pendencias);
}

// ---- Renderizar ----
function renderPainel(pendencias) {
  const el = document.getElementById('pendencias');
  el.style.display = 'block';

  if (pendencias.length === 0) {
    el.className = 'inicio-pendencias inicio-pendencias-ok';
    el.innerHTML = `
      <div class="pendencia-icone">🎉</div>
      <div class="pendencia-conteudo">
        <h3>Você está em dia!</h3>
        <p>Nenhuma pendência obrigatória no momento.</p>
      </div>
    `;
    return;
  }

  el.className = 'inicio-pendencias inicio-pendencias-alerta';
  const plural = pendencias.length === 1 ? 'pendência' : 'pendências';

  el.innerHTML = `
    <div class="pendencia-cabecalho">
      <span class="pendencia-icone">⚠️</span>
      <div>
        <h3>Você tem ${pendencias.length} ${plural} obrigatória${pendencias.length > 1 ? 's' : ''}</h3>
        <p>Estes treinamentos são obrigatórios para o seu perfil.</p>
      </div>
    </div>
    <ul class="pendencia-lista">
      ${pendencias.map(({ curso, iniciado }) => `
        <li class="pendencia-item">
          <span class="pendencia-titulo">${curso.titulo}</span>
          <a class="pendencia-btn" href="${curso.caminho}">
            ${iniciado ? 'Continuar →' : 'Começar →'}
          </a>
        </li>
      `).join('')}
    </ul>
  `;

  console.log(`⚠️ ${pendencias.length} pendências obrigatórias.`);
}