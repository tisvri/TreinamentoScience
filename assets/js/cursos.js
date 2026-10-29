// =================================================================
// cursos.js — Catálogo de cursos
// - Filtra por área (sidebar)
// - Mostra etiquetas: Obrigatório / Recomendado (por setor do usuário)
// - Ordena: obrigatórios primeiro
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let todosCursos = [];
let dadosPorCurso = {};
let setoresUsuario = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }
  await carregarTudo(user);
});

async function carregarTudo(user) {

  // 1. Buscar setores do usuário
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) {
      setoresUsuario = snap.data().setores || [];
    }
  } catch (e) {
    console.warn('⚠️ Erro ao buscar setores do usuário:', e);
  }

  // 2. Manifesto de cursos
  try {
    const r = await fetch('/dados/cursos.json');
    todosCursos = (await r.json()).cursos;
  } catch (e) {
    console.error('❌ Erro ao carregar cursos.json:', e);
    document.getElementById('catalogoGrid').innerHTML =
      '<p style="color:red">Erro ao carregar o catálogo.</p>';
    return;
  }

  // 3. Progresso + total de aulas
  await Promise.all(todosCursos.map(async (curso) => {
    let totalAulas = 0;
    if (curso.id !== 'capital-humano') {
      try {
        const r = await fetch(`/dados/cursos/${curso.id}.json`);
        const data = await r.json();
        if (Array.isArray(data.aulas)) totalAulas = data.aulas.length;
        else if (Array.isArray(data.secoes)) totalAulas = data.secoes.reduce((s, sec) => s + sec.aulas.length, 0);
      } catch (e) {
        console.warn(`⚠️ Não foi possível carregar ${curso.id}.json:`, e);
      }
    }

    let progresso = null;
    try {
      const snap = await getDoc(doc(db, 'progresso', `${user.uid}_${curso.id}`));
      if (snap.exists()) progresso = snap.data();
    } catch (e) {
      console.warn(`⚠️ Erro ao buscar progresso de ${curso.id}:`, e);
    }

    dadosPorCurso[curso.id] = { totalAulas, progresso };
  }));

  // 4. Saudação
  const primeiroNome = (user.displayName || user.email || '').split(' ')[0].split('@')[0];
  document.getElementById('saudacao').textContent = `Olá, ${primeiroNome}! Escolha um curso para começar.`;

  // 5. Sidebar + render
  montarSidebar();
  filtrarPor('todas');

  console.log(`✅ Catálogo: ${todosCursos.length} cursos · setores do usuário: [${setoresUsuario.join(', ')}]`);
}

// ---- Verifica se o curso é obrigatório/recomendado para o usuário ----
function verificarEtiqueta(curso) {
  if (!curso.publico) return null;

  const obrig = curso.publico.obrigatorio || [];
  const recom = curso.publico.recomendado || [];

  const ehObrigatorio =
    obrig.includes('todos') ||
    obrig.some(s => setoresUsuario.includes(s));

  const ehRecomendado =
    recom.includes('todos') ||
    recom.some(s => setoresUsuario.includes(s));

  if (ehObrigatorio) return 'obrigatorio';
  if (ehRecomendado) return 'recomendado';
  return null;
}

// ---- Sidebar ----
function montarSidebar() {
  const sidebar = document.getElementById('sidebarAreas');

  const areas = [...new Set(todosCursos.map(c => c.area))].sort((a, b) => {
    if (a === 'Onboarding') return -1;
    if (b === 'Onboarding') return 1;
    return a.localeCompare(b);
  });

  const contagem = {};
  todosCursos.forEach(c => contagem[c.area] = (contagem[c.area] || 0) + 1);

  const itens = [
    { area: 'todas', label: 'Todas', count: todosCursos.length },
    ...areas.map(a => ({ area: a, label: a, count: contagem[a] }))
  ];

  sidebar.innerHTML = '';
  itens.forEach(item => {
    const li = document.createElement('li');
    li.dataset.area = item.area;
    li.className = 'sidebar-item';
    li.innerHTML = `
      <span class="sidebar-label">${item.label}</span>
      <span class="sidebar-count">${item.count}</span>
    `;
    li.addEventListener('click', () => filtrarPor(item.area));
    sidebar.appendChild(li);
  });
}

// ---- Filtro ----
function filtrarPor(area) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('ativo', el.dataset.area === area);
  });

  const titulo = document.getElementById('tituloArea');
  titulo.textContent = area === 'todas' ? 'Todos os cursos' : area;

  let filtrados = area === 'todas'
    ? [...todosCursos]
    : todosCursos.filter(c => c.area === area);

  // Ordenar: obrigatórios → recomendados → resto (alfabético dentro de cada grupo)
  filtrados.sort((a, b) => {
    const prioA = prioridade(a);
    const prioB = prioridade(b);
    if (prioA !== prioB) return prioA - prioB;
    return a.titulo.localeCompare(b.titulo);
  });

  const grid = document.getElementById('catalogoGrid');
  grid.innerHTML = '';
  filtrados.forEach(curso => {
    const { totalAulas, progresso } = dadosPorCurso[curso.id] || {};
    grid.appendChild(criarCard(curso, totalAulas || 0, progresso));
  });

  if (filtrados.length === 0) {
    grid.innerHTML = '<p class="grid-vazio">Nenhum curso nesta área.</p>';
  }
}

// ---- Prioridade para ordenação ----
function prioridade(curso) {
  const etiqueta = verificarEtiqueta(curso);
  if (etiqueta === 'obrigatorio') return 0;
  if (etiqueta === 'recomendado') return 1;
  return 2;
}

// ---- Card ----
function criarCard(curso, totalAulas, progresso) {
  const etiqueta = verificarEtiqueta(curso);

  // Capital Humano — card simples, sem progresso
  if (curso.id === 'capital-humano') {
    const card = document.createElement('div');
    card.className = 'curso-card';
    card.innerHTML = `
      ${etiquetaHtml(etiqueta)}
      <img class="curso-capa" src="${curso.capa}" alt="${curso.titulo}" loading="lazy">
      <div class="curso-info">
        <span class="curso-area">${curso.area}</span>
        <h3 class="curso-titulo">${curso.titulo}</h3>
        <p class="curso-descricao">${curso.descricao || ''}</p>
        <a class="btn-curso" href="${curso.caminho}">Acessar</a>
      </div>
    `;
    return card;
  }

  // Cards normais
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
    ${etiquetaHtml(etiqueta)}
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

// ---- HTML da etiqueta (aparece no topo do card) ----
function etiquetaHtml(etiqueta) {
  if (etiqueta === 'obrigatorio') {
    return '<span class="curso-etiqueta obrigatorio">⚠️ Obrigatório</span>';
  }
  if (etiqueta === 'recomendado') {
    return '<span class="curso-etiqueta recomendado">💡 Recomendado</span>';
  }
  return '';
}