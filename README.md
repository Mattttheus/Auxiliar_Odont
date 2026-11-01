# Auxiliar Odont — Sistema de Controle de Estoque

Aplicação 100% estática (HTML + CSS + JavaScript) hospedada no **GitHub Pages**, usando
**Supabase (Authentication + Postgres)** como backend de dados — já que o GitHub Pages
não executa PHP nem hospeda MySQL. A versão original em PHP/MySQL foi preservada em
[legacy-php/](legacy-php/) apenas como referência histórica.

## Endereço oficial

**<https://mattttheus.github.io/Auxiliar_Odont/>** é o endereço fixo do sistema, igual para
todos, em qualquer rede. Não há IP para configurar: o GitHub Pages não oferece IP exclusivo,
e o IP do computador local (WAMP) só funciona na mesma rede, com o computador ligado e sem
HTTPS, o que também impede a câmera de ler QR Codes.

**O site abre, mas ninguém consegue entrar?** Veja se o projeto está pausado em
<https://supabase.com/dashboard> e clique em *Resume project*. O plano gratuito pausa o
projeto após uma semana sem atividade, e o endereço do banco deixa de existir enquanto isso. A rotina
[manter-supabase-ativo.yml](.github/workflows/manter-supabase-ativo.yml) evita a pausa
consultando o banco a cada 3 dias e avisa por e-mail se ele não responder.

**Senha do administrador:** ninguém consegue vê-la, pois o Supabase guarda só uma versão
criptografada, e ela nunca deve ficar no site ou neste repositório, que são públicos. Para saber
quem é o administrador, rode no SQL Editor `select nome, email from usuarios where role = 'admin';`.
Para criar uma senha nova, use *Esqueci minha senha* na tela de login.

## Acesso na rede local (WAMP)

Com o WAMP ligado, os aparelhos da rede `192.168.1.x` acessam pelo IP fixo do Wi-Fi deste computador:

| Endereço | O que é | Banco |
|---|---|---|
| `http://192.168.1.51/Auxiliar_Odont/` | Sistema atual, com curva ABC, níveis e QR Code | Supabase: precisa de internet e do projeto ativo |
| `http://192.168.1.51/Auxiliar_Odont/legacy-php/` | Versão antiga em PHP, mais simples, com níveis admin e user | MySQL local: funciona sem internet |

O banco da versão antiga é o `auxiliar_odont`, visível em <http://localhost/phpmyadmin/> (usuário `root`, sem
senha, acessível só deste computador). Para recriá-lo, importe
[estoque_db.sql](legacy-php/database/estoque_db.sql) e depois
[auxiliar_odont_dados_planilha.sql](legacy-php/database/auxiliar_odont_dados_planilha.sql), com os 96 produtos e
as saídas da planilha. Os dois bancos não trocam dados entre si. O `estoque_db` deste computador é do projeto
Auxiliar_Obras e não deve ser alterado.

## Níveis de usuário

| Permissão | Administrador | Cirurgião-dentista | Estoquista | Caixa | Usuário comum |
|---|---|---|---|---|---|
| Dashboard e consulta de produtos | Sim | Sim | Sim | Sim | Sim |
| Histórico | Sim | Sim | Sim | Sim | Não |
| Registrar saídas e vendas | Sim | Não | Sim | Sim | Não |
| Ver lista de compras | Sim | Sim | Sim | Não | Não |
| Produtos, entradas, etiquetas QR e salvar/receber compras | Sim | Não | Sim | Não | Não |
| Usuários, critérios, curva ABC e controle de acesso | Sim | Não | Não | Não | Não |

Internamente, o nível Caixa continua gravado como `vendedor` no banco. O nível Usuário comum
depende da migração v4.

## Como publicar no GitHub Pages

1. **Crie um projeto no Supabase** (gratuito): <https://supabase.com/dashboard>
2. Em **Authentication → Providers → Email**, ative o login por email/senha (e, para
   agilizar testes, pode desativar "Confirm email" em Authentication → Settings).
3. Em **SQL Editor**, execute os scripts abaixo **nesta ordem** (New query > colar >
   Run). Todos são idempotentes — pode rodar de novo sem medo de duplicar dados ou
   quebrar algo, mesmo que parte já tenha sido aplicada antes:
   1. [legacy-php/database/supabase_schema.sql](legacy-php/database/supabase_schema.sql)
      — cria as tabelas (`usuarios`, `produtos`, `entradas_produtos`, `saidas_produtos`,
      `historico`) e a segurança (RLS) inicial.
   2. [legacy-php/database/supabase_migration_v2_seguranca_estoque.sql](legacy-php/database/supabase_migration_v2_seguranca_estoque.sql)
      — garante os níveis de acesso (admin/estoquista/vendedor/dentista), código de
      barras, colunas de estoque (unidade, estoque mínimo, categoria, validade
      opcional) e fecha uma falha de segurança em que um usuário podia se
      autopromover a administrador chamando a API diretamente.
   3. (Opcional) [legacy-php/database/supabase_dados_planilha_estoque.sql](legacy-php/database/supabase_dados_planilha_estoque.sql)
      — importa os 96 produtos e o histórico de movimentações da planilha
      `Controle_de_Estoque.xlsx` para o banco, já com categoria e estoque mínimo
      preenchidos.
   4. [legacy-php/database/supabase_migration_v3_relatorio_final.sql](legacy-php/database/supabase_migration_v3_relatorio_final.sql)
      — alinha o banco ao Relatório Final do PI3: localização do item, **lotes com
      validade** (saída FEFO), movimentações transacionais no banco (RPC
      `registrar_movimentacao`, `registrar_venda`), auditoria automática de
      cadastro/edição/ajuste/exclusão, **critérios de reposição configuráveis**,
      **lista de compras automática** (`sugerir_lista_compras`) com listas salvas e
      recebimento (`receber_lista_compra`), e índices. Sem ela o sistema continua
      funcionando no modo antigo, mas lotes, listas de compra e critérios ficam
      indisponíveis (a tela avisa).
   5. [legacy-php/database/supabase_migration_v4_usuarios.sql](legacy-php/database/supabase_migration_v4_usuarios.sql)
      — **depois de publicar o site**: nível Usuário comum, telefone e nível solicitado
      no perfil, aprovação de cadastros garantida no banco, bloqueio de contas inativas
      pela API e exclusão completa de usuários (`excluir_usuario`).
4. Em **Settings → API Keys**, copie a **Project URL** e a chave **anon/publishable**
   (NUNCA a `service_role`/secret) e cole em
   [assets/js/supabase-config.js](assets/js/supabase-config.js).
5. Em **Authentication → URL Configuration**, defina **Site URL** como
   `https://mattttheus.github.io/Auxiliar_Odont/` e adicione
   `https://mattttheus.github.io/Auxiliar_Odont/**` em **Redirect URLs**. Sem isso, os
   links de confirmação de e-mail e de nova senha não voltam para o sistema.
6. Faça commit e push para o branch `main`.
7. No GitHub, vá em **Settings → Pages** e selecione **Deploy from a branch → main → / (root)**.
8. Acesse `https://mattttheus.github.io/Auxiliar_Odont/`, cadastre-se em **Criar conta**
   (o primeiro usuário criado vira administrador automaticamente; a partir do segundo,
   todo novo cadastro fica aguardando a aprovação de um admin, em **Usuários**).

## Funcionalidades (alinhadas ao Relatório Final)

| Relatório | Tela / banco |
|---|---|
| Entradas e saídas registradas | Produtos, **Movimentar (QR)**, Caixa (PDV): tudo passa pela função `registrar_movimentacao` (uma transação, com histórico e origem) |
| Lotes e datas de validade | Lote e validade na entrada; saída consome primeiro o lote que vence antes; botão *Lotes* em Produtos |
| Localização do componente | Campo *Localização* no produto, exibido na leitura do QR e nas etiquetas |
| QR Code para identificar e movimentar | **Etiquetas QR** (impressão, geração de códigos faltantes) + leitor contínuo com confirmação do item |
| Problemas de leitura nos testes (reflexo, distância) | Área de leitura menor, código aceito só após leituras repetidas, dica de vinil fosco e aproximação |
| Alertas de validade e reposição | Menu lateral e Dashboard, com prazo de validade configurável |
| Lista de compras automática | **Lista de Compras**: estoque mínimo + consumo real + lotes vencendo, critérios ajustáveis (admin), listas salvas, recebimento dá entrada no estoque |
| Relatórios com análise de dados | Dashboard (movimentações 30 dias, mais consumidos, situação por categoria) e CSV |
| Precedência do estoque (somente admin) | **Controle e Curva ABC**: classifica todos os produtos em A (até 80% do consumo), B (até 95%) e C pelo consumo real no período, com curva, filtros e CSV. Não exige migração |
| Controle de acesso (somente admin) | **Controle e Curva ABC**: troca de perfil, ativação/desativação de usuários e matriz do que cada perfil pode fazer. A conta desativada perde o acesso na próxima página aberta |
| Cadastro e gestão de usuários | **Criar conta** com dados validados (nome completo, e-mail, telefone, nível solicitado, senha forte) e aprovação por um admin; **Usuários** com aprovação, busca, filtros e redefinição de senha; **Esqueci minha senha** e **Alterar senha** para todos |

## Limitações do modelo 100% estático

- **Nunca** coloque a chave `service_role`/secret do Supabase no código do site: o GitHub
  Pages é público, então qualquer chave no repositório fica visível a qualquer visitante.
- Criar contas de outros usuários (tela Usuários, admin) exige que o admin esteja logado
  no navegador; é feito via client Supabase secundário (sem persistir sessão) para não
  derrubar a sessão do admin.
- Excluir um usuário remove o login e o perfil. Sem a migração v4, remove só o perfil: a
  conta de login deve ser removida em *Supabase → Authentication → Users* e, se a pessoa
  entrar antes disso, volta como cadastro aguardando aprovação.
- O e-mail de login não pode ser alterado pela tela: o navegador não tem permissão para
  isso. Altere em *Supabase → Authentication → Users*.
- Redefinição de senha de terceiros é feita por e-mail (`resetPasswordForEmail`).
- O banco impede remover, desativar ou rebaixar o **último** administrador ativo, e
  impede que um usuário comum altere a própria `role`/`ativo` mesmo chamando a API
  diretamente — essas regras vivem no banco (triggers/policies), não só na tela.

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

- Supabase Authentication
- Supabase Postgres (com Row Level Security)

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
