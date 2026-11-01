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

CREATE TABLE IF NOT EXISTS entradas_produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    produto_nome VARCHAR(100) NULL,
    quantidade INT NOT NULL,
    usuario_id INT NULL,
    usuario_nome VARCHAR(100) NULL,
    observacao TEXT NULL,
    lote VARCHAR(60) NULL,
    validade DATE NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'manual',
    data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entrada_data (data_entrada),
    CONSTRAINT fk_entrada_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    CONSTRAINT fk_entrada_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS saidas_produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    produto_nome VARCHAR(100) NULL,
    quantidade INT NOT NULL,
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

CREATE TABLE IF NOT EXISTS listas_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    status ENUM('aberta','enviada','recebida','cancelada') NOT NULL DEFAULT 'aberta',
    observacao TEXT NULL,
    criado_por INT NULL,
    criado_por_nome VARCHAR(100) NULL,
    criado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    recebida_em DATETIME NULL,
    CONSTRAINT fk_lista_usuario FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS listas_compra_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lista_id INT NOT NULL,
    produto_id INT NULL,
    produto_nome VARCHAR(100) NOT NULL,
    unidade VARCHAR(30) NULL,
    quantidade_sugerida INT NOT NULL DEFAULT 0,
    quantidade INT NOT NULL,
    motivo TEXT NULL,
    CONSTRAINT fk_item_lista FOREIGN KEY (lista_id) REFERENCES listas_compra(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
) ENGINE=InnoDB;
