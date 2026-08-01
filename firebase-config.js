/* =========================================================
   Configuração do Firebase deste app.
   ========================================================= 

   Substitua os valores abaixo pelos do SEU projeto Firebase:
   Console do Firebase → Configurações do projeto (ícone de engrenagem)
   → aba "Geral" → seção "Seus apps" → app Web → "SDK setup and configuration".

   Esses valores (apiKey, authDomain, etc.) NÃO são segredos — o Firebase
   foi desenhado para que essa configuração fique pública no código do
   navegador. Quem protege os dados de verdade são as regras de segurança
   do Firestore (veja o README), não esconder essas chaves. Por isso é
   seguro deixar este arquivo no repositório público do GitHub.

   Enquanto os valores abaixo não forem substituídos, a sincronização na
   nuvem fica desativada e o app continua funcionando 100% localmente,
   como antes.
   ========================================================= */

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};
