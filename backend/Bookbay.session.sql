CREATE TABLE user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash CHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    user_type ENUM('admin','privat', 'gewerblich') NOT NULL,
    payment_method  VARCHAR(50) NULL,
    paypal_account VARCHAR(100),
    iban VARCHAR(34),
    creditcard_last4 CHAR(4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE address (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address_type ENUM('shipping', 'invoice', 'packstation') NOT NULL,
    street VARCHAR(100) NOT NULL,
    house_number VARCHAR(20),
    post_office_box VARCHAR(20),
    postal_code VARCHAR(20) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(50) DEFAULT 'DE',
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

CREATE TABLE publisher (
    publisher_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    contact_info TEXT
);

CREATE TABLE category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    );

CREATE TABLE book (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(17) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    description LONGTEXT,
    page_count INT UNSIGNED,
    publication_year SMALLINT,
    quality TINYINT CHECK (quality BETWEEN 1 AND 5),
    price DECIMAL(10,2) NOT NULL,
    cover_design JSON,
    publisher_id INT,
    category_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id),
    FOREIGN KEY (category_id) REFERENCES category(category_id)
);

CREATE TABLE library (
    library_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

CREATE TABLE user_books (
    user_book_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    library_id INT NOT NULL,
    is_for_sale BOOLEAN DEFAULT FALSE,
    condition_notes TEXT,
    price_override DECIMAL(10,2),
    status ENUM('available', 'sold', 'reserved') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id),
    FOREIGN KEY (library_id) REFERENCES library(library_id),
    UNIQUE KEY (user_id, book_id)
);

CREATE TABLE wishlist (
    wishlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    priority TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id),
    UNIQUE KEY (user_id, book_id)
);

CREATE TABLE search_history (
    search_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    search_query TEXT NOT NULL,
    search_type ENUM('book', 'author', 'isbn') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(user_id)
);

CREATE TABLE notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    search_id INT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id),
    FOREIGN KEY (search_id) REFERENCES search_history(search_id)
);

CREATE TABLE cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shipping_address_id INT NOT NULL,
  payment_method VARCHAR(50),
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
