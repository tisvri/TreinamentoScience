// =================================================================
// meu-perfil.js — Página "Meu Perfil"
// - Mostra nome, email e setor (readonly)
// - Gestor é escolhido via dropdown (busca lista de usuários)
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, collection, setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let mapaSetores = {};
let listaUsuarios = [];
let userAtual = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname);
    return;
  }
  userAtual = user;

  await carregarMapaSetores();
  await carregarListaUsuarios();
  await carregarPerfil(user);
});

// ---- Carregar nome dos setores (para traduzir "ti" → "TI") ----
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

// ---- Carregar lista de todos os usuários (para o dropdown) ----
async function carregarListaUsuarios() {
  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    listaUsuarios = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.email && u.email !== userAtual.email)  // exclui a si mesmo
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  } catch (e) {
    console.error('❌ Erro ao carregar usuários:', e);
  }
}

// ---- Preencher o dropdown de gestores ----
function popularDropdownGestores(gestorAtual) {
  const select = document.getElementById('gestorEmail');
  select.innerHTML = '<option value="">— Sem gestor —</option>';

  if (listaUsuarios.length === 0) {
    select.innerHTML += '<option value="" disabled>(nenhum usuário cadastrado)</option>';
    return;
  }

  listaUsuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.email;
    opt.textContent = u.nome ? `${u.nome} (${u.email})` : u.email;
    if (u.email === gestorAtual) opt.selected = true;
    select.appendChild(opt);
  });

  // Se o gestor salvo não está na lista (foi removido), adiciona como aviso
  if (gestorAtual && !listaUsuarios.find(u => u.email === gestorAtual)) {
    const opt = document.createElement('option');
    opt.value = gestorAtual;
    opt.textContent = `${gestorAtual} (não cadastrado)`;
    opt.selected = true;
    select.appendChild(opt);
  }
}

// ---- Carregar dados do perfil ----
async function carregarPerfil(user) {
  document.getElementById('nome').value  = user.displayName || '';
  document.getElementById('email').value = user.email || '';

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    const dados = snap.exists() ? snap.data() : {};

    // Setor (readonly)
    const setores = dados.setores || [];
    const setorTexto = setores.length === 0
      ? '⏳ Aguardando atribuição pelo RH'
      : setores.map(s => mapaSetores[s] || s).join(' · ');
    document.getElementById('setor').value = setorTexto;

    // Gestor (dropdown)
    popularDropdownGestores(dados.gestorEmail || '');

  } catch (e) {
    console.error('❌ Erro ao carregar perfil:', e);
  }
}

// ---- Salvar ----
document.getElementById('formPerfil').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!userAtual) return;

  const gestorEmail = document.getElementById('gestorEmail').value.trim();
  const msg = document.getElementById('msg');

  try {
    await setDoc(doc(db, 'usuarios', userAtual.uid), {
      gestorEmail: gestorEmail || null,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    msg.textContent = '✅ Perfil atualizado!';
    msg.className = 'perfil-msg sucesso';
    msg.style.display = 'block';

    setTimeout(() => { msg.style.display = 'none'; }, 3000);

    console.log('💾 Perfil salvo. gestorEmail:', gestorEmail || '(vazio)');
  } catch (e) {
    console.error('❌ Erro ao salvar:', e);
    msg.textContent = 'Erro ao salvar. Tente novamente.';
    msg.className = 'perfil-msg erro';
    msg.style.display = 'block';
  }
});