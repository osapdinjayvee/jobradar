-- JobRadar — profile seed
--
-- Lifted from Jayvee_Osapdin_Resume.pdf and Software Engineer Cover Letter.pdf
-- so the cover letter drafter has something real to work from. Edit freely on
-- the Profile tab afterwards; this is a starting point, not a fixture.
--
-- Depends on 0004_application_flow.sql.

update public.profile set
  full_name = 'Jayvee Osapdin',

  -- Signature line. Mirrors the one on the existing cover letter.
  headline = 'Full-Stack Web & Mobile Developer | Software Engineer',

  location = 'Philippines',

  portfolio_url = 'https://www.linkedin.com/in/jayvee-osapdin',

  -- Condensed from the resume's professional summary. Deliberately shorter
  -- than the PDF version: this paragraph is the *opening* of a letter whose
  -- next paragraph is generated per posting from that job's matched keywords,
  -- so restating the whole stack here would duplicate it.
  summary = 'I''m a full-stack engineer with six years building and running web and mobile systems in Laravel and PHP — enterprise and academic platforms, APIs, POS and inventory tools, and the Linux/Nginx/Redis infrastructure underneath them. I tend to own things end to end, from requirements through deployment and production support.',

  -- Labels for the Resume-sent picker. The files stay wherever you keep them;
  -- JobRadar records which one went out, not the document itself.
  resume_variants = array[
    'Full-stack (Laravel/Vue)',
    'Backend / API',
    'Systems & infrastructure'
  ]
where id = true;
