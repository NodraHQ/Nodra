/* =========================================================
   MANIFESTO DE PACOTES DE PERGUNTAS — SHOW DOWN

   Cópia própria do formato usado no Quest Drop / Time Attack, mas
   arquivo independente — nada aqui importa nada de dentro das
   pastas quest-drop/ ou time-attack/. Pra adicionar outro pacote,
   copie o arquivo pra dentro desta pasta questions/ e adicione ele
   na lista abaixo.
   ========================================================= */

import cryptoBasics from './crypto-basics.js';
import amulets from './amulets.js';
import avalanche from './avalanche.js';
import bitgetWallet from './bitget-wallet.js';
import evervalue from './evervalue.js';
import pagfinance from './pagfinance.js';
import stellar from './stellar.js';

const questionPacks = [
  cryptoBasics,
  amulets,
  avalanche,
  bitgetWallet,
  evervalue,
  pagfinance,
  stellar
];

export default questionPacks;
