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
  apiKey: "AIzaSyB4_TQ5yVyZRQQXltm2bXKnDq16PBFp6GI",
  authDomain: "contas-c655b.firebaseapp.com",
  projectId: "contas-c655b",
  storageBucket: "contas-c655b.firebasestorage.app",
  messagingSenderId: "825846387960",
  appId: "1:825846387960:web:7b28a2a431af81e744970d",
};
