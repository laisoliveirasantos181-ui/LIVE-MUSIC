# LIVE MUSIC V3.4 — Enterprise Stable

Versão consolidada a partir da V3.3.2 funcional enviada pelo usuário.

## Incluído
- Player persistente (música, posição, play/pause, volume, shuffle e repeat).
- Rotas SPA corrigidas para Vercel (`/admin`, `/login` e refresh direto).
- Gestão de músicas, artistas, álbuns e gêneros.
- Favoritos, downloads, próxima/anterior, shuffle e repeat.
- Atalhos do Windows para abrir o aplicativo e o painel administrativo.

## Como usar
1. Copie o arquivo `.env` da versão publicada para esta pasta.
2. Dê dois cliques em `INICIAR LIVE MUSIC.bat` ou `INICIAR PAINEL ADMIN.bat`.
3. Na primeira execução, o projeto instalará as dependências automaticamente.

Não há nova migração SQL nesta versão.


## V3.4.1 — Player e Upload Corrigidos

- Mini player do navegador/Windows: faixa anterior, play/pausa e próxima faixa.
- Removidos os atalhos de voltar/avançar 10 segundos do Media Session.
- Formulário de música é limpo e liberado automaticamente após o cadastro.
- Botão de envio sempre é destravado pelo bloco `finally`.
- Verificação explícita de sessão antes do upload.
- Não é necessário executar SQL novo.
