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

## Como usar no GitHub Pages

1. Publique o repositório no GitHub Pages apontando para a branch desejada.
2. Abra `index.html` ou `pages/login.html`.
3. Faça login com o usuário de demonstração.
4. Os dados ficam salvos localmente no navegador via `localStorage`.

## Estrutura principal

- `index.html` — entrada da aplicação
- `assets/css/custom.css` — estilos globais
- `assets/js/app.js` — autenticação, persistência e regras da aplicação
- `pages/` — telas HTML do sistema

## Observações

- Como o GitHub Pages não executa PHP nem MySQL, esta versão funciona como **demo estática**.
- Os dados não são compartilhados entre usuários/navegadores.
- Os arquivos `.php` antigos foram mantidos apenas como referência da implementação original.
