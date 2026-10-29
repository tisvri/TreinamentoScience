// =================================================================
// firebase.js — Configuração e inicialização do Firebase
// Todas as páginas importam daqui. Nunca repita esta configuração.
// =================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth }     from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// ----- Configuração do projeto (não é senha, é identificador público) -----
const firebaseConfig = {
  apiKey: "AIzaSyCH3b539f67mq_OevHiJtc5TsYkhX_12RM",
  authDomain: "treinamento-science.firebaseapp.com",
  projectId: "treinamento-science",
  storageBucket: "treinamento-science.firebasestorage.app",
  messagingSenderId: "172201428983",
  appId: "1:172201428983:web:002dd752e0f806d37c10f2"
};

// ----- Inicialização -----
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);   // banco de dados
const auth = getAuth(app);        // autenticação

// ----- Exporta para qualquer página usar -----
export { app, db, auth };