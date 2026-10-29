// =================================================================
// avaliacao.js — Quiz local reutilizável
// - Lê ?curso=X da URL
// - Busca o JSON do curso, pega o campo "avaliacao"
// - Embaralha perguntas e alternativas
// - Corrige, salva no Firestore e oferece próximo passo
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

let curso = null;
let avaliacao = null;
let userAtual = null;
let perguntasEmbaralhadas = [];

// ---- 1. Exige login ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  userAtual = user;
  await carregarAvaliacao();
});

// ---- 2. Carrega o curso e a avaliação ----
async function carregarAvaliacao() {
  const cursoId = new URLSearchParams(window.location.search).get('curso');
  if (!cursoId) {
    mostrarErro('Faltou o parâmetro ?curso=X na URL.');
    return;
  }

  try {
    const r = await fetch(`/dados/cursos/${cursoId}.json`);
    curso = await r.json();
  } catch (e) {
    console.error('❌ Erro ao carregar curso:', e);
    mostrarErro('Não foi possível carregar o curso.');
    return;
  }

  avaliacao = curso.avaliacao;
  if (!avaliacao || !Array.isArray(avaliacao.perguntas)) {
    mostrarErro('Este curso não tem avaliação configurada.');
    return;
  }

  document.title = `Avaliação — ${curso.titulo}`;
  document.getElementById('tituloAvaliacao').textContent = `Avaliação — ${curso.titulo}`;
  document.getElementById('subtituloAvaliacao').textContent =
    `Responda as ${avaliacao.perguntas.length} perguntas. Você precisa acertar pelo menos ${avaliacao.notaMinima}% para ser aprovado.`;

  renderizarQuiz();
}

// ---- 3. Renderiza as perguntas (embaralhadas) ----
function renderizarQuiz() {
  // Cópia profunda para embaralhar sem alterar o original
  perguntasEmbaralhadas = avaliacao.perguntas.map(p => ({ ...p }));

  shuffle(perguntasEmbaralhadas);

  const container = document.getElementById('perguntasContainer');
  container.innerHTML = '';

  perguntasEmbaralhadas.forEach((pergunta, index) => {
    // Embaralhar as alternativas preservando o índice da correta
    const opcoesOriginais = pergunta.opcoes.map((texto, i) => ({ texto, correta: i === pergunta.correta }));
    shuffle(opcoesOriginais);
    pergunta._opcoes = opcoesOriginais;

    const div = document.createElement('div');
    div.className = 'pergunta';
    div.innerHTML = `
      <p class="pergunta-enunciado"><strong>${index + 1}.</strong> ${pergunta.enunciado}</p>
      <div class="pergunta-opcoes">
        ${opcoesOriginais.map((op, i) => `
          <label class="opcao">
            <input type="radio" name="q${index}" value="${i}">
            <span>${op.texto}</span>
          </label>
        `).join('')}
      </div>
    `;
    container.appendChild(div);
  });

  // Reset botões
  document.getElementById('btnVerificar').style.display = 'inline-block';
  document.getElementById('btnRefazer').style.display = 'none';
  document.getElementById('btnCertificado').style.display = 'none';
  document.getElementById('resultado').style.display = 'none';
}

// ---- 4. Submit ----
document.getElementById('formAvaliacao').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Verificar se respondeu tudo
  let naoRespondidas = 0;
  perguntasEmbaralhadas.forEach((_, i) => {
    if (!document.querySelector(`input[name="q${i}"]:checked`)) naoRespondidas++;
  });
  if (naoRespondidas > 0) {
    alert(`Você deixou ${naoRespondidas} pergunta(s) sem responder.`);
    return;
  }

  // Corrigir
  let acertos = 0;
  perguntasEmbaralhadas.forEach((pergunta, i) => {
    const escolhida = parseInt(document.querySelector(`input[name="q${i}"]:checked`).value);
    if (pergunta._opcoes[escolhida].correta) acertos++;
  });

  const total = perguntasEmbaralhadas.length;
  const pct = Math.round((acertos / total) * 100);
  const aprovado = pct >= (avaliacao.notaMinima || 70);

  // Salvar no Firestore (no mesmo doc de progresso)
  await salvarResultado(acertos, total, pct, aprovado);

  // Mostrar resultado
  mostrarResultado(acertos, total, pct, aprovado);
});

// ---- 5. Salva no Firestore ----
async function salvarResultado(acertos, total, pct, aprovado) {
  const cursoId = curso.id;
  const ref = doc(db, 'progresso', `${userAtual.uid}_${cursoId}`);
  try {
    const snap = await getDoc(ref);
    const dadosAtuais = snap.exists() ? snap.data() : {};

    await setDoc(ref, {
      ...dadosAtuais,
      uid: userAtual.uid,
      email: userAtual.email,
      nome: userAtual.displayName || '',
      cursoId,
      avaliacao: {
        acertos,
        total,
        percentual: pct,
        aprovado,
        data: new Date().toISOString()
      },
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    console.log(`💾 Resultado salvo: ${acertos}/${total} (${pct}%)`);
  } catch (e) {
    console.error('❌ Erro ao salvar resultado:', e);
  }
}

// ---- 6. Mostra o resultado na tela ----
function mostrarResultado(acertos, total, pct, aprovado) {
  const resultado = document.getElementById('resultado');
  resultado.style.display = 'block';
  resultado.className = 'avaliacao-resultado ' + (aprovado ? 'aprovado' : 'reprovado');

  resultado.innerHTML = `
    <h2>${aprovado ? '✅ Aprovado!' : '❌ Não foi dessa vez'}</h2>
    <p>Você acertou <strong>${acertos}</strong> de <strong>${total}</strong> perguntas (<strong>${pct}%</strong>).</p>
    ${aprovado
      ? `<p>Nota mínima: ${avaliacao.notaMinima}%. Você pode emitir seu certificado.</p>`
      : `<p>Nota mínima: ${avaliacao.notaMinima}%. Tente novamente — as perguntas serão embaralhadas.</p>`
    }
  `;

  document.getElementById('btnVerificar').style.display = 'none';

  if (aprovado) {
    const btnCert = document.getElementById('btnCertificado');
    btnCert.href = `/paginas/certificado.html?curso=${curso.id}`;
    btnCert.style.display = 'inline-block';
  } else {
    document.getElementById('btnRefazer').style.display = 'inline-block';
  }

  resultado.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---- 7. Refazer ----
document.getElementById('btnRefazer').addEventListener('click', () => {
  renderizarQuiz();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---- 8. Utilitários ----
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function mostrarErro(msg) {
  document.getElementById('tituloAvaliacao').textContent = 'Erro';
  document.getElementById('subtituloAvaliacao').textContent = msg;
  document.getElementById('formAvaliacao').style.display = 'none';
}