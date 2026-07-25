# LIVE MUSIC V3.5.7 — Studio Pro

Entrega de engenharia sobre a V3.5.6.

## Incluído
- fila exclusiva para álbum, playlist e coleção;
- controles mobile de atualizar, aleatório e repetir;
- menu do perfil funcional;
- Dashboard sem limite fixo de 50 músicas e atualização Realtime;
- edição de perfil, plano e status dos usuários;
- rodapé institucional em Player e Studio;
- preparação de campo `is_active` para planos/offline/assinaturas.

## SQL obrigatório
Execute `supabase/08_v357_studio_pro.sql`.

> Criação/exclusão de contas de autenticação exige uma Edge Function com service role e será ligada com segurança na futura camada de autenticação/assinaturas. A V3.5.7 não expõe chave administrativa no navegador.
