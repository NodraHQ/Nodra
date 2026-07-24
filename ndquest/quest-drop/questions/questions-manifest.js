/* =========================================================
   MANIFESTO DE PACOTES DE PERGUNTAS

   O script.js nunca precisa ser alterado para trocar ou
   adicionar perguntas. Para criar um novo pacote (ex.: um
   novo evento/parceiro):

   1. Duplique um arquivo desta pasta (ex.: demo.js) e
      renomeie usando o MESMO slug do tema de marca do parceiro
      (ex.: "questions/pagfinance.js" ↔ "branding/pagfinance/"),
      seguindo exatamente a mesma estrutura { name, questions: { easy, medium, hard } }.
   2. Importe o novo arquivo aqui embaixo.
   3. Adicione-o ao array "packs".

   O pacote aparecerá automaticamente no seletor da tela de
   configuração.
   ========================================================= */
import cryptoBasics from "./crypto-basics.js";
import avalanche from "./avalanche.js";
import pagfinance from "./pagfinance.js";
import stellar from "./stellar.js";
import bitgetWallet from "./bitget-wallet.js";
import amulets from "./amulets.js";
import evervalue from "./evervalue.js";

export const questionPacks = [
  cryptoBasics,
  avalanche,
  pagfinance,
  stellar,
  bitgetWallet,
  amulets,
  evervalue
];

export default questionPacks;
