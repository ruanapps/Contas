# Contas a Pagar

Webapp para organizar contas a pagar: lançamentos, contas quitadas, recorrência automática e visão por período. Funciona 100% no navegador — os dados ficam salvos no `localStorage` do próprio aparelho, sem servidor nem banco de dados externo.

## Rodando localmente

Não precisa instalar nada. Basta servir a pasta com um servidor estático simples (necessário para o service worker funcionar; abrir o `index.html` direto com duplo clique também funciona, mas sem cache offline).

Com Python já instalado:

```bash
cd contas-a-pagar
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador.

## Publicando no GitHub Pages (para instalar no celular)

1. Crie um repositório no GitHub e suba todos os arquivos desta pasta (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`).
2. No repositório, vá em **Settings → Pages**.
3. Em "Source", selecione a branch (`main`) e a pasta `/root`. Salve.
4. Aguarde alguns minutos até o GitHub gerar a URL (algo como `https://seu-usuario.github.io/nome-do-repo/`).
5. Abra essa URL no navegador do celular.
6. No Android (Chrome): menu ⋮ → **"Adicionar à tela inicial" / "Instalar app"**.
   No iPhone (Safari): botão de compartilhar → **"Adicionar à Tela de Início"**.

O app passa a se comportar como um aplicativo instalado, com ícone próprio e sem a barra do navegador.

### Se a instalação virar só um atalho (abre dentro do Chrome, com barra de endereço)

Isso quase sempre acontece porque o navegador não considerou o site "instalável" de verdade — e nesse caso ele
silenciosamente cai para um atalho simples, mesmo que o botão diga "Instalar". As causas mais comuns:

1. **Abriu o `index.html` direto (duplo clique) ou por `file://`.** Service worker e manifest só funcionam em
   `https://` ou em `http://localhost`. Um `file://` nunca instala como app de verdade.
2. **Acessou pelo IP local do computador** (ex.: `http://192.168.0.10:8000` no celular). Isso também não conta
   como contexto seguro. Funciona certinho no **GitHub Pages** (é `https://`) ou, para testar no próprio
   computador, acessando exatamente `http://localhost:8000` (não o IP).
3. **Cache/instalação antiga de uma tentativa anterior.** Se você já tinha tentado instalar antes, remova o atalho
   antigo do celular e, no Chrome, vá em **Configurações do site → Excluir dados do site** para esse endereço antes
   de tentar de novo (isso limpa qualquer service worker travado de antes).

**Como confirmar que está tudo certo antes de instalar:** no Chrome (celular ou desktop), abra o site publicado e
toque nos três pontinhos. Se aparecer a opção **"Instalar app"** com o ícone e nome do app (em vez de só
"Adicionar atalho"/"Adicionar à tela inicial" genérico), o navegador reconheceu o PWA corretamente. No desktop dá
pra checar em detalhe: F12 → aba **Application** → **Manifest**, que mostra se o manifest foi lido sem erros e se
o service worker está "activated and is running".

> **Importante:** como os dados ficam salvos no `localStorage` do navegador, cada aparelho/navegador tem seus próprios dados — não há sincronização automática entre dispositivos. Use a função de **Backup local** (exportar/importar `.xlsx`) para levar seus dados de um aparelho para outro.

> **Nota:** a geração/leitura das planilhas de backup usa uma biblioteca carregada de um CDN, então é necessário estar conectado à internet na primeira vez que essas telas forem abertas (depois, o service worker mantém em cache para uso offline).

## Funcionalidades

- **Lançar conta a pagar**: categoria, nome, valor original e vencimento são obrigatórios na criação. Valor pago, data de pagamento e observações podem ser preenchidos depois.
- **Abas "A Pagar" e "Pagas"**: listas separadas por status, com a conta mais próxima do vencimento (ou pagamento mais recente) no topo. Contas vencidas aparecem destacadas em vermelho.
- **Detalhe da conta**: toque em qualquer conta para ver todos os dados, com botões **Editar** e **Marcar como pago**.
  - **Editar** reabre o formulário de lançamento com os dados preenchidos.
  - **Marcar como pago** reabre o mesmo formulário com valor pago = valor original e data de pagamento = hoje, ambos editáveis antes de confirmar.
- **Cobrança recorrente**: ao marcar a caixa "Cobrança recorrente", o app gera automaticamente lançamentos mensais para os próximos 12 meses. Esse horizonte de 12 meses é mantido sempre à frente — a cada mês que passa, um novo lançamento é adicionado ao final da série. Ao desmarcar a recorrência de uma conta, o app pergunta se deseja excluir todas as cobranças futuras dessa série (mantendo a conta atual e as já pagas).
- **Aba "Por Período"**: navegação mês a mês e criação de filtros personalizados (categoria, status, intervalo de datas) que ficam fixados como chips reutilizáveis.
- **Sugestões de nome**: ao escolher a categoria, o campo "Nome da conta" passa a sugerir (mas não obriga) nomes já usados antes naquela mesma categoria — ex.: em "Assinaturas", sugere "Netflix", "Spotify"... se já tiverem sido lançados. O campo continua livre para digitar qualquer coisa.
- **Categorias personalizáveis**: ao selecionar a categoria (no lançamento ou nos filtros), há a opção "+ Criar nova categoria...". Também é possível abrir "Gerenciar categorias" para renomear ou excluir categorias — contas já lançadas acompanham o novo nome quando uma categoria é renomeada, e mantêm o nome antigo quando ela é excluída.
- **Campos de valor com máscara**: ao digitar o valor original ou o valor pago, o app formata automaticamente com vírgula e sempre 2 casas decimais (ex.: digitar "1234" vira "12,34"), no padrão brasileiro de moeda. Internamente, os valores são guardados como números inteiros de centavos (não em ponto flutuante), o que evita erros de arredondamento nas somas e totais — o ponto flutuante só aparece rapidamente na exportação/importação do backup em Excel, sempre com arredondamento explícito na volta.
- **Backup local (Excel)**: o botão ⇅ no topo abre a tela de backup. **Exportar** gera uma planilha `.xlsx` com todos os dados (contas, categorias e filtros) para você guardar onde quiser. **Importar** lê uma dessas planilhas e restaura os dados no aparelho — útil para trocar de celular ou recuperar informações. Importar substitui os dados atuais do app (o app pede confirmação antes).

## Estrutura de arquivos

```
contas-a-pagar/
├── index.html      → estrutura da página e dos modais
├── style.css        → tema visual
├── app.js            → toda a lógica (dados, recorrência, filtros, renderização)
├── manifest.json  → configuração de instalação como PWA
├── sw.js               → service worker (cache offline)
└── icons/               → ícones do app
```
