-- JobRadar — seed data
-- Keyword profile derived from Jayvee Osapdin's resume (Laravel/PHP/Vue
-- full-stack + infra), and a starter set of company boards.
--
-- NOTE ON BOARD TOKENS: a company can migrate ATS at any time, which silently
-- turns its token into a 404. Run "Validate all" on the Companies tab after
-- seeding — it pings every board and deactivates the ones that no longer
-- resolve. Treat this list as a starting point, not gospel.

-- ─────────────────────────────────────────────────────────────
-- Keyword profile
-- ─────────────────────────────────────────────────────────────
insert into public.keywords (term, weight, category) values
  -- primary stack
  ('laravel',            10, 'core'),
  ('php',                 9, 'core'),
  ('filament',            8, 'core'),
  ('vue',                 7, 'core'),
  ('vue.js',              7, 'core'),
  ('full-stack',          6, 'core'),
  ('fullstack',           6, 'core'),
  ('full stack',          6, 'core'),
  ('backend',             6, 'core'),
  ('back-end',            6, 'core'),
  -- data
  ('postgresql',          5, 'data'),
  ('postgres',            5, 'data'),
  ('mysql',               4, 'data'),
  ('redis',               4, 'data'),
  ('supabase',            5, 'data'),
  -- adjacent frontend
  ('typescript',          4, 'frontend'),
  ('javascript',          3, 'frontend'),
  ('react',               3, 'frontend'),
  ('tailwind',            3, 'frontend'),
  ('node.js',             3, 'frontend'),
  ('nodejs',              3, 'frontend'),
  -- infra / devops
  ('aws',                 4, 'infra'),
  ('linux',               3, 'infra'),
  ('nginx',               3, 'infra'),
  ('docker',              3, 'infra'),
  ('rest api',            4, 'infra'),
  ('api',                 2, 'infra'),
  ('devops',              3, 'infra'),
  -- mobile
  ('android',             4, 'mobile'),
  ('kotlin',              3, 'mobile'),
  ('flutter',             3, 'mobile'),
  -- domain experience
  ('pos',                 3, 'domain'),
  ('point of sale',       3, 'domain'),
  ('inventory',           2, 'domain'),
  ('offline-first',       4, 'domain'),
  ('real-time',           2, 'domain'),
  ('saas',                2, 'domain'),
  ('fintech',             2, 'domain'),
  -- level signals
  ('senior software',     4, 'level'),
  ('senior engineer',     4, 'level'),
  ('mid-level',           3, 'level'),
  ('software engineer',   3, 'level'),
  ('web developer',       3, 'level'),
  -- remote signals
  ('remote',              5, 'remote'),
  ('work from anywhere',  6, 'remote'),
  ('fully remote',        6, 'remote'),
  ('distributed team',    4, 'remote'),
  -- negatives: things that make a posting a waste of an application
  ('security clearance', -25, 'exclude'),
  ('us citizen',         -20, 'exclude'),
  ('unpaid',             -25, 'exclude'),
  ('internship',         -15, 'exclude'),
  ('intern',             -10, 'exclude'),
  ('principal',           -6, 'exclude'),
  ('staff engineer',      -4, 'exclude'),
  ('engineering manager',-12, 'exclude'),
  ('director',           -15, 'exclude'),
  ('sales',              -20, 'exclude'),
  ('recruiter',          -20, 'exclude'),
  ('marketing',          -18, 'exclude'),
  ('account executive',  -20, 'exclude'),
  ('customer success',   -18, 'exclude'),
  ('designer',           -15, 'exclude'),
  ('data scientist',     -10, 'exclude'),
  ('machine learning',    -8, 'exclude'),
  ('.net',                -8, 'exclude'),
  ('salesforce',         -10, 'exclude')
on conflict (term) do update set weight = excluded.weight, category = excluded.category;

-- ─────────────────────────────────────────────────────────────
-- Company boards
-- ─────────────────────────────────────────────────────────────
insert into public.companies (name, ats, board_token, market, careers_url) values
  -- Remote-global: hire across timezones, most realistic for a PH-based dev
  ('GitLab',              'greenhouse', 'gitlab',            'remote-global', 'https://about.gitlab.com/jobs/'),
  ('Zapier',              'greenhouse', 'zapier',            'remote-global', 'https://zapier.com/jobs'),
  ('Sourcegraph',         'greenhouse', 'sourcegraph',       'remote-global', 'https://sourcegraph.com/careers'),
  ('Grafana Labs',        'greenhouse', 'grafanalabs',       'remote-global', 'https://grafana.com/about/careers/'),
  ('Remote',              'greenhouse', 'remotecom',         'remote-global', 'https://remote.com/careers'),
  ('Oyster HR',           'greenhouse', 'oysterhr',          'remote-global', 'https://www.oysterhr.com/careers'),
  ('Close',               'greenhouse', 'close',             'remote-global', 'https://www.close.com/careers'),
  ('Chess.com',           'greenhouse', 'chesscom',          'remote-global', 'https://www.chess.com/jobs'),
  ('Supabase',            'ashby',      'supabase',          'remote-global', 'https://supabase.com/careers'),
  ('Vercel',              'ashby',      'vercel',            'remote-global', 'https://vercel.com/careers'),
  ('Linear',              'ashby',      'linear',            'remote-global', 'https://linear.app/careers'),
  ('Deel',                'ashby',      'deel',              'remote-global', 'https://www.deel.com/careers'),
  ('Ashby',               'ashby',      'ashby',             'remote-global', 'https://www.ashbyhq.com/careers'),
  ('Toggl',               'lever',      'toggl',             'remote-global', 'https://toggl.com/jobs/'),
  ('Wikimedia Foundation','lever',      'wikimedia',         'remote-global', 'https://wikimediafoundation.org/about/jobs/'),

  -- Australia / New Zealand: closest to the Appetiser network and timezone
  ('Canva',               'lever',      'canva',             'au-nz', 'https://www.lifeatcanva.com/'),
  ('Culture Amp',         'lever',      'cultureamp',        'au-nz', 'https://www.cultureamp.com/company/careers'),
  ('SafetyCulture',       'lever',      'safetyculture',     'au-nz', 'https://safetyculture.com/careers/'),
  ('Airwallex',           'lever',      'airwallex',         'au-nz', 'https://www.airwallex.com/careers'),
  ('Employment Hero',     'lever',      'employmenthero',    'au-nz', 'https://employmenthero.com/careers/'),
  ('Immutable',           'lever',      'immutable',         'au-nz', 'https://www.immutable.com/careers'),
  ('Linktree',            'lever',      'linktree',          'au-nz', 'https://linktr.ee/s/about/careers/'),
  ('Go1',                 'lever',      'go1',               'au-nz', 'https://www.go1.com/careers'),
  ('Deputy',              'lever',      'deputy',            'au-nz', 'https://www.deputy.com/careers'),
  ('Halter',              'ashby',      'halter',            'au-nz', 'https://halterhq.com/careers'),
  ('Tracksuit',           'ashby',      'tracksuit',         'au-nz', 'https://www.gotracksuit.com/careers'),
  ('Rokt',                'greenhouse', 'rokt',              'au-nz', 'https://www.rokt.com/careers/'),
  ('Eucalyptus',          'lever',      'eucalyptus',        'au-nz', 'https://eucalyptus.vc/careers'),
  ('Mr Yum',              'lever',      'mryum',             'au-nz', 'https://www.mryum.com/careers'),

  -- Philippines: see README — most PH employers post to Kalibrr/JobStreet,
  -- not to these ATSes, so coverage here is thin by nature.
  ('Coins.ph',            'lever',      'coins',             'ph', 'https://coins.ph/careers/'),
  ('First Circle',        'lever',      'firstcircle',       'ph', 'https://www.firstcircle.ph/careers'),
  ('Sprout Solutions',    'lever',      'sprout',            'ph', 'https://sprout.ph/careers/'),
  ('PDAX',                'lever',      'pdax',              'ph', 'https://pdax.ph/careers'),
  ('Kumu',                'lever',      'kumu',              'ph', 'https://www.kumu.ph/careers'),

  -- US / Europe remote: higher bands, usually contractor-of-record setups
  ('Stripe',              'greenhouse', 'stripe',            'us-eu', 'https://stripe.com/jobs'),
  ('Figma',               'greenhouse', 'figma',             'us-eu', 'https://www.figma.com/careers/'),
  ('Discord',             'greenhouse', 'discord',           'us-eu', 'https://discord.com/careers'),
  ('Reddit',              'greenhouse', 'reddit',            'us-eu', 'https://www.redditinc.com/careers'),
  ('Dropbox',             'greenhouse', 'dropbox',           'us-eu', 'https://jobs.dropbox.com/'),
  ('Asana',               'greenhouse', 'asana',             'us-eu', 'https://asana.com/jobs'),
  ('Notion',              'greenhouse', 'notion',            'us-eu', 'https://www.notion.so/careers'),
  ('Airtable',            'greenhouse', 'airtable',          'us-eu', 'https://airtable.com/careers'),
  ('Databricks',          'greenhouse', 'databricks',        'us-eu', 'https://www.databricks.com/company/careers'),
  ('Anthropic',           'greenhouse', 'anthropic',         'us-eu', 'https://www.anthropic.com/careers'),
  ('OpenAI',              'ashby',      'openai',            'us-eu', 'https://openai.com/careers'),
  ('Ramp',                'ashby',      'ramp',              'us-eu', 'https://ramp.com/careers'),
  ('Replit',              'ashby',      'replit',            'us-eu', 'https://replit.com/careers'),
  ('Palantir',            'lever',      'palantir',          'us-eu', 'https://www.palantir.com/careers/'),
  ('Hostinger',           'lever',      'hostinger',         'us-eu', 'https://www.hostinger.com/careers')
on conflict (ats, board_token) do nothing;
