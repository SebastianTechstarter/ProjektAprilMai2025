INSERT INTO book (
  isbn,
  title,
  author,
  description,
  page_count,
  publication_year,
  quality,
  price,
  cover_design,
  publisher_id,
  category_id
)
VALUES (
  '978-3-123456-47-2',
  'Die unendliche Geschichte',
  'Michael Ende',
  'Ein Fantasy-Roman über ein magisches Buch.',
  428,
  1980,
  5,
  14.99,
  JSON_OBJECT('front', 'url_zum_coverbild', 'style', 'modern'),
  1,
  1
);
