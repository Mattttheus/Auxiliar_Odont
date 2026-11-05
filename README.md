# Auxiliar Odont — Sistema de Controle de Estoque

Sistema único de gestão de estoque, que roda **na rede local do consultório**: telas em HTML, CSS e
JavaScript, API em PHP ([api/](api/)) e banco MySQL, tudo no WAMP deste computador. Não depende de
serviços externos para guardar dados.

## Como acessar

| Onde | Endereço |
|---|---|
| Qualquer aparelho no Wi-Fi do consultório (`192.168.1.x`) | <http://192.168.1.51/Auxiliar_Odont/> |
| Banco de dados, só neste computador | <http://localhost/phpmyadmin/> (usuário `root`, sem senha, servidor **MySQL**) |

O WAMP precisa estar ligado. O IP `192.168.1.51` é o IP fixo do Wi-Fi deste computador; se mudar,
atualize a mensagem de erro em [assets/js/api.js](assets/js/api.js).

### Prévia no GitHub Pages

<https://mattttheus.github.io/Auxiliar_Odont/> abre o sistema em **modo de demonstração**, somente leitura: sem PHP
nem banco, as telas leem respostas gravadas em [previa/dados/](previa/dados/) ([assets/js/previa.js](assets/js/previa.js))
e nada é salvo. Os produtos e preços são os do catálogo; movimentações, fornecedores e cotações são simulados, e os
usuários, anonimizados. O resumo do projeto com prints fica em
<https://mattttheus.github.io/Auxiliar_Odont/documentacao/>.

Para conferir a prévia na rede local, abra qualquer tela com `?previa=1` (e `?previa=0` para voltar). Para atualizar os
dados, gere-os de uma **cópia** de demonstração com `php banco/gerar_previa.php <banco> <id do administrador>`; o banco
real é recusado, porque a prévia é pública.

O sistema funciona sem internet: as bibliotecas estão em [assets/vendor/](assets/vendor/) (Bootstrap 5.3.2,
Bootstrap Icons 1.10.5, Chart.js 4.6.1, qrcode-generator 1.4.4 e html5-qrcode 2.3.8, todas de licença MIT).

Limitação: a câmera do navegador só funciona com HTTPS ou em `localhost`. Pela rede, use um leitor USB de
código de barras ou digite o código.

## Instalar em outro computador

1. Instale o WAMP e copie esta pasta para `www/Auxiliar_Odont`.
2. No phpMyAdmin (servidor MySQL), importe [banco/auxiliar_odont.sql](banco/auxiliar_odont.sql), depois
   [banco/dados_planilha.sql](banco/dados_planilha.sql), com o estoque da planilha, e por fim
   [banco/precos_mercado_2026-11.sql](banco/precos_mercado_2026-11.sql), com o custo de referência de mercado dos materiais.
3. Abra o sistema e clique em **Criar conta**: a primeira conta vira administrador, e as próximas aguardam a
   aprovação dele em **Usuários**.

Se a planilha mudar antes da importação, gere os dados de novo com `python banco/gerar_dados_planilha.py`.

**Banco já em uso:** [banco/atualizar_gestao_financeira.sql](banco/atualizar_gestao_financeira.sql) acrescenta custos,
fornecedores, cotações, previsões mensais e envios por e-mail sem mexer no estoque. Os scripts podem ser importados de
novo; faça backup antes. O de preços de mercado só preenche produtos ainda sem custo.

## Gestão de estoque, a partir da planilha

O sistema opera com a mesma lógica de [Controle_de_Estoque.xlsx](Controle_de_Estoque.xlsx):

| Planilha | No sistema |
|---|---|
| Quantidade atual = estoque inicial + entradas − saídas | Cada movimentação atualiza o saldo; **Controle e Curva ABC → Conferência de saldo** recalcula e aponta diferenças |
| Status: abaixo do mínimo é 🔴 Repor, igual ao mínimo é 🟡 Atenção, acima é 🟢 Normal | Produtos, Dashboard, Curva ABC, menu lateral e Lista de Compras |
| Dashboard: totais por status e entradas e saídas por mês | Dashboard, com gráfico mensal e totais por status |
| Itens que precisam de reposição | Dashboard e Lista de Compras |
| Prefixo do código por categoria (01 Dentística, 02 Cirurgia, 03 Periodontia, 04 Endodontia, 05 Consumíveis, 06 Prótese, 07 Instrumental) | Produto novo sem código recebe o próximo da categoria, como `01-033` |
| Lista de unidades | Sugestões no cadastro de produtos |

## Funcionalidades

| Menu | O que faz |
|---|---|
| **Produtos** | Cadastro, filtros por status e validade, lotes, CSV |
| **Movimentar (QR)** | Entrada com lote e validade, saída consumindo primeiro o lote que vence antes (FEFO), por leitor ou código |
| **Caixa (PDV)** | Venda com carrinho: todos os itens saem juntos, ou nenhum |
| **Planejamento 30/60/90** | Previsão estatística do consumo (Holt, Croston ou média, conforme o histórico), nível de serviço pela curva ABC, estoque de segurança, demonstrativo de hoje e de 30/60/90 dias, saúde do estoque, compras indicativas com data de pedido e gasto previsto |
| **Lista de Compras** | Sugestão por estoque mínimo, consumo real e lotes vencendo, listas com fornecedor, pedido por e-mail, recebimento com o custo pago |
| **Cotações** (admin) | Solicitação de cotação por e-mail aos fornecedores cadastrados, quadro de preços, menor preço vence e vira lista de compra |
| **Fornecedores** | Cadastro com CNPJ conferido e avaliação: prazo real, cotações respondidas e compras de 12 meses |
| **Etiquetas QR** | Impressão de etiquetas com código, nome e localização |
| **Histórico** | Todas as ações e saídas, com filtros e CSV |
| **Controle e Curva ABC** (admin) | Curva ABC pelo consumo real, conferência de saldo, troca de nível e ativação de usuários |
| **Usuários** (admin) | Aprovação de cadastros, criação, edição, exclusão e senha temporária |
| **Financeiro** (admin) | Análise semanal, mensal, bimestral, trimestral e semestral (anteriores, atual com progresso e futuros), previsto × realizado, custos dos produtos e envios automáticos por e-mail (compras, aviso de estoque e análise) |

### Custos e gastos

Cada produto tem um custo médio. O ponto de partida é o preço de mercado pesquisado; depois, cada entrada com custo (em
Movimentar, no recebimento de uma lista ou pelo preço de uma cotação) recalcula a média ponderada. O gasto previsto usa o
último custo de compra. Custos e preços de compra só aparecem para o administrador; o histórico registra a alteração sem
o valor.

### E-mails automáticos

Não há tarefa agendada no Windows: o envio vencido sai na primeira vez que alguém usa o sistema depois do horário, sem
duplicar entre telas abertas, e uma falha tenta de novo depois de uma hora. Configure em **Financeiro → Envios
automáticos**; no Gmail, use uma senha de app. A conexão segura usa os certificados raiz do phpMyAdmin do WAMP
(ou `openssl.cafile` no php.ini).

## Níveis de usuário

| Permissão | Administrador | Cirurgião-dentista | Estoquista | Caixa | Usuário comum |
|---|---|---|---|---|---|
| Dashboard e consulta de produtos | Sim | Sim | Sim | Sim | Sim |
| Histórico | Sim | Sim | Sim | Sim | Não |
| Registrar saídas e vendas | Sim | Não | Sim | Sim | Não |
| Ver lista de compras, planejamento (quantidades) e fornecedores | Sim | Sim | Sim | Não | Não |
| Produtos, entradas, etiquetas QR, salvar/receber compras e cadastrar fornecedores | Sim | Não | Sim | Não | Não |
| Usuários, critérios, curva ABC e controle de acesso | Sim | Não | Não | Não | Não |
| Custos, gastos, cotações, financeiro e e-mails | Sim | Não | Não | Não | Não |

As regras valem no servidor ([api/nucleo.php](api/nucleo.php)); [assets/js/permissions.js](assets/js/permissions.js)
repete a mesma matriz só para decidir o que mostrar na tela. Internamente, o nível Caixa é gravado como `vendedor`.

## Senhas

As senhas ficam criptografadas no banco e ninguém consegue lê-las. Quem esqueceu pede a um administrador, que gera
uma senha temporária em **Usuários**; depois a pessoa troca em **Alterar senha**. Nunca coloque senhas neste
repositório, que é público.

## Arquivos antigos

[legacy-php/](legacy-php/) é a versão original em PHP e os scripts `supabase_*.sql` são da fase em nuvem. Ficam só como
referência: o endereço antigo redireciona para o sistema atual, e nada disso é usado.

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
- Cirurgião-dentista
- Estoquista
- Caixa
- Usuário comum

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

Backend/Dados (rede local):

- API em PHP com sessão no servidor
- MySQL (WAMP), com transações

Bibliotecas:

- Chart.js (gráficos)

1. BANCO DE DADOS

O sistema utiliza um banco de dados MySQL chamado:

auxiliar_odont

Entre as principais tabelas estão:

- usuarios
- produtos
- entradas_produtos
- saidas_produtos
- lotes
- historico
- listas_compra

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

- Backup automático;
- Leitura de QR Code pela câmera na rede local, com HTTPS.

1. CONCLUSÃO

O projeto Auxiliar Odont demonstrou como a tecnologia pode contribuir para otimizar processos administrativos em clínicas odontológicas.

Com a automação do controle de estoque, é possível reduzir erros, melhorar a organização e aumentar a eficiência no gerenciamento de materiais.

Dessa forma, o sistema atende às necessidades básicas de controle e ainda oferece possibilidades de expansão para versões futuras mais completas.
