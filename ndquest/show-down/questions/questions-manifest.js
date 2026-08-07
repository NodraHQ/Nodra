/* =========================================================
   MANIFESTO DE PACOTES DE PERGUNTAS — SHOW DOWN

   Cópia própria do formato usado no Quest Drop / Time Attack, mas
   arquivo independente — nada aqui importa nada de dentro das
   pastas quest-drop/ ou time-attack/. Pra adicionar outro pacote,
   copie o arquivo pra dentro desta pasta questions/ e adicione ele
   na lista abaixo.
   ========================================================= */

import cryptoBasics from './crypto-basics.js';
import avalanche from './avalanche.js';
import evervalue from './evervalue.js';
import stellar from './stellar.js';

const questionPacks = [
  cryptoBasics,
  avalanche,
  evervalue,
  stellar
];

export default questionPacks;
