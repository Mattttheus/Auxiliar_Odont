-- Leva um banco já em uso para a gestão financeira e o planejamento: custo médio,
-- fornecedores, cotações, previsões mensais e envios periódicos por e-mail. Não apaga nem
-- altera nenhum dado de estoque.
--
-- Como usar: faça um backup. No phpMyAdmin (servidor MySQL), abra o banco auxiliar_odont,
-- vá em Importar e escolha este arquivo. Pode ser importado de novo: o que já existe é mantido.
-- Instalação nova não precisa deste arquivo: auxiliar_odont.sql já cria tudo.

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

-- MySQL 8 não tem ADD COLUMN IF NOT EXISTS: cada bloco confere antes de alterar.
SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'custo_medio') = 0,
    'ALTER TABLE produtos ADD COLUMN custo_medio DECIMAL(12,4) NULL AFTER preco',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entradas_produtos' AND COLUMN_NAME = 'custo_unitario') = 0,
    'ALTER TABLE entradas_produtos ADD COLUMN custo_unitario DECIMAL(12,4) NULL AFTER quantidade, ADD COLUMN fornecedor_id INT NULL AFTER custo_unitario, ADD COLUMN fornecedor_nome VARCHAR(150) NULL AFTER fornecedor_id, ADD CONSTRAINT fk_entrada_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saidas_produtos' AND COLUMN_NAME = 'custo_unitario') = 0,
    'ALTER TABLE saidas_produtos ADD COLUMN custo_unitario DECIMAL(12,4) NULL AFTER quantidade, ADD COLUMN preco_unitario DECIMAL(10,2) NULL AFTER custo_unitario',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotacoes' AND COLUMN_NAME = 'prazo_resposta') = 0,
    'ALTER TABLE cotacoes ADD COLUMN prazo_resposta DATE NULL AFTER observacao, ADD COLUMN origem VARCHAR(20) NOT NULL DEFAULT ''manual'' AFTER prazo_resposta',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cotacao_fornecedores' AND COLUMN_NAME = 'enviado_em') = 0,
    'ALTER TABLE cotacao_fornecedores ADD COLUMN enviado_em DATETIME NULL, ADD COLUMN erro_envio TEXT NULL, ADD COLUMN prazo_entrega_dias INT NULL, ADD COLUMN observacao VARCHAR(255) NULL',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listas_compra' AND COLUMN_NAME = 'fornecedor_id') = 0,
    'ALTER TABLE listas_compra ADD COLUMN fornecedor_id INT NULL AFTER observacao, ADD COLUMN fornecedor_nome VARCHAR(150) NULL AFTER fornecedor_id, ADD COLUMN cotacao_id INT NULL AFTER fornecedor_nome, ADD CONSTRAINT fk_lista_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL, ADD CONSTRAINT fk_lista_cotacao FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listas_compra_itens' AND COLUMN_NAME = 'preco_unitario') = 0,
    'ALTER TABLE listas_compra_itens ADD COLUMN preco_unitario DECIMAL(12,4) NULL AFTER quantidade',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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

-- A primeira versão deste script guardava o agendamento junto do SMTP, em uma linha só. Ele
-- passou para envios_programados, que aceita vários envios; as colunas antigas nunca foram usadas.
SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'relatorio_email' AND COLUMN_NAME = 'frequencia') = 1,
    'ALTER TABLE relatorio_email DROP COLUMN ativo, DROP COLUMN destinatarios, DROP COLUMN frequencia, DROP COLUMN dia_semana, DROP COLUMN dia_mes, DROP COLUMN hora, DROP COLUMN proximo_envio, DROP COLUMN ultimo_erro',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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

SET @comando = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'relatorio_envios' AND COLUMN_NAME = 'tipo') = 0,
    'ALTER TABLE relatorio_envios MODIFY COLUMN origem ENUM(''automatico'',''manual'',''fornecedor'',''cotacao'') NOT NULL, ADD COLUMN tipo VARCHAR(20) NULL AFTER origem, ADD COLUMN programacao_id INT NULL AFTER tipo, ADD COLUMN assunto VARCHAR(200) NULL AFTER programacao_id',
    'DO 0');
PREPARE passo FROM @comando; EXECUTE passo; DEALLOCATE PREPARE passo;

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
