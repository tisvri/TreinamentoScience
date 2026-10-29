// =================================================================
// admin.js — Tela de administração de colaboradores
// - Exige isGestor OU isAdmin
// - Lista todos os usuários
// - Permite editar: setor, sub-setor, gestor
// - Só Admin pode: promover/rebaixar a gestor
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, collection, updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let estruturaSetores = [];
let usuarios = [];
let usuarioLogado = null;
let ehAdmin = false;

// ---- 1. Verificar permissão ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }

  // Verificar se é gestor ou admin
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const dados = snap.exists() ? snap.data() : {};
    const ehGestor = dados.isGestor === true;
    ehAdmin = dados.isAdmin === true;

    if (!ehGestor && !ehAdmin) {
      document.body.innerHTML = `
        <header id="menu-global"></header>
        <div style="max-width:600px;margin:80px auto;text-align:center;padding:20px;">
          <h1 style="color:#EC0E73">Acesso restrito</h1>
          <p>Esta página é apenas para RH e TI.</p>
        </div>
      `;
      return;
    }
  } catch (e) {
    console.error('❌ Erro ao verificar permissão:', e);
    return;
  }

  usuarioLogado = user;

  // ---- 2. Carregar estrutura de setores ----
  try {
    const r = await fetch('/dados/setores.json');
    estruturaSetores = (await r.json()).setores;
  } catch (e) {
    console.error('❌ Erro ao carregar setores.json:', e);
    return;
  }

  // ---- 3. Carregar todos os usuários ----
  const snap = await getDocs(collection(db, 'usuarios'));
  usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ---- 4. Ordenar: sem setor primeiro, depois alfabético ----
  usuarios.sort((a, b) => {
    const aTem = (a.setores && a.setores.length) ? 1 : 0;
    const bTem = (b.setores && b.setores.length) ? 1 : 0;
    if (aTem !== bTem) return aTem - bTem;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  render();

  console.log(`✅ Admin: ${usuarios.length} usuários · Admin: ${ehAdmin}`);
});

// ---- 5. Renderizar lista ----
function render() {
  const lista = document.getElementById('adminLista');
  lista.innerHTML = '';

  const busca = document.getElementById('busca').value.toLowerCase().trim();
  const filtrados = busca
    ? usuarios.filter(u =>
        (u.nome || '').toLowerCase().includes(busca) ||
        (u.email || '').toLowerCase().includes(busca)
      )
    : usuarios;

  // Contador
  const semSetor = usuarios.filter(u => !u.setores || u.setores.length === 0).length;
  document.getElementById('contador').textContent =
    `${usuarios.length} colaboradores · ${semSetor} sem setor`;

  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="lista-vazia">Nenhum colaborador encontrado.</p>';
    return;
  }

  filtrados.forEach(u => lista.appendChild(criarCard(u)));
}

// ---- 6. Card de cada usuário ----
function criarCard(u) {
  const semSetor = !u.setores || u.setores.length === 0;
  const setorAtual = semSetor ? '' : (u.setores[0] || '');
  const subAtual   = (u.setores && u.setores.length > 1) ? u.setores[1] : '';

  const card = document.createElement('div');
  card.className = 'admin-card' + (semSetor ? ' admin-card-pendente' : '');
  card.dataset.uid = u.id;

  card.innerHTML = `
    <div class="admin-card-header">
      <div class="admin-card-info">
        <span class="admin-card-nome">${u.nome || '(sem nome)'}</span>
        <span class="admin-card-email">${u.email || ''}</span>
      </div>
      <div class="admin-card-badges">
        ${semSetor ? '<span class="admin-badge pendente">⏳ Sem setor</span>' : ''}
        ${u.isGestor ? '<span class="admin-badge gestor">Gestor</span>' : ''}
        ${u.isAdmin  ? '<span class="admin-badge admin">Admin</span>' : ''}
      </div>
    </div>

    <div class="admin-card-form">
      <div class="admin-campo">
        <label>Setor</label>
        <select class="admin-select" data-campo="setor">
          <option value="">— Não definido —</option>
          ${estruturaSetores.map(s =>
            `<option value="${s.id}" ${s.id === setorAtual ? 'selected' : ''}>${s.nome}</option>`
          ).join('')}
        </select>
      </div>

      <div class="admin-campo">
        <label>Sub-setor</label>
        <select class="admin-select" data-campo="sub" ${!setorAtual ? 'disabled' : ''}></select>
      </div>

      <div class="admin-campo">
        <label>Gestor</label>
        <select class="admin-select" data-campo="gestor">
          <option value="">— Sem gestor —</option>
          ${usuarios
            .filter(outro => outro.email && outro.email !== u.email)
            .map(outro =>
              `<option value="${outro.email}" ${outro.email === u.gestorEmail ? 'selected' : ''}>${outro.nome || outro.email}</option>`
            ).join('')}
        </select>
      </div>

      <div class="admin-card-acoes">
        <button class="admin-btn-salvar">Salvar</button>
        ${ehAdmin && u.id !== usuarioLogado.uid ? `
          <button class="admin-btn-promover">
            ${u.isGestor ? 'Remover gestor' : 'Tornar gestor'}
          </button>
        ` : ''}
      </div>
    </div>

    <div class="admin-card-msg" style="display:none;"></div>
  `;

  // Preencher sub-setor
  const selectSetor = card.querySelector('[data-campo="setor"]');
  const selectSub   = card.querySelector('[data-campo="sub"]');
  atualizarSubSetores(selectSetor.value, selectSub, subAtual);

  // Ao trocar setor, atualiza sub-setores
  selectSetor.addEventListener('change', () => {
    atualizarSubSetores(selectSetor.value, selectSub, '');
  });

  // Botão salvar
  card.querySelector('.admin-btn-salvar').addEventListener('click', () => salvar(card, u));

  // Botão promover (só admin vê)
  const btnPromover = card.querySelector('.admin-btn-promover');
  if (btnPromover) {
    btnPromover.addEventListener('click', () => promover(card, u));
  }

  return card;
}

// ---- 7. Atualizar dropdown de sub-setores ----
function atualizarSubSetores(setorId, selectSub, subAtual) {
  selectSub.innerHTML = '';

  if (!setorId) {
    selectSub.disabled = true;
    selectSub.innerHTML = '<option value="">—</option>';
    return;
  }

  const setor = estruturaSetores.find(s => s.id === setorId);
  if (!setor || !setor.sub || setor.sub.length === 0) {
    selectSub.disabled = true;
    selectSub.innerHTML = '<option value="">—</option>';
    return;
  }

  selectSub.disabled = false;
  selectSub.innerHTML = '<option value="">— Sem sub-setor —</option>' +
    setor.sub.map(s =>
      `<option value="${s.id}" ${s.id === subAtual ? 'selected' : ''}>${s.nome}</option>`
    ).join('');
}

// ---- 8. Salvar setores + gestor ----
async function salvar(card, u) {
  const selectSetor  = card.querySelector('[data-campo="setor"]');
  const selectSub    = card.querySelector('[data-campo="sub"]');
  const selectGestor = card.querySelector('[data-campo="gestor"]');
  const msg = card.querySelector('.admin-card-msg');
  const btn = card.querySelector('.admin-btn-salvar');

  const setorId = selectSetor.value;
  const subId   = selectSub.value;
  const gestor  = selectGestor.value;

  // Montar array de setores (pai + filho)
  const setores = [];
  if (setorId) setores.push(setorId);
  if (subId)   setores.push(subId);

  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    await updateDoc(doc(db, 'usuarios', u.id), {
      setores: setores,
      gestorEmail: gestor || null,
      atualizadoEm: new Date().toISOString()
    });

    // Atualizar cópia local
    u.setores = setores;
    u.gestorEmail = gestor || null;

    msg.textContent = '✅ Salvo!';
    msg.className = 'admin-card-msg sucesso';
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);

    console.log(`💾 Salvo: ${u.nome} → ${setores.join(', ') || 'sem setor'}`);
  } catch (e) {
    console.error('❌ Erro ao salvar:', e);
    msg.textContent = 'Erro ao salvar. Veja o console.';
    msg.className = 'admin-card-msg erro';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

// ---- 9. Promover / rebaixar gestor (só admin) ----
async function promover(card, u) {
  const novoStatus = !u.isGestor;
  const acao = novoStatus ? 'promover' : 'remover';
  if (!confirm(`Confirma ${acao} ${u.nome} como gestor?`)) return;

  const btn = card.querySelector('.admin-btn-promover');
  btn.disabled = true;
  btn.textContent = 'Processando...';

  try {
    await updateDoc(doc(db, 'usuarios', u.id), {
      isGestor: novoStatus,
      atualizadoEm: new Date().toISOString()
    });

    u.isGestor = novoStatus;
    console.log(`👤 ${u.nome} agora é ${novoStatus ? 'gestor' : 'colaborador comum'}`);

    // Re-renderiza (para atualizar o botão e o badge)
    render();
  } catch (e) {
    console.error('❌ Erro:', e);
    alert('Erro ao atualizar. Veja o console.');
    btn.disabled = false;
    btn.textContent = u.isGestor ? 'Remover gestor' : 'Tornar gestor';
  }
}

// ---- 10. Busca em tempo real ----
document.getElementById('busca').addEventListener('input', render);