// =================================================================
// politica.js — Página dedicada de uma política
// - Lê ?id=X da URL
// - Mostra os dados da política
// - "Li e concordo" só libera após clicar em "Abrir documento"
// =================================================================

import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { registrarAcesso } from './registro.js';
import { buscarAceites, aceitarPolitica } from './aceite.js';

let politicaAtual = null;
let userAtual = null;
let abriuDocumento = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/paginas/login.html?redir=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  userAtual = user;
  await carregarPolitica();
});

async function carregarPolitica() {

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    mostrarErro('Faltou o parâmetro ?id=X na URL.');
    return;
  }

  // Buscar todas as políticas e encontrar a que interessa
  let politica;
  try {
    const r = await fetch('/dados/politicas.json');
    const politicas = (await r.json()).politicas;
    politica = politicas.find(p => p.id === id);
  } catch (e) {
    console.error('❌ Erro ao carregar políticas:', e);
    mostrarErro('Não foi possível carregar a política.');
    return;
  }

  if (!politica) {
    mostrarErro('Política não encontrada.');
    return;
  }

  politicaAtual = politica;
  document.title = politica.titulo;

  // Preencher cabeçalho
  document.getElementById('politicaTipo').textContent = politica.tipo || 'Documento';
  document.getElementById('politicaTitulo').textContent = politica.titulo;
  document.getElementById('politicaMeta').textContent =
    `${politica.area || ''} · Versão ${politica.versao || '1.0'} · ${formatarData(politica.data)}`;

  // Botão "Abrir documento"
  document.getElementById('btnAbrir').href = politica.arquivo;

  // Verificar se já aceitou
  const aceites = await buscarAceites(userAtual);
  const aceite = aceites[`${politica.id}_${politica.versao}`];
  if (aceite) {
    mostrarAceito(aceite);
    return;
  }

  // Mostrar conteúdo (formulário)
  document.getElementById('politicaConteudo').style.display = 'block';

  // ---- Botão "Abrir documento" ----
  document.getElementById('btnAbrir').addEventListener('click', () => {
    registrarAcesso(userAtual, politica.id, politica.titulo, 'politica');
    abriuDocumento = true;
    document.getElementById('btnAceitar').disabled = false;
    document.getElementById('avisoAbertura').style.display = 'none';
  });

  // ---- Botão "Li e concordo" ----
  document.getElementById('btnAceitar').addEventListener('click', async () => {
    if (!abriuDocumento) return;

    const confirma = confirm(
      `Você confirma que leu e concorda com a "${politica.titulo}" (versão ${politica.versao})?`
    );
    if (!confirma) return;

    const btn = document.getElementById('btnAceitar');
    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
      const registro = await aceitarPolitica(userAtual, politica);
      mostrarAceito(registro);
    } catch (e) {
      console.error('❌ Erro ao registrar aceite:', e);
      alert('Não foi possível registrar. Tente novamente.');
      btn.disabled = false;
      btn.textContent = '✍️ Li e concordo';
    }
  });
}

// ---- Quando já aceitou (ou acabou de aceitar) ----
function mostrarAceito(aceite) {
  document.getElementById('politicaConteudo').style.display = 'none';

  const el = document.getElementById('avisoAceito');
  el.style.display = 'block';
  document.getElementById('aceitoData').textContent =
    `Você aceitou a versão ${aceite.versao} em ${formatarDataHora(aceite.aceitoEm)}.`;
}

// ---- Erro ----
function mostrarErro(msg) {
  document.getElementById('politicaHeader').style.display = 'none';
  const el = document.getElementById('politicaErro');
  el.style.display = 'block';
  el.innerHTML = `
    <h2>Não foi possível carregar</h2>
    <p>${msg}</p>
    <a href="/paginas/politicas.html" class="btn-politica btn-politica-voltar">← Voltar para políticas</a>
  `;
}

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}