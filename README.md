# Auxiliar Odont — Sistema de Controle de Estoque

## Versão para GitHub Pages

O repositório agora possui uma versão estática pronta para publicação no GitHub Pages.

### O que mudou

- Foi criado um `index.html` compatível com GitHub Pages
- A interface está em português do Brasil (`lang="pt-BR"`)
- O sistema funciona no navegador com HTML, CSS e JavaScript
- Os dados da demonstração são armazenados em `localStorage`
- Há login demo, dashboard, CRUD de produtos, usuários, histórico e exportação CSV
- A publicação automática está configurada em `.github/workflows/deploy-pages.yml`

### Publicação no GitHub Pages

1. Envie as alterações para a branch principal
2. No GitHub, abra **Settings > Pages**
3. Em **Build and deployment**, selecione **GitHub Actions**
4. Aguarde a execução do workflow **Deploy GitHub Pages**

### Acesso de demonstração

- admin@local.com / 123456

## Projeto original

Projeto: Auxiliar Odont — sistema de controle de estoque desenvolvido em PHP e MySQL.
Inclui CRUD de produtos e usuários, dashboard com Chart.js, exportação CSV e histórico de saídas.

### Observação importante

O GitHub Pages não executa PHP ou MySQL.
Por isso, a versão online publicada neste repositório é uma adaptação estática para demonstração.
Para usar o sistema original com backend, continue utilizando PHP + MySQL e importe `database/estoque_db.sql` no phpMyAdmin.
ROTEIRO DE APRESENTAÇÃO DO PROJETO
AUXILIAR ODONT — SISTEMA DE CONTROLE DE ESTOQUE

1. APRESENTAÇÃO DO PROJETO

O projeto “Auxiliar Odont” foi desenvolvido com o objetivo de facilitar o gerenciamento e controle de estoque de materiais odontológicos, oferecendo uma solução simples, segura e eficiente para monitoramento de entradas, saídas e administração de produtos.

O sistema foi desenvolvido utilizando as tecnologias PHP, MySQL, HTML, CSS, JavaScript e Bootstrap, permitindo uma interface intuitiva, responsiva e de fácil utilização.

O principal objetivo do projeto é reduzir falhas no controle manual de estoque, melhorar a organização dos materiais e auxiliar na tomada de decisão através de relatórios e gráficos.

2. PROBLEMA IDENTIFICADO

Muitos consultórios odontológicos realizam o controle de materiais de forma manual, utilizando planilhas ou anotações físicas, o que pode gerar:

- Perda de informações;
- Divergência no estoque;
- Dificuldade no controle de validade e quantidade;
- Falta de histórico de movimentações;
- Baixa produtividade administrativa.

Pensando nisso, foi desenvolvido o sistema Auxiliar Odont.

3. OBJETIVO DO SISTEMA

O sistema possui como objetivo principal automatizar o controle de estoque odontológico, permitindo:

- Cadastro e gerenciamento de produtos;
- Controle de entrada e saída de materiais;
- Histórico das movimentações realizadas;
- Controle de usuários com permissões;
- Dashboard administrativo com gráficos;
- Exportação de dados para CSV.

4. FUNCIONALIDADES PRINCIPAIS

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

5. TECNOLOGIAS UTILIZADAS

Front-end:
- HTML5
- CSS3
- Bootstrap
- JavaScript

Back-end:
- PHP

Banco de Dados:
- MySQL

Bibliotecas:
- Chart.js (gráficos)

6. BANCO DE DADOS

O sistema utiliza um banco de dados MySQL chamado:

estoque_db

Entre as principais tabelas estão:

- usuarios
- produtos
- historico_saida

O banco foi estruturado para garantir integridade e organização das informações.

7. DIFERENCIAIS DO PROJETO

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

8. CONCLUSÃO

O projeto Auxiliar Odont demonstrou como a tecnologia pode contribuir para otimizar processos administrativos em clínicas odontológicas.

Com a automação do controle de estoque, é possível reduzir erros, melhorar a organização e aumentar a eficiência no gerenciamento de materiais.

Dessa forma, o sistema atende às necessidades básicas de controle e ainda oferece possibilidades de expansão para versões futuras mais completas.
