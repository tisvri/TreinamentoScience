// =================================================================
// app.js — Header e menu global + criação automática do usuário
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  const header = document.getElementById('menu-global');
  if (!header) return;

  if (!user) {
    header.innerHTML = '';
    return;
  }

  // --- 1. Garantir que o usuário tem um documento no Firestore ---
  await garantirUsuario(user);

  // --- 2. Buscar itens de navegação ---
  let itens = [];
  try {
    const r = await fetch('/dados/navegacao.json');
    itens = (await r.json()).itens;
  } catch (e) {
    console.warn('⚠️ Navegação não carregada:', e);
  }

  // --- 3. Renderizar header ---
  const nomeCompleto = user.displayName || user.email || '';
  const primeiroNome = nomeCompleto.split(' ')[0].split('@')[0];

  header.classList.add('menu_pagina');
  header.innerHTML = `
    <div class="img_menu">
      <a href="/paginas/cursos.html">
        <img class="logo" src="/assets/img/logo-science-valley.png" alt="Science Valley">
      </a>
    </div>

    <nav class="menu_global">
      <ul>
        ${itens.map(i => `<li><a href="${i.href}">${i.label}</a></li>`).join('')}
      </ul>
    </nav>

    <div class="menu_usuario">
      <span class="menu_nome">${primeiroNome}</span>
      <button class="menu_sair" id="btnSair">Sair</button>
    </div>
  `;

  document.getElementById('btnSair').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '/paginas/login.html';
  });
});

// =================================================================
// Cria o documento usuarios/{uid} se ainda não existir.
// Não sobrescreve se já existir (protege isGestor de ser resetado).
// =================================================================
async function garantirUsuario(user) {
  try {
    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    await setDoc(ref, {
      uid: user.uid,
      nome: user.displayName || '',
      email: user.email,
      isGestor: false,
      criadoEm: new Date().toISOString()
    });
    console.log('👤 Documento de usuário criado.');
  } catch (e) {
    console.warn('⚠️ Não foi possível criar documento do usuário:', e);
  }
}