# Auxiliar Odont — Sistema de Controle de Estoque

Aplicação 100% estática (HTML + CSS + JavaScript) hospedada no **GitHub Pages**, usando
**Firebase (Authentication + Firestore)** como backend de dados — já que o GitHub Pages
não executa PHP nem hospeda MySQL. A versão original em PHP/MySQL foi preservada em
[legacy-php/](legacy-php/) apenas como referência histórica.

## Como publicar no GitHub Pages

1. **Crie um projeto no Firebase** (gratuito): <https://console.firebase.google.com>
   - Ative **Authentication → Sign-in method → Email/senha**.
   - Ative **Firestore Database** (modo produção).
2. Copie as credenciais em *Configurações do projeto → Seus apps → Web (`</>`)* e cole em
   [assets/js/firebase-config.js](assets/js/firebase-config.js).
3. No Firestore, configure as regras de segurança (Regras → cole o conteúdo abaixo):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function logado() { return request.auth != null; }
       function souAdmin() {
         return exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) &&
           get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'admin';
       }
       match /usuarios/{uid} {
         allow read: if logado();
         allow create: if request.auth.uid == uid || souAdmin();
         allow update, delete: if souAdmin() || request.auth.uid == uid;
       }
       match /produtos/{id} { allow read, write: if logado(); }
       match /entradas_produtos/{id} { allow read, write: if logado(); }
       match /saidas_produtos/{id} { allow read, write: if logado(); }
       match /historico/{id} { allow read, write: if logado(); }
     }
   }
   ```

4. Faça commit e push para o branch `main`.
5. No GitHub, vá em **Settings → Pages** e selecione **Deploy from a branch → main → / (root)**.
6. Acesse `https://mattttheus.github.io/Auxiliar_Odont/`, cadastre-se em **Criar conta**
   (o primeiro usuário criado vira administrador automaticamente).

## Limitações do modelo 100% estático

- Criar/editar contas de outros usuários exige que o admin esteja logado no navegador
  (feito via app Firebase secundário para não derrubar a sessão do admin).
- Excluir um usuário remove apenas o perfil no Firestore; a conta de login deve ser
  removida manualmente em *Firebase Console → Authentication*.
- Redefinição de senha de terceiros é feita por e-mail (`sendPasswordResetEmail`).

---

ROTEIRO DE APRESENTAÇÃO DO PROJETO
AUXILIAR ODONT — SISTEMA DE CONTROLE DE ESTOQUE

1. APRESENTAÇÃO DO PROJETO

O projeto “Auxiliar Odont” foi desenvolvido com o objetivo de facilitar o gerenciamento e controle de estoque de materiais odontológicos, oferecendo uma solução simples, segura e eficiente para monitoramento de entradas, saídas e administração de produtos.

O sistema foi desenvolvido utilizando as tecnologias PHP, MySQL, HTML, CSS, JavaScript e Bootstrap, permitindo uma interface intuitiva, responsiva e de fácil utilização.

O principal objetivo do projeto é reduzir falhas no controle manual de estoque, melhorar a organização dos materiais e auxiliar na tomada de decisão através de relatórios e gráficos.

1. PROBLEMA IDENTIFICADO

Muitos consultórios odontológicos realizam o controle de materiais de forma manual, utilizando planilhas ou anotações físicas, o que pode gerar:

- Perda de informações;
- Divergência no estoque;
- Dificuldade no controle de validade e quantidade;
- Falta de histórico de movimentações;
- Baixa produtividade administrativa.

Pensando nisso, foi desenvolvido o sistema Auxiliar Odont.

1. OBJETIVO DO SISTEMA

O sistema possui como objetivo principal automatizar o controle de estoque odontológico, permitindo:

- Cadastro e gerenciamento de produtos;
- Controle de entrada e saída de materiais;
- Histórico das movimentações realizadas;
- Controle de usuários com permissões;
- Dashboard administrativo com gráficos;
- Exportação de dados para CSV.

1. FUNCIONALIDADES PRINCIPAIS

4.1 Login Seguro
O sistema possui autenticação de usuários, permitindo acesso apenas mediante email e senha cadastrados.

Existe diferenciação de permissões entre:

- Administrador (admin)
- Usuário comum (user)

Isso garante maior segurança e controle das ações realizadas dentro do sistema.

4.2 Cadastro de Produtos (CRUD)
O sistema permite:

- Criar novos produtos;
- Visualizar produtos cadastrados;
- Editar informações;
- Excluir produtos.

Cada produto contém informações como:

- Nome;
- Descrição;
- Quantidade em estoque;
- Categoria;
- Data de cadastro.

4.3 Controle de Saídas
Ao retirar materiais do estoque, o sistema registra:

- Produto retirado;
- Quantidade;
- Usuário responsável;
- Data e horário da movimentação.

Esse histórico ajuda na rastreabilidade e auditoria do estoque.

4.4 Dashboard Inteligente
O sistema conta com um painel administrativo contendo gráficos desenvolvidos com Chart.js, permitindo:

- Visualização do estoque;
- Produtos com menor quantidade;
- Histórico de movimentações;
- Dados estatísticos do sistema.

4.5 Exportação CSV
Os dados do estoque podem ser exportados em formato CSV, facilitando:

- Relatórios;
- Auditorias;
- Compartilhamento das informações;
- Backup administrativo.

1. TECNOLOGIAS UTILIZADAS

Front-end:

- HTML5
- CSS3
- Bootstrap 5
- JavaScript (ES Modules)

Backend/Dados (nuvem):

- Firebase Authentication
- Firebase Firestore

Bibliotecas:

- Chart.js (gráficos)

(Versão legada em PHP + MySQL disponível em legacy-php/, mantida apenas como referência.)

1. BANCO DE DADOS

O sistema utiliza um banco de dados MySQL chamado:

estoque_db

Entre as principais tabelas estão:

- usuarios
- produtos
- historico_saida

O banco foi estruturado para garantir integridade e organização das informações.

1. DIFERENCIAIS DO PROJETO

Os principais diferenciais do sistema são:

- Interface simples e intuitiva;
- Controle seguro por login;
- Histórico completo das movimentações;
- Dashboard com gráficos em tempo real;
- Exportação de relatórios;
- Facilidade de expansão futura.

Além disso, o sistema pode receber futuras melhorias, como:

- Leitura de QR Code;
- Código de barras;
- Controle de validade dos produtos;
- Notificações de estoque mínimo;
- Backup automático.

1. CONCLUSÃO

O projeto Auxiliar Odont demonstrou como a tecnologia pode contribuir para otimizar processos administrativos em clínicas odontológicas.

Com a automação do controle de estoque, é possível reduzir erros, melhorar a organização e aumentar a eficiência no gerenciamento de materiais.

Dessa forma, o sistema atende às necessidades básicas de controle e ainda oferece possibilidades de expansão para versões futuras mais completas.
