# Quest Drop

Ativação de evento em HTML, CSS e JavaScript puro (sem build, sem frameworks).

## Estrutura do projeto

```
/
├── index.html
├── style.css
├── script.js          → lógica do jogo (não precisa ser alterado para novos eventos)
│
├── assets/
│   ├── logos/          → logos usadas pelos temas de marca
│   ├── textures/        → texturas de fundo dos envelopes (opcional)
│   ├── images/          → outras imagens do projeto
│   ├── icons/           → ícones diversos
│   └── sounds/          → sons (se algum dia forem usados)
│
├── questions/            → pacotes de perguntas (conteúdo)
│   ├── questions-manifest.js
│   ├── demo.js
│   └── evervalue.js
│
└── branding/              → temas de marca (identidade visual)
    ├── branding-manifest.js
    ├── default/
    │   └── default.js
    └── evervalue/
        └── evervalue.js
```

`script.js` só conhece o conteúdo e a identidade visual através dos dois
arquivos de manifesto. Isso significa que, para cada novo evento, você
normalmente só edita `questions/` e `branding/` — o restante do projeto
permanece igual.

## Convenção de nomes (importante)

**O pacote de perguntas e o tema de marca de um mesmo parceiro devem
usar sempre o mesmo slug**, para nunca ficar em dúvida sobre qual
arquivo pertence a qual empresa:

```
questions/<slug>.js         →  ex.: questions/evervalue.js
branding/<slug>/<slug>.js   →  ex.: branding/evervalue/evervalue.js
```

Use o nome completo do parceiro como slug (evite abreviações como
"eva" — com várias empresas cadastradas, nomes genéricos ou
abreviados dificultam saber de cabeça o que é o que). O campo `name`
dentro de cada arquivo pode ter a formatação "bonita" que quiser
(ex.: `"EverValue"`); o slug é só o nome do arquivo/pasta no disco.

## Como adicionar um novo pacote de perguntas

1. Duplique `questions/demo.js` e renomeie usando o slug do parceiro
   (ex.: `questions/pagfinance.js`).
2. Preencha `name` e os arrays `easy`, `medium` e `hard` seguindo o mesmo
   formato já usado em `demo.js`.
3. Abra `questions/questions-manifest.js` e:
   - importe o novo arquivo no topo;
   - adicione-o ao array `packs`.
4. O pacote aparece automaticamente no seletor "Pacote de perguntas" da
   tela de configuração.

## Como adicionar um novo tema de marca

1. Duplique a pasta `branding/default/` e renomeie a pasta **e o arquivo
   dentro dela** usando o mesmo slug do pacote de perguntas do parceiro
   (ex.: `branding/pagfinance/pagfinance.js`).
2. Nesse arquivo, ajuste `name`, as `colors` (`primary`, `primaryLight`,
   `background`) e, se quiser, `slogan` (frase curta exibida no hero da
   tela de envelopes — deixe `null` para não exibir nenhuma).
3. Se o parceiro tiver logo, salve o arquivo em `assets/logos/` (ex.:
   `assets/logos/pagfinance.png`) e aponte `logo` para esse caminho.
   Se a logo tiver partes claras que ficariam "apagadas" sobre o papel
   claro do envelope, defina também `logoBackground` (uma cor escura de
   fundo atrás da logo dentro do envelope).
4. Se quiser uma textura de fundo para o envelope, salve em
   `assets/textures/` e aponte `envelopeTexture` para esse caminho.
   Caso não queira, deixe `envelopeTexture: null`.
5. Abra `branding/branding-manifest.js` e:
   - importe o novo arquivo no topo;
   - adicione-o ao array `themes`.
6. O tema aparece automaticamente no seletor "Tema da empresa" da tela
   de configuração.

## Observação sobre módulos ES

O projeto usa `import`/`export` para carregar pacotes e temas
dinamicamente. Por isso, `index.html` precisa ser aberto por um servidor
local (ex.: `python3 -m http.server`) em vez de aberto diretamente como
arquivo (`file://`), pois navegadores bloqueiam módulos ES nesse modo.
