# Limites e Custos — Firebase

**Projeto:** treinamento-science
**Plano atual:** Spark (gratuito)
**Data:** Outubro/2026

---

## 1. Limites do plano gratuito (Spark)

| Recurso | Limite |
|---|---|
| Armazenamento Firestore | 1 GiB (~1 GB) |
| Leituras de documentos | 50.000/dia |
| Escritas de documentos | 20.000/dia |
| Exclusões de documentos | 20.000/dia |
| Transferência de saída | 10 GiB/mês |

**Renovação:** diária (meia-noite, horário do Pacífico).

---

## 2. Uso atual do projeto

| Item | Estimativa |
|---|---|
| Documentos no Firestore | ~20 |
| Tamanho total | ~10 KB |
| % do limite gratuito | ~0,001% |

**Projeção com 100 colaboradores:**
- ~2.100 documentos
- ~1 MB
- ~0,1% do limite gratuito

**Projeção com 1.000 colaboradores:**
- ~21.000 documentos
- ~10 MB
- ~1% do limite gratuito

**Conclusão:** a plataforma suporta centenas de colaboradores sem custo.

---

## 3. O que acontece se ultrapassar o limite

**Não há cobrança automática.**

- O Google oferece **30 dias de carência** para decidir se faz upgrade.
- Se não fizer upgrade, o serviço **para de funcionar** até o próximo ciclo.
- Não há cobrança retroativa.

---

## 4. O plano Blaze (pago por uso)

Se um dia for necessário:

| Aspecto | Detalhe |
|---|---|
| Ativação | Manual (você decide) |
| Cobrança | Só pelo que ultrapassar o gratuito |
| Cartão de crédito | Obrigatório |
| Custo estimado (1.000 usuários) | < US$ 5/mês |

**Importante:** no Blaze, você **mantém os limites gratuitos**. Só paga o excedente.

---

## 5. Ferramentas de controle de gastos

### 5.1 Alertas de orçamento (budget alerts)

- **O que faz:** envia e-mail quando gasto atinge % do orçamento.
- **O que NÃO faz:** não pausa o serviço.
- **Onde configurar:** Firebase Console → Uso e faturamento → Detalhes e configurações → Orçamentos e alertas.

### 5.2 Limites de gasto por serviço (spend caps)

- **O que faz:** define um teto mensal para um serviço específico.
- **Quando atinge:** o serviço para de aceitar operações até o próximo mês.
- **Onde configurar:** Firebase Console → Uso e faturamento → Detalhes e configurações → Limites de gasto por serviço.
- **Exemplo:** Firestore com teto de US$ 5/mês.

### 5.3 Orçamento programático (avançado)

- Cloud Function que desliga o billing automaticamente ao atingir um valor.
- Requer conhecimento de Cloud Functions.

---

## 6. Recomendação para produção

Se migrar para Blaze:

1. Orçamento: US$ 10/mês (bem acima do previsto)
2. Alertas: 50%, 80%, 100%
3. Spend cap Firestore: US$ 10/mês
4. Revisar mensalmente nos primeiros 3 meses

---

## 7. Perguntas frequentes

### "Os dados ficam no Brasil?"

Sim. O Firestore foi criado na região `southamerica-east1` (São Paulo).

### "É seguro para LGPD?"

As regras do Firestore garantem que cada usuário acessa apenas os próprios dados. Logs registram acessos. Adequado para dados internos.

### "O que acontece se alguém tentar burlar?"

A validação é 100% no servidor. Mesmo que alguém tente se promover a admin pelo navegador, as regras do Firestore bloqueiam.

### "Qual o custo projetado em produção?"

Com 1.000 colaboradores ativos: menos de US$ 5/mês no plano Blaze. No plano Spark (atual): US$ 0.

---

## 8. Referências

- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firestore Usage and Limits](https://firebase.google.com/docs/firestore/quotas)
- [Avoid Surprise Bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)