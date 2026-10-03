INSERT INTO content_translations (entity_type, source_key, source_sample, locale, translated_text, status, origin) VALUES
('portion', '1 barrinha', '1 barrinha', 'en', '1 bar', 'pending', 'llm'),
('portion', '1 bombom ou 20g', '1 bombom ou 20g', 'en', '1 bonbon or 20g', 'pending', 'llm'),
('portion', '1 mini (20g)', '1 mini (20g)', 'en', '1 mini (20g)', 'pending', 'llm'),
('portion', '1 un. (12 3g)', '1 un. (12,3g)', 'en', '1 pc. (12.3g)', 'pending', 'llm'),
('portion', '1 un. (19g)', '1 un. (19g)', 'en', '1 pc. (19g)', 'pending', 'llm'),
('portion', '1 un. (20-21 5g)', '1 un. (20-21,5g)', 'en', '1 pc. (20-21.5g)', 'pending', 'llm'),
('portion', '1 un. (~20g)', '1 un. (~20g)', 'en', '1 pc. (~20g)', 'pending', 'llm'),
('portion', '1 un. pequena', '1 un. pequena', 'en', '1 small pc.', 'pending', 'llm'),
('portion', '1 unidade', '1 unidade', 'en', '1 piece', 'pending', 'llm'),
('portion', '1/2 un. (~20g)', '1/2 un. (~20g)', 'en', '1/2 pc. (~20g)', 'pending', 'llm'),
('portion', '3 unidades', '3 unidades', 'en', '3 pieces', 'pending', 'llm'),
('portion', 'cerca de 20g', 'cerca de 20g', 'en', 'about 20g', 'pending', 'llm'),
('portion', 'cerca de 25g', 'cerca de 25g', 'en', 'about 25g', 'pending', 'llm')
ON CONFLICT (entity_type, source_key, locale) DO NOTHING;
