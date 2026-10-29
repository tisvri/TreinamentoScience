// =================================================================
// registro.js — Registra acessos a documentos no Firestore
// =================================================================

import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export async function registrarAcesso(user, documentoId, documentoTitulo, categoria) {
  try {
    await addDoc(collection(db, 'acessos_documentos'), {
      uid: user.uid,
      email: user.email,
      nome: user.displayName || '',
      documentoId,
      documentoTitulo,
      categoria,       // 'politica' ou 'manual'
      data: new Date().toISOString()
    });
    console.log(`📋 Acesso registrado: ${documentoTitulo}`);
  } catch (e) {
    console.warn('⚠️ Não foi possível registrar acesso:', e);
  }
}