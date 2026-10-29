// =================================================================
// painel-gestor.js — Painel do Gestor/RH
// - Filtros: busca, setor, status, curso/política
// - Ordenação por coluna (clique no cabeçalho)
// - Botão Limpar filtros
// - Exportação CSV
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let dadosGlobais = null;
let abaAtiva = 'cursos';
let mapaSetores = {};
let sortState = { key: null, dir: 'asc' };

// ---- 1. Exige login + gestor/admin ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const dados = snap.exists() ? snap.data() : {};
    const temAcesso = dados.isGestor === true || dados.isAdmin === true;

    if (!temAcesso) {
      document.body.innerHTML = `
        <header id="menu-global"></header>
        <div style="max-width:600px;margin:80px auto;text-align:center;padding:20px;">
          <h1 style="color:#EC0E73">Acesso restrito</h1>
          <p>Esta página é apenas para gestores e RH.</p>
        </div>
      `;
      return;
    }
  } catch (e) {
    console.error('❌ Erro ao verificar permissão:', e);
    return;
  }

  await carregarMapaSetores();
  popularFiltroSetores();
  await carregarPainel();
});

// ---- 2. Mapa de setores ----
async function carregarMapaSetores() {
  try {
    const r = await fetch('/dados/setores.json');
    const setores = (await r.json()).setores;
    setores.forEach(s => {
      mapaSetores[s.id] = s.nome;
      if (s.sub) s.sub.forEach(sub => { mapaSetores[sub.id] = sub.nome; });
    });
  } catch (e) {
    console.warn('⚠️ Erro ao carregar setores:', e);
  }
}

// ---- 3. Popular filtro de setor ----
function popularFiltroSetores() {
  const select = document.getElementById('filtroSetor');
  if (!select) return;

  fetch('/dados/setores.json')
    .then(r => r.json())
    .then(data => {
      data.setores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nome;
        select.appendChild(opt);

        if (s.sub) {
          s.sub.forEach(sub => {
            const optSub = document.createElement('option');
            optSub.value = sub.id;
            optSub.textContent = `   ↳ ${sub.nome}`;
            select.appendChild(optSub);
          });
        }
      });
    })
    .catch(e => console.warn('⚠️ Erro ao popular filtro de setores:', e));
}

// ---- 4. Popular o dropdown de curso/política conforme a aba ----
function popularFiltroCurso() {
  const select = document.getElementById('filtroCurso');
  if (!select || !dadosGlobais) return;

  select.innerHTML = '';

  if (abaAtiva === 'cursos') {
    const opt0 = document.createElement('option');
    opt0.value = 'todos';
    opt0.textContent = 'Filtrar por curso...';
    select.appendChild(opt0);

    dadosGlobais.cursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.titulo;
      select.appendChild(opt);
    });
  } else {
    const opt0 = document.createElement('option');
    opt0.value = 'todos';
    opt0.textContent = 'Filtrar por política...';
    select.appendChild(opt0);

    dadosGlobais.politicas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.titulo;
      select.appendChild(opt);
    });
  }
}

// ---- 5. Carregar painel ----
async function carregarPainel() {

  const r = await fetch('/dados/cursos.json');
  const todosCursos = (await r.json()).cursos;

  const cursosComProgresso = todosCursos.filter(c => c.id !== 'capital-humano');

  let politicas = [];
  try {
    const rp = await fetch('/dados/politicas.json');
    politicas = (await rp.json()).politicas;
  } catch (e) {
    console.warn('⚠️ Não foi possível carregar políticas:', e);
  }

  const usuariosSnap = await getDocs(collection(db, 'usuarios'));
  const usuarios = usuariosSnap.docs.map(d => d.data());

  const progressoSnap = await getDocs(collection(db, 'progresso'));
  const progressos = progressoSnap.docs.map(d => d.data());

  const aceitesSnap = await getDocs(collection(db, 'aceites'));
  const aceites = aceitesSnap.docs.map(d => d.data());

  const totais = {};
  await Promise.all(cursosComProgresso.map(async (c) => {
    try {
      const resp = await fetch(`/dados/cursos/${c.id}.json`);
      const data = await resp.json();
      let total = 0;
      if (Array.isArray(data.aulas)) total = data.aulas.length;
      else if (Array.isArray(data.secoes)) total = data.secoes.reduce((s, sec) => s + sec.aulas.length, 0);
      totais[c.id] = total;
    } catch {
      totais[c.id] = 0;
    }
  }));

  const linhasCursos = usuarios.map(u => {
    const status = {};
    cursosComProgresso.forEach(c => {
      const p = progressos.find(p => p.uid === u.uid && p.cursoId === c.id);
      const totalAulas = totais[c.id] || 0;
      if (!p) {
        status[c.id] = { tipo: 'nao-iniciado', valor: '—', pct: 0 };
      } else if (p.concluido) {
        status[c.id] = { tipo: 'concluido', valor: '✓', pct: 100 };
      } else {
        const feitas = (p.aulasAssistidas || []).length;
        const pct = totalAulas > 0 ? Math.round((feitas / totalAulas) * 100) : 0;
        status[c.id] = { tipo: 'andamento', valor: `${feitas}/${totalAulas}`, pct };
      }
    });
    return { usuario: u, status };
  });

  const linhasAceites = usuarios.map(u => {
    const status = {};
    politicas.forEach(pol => {
      const aceite = aceites.find(a =>
        a.uid === u.uid &&
        a.politicaId === pol.id &&
        a.versao === pol.versao
      );
      if (aceite) {
        const ts = new Date(aceite.aceitoEm).getTime();
        status[pol.id] = { tipo: 'aceito', valor: formatarDataHora(aceite.aceitoEm), sort: ts };
      } else {
        status[pol.id] = { tipo: 'pendente', valor: '⚠️ Pendente', sort: 0 };
      }
    });
    return { usuario: u, status };
  });

  dadosGlobais = { cursos: cursosComProgresso, politicas, linhasCursos, linhasAceites };

  renderResumo();
  renderTabelaCursos(linhasCursos, cursosComProgresso);
  renderTabelaAceites(linhasAceites, politicas);
  popularFiltroCurso();
  configurarAbas();
  aplicarFiltros();

  console.log(`✅ Painel: ${usuarios.length} usuários · ${cursosComProgresso.length} cursos · ${politicas.length} políticas.`);
}

// ---- 6. Formatar setores ----
function formatarSetores(u) {
  const setores = u.setores || [];
  if (setores.length === 0) return '—';
  return setores.map(s => mapaSetores[s] || s).join(' · ');
}

// ---- 7. Cards de resumo ----
function renderResumo() {
  const { cursos, politicas, linhasCursos, linhasAceites } = dadosGlobais;
  const resumo = document.getElementById('resumo');

  if (abaAtiva === 'cursos') {
    let comPendencia = 0;
    linhasCursos.forEach(l => {
      if (cursos.some(c => l.status[c.id].tipo !== 'concluido')) comPendencia++;
    });

    resumo.innerHTML = `
      <div class="resumo-card">
        <span class="resumo-numero">${linhasCursos.length}</span>
        <span class="resumo-label">Colaboradores</span>
      </div>
      <div class="resumo-card">
        <span class="resumo-numero">${cursos.length}</span>
        <span class="resumo-label">Cursos ativos</span>
      </div>
      <div class="resumo-card destaque">
        <span class="resumo-numero">${comPendencia}</span>
        <span class="resumo-label">Com pendências</span>
      </div>
    `;
  } else {
    let comPendencia = 0;
    linhasAceites.forEach(l => {
      if (politicas.some(p => l.status[p.id].tipo !== 'aceito')) comPendencia++;
    });

    resumo.innerHTML = `
      <div class="resumo-card">
        <span class="resumo-numero">${linhasAceites.length}</span>
        <span class="resumo-label">Colaboradores</span>
      </div>
      <div class="resumo-card">
        <span class="resumo-numero">${politicas.length}</span>
        <span class="resumo-label">Políticas ativas</span>
      </div>
      <div class="resumo-card destaque">
        <span class="resumo-numero">${comPendencia}</span>
        <span class="resumo-label">Com aceites pendentes</span>
      </div>
    `;
  }
}

// ---- 8. Tabela de cursos ----
function renderTabelaCursos(linhas, cursos) {
  document.getElementById('tabelaCabecalho').innerHTML = `
    <tr>
      <th class="th-sortable">Colaborador</th>
      <th class="th-sortable">Setor</th>
      <th class="th-sortable">E-mail</th>
      ${cursos.map(c => `<th class="th-sortable">${c.titulo}</th>`).join('')}
    </tr>
  `;

  const tbody = document.getElementById('tabelaCorpo');
  tbody.innerHTML = '';
  linhas.forEach(({ usuario, status }) => {
    const tr = document.createElement('tr');
    tr.dataset.nome = (usuario.nome || '').toLowerCase();
    tr.dataset.email = (usuario.email || '').toLowerCase();
    tr.dataset.setores = (usuario.setores || []).join(',');
    const temPendencia = cursos.some(c => status[c.id].tipo !== 'concluido');
    tr.dataset.pendencia = temPendencia ? 'sim' : 'nao';

    tr.innerHTML = `
      <td class="col-nome" data-sort="${(usuario.nome || '').toLowerCase()}">${usuario.nome || '(sem nome)'}</td>
      <td class="col-setor" data-sort="${formatarSetores(usuario).toLowerCase()}">${formatarSetores(usuario)}</td>
      <td class="col-email" data-sort="${usuario.email || ''}">${usuario.email || ''}</td>
      ${cursos.map(c => {
        const s = status[c.id];
        return `<td class="col-status status-${s.tipo}" data-sort="${s.pct}">${s.valor}</td>`;
      }).join('')}
    `;
    tbody.appendChild(tr);
  });
}

// ---- 9. Tabela de aceites ----
function renderTabelaAceites(linhas, politicas) {
  document.getElementById('tabelaCabecalhoAceites').innerHTML = `
    <tr>
      <th class="th-sortable">Colaborador</th>
      <th class="th-sortable">Setor</th>
      <th class="th-sortable">E-mail</th>
      ${politicas.map(p => `<th class="th-sortable">${p.titulo} <small>(v${p.versao})</small></th>`).join('')}
    </tr>
  `;

  const tbody = document.getElementById('tabelaCorpoAceites');
  tbody.innerHTML = '';
  linhas.forEach(({ usuario, status }) => {
    const tr = document.createElement('tr');
    tr.dataset.nome = (usuario.nome || '').toLowerCase();
    tr.dataset.email = (usuario.email || '').toLowerCase();
    tr.dataset.setores = (usuario.setores || []).join(',');
    const temPendencia = politicas.some(p => status[p.id].tipo !== 'aceito');
    tr.dataset.pendencia = temPendencia ? 'sim' : 'nao';

    tr.innerHTML = `
      <td class="col-nome" data-sort="${(usuario.nome || '').toLowerCase()}">${usuario.nome || '(sem nome)'}</td>
      <td class="col-setor" data-sort="${formatarSetores(usuario).toLowerCase()}">${formatarSetores(usuario)}</td>
      <td class="col-email" data-sort="${usuario.email || ''}">${usuario.email || ''}</td>
      ${politicas.map(p => {
        const s = status[p.id];
        const aceitou = s.tipo === 'aceito' ? 1 : 0;
        return `<td class="col-aceite aceite-${s.tipo}" data-sort="${s.sort}" data-aceitou="${aceitou}">${s.valor}</td>`;
      }).join('')}
    `;
    tbody.appendChild(tr);
  });
}

// ---- 10. Abas ----
function configurarAbas() {
  document.querySelectorAll('.painel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      abaAtiva = btn.dataset.tab;

      document.querySelectorAll('.painel-tab').forEach(b => b.classList.toggle('ativo', b === btn));

      document.getElementById('painelCursos').style.display   = abaAtiva === 'cursos'  ? 'block' : 'none';
      document.getElementById('painelAceites').style.display  = abaAtiva === 'aceites' ? 'block' : 'none';

      // Repopular dropdown de curso/política + resetar seleção
      document.getElementById('filtroCurso').value = 'todos';
      popularFiltroCurso();

      renderResumo();
      aplicarFiltros();
    });
  });
}

// ---- 11. Filtros ----
function aplicarFiltros() {
  const busca = document.getElementById('busca').value.toLowerCase().trim();
  const filtroSetor = document.getElementById('filtroSetor').value;
  const filtroStatus = document.getElementById('filtroStatus').value;
  const filtroCurso = document.getElementById('filtroCurso').value;
  const filtroCursoStatus = document.getElementById('filtroCursoStatus').value;

  const tbodyId = abaAtiva === 'cursos' ? '#tabelaCorpo' : '#tabelaCorpoAceites';

  // Índice da coluna do curso/política selecionado
  let colIdx = -1;
  if (filtroCurso !== 'todos' && dadosGlobais) {
    if (abaAtiva === 'cursos') {
      const idx = dadosGlobais.cursos.findIndex(c => c.id === filtroCurso);
      if (idx >= 0) colIdx = 3 + idx;
    } else {
      const idx = dadosGlobais.politicas.findIndex(p => p.id === filtroCurso);
      if (idx >= 0) colIdx = 3 + idx;
    }
  }

  document.querySelectorAll(`${tbodyId} tr`).forEach(tr => {
    const nomeOk = !busca || (tr.dataset.nome || '').includes(busca) || (tr.dataset.email || '').includes(busca);

    let setorOk = true;
    if (filtroSetor !== 'todos') {
      const setoresPessoa = (tr.dataset.setores || '').split(',').filter(Boolean);
      setorOk = setoresPessoa.includes(filtroSetor);
    }

    let statusOk = true;
    if (filtroStatus === 'pendentes') statusOk = tr.dataset.pendencia === 'sim';
    if (filtroStatus === 'concluidos') statusOk = tr.dataset.pendencia === 'nao';

    // Filtro por curso/política
    let cursoOk = true;
    if (colIdx >= 0) {
      const cell = tr.children[colIdx];
      if (cell) {
        if (abaAtiva === 'cursos') {
          const pct = parseFloat(cell.dataset.sort || '0');
          if (filtroCursoStatus === 'fez') cursoOk = pct >= 100;
          else if (filtroCursoStatus === 'naofez') cursoOk = pct < 100;
        } else {
          const aceitou = cell.dataset.aceitou === '1';
          if (filtroCursoStatus === 'fez') cursoOk = aceitou;
          else if (filtroCursoStatus === 'naofez') cursoOk = !aceitou;
        }
      }
    }

    tr.style.display = (nomeOk && setorOk && statusOk && cursoOk) ? '' : 'none';
  });
}

document.getElementById('busca').addEventListener('input', aplicarFiltros);
document.getElementById('filtroSetor').addEventListener('change', aplicarFiltros);
document.getElementById('filtroStatus').addEventListener('change', aplicarFiltros);
document.getElementById('filtroCurso').addEventListener('change', aplicarFiltros);
document.getElementById('filtroCursoStatus').addEventListener('change', aplicarFiltros);

// ---- 12. Limpar filtros ----
document.getElementById('btnLimpar').addEventListener('click', () => {
  document.getElementById('busca').value = '';
  document.getElementById('filtroSetor').value = 'todos';
  document.getElementById('filtroStatus').value = 'todos';
  document.getElementById('filtroCurso').value = 'todos';
  document.getElementById('filtroCursoStatus').value = 'todos';

  // Resetar ordenação
  sortState = { key: null, dir: 'asc' };
  document.querySelectorAll('th.ordenado-asc, th.ordenado-desc').forEach(th => {
    th.classList.remove('ordenado-asc', 'ordenado-desc');
  });

  aplicarFiltros();
  console.log('🧹 Filtros limpos.');
});

// ---- 13. Ordenação por coluna ----
document.addEventListener('click', (e) => {
  const th = e.target.closest('th.th-sortable');
  if (!th) return;

  // CORREÇÃO: usar closest('thead') para pegar o thead (parentElement pegava o <tr>)
  const thead = th.closest('thead');
  if (!thead) return;

  const theadId = thead.id;
  if (theadId !== 'tabelaCabecalho' && theadId !== 'tabelaCabecalhoAceites') return;

  const colIndex = Array.from(thead.querySelectorAll('th')).indexOf(th);
  const tbodyId = theadId === 'tabelaCabecalho' ? 'tabelaCorpo' : 'tabelaCorpoAceites';

  ordenarTabela(theadId, tbodyId, colIndex);
});

function ordenarTabela(theadId, tbodyId, colIndex) {
  const key = `${theadId}-${colIndex}`;
  let dir = 'asc';
  if (sortState.key === key && sortState.dir === 'asc') {
    dir = 'desc';
  }
  sortState = { key, dir };

  const tbody = document.getElementById(tbodyId);
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    const aCell = a.children[colIndex];
    const bCell = b.children[colIndex];
    if (!aCell || !bCell) return 0;

    const aVal = aCell.dataset.sort !== undefined ? aCell.dataset.sort : aCell.textContent.trim().toLowerCase();
    const bVal = bCell.dataset.sort !== undefined ? bCell.dataset.sort : bCell.textContent.trim().toLowerCase();

    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);

    let cmp;
    if (!isNaN(aNum) && !isNaN(bNum)) {
      cmp = aNum - bNum;
    } else {
      cmp = String(aVal).localeCompare(String(bVal), 'pt-BR');
    }

    return dir === 'asc' ? cmp : -cmp;
  });

  rows.forEach(r => tbody.appendChild(r));

  // Indicador visual
  const thead = document.getElementById(theadId);
  const headers = thead.querySelectorAll('th');
  headers.forEach((th, idx) => {
    th.classList.remove('ordenado-asc', 'ordenado-desc');
    if (idx === colIndex) {
      th.classList.add(dir === 'asc' ? 'ordenado-asc' : 'ordenado-desc');
    }
  });

  console.log(`🔀 Ordenado: coluna ${colIndex}, ${dir === 'asc' ? 'crescente' : 'decrescente'}`);
}

// ---- 14. Exportar CSV ----
document.getElementById('btnExportar').addEventListener('click', () => {
  if (!dadosGlobais) return;
  const { cursos, politicas, linhasCursos, linhasAceites } = dadosGlobais;

  const linhas1 = [
    ['=== PROGRESSO NOS CURSOS ==='],
    ['Colaborador', 'Setor', 'E-mail', ...cursos.map(c => c.titulo)],
    ...linhasCursos.map(({ usuario, status }) => [
      usuario.nome || '',
      formatarSetores(usuario),
      usuario.email || '',
      ...cursos.map(c => status[c.id].valor)
    ]),
    []
  ];

  const linhas2 = [
    ['=== ACEITES DE POLÍTICAS ==='],
    ['Colaborador', 'Setor', 'E-mail', ...politicas.map(p => `${p.titulo} (v${p.versao})`)],
    ...linhasAceites.map(({ usuario, status }) => [
      usuario.nome || '',
      formatarSetores(usuario),
      usuario.email || '',
      ...politicas.map(p => status[p.id].valor)
    ])
  ];

  const csv = [...linhas1, ...linhas2]
    .map(linha => linha.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `painel-treinamentos-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('📥 CSV exportado.');
});

// ---- 15. Utilitário ----
function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}