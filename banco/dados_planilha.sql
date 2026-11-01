-- Dados de Controle_de_Estoque.xlsx para o banco auxiliar_odont. Gerado por gerar_dados_planilha.py.
-- Importe DEPOIS de auxiliar_odont.sql: phpMyAdmin (servidor MySQL) > Importar > este arquivo.
-- Pode ser importado de novo: produtos que já existem ficam como estão e os movimentos não se repetem.
-- "Quantidade atual" da planilha já desconta os movimentos abaixo: eles entram só como histórico.

USE auxiliar_odont;

INSERT IGNORE INTO produtos (codigo_barras, nome, unidade, estoque_inicial, quantidade, estoque_minimo, categoria)
VALUES
  ('01-001', 'Microbrush', 'Tubos', 20, 20, 5, 'Dentística'),
  ('01-002', 'Adesivo Universal', 'Tubos', 3, 3, 2, 'Dentística'),
  ('01-003', 'Ácido Fosfórico 37%', 'Tubos', 1, 0, 8, 'Dentística'),
  ('01-004', 'Ionômero de Vidro', 'Frasco', 3, 3, 4, 'Dentística'),
  ('01-005', 'Benzotop', 'Frasco', 4, 4, 2, 'Dentística'),
  ('01-006', 'Cimento reparador MTA (2 aplicações)', 'Frasco', 2, 2, 2, 'Dentística'),
  ('01-007', 'Cimento de hidróxido de cálcio (Dentística)', 'Frasco', 3, 3, 2, 'Dentística'),
  ('01-008', 'Banda matriz aço 7 mm', 'Unidade', 13, 13, 6, 'Dentística'),
  ('01-009', 'Banda matriz aço 5 mm', 'Unidade', 26, 26, 6, 'Dentística'),
  ('01-010', 'Inter-A (material restaurador intermediário)', 'Frasco', 1, 1, 2, 'Dentística'),
  ('01-011', 'Coroa Hable adulto', 'Pacote', 1, 1, 1, 'Dentística'),
  ('01-012', 'Coroa Hable pediátrica', 'Pacote', 1, 1, 1, 'Dentística'),
  ('01-013', 'Resina composta A1E', 'Unidade', 2, 2, 1, 'Dentística'),
  ('01-014', 'Resina composta A2E', 'Unidade', 2, 2, 2, 'Dentística'),
  ('01-015', 'Resina composta A3E', 'Unidade', 1, 1, 4, 'Dentística'),
  ('01-016', 'Resina composta A1B', 'Unidade', 1, 1, 1, 'Dentística'),
  ('01-017', 'Resina composta A2B', 'Unidade', 0, 0, 2, 'Dentística'),
  ('01-018', 'Resina composta A3B', 'Unidade', 0, 0, 4, 'Dentística'),
  ('01-019', 'Resina composta A3.5B', 'Unidade', 0, 0, 4, 'Dentística'),
  ('01-020', 'Forrador Dentinário Liner', 'Unidade', 0, 0, 2, 'Dentística'),
  ('01-021', 'Discos de lixa P/M/G com mandril', 'Pacote', 5, 5, 2, 'Dentística'),
  ('01-022', 'Disco de lixa M com mandril', 'Pacote', 1, 1, 2, 'Dentística'),
  ('01-023', 'Bloco de papel p/ espatulação', 'Bloco', 3, 3, 4, 'Dentística'),
  ('01-024', 'Arco Young plástico', 'Unidade', 2, 2, 2, 'Dentística'),
  ('01-025', 'Fio dental', 'Unidade', 9, 9, 6, 'Dentística'),
  ('01-026', 'Disco de lixa superfino s/ mandril', 'Pacote', 7, 7, 4, 'Dentística'),
  ('01-027', 'Disco de lixa grosso s/ mandril', 'Pacote', 4, 4, 4, 'Dentística'),
  ('01-028', 'Tira de poliéster p/ acabamento', 'Pacote', 14, 14, 4, 'Dentística'),
  ('01-029', 'Tira de poliéster transparente', 'Pacote', 15, 15, 4, 'Dentística'),
  ('01-030', 'Cunha de madeira', 'Pacote', 7, 7, 4, 'Dentística'),
  ('01-031', 'Papel carbono', 'Pacote', 70, 70, 8, 'Dentística'),
  ('01-032', 'Fio retrator', 'Unidade', 2, 2, 2, 'Dentística'),
  ('02-001', 'Esponja Hemostática', 'Pacote', 1, 1, 2, 'Cirurgia'),
  ('02-002', 'Líquido Hemostático', 'Frasco', 1, 1, 2, 'Cirurgia'),
  ('02-003', 'Lâmina de bisturi', 'Caixa', 2, 2, 2, 'Cirurgia'),
  ('02-004', 'Agulha 22 G (preta)', 'Caixa', 6, 6, 2, 'Cirurgia'),
  ('02-005', 'Fio de sutura', 'Caixa', 4, 4, 2, 'Cirurgia'),
  ('03-001', 'Bicarbonato de sódio', 'Caixa', 9, 9, 2, 'Periodontia'),
  ('04-001', 'NDP', 'Caixa', 1, 1, 2, 'Endodontia'),
  ('04-002', 'PRP', 'Caixa', 0, 0, 2, 'Endodontia'),
  ('04-003', 'Eucaliptol', 'Frasco', 1, 1, 1, 'Endodontia'),
  ('04-004', 'Lençol de borracha', 'Caixa', 9, 9, 2, 'Endodontia'),
  ('04-005', 'Formocresol', 'Unidade', 0, 0, 2, 'Endodontia'),
  ('04-006', 'Cone de papel absorvente 45-80', 'Pacote', 22, 22, 2, 'Endodontia'),
  ('04-007', 'Cone de papel absorvente 15', 'Pacote', 4, 4, 2, 'Endodontia'),
  ('04-008', 'Cone de papel absorvente 20', 'Pacote', 5, 5, 2, 'Endodontia'),
  ('04-009', 'Cone de papel absorvente 25', 'Pacote', 3, 3, 2, 'Endodontia'),
  ('04-010', 'Cone de papel absorvente 30', 'Pacote', 3, 3, 2, 'Endodontia'),
  ('04-011', 'Cone de papel absorvente 35', 'Pacote', 1, 1, 2, 'Endodontia'),
  ('04-012', 'Cone de papel absorvente 60', 'Pacote', 3, 3, 2, 'Endodontia'),
  ('04-013', 'Cone de papel absorvente 80', 'Pacote', 4, 4, 2, 'Endodontia'),
  ('05-001', 'Agulha curta', 'Caixa', 5, 5, 2, 'Consumíveis'),
  ('05-002', 'Filmes radiográficos', 'Caixa', 7, 7, 2, 'Consumíveis'),
  ('05-003', 'Sugador cirúrgico', 'Unidade', 8, 8, 2, 'Consumíveis'),
  ('05-004', 'Caixa descarpack pequena 3 L', 'Unidade', 8, 8, 4, 'Consumíveis'),
  ('05-005', 'Touca descartável', 'Pacote', 9, 9, 4, 'Consumíveis'),
  ('05-006', 'Máscara N95', 'Unidade', 220, 220, 150, 'Consumíveis'),
  ('05-007', 'Máscara descartável', 'Caixa', 9, 9, 6, 'Consumíveis'),
  ('05-008', 'Avental cirúrgico', 'Unidade', 42, 42, 12, 'Consumíveis'),
  ('05-009', 'Avental de TNT', 'Unidade', 930, 928, 300, 'Consumíveis'),
  ('05-010', 'Avental de plástico', 'Unidade', 390, 390, 100, 'Consumíveis'),
  ('05-011', 'Rolete de algodão', 'Pacote', 300, 300, 100, 'Consumíveis'),
  ('05-012', 'Sugador', 'Pacote', 150, 150, 50, 'Consumíveis'),
  ('05-013', 'Seringa 10 mL', 'Unidade', 250, 250, 50, 'Consumíveis'),
  ('05-014', 'Saco Geladinho', 'Unidade', 20000, 20000, 2000, 'Consumíveis'),
  ('05-015', 'Papel grau cirúrgico 150 mm', 'Unidade', 0, 0, 2, 'Consumíveis'),
  ('05-016', 'Papel grau cirúrgico 200 mm', 'Unidade', 1, 1, 1, 'Consumíveis'),
  ('05-017', 'Álcool 70%', 'Unidade', 27, 26, 12, 'Consumíveis'),
  ('05-018', 'Revelador', 'Unidade', 6, 6, 6, 'Consumíveis'),
  ('05-019', 'Fixador', 'Unidade', 14, 14, 6, 'Consumíveis'),
  ('05-020', 'Álcool em gel', 'Unidade', 13, 13, 6, 'Consumíveis'),
  ('05-021', 'Detergente enzimático', 'Unidade', 3, 3, 2, 'Consumíveis'),
  ('05-022', 'Hipoclorito de sódio 2,5%', 'Unidade', 3, 3, 4, 'Consumíveis'),
  ('05-023', 'Guardanapo', 'Pacote', 54, 52, 25, 'Consumíveis'),
  ('05-024', 'Água destilada', 'Galão', 27, 26, 10, 'Consumíveis'),
  ('05-025', 'Babador', 'Pacote', 61, 60, 25, 'Consumíveis'),
  ('05-026', 'Gaze', 'Pacote', 73, 71, 25, 'Consumíveis'),
  ('05-027', 'Flúor 2%', 'Unidade', 7, 7, 4, 'Consumíveis'),
  ('05-028', 'Flúor 1,23%', 'Unidade', 8, 8, 4, 'Consumíveis'),
  ('05-029', 'Clorexidina 2% (lavar mãos)', 'Unidade', 1, 1, 2, 'Consumíveis'),
  ('05-030', 'Anestésico Prilocaína', 'Caixa', 0, 0, 2, 'Consumíveis'),
  ('05-031', 'Anestésico Lidocaína', 'Caixa', 0, 0, 2, 'Consumíveis'),
  ('05-032', 'Anestésico Mepivacaína', 'Caixa', 0, 0, 4, 'Consumíveis'),
  ('05-033', 'Anestésico Articaína', 'Caixa', 0, 0, 2, 'Consumíveis'),
  ('05-034', 'Fita adesiva autoclavavél', 'Unidade', 0, 0, 12, 'Consumíveis'),
  ('05-035', 'Agulha longa', 'Caixa', 0, 0, 2, 'Consumíveis'),
  ('06-001', 'Cimento resinoso (prótese) Dual', 'Unidade', 1, 1, 2, 'Prótese'),
  ('06-002', 'Pote Dappen plástico/silicone', 'Unidade', 4, 4, 2, 'Prótese'),
  ('06-003', 'Eugenol', 'Unidade', 0, 0, 2, 'Prótese'),
  ('07-001', 'Jacarés', 'Unidade', 2, 2, 0, 'Instrumental'),
  ('07-002', 'Sonda exploradora nº 5', 'Unidade', 9, 9, 0, 'Instrumental'),
  ('07-003', 'Espátula p/ resina Ward', 'Unidade', 5, 5, 0, 'Instrumental'),
  ('07-004', 'Sonda Carolina do Norte', 'Unidade', 5, 5, 0, 'Instrumental'),
  ('07-005', 'Tesoura Goldmann Fox', 'Unidade', 5, 5, 0, 'Instrumental'),
  ('07-006', 'Cabo p/ espelho', 'Unidade', 22, 22, 0, 'Instrumental'),
  ('07-007', 'Espelho nº 5', 'Unidade', 21, 21, 0, 'Instrumental');

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 1, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-12 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '01-003'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-12 00:00:00' AND x.quantidade = 1
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 1 unidade(s) (importado da planilha)', -1, 'importacao', '2026-08-12 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '01-003'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-12 00:00:00' AND x.descricao = 'Saída de 1 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 2, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-009'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 2
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 2 unidade(s) (importado da planilha)', -2, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-009'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 2 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 2, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-026'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 2
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 2 unidade(s) (importado da planilha)', -2, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-026'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 2 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 2, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-023'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 2
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 2 unidade(s) (importado da planilha)', -2, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-023'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 2 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 1, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-024'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 1
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 1 unidade(s) (importado da planilha)', -1, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-024'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 1 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 1, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-017'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 1
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 1 unidade(s) (importado da planilha)', -1, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-017'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 1 unidade(s) (importado da planilha)'
);

INSERT INTO saidas_produtos (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, data_saida)
SELECT p.id, p.nome, 1, 'Importação da planilha', 'Importado da planilha Controle_de_Estoque.xlsx', 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-025'
AND NOT EXISTS (
  SELECT 1 FROM saidas_produtos x WHERE x.produto_id = p.id AND x.data_saida = '2026-08-25 00:00:00' AND x.quantidade = 1
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT 'Importação da planilha', p.id, p.nome, 'Saída', 'Saída de 1 unidade(s) (importado da planilha)', -1, 'importacao', '2026-08-25 00:00:00'
FROM produtos p
WHERE p.codigo_barras = '05-025'
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '2026-08-25 00:00:00' AND x.descricao = 'Saída de 1 unidade(s) (importado da planilha)'
);
