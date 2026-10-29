// =================================================================
// certificado.js — Emissão de certificado
// - Exige login
// - Lê ?curso=X da URL
// - Se o curso TEM quiz: exige aprovação na avaliação
// - Se o curso NÃO tem quiz: exige conclusão das aulas
// - Gera código único e salva no Firestore
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let curso = null;
let userAtual = null;

// ---- 1. Exige login ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  userAtual = user;
  await emitirCertificado();
});

// ---- 2. Emitir o certificado ----
async function emitirCertificado() {
  const cursoId = new URLSearchParams(window.location.search).get('curso');
  if (!cursoId) {
    mostrarErro('Faltou o parâmetro ?curso=X na URL.');
    return;
  }

  // 2.1 — Buscar o curso
  try {
    const r = await fetch(`/dados/cursos/${cursoId}.json`);
    curso = await r.json();
  } catch (e) {
    console.error('❌ Erro ao carregar curso:', e);
    mostrarErro('Não foi possível carregar o curso.');
    return;
  }

  // 2.2 — Buscar o progresso do aluno
  const progRef = doc(db, 'progresso', `${userAtual.uid}_${cursoId}`);
  const progSnap = await getDoc(progRef);

  if (!progSnap.exists()) {
    mostrarErro('Você ainda não começou este curso.');
    return;
  }

  const progresso = progSnap.data();

  // 2.3 — Verificar requisitos (dois cenários)
  let percentualFinal = 100;

  if (curso.avaliacao) {
    // Curso COM quiz: exige aprovação
    if (!progresso.avaliacao?.aprovado) {
      mostrarErro('Você precisa ser aprovado na avaliação antes de emitir o certificado.');
      return;
    }
    percentualFinal = progresso.avaliacao.percentual;
  } else {
    // Curso SEM quiz: exige conclusão das aulas
    if (!progresso.concluido) {
      mostrarErro('Você precisa concluir todas as aulas antes de emitir o certificado.');
      return;
    }
  }

  // 2.4 — Reaproveitar ou gerar código único
  const codigo = await obterOuGerarCodigo(cursoId, progresso, percentualFinal);

  // 2.5 — Preencher a tela
  preencherCertificado(progresso, codigo, percentualFinal);

  // 2.6 — Botão de download
  document.getElementById('btnBaixar').addEventListener('click', () => {
    window.print();
  });
}

// ---- 3. Código único ----
async function obterOuGerarCodigo(cursoId, progresso, percentualFinal) {
  const q = query(
    collection(db, 'certificados'),
    where('uid', '==', userAtual.uid),
    where('cursoId', '==', cursoId)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  const codigo = gerarCodigo();
  const dataEmissao = new Date().toISOString();

  await setDoc(doc(db, 'certificados', codigo), {
    uid: userAtual.uid,
    nome: userAtual.displayName || progresso.nome || '',
    email: userAtual.email,
    cursoId,
    cursoTitulo: curso.titulo,
    percentual: percentualFinal,
    dataEmissao
  });

  console.log(`🎓 Certificado emitido: ${codigo}`);
  return codigo;
}

function gerarCodigo() {
  const ano = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let aleatorio = '';
  for (let i = 0; i < 4; i++) {
    aleatorio += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SVRI-${ano}-${aleatorio}`;
}

// ---- 4. Preencher a tela ----
function preencherCertificado(progresso, codigo, percentualFinal) {
  const nome = userAtual.displayName || progresso.nome || '(sem nome)';
  const data = new Date();

  document.getElementById('certNome').textContent = nome;
  document.getElementById('certCurso').textContent = curso.titulo;

  // Se curso tem quiz, mostra a nota. Se não tem, mostra "Concluído"
  const elNota = document.getElementById('certNota');
  if (curso.avaliacao) {
    elNota.textContent = `${percentualFinal}%`;
  } else {
    elNota.textContent = 'Concluído';
  }

  document.getElementById('certData').textContent = data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  document.getElementById('certCodigo').textContent = codigo;

  document.title = `Certificado — ${curso.titulo}`;
}

// ---- 5. Erro ----
function mostrarErro(msg) {
  document.getElementById('certificado').style.display = 'none';
  const el = document.getElementById('certErro');
  el.style.display = 'block';
  el.innerHTML = `
    <h2>Não foi possível emitir o certificado</h2>
    <p>${msg}</p>
    <a href="/paginas/cursos.html" class="btn-voltar">← Voltar ao catálogo</a>
  `;
}