# Colhe o estoque de Controle_de_Estoque.xlsx e gera dados_planilha.sql para o MySQL local.
# Rode de novo se a planilha mudar antes da importação: python banco/gerar_dados_planilha.py
from pathlib import Path

from openpyxl import load_workbook

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = "Importação da planilha"
OBSERVACAO = "Importado da planilha Controle_de_Estoque.xlsx"

# Aba Listas: o prefixo do código identifica a categoria do item.
CATEGORIAS = {
    "01": "Dentística", "02": "Cirurgia", "03": "Periodontia", "04": "Endodontia",
    "05": "Consumíveis", "06": "Prótese", "07": "Instrumental",
}


def texto(valor):
    return "'" + str(valor).replace("\\", "\\\\").replace("'", "''") + "'"


planilha = load_workbook(RAIZ / "Controle_de_Estoque.xlsx", data_only=True)

produtos = []
for linha in planilha["Estoque"].iter_rows(min_row=2, values_only=True):
    codigo, nome, unidade, inicial, atual, minimo = linha[:6]
    if codigo in (None, ""):
        continue
    produtos.append(
        f"  ({texto(codigo)}, {texto(nome)}, {texto(unidade)}, {int(inicial)}, {int(atual)}, "
        f"{int(minimo)}, {texto(CATEGORIAS[str(codigo)[:2]])})"
    )

movimentos = []
for data, tipo, codigo, nome, quantidade, observacao in planilha["Movimentações"].iter_rows(min_row=2, max_col=6, values_only=True):
    if codigo in (None, ""):
        continue
    quando = data.strftime("%Y-%m-%d %H:%M:%S")
    qtd = int(quantidade)
    obs = texto(observacao or OBSERVACAO)
    tabela, campo, sinal = ("entradas_produtos", "data_entrada", 1) if tipo == "Entrada" else ("saidas_produtos", "data_saida", -1)
    descricao = texto(f"{tipo} de {qtd} unidade(s) (importado da planilha)")
    movimentos.append(f"""INSERT INTO {tabela} (produto_id, produto_nome, quantidade, usuario_nome, observacao, origem, {campo})
SELECT p.id, p.nome, {qtd}, {texto(ORIGEM)}, {obs}, 'importacao', '{quando}'
FROM produtos p
WHERE p.codigo_barras = {texto(codigo)}
AND NOT EXISTS (
  SELECT 1 FROM {tabela} x WHERE x.produto_id = p.id AND x.{campo} = '{quando}' AND x.quantidade = {qtd}
);

INSERT INTO historico (usuario_nome, produto_id, produto_nome, acao, descricao, quantidade, origem, data_acao)
SELECT {texto(ORIGEM)}, p.id, p.nome, {texto(tipo)}, {descricao}, {sinal * qtd}, 'importacao', '{quando}'
FROM produtos p
WHERE p.codigo_barras = {texto(codigo)}
AND NOT EXISTS (
  SELECT 1 FROM historico x WHERE x.produto_id = p.id AND x.data_acao = '{quando}' AND x.descricao = {descricao}
);
""")

lista_produtos = ",\n".join(produtos)
lista_movimentos = "\n".join(movimentos)
saida = f"""-- Dados de Controle_de_Estoque.xlsx para o banco auxiliar_odont. Gerado por gerar_dados_planilha.py.
-- Importe DEPOIS de auxiliar_odont.sql: phpMyAdmin (servidor MySQL) > Importar > este arquivo.
-- Pode ser importado de novo: produtos que já existem ficam como estão e os movimentos não se repetem.
-- "Quantidade atual" da planilha já desconta os movimentos abaixo: eles entram só como histórico.

USE auxiliar_odont;

INSERT IGNORE INTO produtos (codigo_barras, nome, unidade, estoque_inicial, quantidade, estoque_minimo, categoria)
VALUES
{lista_produtos};

{lista_movimentos}"""

(RAIZ / "banco" / "dados_planilha.sql").write_text(saida, encoding="utf-8")
print(f"{len(produtos)} produtos e {len(movimentos)} movimentos")
