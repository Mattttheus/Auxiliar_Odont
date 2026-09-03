CREATE DATABASE IF NOT EXISTS estoque_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE estoque_db;

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

    validade DATE NOT NULL,

    codigo_qr VARCHAR(255),

    codigo_barras VARCHAR(100) UNIQUE,

    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS historico (

    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario_id INT NULL,

    produto_id INT NULL,

    acao VARCHAR(50) NOT NULL,

    descricao TEXT,

    data_acao DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    FOREIGN KEY (produto_id)
        REFERENCES produtos(id)
        ON DELETE SET NULL
);

-- ======================================
-- ÍNDICES
-- ======================================

CREATE INDEX idx_produto_nome
ON produtos(nome);

CREATE INDEX idx_validade
ON produtos(validade);

CREATE INDEX idx_historico_data
ON historico(data_acao);

-- ======================================
-- USUÁRIO ADMIN PADRÃO
-- senha: 123456
-- hash gerado pelo password_hash()
-- ======================================

INSERT IGNORE INTO usuarios (
    nome,
    email,
    senha,
    role
) VALUES (
    'Administrador',
    'admin@local.com',
    '$2y$10$wH8J8KQm5vK4gZ7xJYzQ6e3h0z6P3GQ8N9Xz9k7k2vY5lG3mQ7W2K',
    'admin'
);