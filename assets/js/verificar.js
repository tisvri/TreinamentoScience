// =================================================================
// verificar.js — Verificação pública de certificado
// - Não exige login
// - Lê o código da URL (?codigo=SVRI-2026-XXXX) ou do input
// - Busca no Firestore (leitura pública)
// - Mostra os dados se encontrado
// =================================================================

import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const input = document.getElementById('inputCodigo');
const form = document.getElementById('formVerificar');
const resultado = document.getElementById('resultado');

// ---- 1. Se a URL já tem ?codigo=..., preenche e busca automaticamente ----
const params = new URLSearchParams(window.location.search);
const codigoInicial = params.get('codigo');
if (codigoInicial) {
  input.value = codigoInicial.toUpperCase();
  buscarCertificado(codigoInicial);
}

// ---- 2. Submit do formulário ----
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const codigo = input.value.trim().toUpperCase();
  if (!codigo) return;
  buscarCertificado(codigo);
});

// ---- 3. Busca o certificado ----
async function buscarCertificado(codigo) {
  resultado.innerHTML = '<p class="carregando">Buscando...</p>';

  try {
    const snap = await getDoc(doc(db, 'certificados', codigo));

    if (!snap.exists()) {
      mostrarNaoEncontrado(codigo);
      return;
    }

    mostrarEncontrado(snap.data(), codigo);

  } catch (e) {
    console.error('❌ Erro ao consultar certificado:', e);
    resultado.innerHTML = '<p class="erro">Erro ao consultar. Tente novamente.</p>';
  }
}

// ---- 4. Certificado válido ----
function mostrarEncontrado(dados, codigo) {
  const dataFormatada = new Date(dados.dataEmissao).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  resultado.innerHTML = `
    <div class="resultado-card valido">
      <div class="resultado-status">✅ Certificado válido</div>

      <div class="resultado-dados">
        <div class="resultado-linha">
          <span class="resultado-label">Nome</span>
          <span class="resultado-valor">${dados.nome || '—'}</span>
        </div>
        <div class="resultado-linha">
          <span class="resultado-label">Curso</span>
          <span class="resultado-valor">${dados.cursoTitulo || '—'}</span>
        </div>
        <div class="resultado-linha">
          <span class="resultado-label">Aproveitamento</span>
          <span class="resultado-valor">${dados.percentual}%</span>
        </div>
        <div class="resultado-linha">
          <span class="resultado-label">Data de emissão</span>
          <span class="resultado-valor">${dataFormatada}</span>
        </div>
        <div class="resultado-linha">
          <span class="resultado-label">Código</span>
          <span class="resultado-valor codigo">${codigo}</span>
        </div>
      </div>

      <p class="resultado-rodape">
        Este certificado foi emitido pela Science Valley Research Institute.
      </p>
    </div>
  `;
}

// ---- 5. Certificado não encontrado ----
function mostrarNaoEncontrado(codigo) {
  resultado.innerHTML = `
    <div class="resultado-card invalido">
      <div class="resultado-status">❌ Certificado não encontrado</div>
      <p class="resultado-msg">
        Não encontramos nenhum certificado com o código <strong>${codigo}</strong>.
      </p>
      <p class="resultado-msg pequeno">
        Verifique se digitou o código corretamente. Ele tem o formato <strong>SVRI-AAAA-XXXX</strong>.
      </p>
    </div>
  `;
}