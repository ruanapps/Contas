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

> **Importante:** como os dados ficam salvos no `localStorage` do navegador, cada aparelho/navegador tem seus próprios dados — não há sincronização entre dispositivos nesta versão.

## Funcionalidades

- **Lançar conta a pagar**: categoria, nome, valor original e vencimento são obrigatórios na criação. Valor pago, data de pagamento e observações podem ser preenchidos depois.
- **Abas "A Pagar" e "Pagas"**: listas separadas por status, com a conta mais próxima do vencimento (ou pagamento mais recente) no topo. Contas vencidas aparecem destacadas em vermelho.
- **Detalhe da conta**: toque em qualquer conta para ver todos os dados, com botões **Editar** e **Marcar como pago**.
  - **Editar** reabre o formulário de lançamento com os dados preenchidos.
  - **Marcar como pago** reabre o mesmo formulário com valor pago = valor original e data de pagamento = hoje, ambos editáveis antes de confirmar.
- **Cobrança recorrente**: ao marcar a caixa "Cobrança recorrente", o app gera automaticamente lançamentos mensais para os próximos 12 meses. Esse horizonte de 12 meses é mantido sempre à frente — a cada mês que passa, um novo lançamento é adicionado ao final da série. Ao desmarcar a recorrência de uma conta, o app pergunta se deseja excluir todas as cobranças futuras dessa série (mantendo a conta atual e as já pagas).
- **Aba "Por Período"**: navegação mês a mês e criação de filtros personalizados (categoria, status, intervalo de datas) que ficam fixados como chips reutilizáveis.
- **Categorias personalizáveis**: ao selecionar a categoria (no lançamento ou nos filtros), há a opção "+ Criar nova categoria...". Também é possível abrir "Gerenciar categorias" para excluir categorias que não usa mais — contas já lançadas mantêm o nome da categoria mesmo se ela for excluída da lista.

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
