SELECT * FROM category;

INSERT INTO category (category_id, name)
VALUES (1, 'klett-cotta');

SELECT * FROM book;

UPDATE book
SET category_id = 1
WHERE book_id = 2;