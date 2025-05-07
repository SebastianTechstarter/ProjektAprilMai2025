-- Benutzertabelle
CREATE TABLE user (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL, -- Benutzername, eindeutig und erforderlich
    password_hash CHAR(255) NOT NULL, -- Passwort-Hash mit BCrypt gespeichert
    email VARCHAR(100) UNIQUE NOT NULL, -- E-Mail-Adresse, eindeutig und erforderlich
    user_type ENUM('admin','privat', 'gewerblich') NOT NULL, -- Benutzertyp: privat oder gewerblich
    payment_method ENUM('paypal', 'iban', 'creditcard') NOT NULL, -- Zahlungsmethode: PayPal, IBAN oder Kreditkarte
    paypal_account VARCHAR(100), -- PayPal-Konto
    iban VARCHAR(34), -- IBAN-Nummer
    creditcard_last4 CHAR(4), -- Letzte 4 Ziffern der Kreditkarte
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Erstellungszeit, Standard ist die aktuelle Zeit
);

-- Adresstabelle (unterstützt mehrere Adressen)
CREATE TABLE address (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID, Fremdschlüssel
    address_type ENUM('shipping', 'invoice', 'packstation') NOT NULL, -- Adresstyp: Versandadresse, Rechnungsadresse oder Packstation
    street VARCHAR(100) NOT NULL, -- Straße
    house_number VARCHAR(20), -- Hausnummer
    post_office_box VARCHAR(20), -- Postfach
    postal_code VARCHAR(20) NOT NULL, -- Postleitzahl
    city VARCHAR(100) NOT NULL, -- Stadt
    country VARCHAR(50) DEFAULT 'DE', -- Land, Standard ist Deutschland
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE -- Fremdschlüssel, löscht Adressen, wenn der Benutzer gelöscht wird
);

-- Verlagstabelle
CREATE TABLE publisher (
    publisher_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- Verlagsname, eindeutig und erforderlich
    contact_info TEXT -- Kontaktinformationen
);

-- Kategorietabelle
CREATE TABLE category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- Kategoriename, eindeutig und erforderlich
    parent_category_id INT, -- ID der übergeordneten Kategorie
    FOREIGN KEY (parent_category_id) REFERENCES category(category_id) -- Fremdschlüssel, verweist auf die übergeordnete Kategorie
);

-- Büchertabelle
CREATE TABLE book (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(17) UNIQUE NOT NULL, -- ISBN-13 mit optionalen Bindestrichen
    title VARCHAR(255) NOT NULL, -- Buchtitel
    author VARCHAR(100) NOT NULL, -- Autor
    description LONGTEXT, -- Beschreibung
    page_count INT UNSIGNED, -- Seitenanzahl
    publication_year SMALLINT, -- Veröffentlichungsjahr
    quality TINYINT CHECK (quality BETWEEN 1 AND 5), -- Qualitätsbewertung, 1 = schlecht, 5 = neu
    price DECIMAL(10,2) NOT NULL, -- Preis
    cover_design JSON, -- Cover-Design im JSON-Format gespeichert
    publisher_id INT, -- Verlags-ID
    category_id INT, -- Kategorie-ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Erstellungszeit
    FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id), -- Fremdschlüssel, verweist auf den Verlag
    FOREIGN KEY (category_id) REFERENCES category(category_id) -- Fremdschlüssel, verweist auf die Kategorie
);

-- Benutzerspezifische Bibliothekstabelle (unterstützt mehrere Bibliotheken)
CREATE TABLE library (
    library_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID
    name VARCHAR(100) NOT NULL, -- Bibliotheksname
    is_default BOOLEAN DEFAULT FALSE, -- Ob es sich um die Standardbibliothek handelt
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE -- Fremdschlüssel, löscht Bibliotheken, wenn der Benutzer gelöscht wird
);

-- Benutzer-Buch-Beziehungstabelle (einschließlich Transaktionsstatus)
CREATE TABLE user_books (
    user_book_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID
    book_id INT NOT NULL, -- Buch-ID
    library_id INT NOT NULL, -- Bibliotheks-ID
    is_for_sale BOOLEAN DEFAULT FALSE, -- Ob das Buch zum Verkauf steht
    condition_notes TEXT, -- Notizen zum Zustand des Buches
    price_override DECIMAL(10,2), -- Angepasster Preis
    status ENUM('available', 'sold', 'reserved') DEFAULT 'available', -- Status: verfügbar, verkauft, reserviert
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Erstellungszeit
    FOREIGN KEY (user_id) REFERENCES user(user_id), -- Fremdschlüssel, verweist auf den Benutzer
    FOREIGN KEY (book_id) REFERENCES book(book_id), -- Fremdschlüssel, verweist auf das Buch
    FOREIGN KEY (library_id) REFERENCES library(library_id), -- Fremdschlüssel, verweist auf die Bibliothek
    UNIQUE KEY (user_id, book_id) -- Eindeutige Kombination aus Benutzer und Buch
);

-- Wunschlistentabelle
CREATE TABLE wishlist (
    wishlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID
    book_id INT NOT NULL, -- Buch-ID
    priority TINYINT DEFAULT 1, -- Priorität
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Erstellungszeit
    FOREIGN KEY (user_id) REFERENCES user(user_id), -- Fremdschlüssel, verweist auf den Benutzer
    FOREIGN KEY (book_id) REFERENCES book(book_id), -- Fremdschlüssel, verweist auf das Buch
    UNIQUE KEY (user_id, book_id) -- Eindeutige Kombination aus Benutzer und Buch
);

-- Suchhistorientabelle (für Benachrichtigungen)
CREATE TABLE search_history (
    search_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID
    search_query TEXT NOT NULL, -- Suchanfrage
    search_type ENUM('book', 'author', 'isbn') NOT NULL, -- Suchtyp: Buch, Autor oder ISBN
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Erstellungszeit
    FOREIGN KEY (user_id) REFERENCES user(user_id) -- Fremdschlüssel, verweist auf den Benutzer
);

-- Benachrichtigungstabelle
CREATE TABLE notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Benutzer-ID
    book_id INT NOT NULL, -- Buch-ID
    search_id INT, -- Such-ID
    message TEXT NOT NULL, -- Benachrichtigungsnachricht
    is_read BOOLEAN DEFAULT FALSE, -- Ob die Benachrichtigung gelesen wurde
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Erstellungszeit
    FOREIGN KEY (user_id) REFERENCES user(user_id), -- Fremdschlüssel, verweist auf den Benutzer
    FOREIGN KEY (book_id) REFERENCES book(book_id), -- Fremdschlüssel, verweist auf das Buch
    FOREIGN KEY (search_id) REFERENCES search_history(search_id) -- Fremdschlüssel, verweist auf die Suchhistorie
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
