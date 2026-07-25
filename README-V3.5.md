# LIVE MUSIC V3.5 — Upload em Lote e Metadados

## Novidades

- Seleção de várias músicas de uma vez.
- Leitura local de metadados ID3 para MP3: título, artista, álbum, gênero, número da faixa, ano e capa incorporada.
- Leitura automática da duração do áudio pelo navegador.
- Tela de revisão editável antes do envio.
- Dados padrão para aplicar artista, álbum, gênero e capa ao lote.
- Criação automática de artista, álbum e gênero quando ainda não existem.
- Barra de progresso da importação.
- Resultado individual por faixa, com possibilidade de repetir somente as que falharam.
- Upload individual anterior preservado.
- Todos os recursos da V3.4.2 preservados.

## Instalação

1. Extraia o projeto em uma pasta nova.
2. Copie o arquivo `.env` da V3.4.2 funcional para esta pasta.
3. Execute `npm install`.
4. Execute `npm run dev` ou use `INICIAR PAINEL ADMIN.bat`.
5. No Studio, abra **Upload em lote**.

Não há SQL novo nesta versão.

## Como organizar os arquivos

Arquivos MP3 com etiquetas ID3 completas serão preenchidos automaticamente. Quando os dados estiverem ausentes, o nome do arquivo será usado como título e os outros campos poderão ser corrigidos na tabela de revisão.

Para várias músicas do mesmo artista ou álbum, use os campos **Dados padrão** e clique em **Aplicar ao lote**.

## Observação sobre formatos

A leitura completa de etiquetas incorporadas é mais confiável em MP3 com ID3v2. WAV, FLAC, M4A, AAC e OGG podem ser enviados em lote, mas alguns navegadores não expõem todos os metadados desses formatos; nesses casos, revise os campos antes da importação.
