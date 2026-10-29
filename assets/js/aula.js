// =================================================================
// aula.js — Página de aula
// - Exige login
// - Lê o JSON do curso (aulas planas ou seções)
// - Carrega e salva progresso no Firestore
// - Mostra material de apoio
// - Mostra botão de avaliação/certificado quando concluir tudo
// - Suporta vídeos (iframe), mp4 local (<video>) e documentos (iframe modo PDF)
// =================================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ---- 1. Exige login ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const atual = window.location.pathname + window.location.search;
    window.location.href = `/paginas/login.html?redir=${encodeURIComponent(atual)}`;
    return;
  }
  await iniciarCurso(user);
});

// ---- 2. Inicializa a página do curso ----
async function iniciarCurso(user) {

  const cursoId = document.body.dataset.curso;
  if (!cursoId) {
    console.error('❌ Faltou data-curso="..." no <body>');
    return;
  }

  // ---- Buscar JSON do curso ----
  let curso;
  try {
    const r = await fetch(`/dados/cursos/${cursoId}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    curso = await r.json();
  } catch (e) {
    console.error('❌ Erro ao carregar o curso:', e);
    document.querySelector('.lessons-section').innerHTML =
      '<p style="color:red">Erro ao carregar o curso. Veja o console.</p>';
    return;
  }

  // ---- NORMALIZAR: transforma "aulas" ou "secoes" em lista única ----
  const render = [];
  const aulasPlanas = [];

  if (curso.secoes && Array.isArray(curso.secoes)) {
    curso.secoes.forEach(secao => {
      render.push({ tipo: 'titulo', texto: secao.titulo });
      secao.aulas.forEach(aula => {
        render.push({ tipo: 'aula', aula, indice: aulasPlanas.length });
        aulasPlanas.push(aula);
      });
    });
  } else if (curso.aulas && Array.isArray(curso.aulas)) {
    curso.aulas.forEach(aula => {
      render.push({ tipo: 'aula', aula, indice: aulasPlanas.length });
      aulasPlanas.push(aula);
    });
  } else {
    console.error('❌ JSON sem "aulas" nem "secoes"');
    return;
  }

  const totalAulas = aulasPlanas.length;

  // ---- Buscar progresso no Firestore ----
  const ref = doc(db, 'progresso', `${user.uid}_${cursoId}`);
  let assistidas = [];
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) assistidas = snap.data().aulasAssistidas || [];
  } catch (e) {
    console.error('❌ Erro ao buscar progresso:', e);
  }

  // ---- Elementos da página ----
  const container = document.getElementById('videoContainer');
  const lista     = document.getElementById('listaAulas');
  const btnAnt    = document.getElementById('btnAnterior');
  const btnProx   = document.getElementById('btnProximo');
  const h2        = document.getElementById('tituloCurso');

  let atual = 0;

  // ---- Montar lista (com cabeçalhos, se houver seções) ----
  render.forEach(item => {
    if (item.tipo === 'titulo') {
      const cab = document.createElement('div');
      cab.className = 'secao-titulo';
      cab.textContent = item.texto;
      lista.appendChild(cab);
    } else {
      const div = document.createElement('div');
      div.className = 'lesson';
      if (assistidas.includes(item.indice)) div.classList.add('concluida');
      div.dataset.indice = item.indice;
      div.innerHTML = `
        <span class="lesson-title">${item.aula.titulo}</span><br>
        <span class="lesson-duration">${item.aula.duracao || ''}</span>
      `;
      div.addEventListener('click', () => irPara(item.indice));
      lista.appendChild(div);
    }
  });

  // ---- Atualiza título + botões de próximo passo ----
  function atualizarTitulo() {
    document.title = curso.titulo;
    h2.textContent = `${curso.titulo} — ${assistidas.length} de ${totalAulas} aulas`;

    document.querySelectorAll('.btn-proximo-passo').forEach(el => el.remove());

    if (curso.avaliacao && assistidas.length === totalAulas) {
      const btnAv = document.createElement('a');
      btnAv.href = `/paginas/avaliacao.html?curso=${cursoId}`;
      btnAv.className = 'BtnMenu btn-proximo-passo';
      btnAv.textContent = '✅ Fazer avaliação';
      btnAv.style.cssText = 'display:block; margin:20px auto 0; text-align:center; width:fit-content;';
      document.querySelector('.lessons-section').appendChild(btnAv);
    }

    if (!curso.avaliacao && curso.certificado && assistidas.length === totalAulas) {
      const btnCert = document.createElement('a');
      btnCert.href = `/paginas/certificado.html?curso=${cursoId}`;
      btnCert.className = 'BtnMenu btn-proximo-passo';
      btnCert.textContent = '🎓 Emitir certificado';
      btnCert.style.cssText = 'display:block; margin:20px auto 0; text-align:center; width:fit-content;';
      document.querySelector('.lessons-section').appendChild(btnCert);
    }
  }

  // ---- Detecta o tipo e injeta o player correto ----
  function injetarVideo(aula) {
    container.innerHTML = '';

    const url = aula.video;
    const ehArquivoLocal = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
    const ehDocumento = aula.tipo === 'documento';

    if (ehArquivoLocal) {
      // Arquivo local → <video>
      const video = document.createElement('video');
      video.controls = true;
      video.src = url;
      video.setAttribute('controlsList', 'nodownload');
      video.setAttribute('title', aula.titulo);
      container.appendChild(video);
      container.className = 'video-normal';

    } else if (ehDocumento) {
      // Documento (PDF, Word, etc.) → iframe em modo documento
      const iframe = document.createElement('iframe');
      iframe.title = aula.titulo;
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'yes');
      iframe.setAttribute('allowfullscreen', '');
      iframe.src = url;
      container.appendChild(iframe);
      container.className = 'video-documento';

    } else {
      // Vídeo externo (SharePoint, YouTube) → <iframe> normal
      const iframe = document.createElement('iframe');
      iframe.title = aula.titulo;
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allowfullscreen', '');
      iframe.src = url;
      container.appendChild(iframe);
      container.className = 'video-normal';
    }
  }

  // ---- Trocar de aula ----
  async function irPara(indice) {
    atual = indice;
    injetarVideo(aulasPlanas[indice]);

    document.querySelectorAll('.lesson').forEach(el => {
      el.classList.toggle('ativo', parseInt(el.dataset.indice) === indice);
    });

    btnAnt.style.display  = indice === 0 ? 'none' : 'inline-block';
    btnProx.style.display = indice === totalAulas - 1 ? 'none' : 'inline-block';

    if (!assistidas.includes(indice)) {
      assistidas.push(indice);
      const el = document.querySelector(`.lesson[data-indice="${indice}"]`);
      if (el) el.classList.add('concluida');
      atualizarTitulo();
      await salvarProgresso(user, cursoId, assistidas, totalAulas);
    }
  }

  // ---- Botões Anterior / Próximo ----
  btnAnt.addEventListener('click', e => {
    e.preventDefault();
    if (atual > 0) irPara(atual - 1);
  });
  btnProx.addEventListener('click', e => {
    e.preventDefault();
    if (atual < totalAulas - 1) irPara(atual + 1);
  });

  // ---- Material de apoio ----
  if (curso.material) {
    let itens;
    if (typeof curso.material === 'string') {
      itens = [{ texto: 'Abrir material', url: curso.material }];
    } else if (Array.isArray(curso.material)) {
      itens = curso.material;
    } else {
      itens = [curso.material];
    }

    const secao = document.querySelector('.lessons-section');
    itens.forEach(mat => {
      const link = document.createElement('a');
      link.href        = mat.url;
      link.target      = '_blank';
      link.rel         = 'noopener';
      link.className   = 'BtnMenu';
      link.textContent = '📄 ' + mat.texto;
      link.style.cssText = 'display: block; margin: 10px auto 0; text-align: center; width: fit-content;';
      secao.appendChild(link);
    });
  }

  // ---- Iniciar ----
  atualizarTitulo();
  irPara(0);
  console.log(`✅ ${curso.titulo}: ${assistidas.length}/${totalAulas} aulas concluídas.`);
}

// ---- 3. Salvar progresso ----
async function salvarProgresso(user, cursoId, assistidas, total) {
  try {
    await setDoc(doc(db, 'progresso', `${user.uid}_${cursoId}`), {
      uid:             user.uid,
      email:           user.email,
      nome:            user.displayName || '',
      cursoId:         cursoId,
      aulasAssistidas: [...assistidas].sort((a, b) => a - b),
      atualizadoEm:    new Date().toISOString(),
      concluido:       assistidas.length === total
    }, { merge: true });
    console.log(`💾 Progresso salvo: ${assistidas.length}/${total}`);
  } catch (e) {
    console.error('❌ Erro ao salvar progresso:', e);
  }
}