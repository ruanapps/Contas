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

1. Crie um repositório no GitHub e suba **todos os arquivos desta pasta soltos na raiz do repositório**
   (não dentro de uma subpasta) — `index.html`, `style.css`, `app.js`, `firebase-config.js`, `manifest.json`, `sw.js` e os `icon-*.png`.
   Se você arrastar os arquivos direto para a página do GitHub, é exatamente isso que acontece por padrão.
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

1. **Os ícones não estão no caminho que o `manifest.json` espera.** O erro mais comum: subir os arquivos
   `icon-*.png` dentro de uma pasta `icons/` enquanto o manifest aponta para o caminho errado (ou vice-versa) —
   o navegador não consegue carregar nenhum ícone, considera o manifest inválido e cai no modo atalho. Confira em
   `https://SEU-USUARIO.github.io/SEU-REPO/icon-192.png` se a imagem abre direto no navegador; se der 404, é isso.
   **Nesta versão, todos os arquivos (inclusive os ícones) ficam soltos na raiz do projeto**, sem pasta `icons/`,
   para evitar esse problema.
2. **Abriu o `index.html` direto (duplo clique) ou por `file://`.** Service worker e manifest só funcionam em
   `https://` ou em `http://localhost`. Um `file://` nunca instala como app de verdade.
3. **Acessou pelo IP local do computador** (ex.: `http://192.168.0.10:8000` no celular). Isso também não conta
   como contexto seguro. Funciona certinho no **GitHub Pages** (é `https://`) ou, para testar no próprio
   computador, acessando exatamente `http://localhost:8000` (não o IP).
4. **Cache/instalação antiga de uma tentativa anterior.** Se você já tinha tentado instalar antes, remova o atalho
   antigo do celular e, no Chrome, vá em **Configurações do site → Excluir dados do site** para esse endereço antes
   de tentar de novo (isso limpa qualquer service worker travado de antes).

**Como confirmar que está tudo certo antes de instalar:** no Chrome (celular ou desktop), abra o site publicado e
toque nos três pontinhos. Se aparecer a opção **"Instalar app"** com o ícone e nome do app (em vez de só
"Adicionar atalho"/"Adicionar à tela inicial" genérico), o navegador reconheceu o PWA corretamente. No desktop dá
pra checar em detalhe: F12 → aba **Application** → **Manifest**, que mostra se o manifest foi lido sem erros (se
algum ícone não carregar, aparece um aviso ali) e se o service worker está "activated and is running".

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
- **Sincronização automática na nuvem (opcional)**: o botão ☁ no topo permite entrar com Google ou e-mail/senha. Depois de logado, os dados passam a sincronizar automaticamente entre todos os aparelhos onde você usar a mesma conta — sem precisar exportar/importar nada manualmente. Sem login, o app continua funcionando 100% local como antes. Veja como configurar na seção abaixo.

## Configurando a sincronização na nuvem (Firebase)

Esse recurso é opcional e desligado por padrão — sem configurar nada, o app funciona só com `localStorage`,
como sempre funcionou. Para ativar a sincronização entre aparelhos, você precisa criar (de graça) um projeto
Firebase próprio e colar as credenciais dele no app. Leva uns 10 minutos.

1. **Crie um projeto**: acesse [console.firebase.google.com](https://console.firebase.google.com), clique em
   "Adicionar projeto" e siga o assistente (pode desativar o Google Analytics, não é necessário).
2. **Registre um app Web**: na tela inicial do projeto, clique no ícone `</>` ("Web"), dê um apelido qualquer
   e clique em "Registrar app". O Firebase vai mostrar um objeto `firebaseConfig` com `apiKey`, `authDomain`
   etc. — copie esse objeto inteiro.
3. **Cole no app**: abra o arquivo `firebase-config.js` (neste projeto) e substitua os valores de exemplo pelos
   que você copiou.
4. **Ative os métodos de login**: no menu lateral do Firebase, vá em **Build → Authentication → Get started**.
   Na aba "Sign-in method", habilite **Google** (é só escolher um e-mail de suporte) e **E-mail/senha**.
5. **Autorize seu domínio do GitHub Pages**: ainda em Authentication, aba **Settings → Authorized domains**,
   clique em "Add domain" e adicione o domínio do seu site (ex.: `seu-usuario.github.io`). Sem isso, o login
   falha com erro de "domínio não autorizado".
6. **Crie o banco de dados**: no menu lateral, vá em **Build → Firestore Database → Criar banco de dados**.
   Escolha uma região (qualquer uma do Brasil serve bem) e comece em **modo de produção**.
7. **Configure as regras de segurança**: na aba "Regras" do Firestore, substitua o conteúdo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

   Essas regras são o que garante o isolamento: cada usuário logado só consegue ler ou escrever no próprio
   documento (`users/{seu-uid}`) — mesmo que tente adivinhar o link ou o ID de outra pessoa, o Firebase nega
   o acesso.
8. **Suba o `firebase-config.js` preenchido para o GitHub** (junto com os outros arquivos atualizados) e pronto.

> As chaves em `firebase-config.js` (apiKey, authDomain...) não são segredas — o Firebase foi desenhado para
> essa configuração ficar pública no código do navegador. A proteção de verdade vem das regras do passo 7, então
> não tem problema esse arquivo ficar num repositório público.

**Como funciona por baixo dos panos:** a primeira vez que você loga numa conta (Google ou e-mail), o app sobe os
dados que já estavam salvos localmente naquele aparelho para a nuvem. Em qualquer login seguinte — no mesmo
aparelho ou em outro — os dados da nuvem é que valem, e ficam sincronizados em tempo real: uma alteração feita
num aparelho aparece automaticamente nos outros em poucos segundos, sem precisar atualizar a página.

## Estrutura de arquivos

```
contas-a-pagar/
├── index.html            → estrutura da página e dos modais
├── style.css             → tema visual
├── app.js                → toda a lógica (dados, recorrência, filtros, sincronização, renderização)
├── firebase-config.js    → credenciais do SEU projeto Firebase (sincronização na nuvem, opcional)
├── manifest.json         → configuração de instalação como PWA
├── sw.js                 → service worker (cache offline)
└── icon-*.png            → ícones do app (soltos na raiz, junto dos demais arquivos)
```
