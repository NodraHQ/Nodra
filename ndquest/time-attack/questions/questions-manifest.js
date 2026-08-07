/* =========================================================
   MANIFESTO DE PACOTES DE PERGUNTAS — TIME ATTACK

   Cópia própria do formato usado no Quest Drop, mas arquivo
   independente — nada aqui importa nada de dentro da pasta
   quest-drop/. Pra adicionar outro pacote (inclusive um que já
   existe no Quest Drop), copie o arquivo pra dentro desta pasta
   questions/ e adicione ele na lista abaixo.
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
