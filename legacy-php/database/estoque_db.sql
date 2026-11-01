-- OBSOLETO: era o banco da versão antiga em PHP. Não importe: o sistema atual usa banco/auxiliar_odont.sql.
-- Mantido só como referência da estrutura original.

CREATE DATABASE IF NOT EXISTS auxiliar_odont
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE auxiliar_odont;

-- ======================================
-- TABELA DE USUÁRIOS
-- ======================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    role ENUM('admin','user') DEFAULT 'user',
    ativo TINYINT(1) DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- TABELA DE PRODUTOS
-- ======================================

CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,

    nome VARCHAR(100) NOT NULL,
    descricao TEXT,

    preco DECIMAL(10,2) DEFAULT 0.00,

    quantidade INT DEFAULT 0,

    unidade VARCHAR(30) NULL,

    estoque_minimo INT NOT NULL DEFAULT 5,

    categoria VARCHAR(60) NULL,

    validade DATE NULL,

    codigo_qr VARCHAR(255),

    codigo_barras VARCHAR(100) UNIQUE,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_produto_nome (nome),
    INDEX idx_validade (validade)
);

-- ======================================
-- ENTRADA DE PRODUTOS
-- ======================================

CREATE TABLE IF NOT EXISTS entradas_produtos (

    id INT AUTO_INCREMENT PRIMARY KEY,

    produto_id INT NOT NULL,

    quantidade INT NOT NULL,

    usuario_id INT,

    observacao TEXT,

    data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (produto_id)
        REFERENCES produtos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL
);

-- ======================================
-- SAÍDA DE PRODUTOS
-- ======================================

CREATE TABLE IF NOT EXISTS saidas_produtos (

    id INT AUTO_INCREMENT PRIMARY KEY,

    produto_id INT NOT NULL,

    quantidade INT NOT NULL,

    usuario_id INT,

    observacao TEXT,

    data_saida DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (produto_id)
        REFERENCES produtos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL
);

-- ======================================
-- HISTÓRICO GERAL
-- ======================================

-- usuario e produto_nome guardam os nomes da época: as telas de entrada e saída
-- registram por nome, e o registro continua legível se o produto for excluído.
CREATE TABLE IF NOT EXISTS historico (

    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario_id INT NULL,

    usuario VARCHAR(100) NULL,

    produto_id INT NULL,

    produto_nome VARCHAR(100) NULL,

    acao VARCHAR(50) NOT NULL,

    descricao TEXT,

    data_acao DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_historico_data (data_acao),

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    FOREIGN KEY (produto_id)
        REFERENCES produtos(id)
        ON DELETE SET NULL
);
