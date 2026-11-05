-- Banco do sistema Auxiliar Odont, no MySQL do WAMP.
--
-- Como usar: phpMyAdmin (http://localhost/phpmyadmin/, servidor MySQL) > Importar > este arquivo.
-- Depois, importe dados_planilha.sql para carregar o estoque de Controle_de_Estoque.xlsx.
-- Pode ser importado de novo: não apaga nem altera o que já existe.
--
-- Não há usuário padrão, pois este arquivo é público: quem se cadastrar primeiro no
-- sistema vira administrador.
--
-- ENGINE=InnoDB é obrigatório: as movimentações usam transações, e este MySQL cria
-- tabelas MyISAM por padrão, que ignoram transações e chaves estrangeiras.

CREATE DATABASE IF NOT EXISTS auxiliar_odont
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE auxiliar_odont;

-- role: 'vendedor' é o nível Caixa e 'dentista' é o Cirurgião-dentista.
-- perfil_solicitado preenchido com ativo = 0 significa "aguardando aprovação".
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(11) NULL,
    role ENUM('admin','dentista','estoquista','vendedor','comum') NOT NULL DEFAULT 'comum',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    perfil_solicitado ENUM('dentista','estoquista','vendedor','comum') NULL,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Mesma lógica da planilha: quantidade = estoque_inicial + entradas - saídas (e ajustes).
CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    custo_medio DECIMAL(12,4) NULL,
    estoque_inicial INT NOT NULL DEFAULT 0,
    quantidade INT NOT NULL DEFAULT 0,
    unidade VARCHAR(30) NULL,
    estoque_minimo INT NOT NULL DEFAULT 5,
    categoria VARCHAR(60) NULL,
    localizacao VARCHAR(100) NULL,
    validade DATE NULL,
    codigo_barras VARCHAR(100) NULL UNIQUE,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_produto_nome (nome),
    INDEX idx_validade (validade)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    lote VARCHAR(60) NOT NULL DEFAULT 'S/L',
    validade DATE NULL,
    quantidade INT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lote_produto_validade (produto_id, validade),
    CONSTRAINT fk_lote_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fornecedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(14) NULL UNIQUE,
    contato VARCHAR(100) NULL,
    email VARCHAR(150) NULL,
    telefone VARCHAR(11) NULL,
    endereco VARCHAR(200) NULL,
    prazo_entrega_dias INT NULL,
    condicao_pagamento VARCHAR(100) NULL,
    observacao TEXT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fornecedor_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entradas_produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    produto_nome VARCHAR(100) NULL,
    quantidade INT NOT NULL,
    custo_unitario DECIMAL(12,4) NULL,
    fornecedor_id INT NULL,
    fornecedor_nome VARCHAR(150) NULL,
    usuario_id INT NULL,
    usuario_nome VARCHAR(100) NULL,
    observacao TEXT NULL,
    lote VARCHAR(60) NULL,
    validade DATE NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'manual',
    data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entrada_data (data_entrada),
    CONSTRAINT fk_entrada_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    CONSTRAINT fk_entrada_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_entrada_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saidas_produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    produto_nome VARCHAR(100) NULL,
    quantidade INT NOT NULL,
    custo_unitario DECIMAL(12,4) NULL,
    preco_unitario DECIMAL(10,2) NULL,
    usuario_id INT NULL,
    usuario_nome VARCHAR(100) NULL,
    observacao TEXT NULL,
    lote TEXT NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'manual',
    data_saida DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_saida_data (data_saida),
    CONSTRAINT fk_saida_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    CONSTRAINT fk_saida_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Os nomes ficam gravados para o registro continuar legível depois de uma exclusão.
CREATE TABLE IF NOT EXISTS historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    usuario_nome VARCHAR(100) NULL,
    produto_id INT NULL,
    produto_nome VARCHAR(100) NULL,
    acao VARCHAR(50) NOT NULL,
    descricao TEXT NULL,
    quantidade INT NULL,
    origem VARCHAR(20) NULL,
    data_acao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_historico_data (data_acao),
    CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_historico_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Critérios de alerta e reposição: uma única linha.
CREATE TABLE IF NOT EXISTS configuracoes (
    id TINYINT PRIMARY KEY DEFAULT 1,
    dias_alerta_validade INT NOT NULL DEFAULT 30,
    janela_consumo_dias INT NOT NULL DEFAULT 90,
    dias_cobertura INT NOT NULL DEFAULT 30,
    dias_reposicao INT NOT NULL DEFAULT 7,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracoes (id) VALUES (1);

-- Solicitação de cotação: vai por e-mail a cada fornecedor; os preços respondidos são
-- digitados no quadro, o menor vence e vira uma lista de compra por fornecedor.
CREATE TABLE IF NOT EXISTS cotacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    status ENUM('aberta','concluida','cancelada') NOT NULL DEFAULT 'aberta',
    observacao TEXT NULL,
    prazo_resposta DATE NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'manual',
    criado_por INT NULL,
    criado_por_nome VARCHAR(100) NULL,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    concluida_em DATETIME NULL,
    CONSTRAINT fk_cotacao_usuario FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cotacao_fornecedores (
    cotacao_id INT NOT NULL,
    fornecedor_id INT NOT NULL,
    enviado_em DATETIME NULL,
    erro_envio TEXT NULL,
    prazo_entrega_dias INT NULL,
    observacao VARCHAR(255) NULL,
    PRIMARY KEY (cotacao_id, fornecedor_id),
    CONSTRAINT fk_cotforn_cotacao FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cotforn_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cotacao_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cotacao_id INT NOT NULL,
    produto_id INT NULL,
    produto_nome VARCHAR(100) NOT NULL,
    unidade VARCHAR(30) NULL,
    quantidade INT NOT NULL,
    fornecedor_escolhido_id INT NULL,
    UNIQUE KEY uq_cotacao_produto (cotacao_id, produto_id),
    CONSTRAINT fk_cotitem_cotacao FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cotitem_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
    CONSTRAINT fk_cotitem_fornecedor FOREIGN KEY (fornecedor_escolhido_id) REFERENCES fornecedores(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cotacao_precos (
    item_id INT NOT NULL,
    fornecedor_id INT NOT NULL,
    preco_unitario DECIMAL(12,4) NOT NULL,
    PRIMARY KEY (item_id, fornecedor_id),
    CONSTRAINT fk_cotpreco_item FOREIGN KEY (item_id) REFERENCES cotacao_itens(id) ON DELETE CASCADE,
    CONSTRAINT fk_cotpreco_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS listas_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    status ENUM('aberta','enviada','recebida','cancelada') NOT NULL DEFAULT 'aberta',
    observacao TEXT NULL,
    fornecedor_id INT NULL,
    fornecedor_nome VARCHAR(150) NULL,
    cotacao_id INT NULL,
    criado_por INT NULL,
    criado_por_nome VARCHAR(100) NULL,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    recebida_em DATETIME NULL,
    CONSTRAINT fk_lista_usuario FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_lista_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL,
    CONSTRAINT fk_lista_cotacao FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS listas_compra_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lista_id INT NOT NULL,
    produto_id INT NULL,
    produto_nome VARCHAR(100) NOT NULL,
    unidade VARCHAR(30) NULL,
    quantidade_sugerida INT NOT NULL DEFAULT 0,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(12,4) NULL,
    motivo TEXT NULL,
    CONSTRAINT fk_item_lista FOREIGN KEY (lista_id) REFERENCES listas_compra(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Servidor de e-mail (SMTP): uma única linha. A senha nunca volta para a tela.
CREATE TABLE IF NOT EXISTS relatorio_email (
    id TINYINT PRIMARY KEY DEFAULT 1,
    smtp_host VARCHAR(150) NULL,
    smtp_porta INT NOT NULL DEFAULT 587,
    smtp_seguranca ENUM('tls','ssl','nenhuma') NOT NULL DEFAULT 'tls',
    smtp_usuario VARCHAR(150) NULL,
    smtp_senha VARCHAR(255) NULL,
    remetente_email VARCHAR(150) NULL,
    remetente_nome VARCHAR(100) NOT NULL DEFAULT 'Auxiliar Odont',
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO relatorio_email (id) VALUES (1);

-- Envios periódicos: compras a fazer, avisos de estoque e análise financeira e preditiva.
-- dia_semana: 1 = segunda ... 7 = domingo. Bimestral, trimestral e semestral saem no
-- dia_mes do primeiro mês de cada período (jan, mar, mai... / jan, abr, jul, out / jan, jul).
CREATE TABLE IF NOT EXISTS envios_programados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('compras','estoque','analise') NOT NULL,
    frequencia ENUM('diaria','semanal','quinzenal','mensal','bimestral','trimestral','semestral') NOT NULL DEFAULT 'semanal',
    dia_semana TINYINT NOT NULL DEFAULT 1,
    dia_mes TINYINT NOT NULL DEFAULT 1,
    hora TINYINT NOT NULL DEFAULT 8,
    destinatarios TEXT NOT NULL,
    incluir_valores TINYINT(1) NOT NULL DEFAULT 0,
    cotar_fornecedores TINYINT(1) NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    proximo_envio DATETIME NULL,
    ultimo_envio DATETIME NULL,
    ultimo_erro TEXT NULL,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS relatorio_envios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enviado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    origem ENUM('automatico','manual','fornecedor','cotacao') NOT NULL,
    tipo VARCHAR(20) NULL,
    programacao_id INT NULL,
    assunto VARCHAR(200) NULL,
    destinatarios TEXT NULL,
    periodo_inicio DATETIME NULL,
    periodo_fim DATETIME NULL,
    ok TINYINT(1) NOT NULL,
    erro TEXT NULL,
    INDEX idx_envio_data (enviado_em)
) ENGINE=InnoDB;

-- O que o sistema previu para cada mês, gravado na primeira consulta do mês, para a análise
-- financeira comparar com o realizado.
CREATE TABLE IF NOT EXISTS planejamento_previsoes (
    mes CHAR(7) PRIMARY KEY,
    gerado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    base_dias INT NOT NULL,
    consumo_un DECIMAL(14,2) NOT NULL,
    consumo_valor DECIMAL(14,2) NOT NULL,
    compras_valor DECIMAL(14,2) NOT NULL
) ENGINE=InnoDB;
