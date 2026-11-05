-- Custo de referência dos materiais pelo preço de mercado, pesquisado em 04/11/2026 em lojas
-- odontológicas e hospitalares brasileiras (varejo on-line, sem frete). Para cada item vale a
-- mediana dos anúncios encontrados, na embalagem cadastrada no sistema (caixa, pacote, rolo...).
--
-- base = 'pesquisa': preço encontrado nas lojas citadas em "referencia".
-- base = 'estimativa': a busca não trouxe preço; valor estimado por item equivalente. Confira
--        em Financeiro → Custos e corrija com o preço que o consultório realmente paga.
-- As duas "Coroa Hable" ficam sem custo: não houve referência.
--
-- Só preenche produtos ainda SEM custo: não sobrescreve custos informados nem os aprendidos com
-- as compras (cada entrada com custo recalcula a média ponderada). Pode ser importado de novo.
-- Como usar: faça um backup e importe no phpMyAdmin, com o banco auxiliar_odont aberto.

CREATE TEMPORARY TABLE precos_mercado (
    codigo VARCHAR(20) PRIMARY KEY,
    preco DECIMAL(12,4) NOT NULL,
    base ENUM('pesquisa','estimativa') NOT NULL,
    embalagem VARCHAR(60) NOT NULL,
    referencia VARCHAR(200) NOT NULL
);

INSERT INTO precos_mercado (codigo, preco, base, embalagem, referencia) VALUES
-- Dentística
('01-001', 15.00, 'estimativa', 'tubo com 100 aplicadores', 'Microbrush descartável: sem preço na busca'),
('01-002', 48.90, 'pesquisa', 'frasco 4 ml', 'Adesivo Ambar 4 ml (FGM): Ice Virtual R$ 48,90, OK Dental R$ 47,99, Odonto Dental R$ 44,60'),
('01-003', 6.27, 'pesquisa', 'seringa', 'Ácido fosfórico 37% gel: 2i R$ 6,27, Maquira R$ 5,23, Villevie R$ 8,65'),
('01-004', 46.90, 'pesquisa', 'kit', 'Ionômero Maxxion R (FGM) R$ 46,90'),
('01-005', 18.00, 'estimativa', 'frasco 12 g', 'Anestésico tópico Benzotop: sem preço na busca'),
('01-006', 229.90, 'pesquisa', 'embalagem com 2 doses', 'MTA Branco Angelus 2 doses: Dental Light R$ 229,90'),
('01-007', 62.00, 'pesquisa', 'kit', 'Hydro C (Dentsply): Dental Orto Line R$ 62,00'),
('01-008', 4.24, 'pesquisa', 'rolo 50 cm', 'Fita matriz aço 7 mm: Maquira R$ 4,24, Preven R$ 3,71, Iodontosul R$ 5,20'),
('01-009', 4.24, 'pesquisa', 'rolo 50 cm', 'Fita matriz aço 5 mm: Maquira R$ 4,24, Preven R$ 3,71, Iodontosul R$ 5,20'),
('01-010', 149.00, 'pesquisa', 'kit', 'Referência equivalente: IRM (Dentsply) R$ 149,00 na Dental Orto Line'),
('01-013', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-014', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-015', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-016', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-017', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-018', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-019', 48.40, 'pesquisa', 'seringa 4 g', 'Resina Opallis 4 g (FGM): R$ 48,40 Pix; faixa R$ 41,50 a R$ 92,77'),
('01-020', 45.00, 'estimativa', 'unidade', 'Forrador ionomérico (liner): sem preço na busca'),
('01-021', 104.90, 'pesquisa', 'refil 26 discos + mandril', 'Disco Diamond Pro (FGM): Dental Light R$ 104,90, Dental Sorria R$ 102,90, Odonto Dental R$ 104,49'),
('01-022', 104.90, 'pesquisa', 'refil 26 discos + mandril', 'Disco Diamond Pro (FGM): Dental Light R$ 104,90'),
('01-023', 6.00, 'estimativa', 'bloco', 'Bloco de papel para espatulação: sem preço na busca'),
('01-024', 15.00, 'estimativa', 'unidade', 'Arco de Young plástico: sem preço na busca'),
('01-025', 9.00, 'estimativa', 'rolo', 'Fio dental: sem preço na busca'),
('01-026', 102.90, 'pesquisa', 'refil 26 discos', 'Disco Diamond Pro refil (FGM): Dental Sorria R$ 102,90'),
('01-027', 102.90, 'pesquisa', 'refil 26 discos', 'Disco Diamond Pro refil (FGM): Dental Sorria R$ 102,90'),
('01-028', 8.00, 'estimativa', 'pacote', 'Tira de poliéster para acabamento: sem preço na busca'),
('01-029', 6.00, 'estimativa', 'pacote', 'Tira de poliéster transparente: sem preço na busca'),
('01-030', 12.00, 'estimativa', 'pacote', 'Cunha de madeira: sem preço avulso na busca'),
('01-031', 12.00, 'estimativa', 'pacote', 'Papel carbono articular: sem preço na busca'),
('01-032', 35.00, 'estimativa', 'unidade', 'Fio retrator: sem preço na busca'),
-- Cirurgia
('02-001', 76.90, 'pesquisa', 'pacote', 'Hemospon (Maquira): Unidental R$ 76,90'),
('02-002', 30.00, 'estimativa', 'frasco', 'Líquido hemostático: sem preço na busca'),
('02-003', 42.00, 'pesquisa', 'caixa', 'Lâmina de bisturi aço carbono: Unidental R$ 42,00'),
('02-004', 18.00, 'estimativa', 'caixa com 100', 'Agulha hipodérmica 22 G: sem preço na busca'),
('02-005', 90.00, 'estimativa', 'caixa com 24', 'Fio de sutura seda 4-0: sem preço na busca'),
-- Periodontia
('03-001', 30.00, 'estimativa', 'caixa', 'Bicarbonato para profilaxia: sem preço na busca'),
-- Endodontia
('04-001', 40.00, 'estimativa', 'caixa', 'Pasta NDP: sem preço na busca'),
('04-002', 40.00, 'estimativa', 'caixa', 'Pasta PRP: sem preço na busca'),
('04-003', 15.00, 'pesquisa', 'frasco 10 ml', 'Eucaliptol (Biodinâmica): R$ 15,00 preço cheio, R$ 7,99 em promoção'),
('04-004', 36.90, 'pesquisa', 'caixa com 26 folhas', 'Lençol de borracha Madeitex: Odontomaster R$ 36,90; faixa R$ 32,00 a R$ 49,90'),
('04-005', 22.30, 'pesquisa', 'frasco 10 ml', 'Formocresol (Biodinâmica): Artvend R$ 22,30; faixa R$ 18,90 a R$ 35,23'),
('04-006', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-007', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-008', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-009', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-010', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-011', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-012', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
('04-013', 46.59, 'pesquisa', 'caixa com 120', 'Cone de papel absorvente: Dentsply R$ 46,59, Bassi R$ 47,41, Tanari R$ 43,66'),
-- Consumíveis
('05-001', 50.89, 'pesquisa', 'caixa com 100', 'Agulha gengival curta 30G: Drogaraia R$ 50,89, AF Hospitalar R$ 51,95, D Care R$ 49,90'),
('05-002', 279.90, 'pesquisa', 'caixa com 150', 'Filme periapical E-Speed (Carestream): Dental Odonthomaz R$ 279,90; faixa R$ 269,90 a R$ 297,90'),
('05-003', 3.00, 'estimativa', 'unidade', 'Cânula de sucção cirúrgica descartável: sem preço na busca'),
('05-004', 6.00, 'estimativa', 'unidade', 'Caixa coletora de perfurocortantes 3 L: sem preço na busca'),
('05-005', 15.95, 'pesquisa', 'pacote com 100', 'Touca sanfonada Ferraz Premium: R$ 15,95'),
('05-006', 1.89, 'pesquisa', 'unidade', 'Máscara PFF2/N95: R$ 1,89 (Valery); caixa 50 por R$ 86,50 (Amazon)'),
('05-007', 15.00, 'estimativa', 'caixa com 50', 'Máscara descartável tripla: sem preço na busca'),
('05-008', 9.49, 'pesquisa', 'unidade', 'Avental SMS 40 g: pacote com 10 por R$ 94,90 (SP Protection)'),
('05-009', 3.73, 'pesquisa', 'unidade', 'Avental TNT 40 g manga longa: pacote com 10 por R$ 37,29 (Utilidades Clínicas)'),
('05-010', 0.80, 'estimativa', 'unidade', 'Avental plástico descartável: sem preço na busca'),
('05-011', 3.90, 'pesquisa', 'pacote com 100', 'Rolete de algodão WA: Dental Light R$ 3,90; faixa R$ 2,90 a R$ 7,94'),
('05-012', 9.50, 'pesquisa', 'pacote com 40', 'Sugador descartável: WA R$ 9,50, Dochem R$ 8,90, SSPlus R$ 10,19'),
('05-013', 0.70, 'estimativa', 'unidade', 'Seringa descartável 10 ml: sem preço na busca'),
('05-014', 0.04, 'pesquisa', 'unidade', 'Saco tipo geladinho 6x24: pacote com 1000 entre R$ 35,50 e R$ 52,00'),
('05-015', 94.90, 'pesquisa', 'rolo 15 cm x 100 m', 'Papel grau cirúrgico: Dental Curitibana R$ 94,90, Hospicenter R$ 96,50'),
('05-016', 125.00, 'estimativa', 'rolo 20 cm x 100 m', 'Proporcional ao rolo de 15 cm (R$ 94,90)'),
('05-017', 12.00, 'estimativa', 'litro', 'Álcool 70% líquido: sem preço na busca'),
('05-018', 21.06, 'pesquisa', 'frasco 475 ml', 'Revelador SS White: A Dental R$ 21,06'),
('05-019', 18.90, 'pesquisa', 'frasco 475 ml', 'Fixador Lysanda: Starhouse R$ 18,90; Preven R$ 19,79'),
('05-020', 18.90, 'pesquisa', 'litro', 'Álcool gel 70% 1 L (Cinord): MedShop R$ 18,90'),
('05-021', 45.00, 'estimativa', 'litro', 'Detergente enzimático: sem preço na busca'),
('05-022', 10.00, 'estimativa', 'litro', 'Hipoclorito de sódio 2,5%: sem preço na busca'),
('05-023', 5.00, 'estimativa', 'pacote', 'Guardanapo de papel: sem preço na busca'),
('05-024', 18.00, 'estimativa', 'galão 5 L', 'Água destilada: sem preço na busca'),
('05-025', 22.80, 'pesquisa', 'pacote com 100', 'Babador descartável: Best Care R$ 22,80, Hospiflex R$ 21,92, Biodinâmica R$ 34,08'),
('05-026', 33.60, 'pesquisa', 'pacote com 500', 'Gaze 7,5x7,5 13 fios: Welmed R$ 33,60, Drogasil R$ 36,99'),
('05-027', 10.90, 'pesquisa', 'frasco 200 ml', 'Flúor neutro 2%: Maquira R$ 10,90, Iodontosul R$ 10,45, SS White R$ 13,00'),
('05-028', 10.55, 'pesquisa', 'frasco 200 ml', 'Flúor acidulado 1,23%: Maquira R$ 10,55, DFL R$ 8,40, Skymed R$ 8,90'),
('05-029', 32.90, 'pesquisa', 'litro', 'Clorexidina 2% degermante Riohex: Amazon R$ 32,90, Orto Curitiba R$ 33,16, Medplus R$ 26,00'),
('05-030', 267.83, 'pesquisa', 'caixa com 50 tubetes', 'Prilonest 3% (Nova DFL): Odontomaster R$ 267,83'),
('05-031', 161.20, 'pesquisa', 'caixa com 50 tubetes', 'Lidostesim 2% 1:50.000 (DLA): Odontomaster R$ 161,20'),
('05-032', 230.48, 'pesquisa', 'caixa com 50 tubetes', 'Mepivacaína 2%: Mepivalem AD R$ 206,06 e Mepiadre R$ 254,89 (média)'),
('05-033', 242.63, 'pesquisa', 'caixa com 50 tubetes', 'Articaína 4%: Nova DFL R$ 226,01 e R$ 242,63, Septanest R$ 279,97'),
('05-034', 12.00, 'estimativa', 'rolo', 'Fita indicadora para autoclave: sem preço na busca'),
('05-035', 48.00, 'pesquisa', 'caixa com 100', 'Agulha gengival longa 30G Injex: Medicallage R$ 48,00; D Care R$ 54,90'),
-- Prótese
('06-001', 143.22, 'pesquisa', 'kit', 'Allcem Dual (FGM): R$ 113,00 a R$ 186,00; mediana R$ 143,22'),
('06-002', 5.00, 'estimativa', 'unidade', 'Pote Dappen: sem preço na busca'),
('06-003', 15.00, 'estimativa', 'frasco 20 ml', 'Eugenol: sem preço na busca'),
-- Instrumental
('07-001', 12.00, 'estimativa', 'unidade', 'Prendedor jacaré: sem preço na busca'),
('07-002', 20.00, 'pesquisa', 'unidade', 'Sonda exploradora nº 5: Kota R$ 20,00; faixa R$ 11,39 a R$ 62,62'),
('07-003', 45.00, 'estimativa', 'unidade', 'Espátula para resina: sem preço na busca'),
('07-004', 62.53, 'pesquisa', 'unidade', 'Sonda Carolina do Norte Millennium (Golgran): Dentalecia R$ 62,53; faixa R$ 48,90 a R$ 74,80'),
('07-005', 65.00, 'estimativa', 'unidade', 'Tesoura Goldman-Fox: sem preço na busca'),
('07-006', 10.00, 'estimativa', 'unidade', 'Cabo para espelho: sem preço na busca'),
('07-007', 2.09, 'pesquisa', 'unidade', 'Espelho bucal nº 5: pacote com 20 por R$ 41,75 (Prisma)');

-- O histórico registra a origem, sem o valor: outros níveis leem o histórico.
INSERT INTO historico (usuario_id, usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem)
SELECT NULL, 'Pesquisa de mercado', p.id, p.nome, 'Edição',
       IF(m.base = 'pesquisa', 'Custo de referência pelo preço de mercado (pesquisa de 04/11/2026)',
                               'Custo de referência estimado por item equivalente (pesquisa de 04/11/2026)'),
       NULL, 'cadastro'
FROM produtos p JOIN precos_mercado m ON m.codigo = p.codigo_barras
WHERE p.custo_medio IS NULL;

UPDATE produtos p JOIN precos_mercado m ON m.codigo = p.codigo_barras
SET p.custo_medio = m.preco
WHERE p.custo_medio IS NULL;

DROP TEMPORARY TABLE precos_mercado;
