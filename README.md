# Auxiliar Odont — Sistema de Controle de Estoque

Projeto convertido para uma versão **100% estática em HTML, CSS e JavaScript**, compatível com **GitHub Pages**.

## O que mudou

A aplicação original em PHP/MySQL foi adaptada para rodar sem servidor:

- autenticação local com `sessionStorage`
- banco de dados simulado com `localStorage`
- dashboard, produtos, entradas, saídas, histórico e usuários em páginas HTML
- exportação CSV no navegador
- interface sem dependência de PHP, MySQL ou Bootstrap

## Acesso de demonstração

- `admin@local.com`
- `123456`

## Como acessar no GitHub Pages

1. No GitHub, abra **Settings > Pages**.
2. Em **Source**, selecione **GitHub Actions**.
3. Aguarde o workflow `Deploy GitHub Pages` publicar o site.
4. Abra a URL no formato:
   - `https://mattttheus.github.io/Auxiliar_Odont/`
5. Faça login com o usuário de demonstração.
6. Os dados ficam salvos localmente no navegador via `localStorage`.

> Se você abrir apenas a página principal do repositório no GitHub, verá o `README.md`, não a aplicação publicada.

## Estrutura principal

- `index.html` — entrada da aplicação
- `assets/css/custom.css` — estilos globais
- `assets/js/app.js` — autenticação, persistência e regras da aplicação
- `pages/` — telas HTML do sistema

## Observações

- Como o GitHub Pages não executa PHP nem MySQL, esta versão funciona como **demo estática**.
- Os dados não são compartilhados entre usuários/navegadores.
- Os arquivos `.php` antigos foram mantidos apenas como referência da implementação original.
