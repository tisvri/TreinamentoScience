// =================================================================
// aceite.js — Aceite eletrônico de políticas
// =================================================================

import { db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ---- Buscar todos os aceites de um usuário ----
export async function buscarAceites(user) {
  try {
    const q = query(collection(db, 'aceites'), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    const mapa = {};
    snap.forEach(d => {
      const data = d.data();
      mapa[`${data.politicaId}_${data.versao}`] = data;
    });
    return mapa;
  } catch (e) {
    console.warn('⚠️ Erro ao buscar aceites:', e);
    return {};
  }
}

// ---- Aceitar uma política ----
export async function aceitarPolitica(user, politica) {
  const docId = `${user.uid}_${politica.id}_${politica.versao}`;
  const ref = doc(db, 'aceites', docId);

  const existente = await getDoc(ref);
  if (existente.exists()) {
    return existente.data();
  }

  const registro = {
    uid: user.uid,
    email: user.email,
    nome: user.displayName || '',
    politicaId: politica.id,
    politicaTitulo: politica.titulo,
    versao: politica.versao,
    aceitoEm: new Date().toISOString()
  };

  await setDoc(ref, registro);
  console.log(`✅ Aceite registrado: ${politica.titulo} v${politica.versao}`);
  return registro;
}