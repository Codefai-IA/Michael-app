# Backup das traducoes de conteudo (pt-BR -> en)

As 1.414 traducoes que estao em `content_translations` no Supabase, geradas em 08/09/2026.
Formato: `{ "texto original": "translation" }`, um arquivo por `entity_type`.

Servem para:
- **restaurar** se alguem apagar a tabela por engano;
- **revisar em diff** quando uma traducao for corrigida na Biblioteca;
- **rastrear** o que foi entregue (o banco perde o historico depois que o admin edita).

Nao sao lidos pelo app — a fonte da verdade em runtime e a tabela `content_translations`.
Para recarregar no banco: ver `scripts/translate-content.mjs` (mesmo formato de upsert),
lembrando que `source_key` e sempre `normalizeKey(texto original)`.
