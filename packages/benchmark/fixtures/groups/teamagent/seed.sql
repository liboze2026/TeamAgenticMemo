INSERT INTO knowledge (
  id, scope_level, category, type, nature, trigger,
  wrong_pattern, correct_pattern, correct_pattern_tldr,
  reasoning, confidence, demerit,
  current_tier, max_tier_ever, tier_entered_at,
  enforcement, status,
  hit_count, success_count, override_count, resurrect_count,
  source, created_at
) VALUES (
  'rule-moment-to-dayjs',
  'personal',
  'tech_choice',
  'avoidance',
  'objective',
  'using moment for date formatting in TypeScript/JavaScript',
  'moment',
  'from ''dayjs''',
  'Prefer dayjs over moment: smaller bundle (~2KB vs ~70KB), immutable API, same-style format strings.',
  'moment is in maintenance mode and bloats client bundles; dayjs is a drop-in modern replacement.',
  0.9, 0,
  'stable', 'stable', datetime('now'),
  'block', 'active',
  0, 0, 0, 0,
  'preset', datetime('now')
);

INSERT INTO knowledge (
  id, scope_level, category, type, nature, trigger,
  wrong_pattern, correct_pattern, correct_pattern_tldr,
  reasoning, confidence, demerit,
  current_tier, max_tier_ever, tier_entered_at,
  enforcement, status,
  hit_count, success_count, override_count, resurrect_count,
  source, created_at
) VALUES (
  'wiki-axios-abort-signal',
  'personal',
  'api_currency',
  'avoidance',
  'objective',
  'cancelling axios requests',
  'CancelToken',
  'AbortController + signal',
  'axios v0.22+ deprecated CancelToken; use AbortController and pass signal in the request config.',
  'CancelToken was deprecated in axios 0.22.0 (Oct 2021) in favor of the standard AbortController/AbortSignal Web API.',
  0.95, 0,
  'stable', 'stable', datetime('now'),
  'suggest', 'active',
  0, 0, 0, 0,
  'preset', datetime('now')
);

INSERT INTO wiki_meta (
  knowledge_id, source_url, source_type, source_id,
  published_at, tldr, keywords,
  user_thumbs_down, inline_injection_count, fetch_error
) VALUES (
  'wiki-axios-abort-signal',
  'https://github.com/axios/axios/releases/tag/v0.22.0',
  'github_release',
  'axios/axios#v0.22.0',
  '2021-10-01T00:00:00Z',
  'axios v0.22 deprecated CancelToken in favor of AbortController/AbortSignal. Use new AbortController(); pass controller.signal in axios config; call controller.abort() to cancel.',
  '["axios","cancel","AbortController","AbortSignal"]',
  0, 0, NULL
);

INSERT INTO knowledge (
  id, scope_level, category, type, nature, trigger,
  wrong_pattern, correct_pattern, correct_pattern_tldr,
  reasoning, confidence, demerit,
  current_tier, max_tier_ever, tier_entered_at,
  enforcement, status,
  hit_count, success_count, override_count, resurrect_count,
  source, created_at
) VALUES (
  'rule-react-key-stable',
  'personal',
  'framework',
  'avoidance',
  'objective',
  'using array index as React list key',
  'key={index}',
  'key={item.id} or stable identifier',
  'React keys should be stable identifiers (item.id or a unique string), never array index — index causes state desync, DOM thrash, and broken animations when the list reorders.',
  'Array index as key breaks React reconciliation when list items are inserted, removed, or reordered; React treats same-index-different-data as mutation rather than move, losing component state and wasting DOM work.',
  0.92, 0,
  'stable', 'stable', datetime('now'),
  'block', 'active',
  0, 0, 0, 0,
  'preset', datetime('now')
);
