const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());

// Datenbankkonfiguration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Breakout_4',
    database: 'bookbay',
    waitForConnections: true,
    connectionLimit: 1000
};

const pool = mysql.createPool(dbConfig);

// JWT-Konfiguration
const JWT_SECRET = 'breakout4';

// Authentifizierungsmiddleware
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // decoded 中已经包含 userType
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

app.post('/api/v1/auth/register', [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, user_type, payment_method } = req.body;

    try {
        const [existingUsers] = await pool.query(
            'SELECT user_id FROM user WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Email is already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO user (username, email, password_hash, user_type, payment_method) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, user_type, payment_method || null]
        );

        return res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});


// Benutzeranmeldung
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT user_id, email, password_hash, user_type FROM user WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // JWT generieren
        const token = jwt.sign(
            { userId: user.user_id, userType: user.user_type },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { userId: user.user_id, userType: user.user_type } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/v1/address/:addressId', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Überprüfung der Benutzertypen
    if (req.user.userType !== 'privat' && req.user.userType !== 'gewerblich') {
        return res.status(403).json({ message: 'Verboten: Keine Privater oder Gewerbliche Rechte' });
    }

    const addressId = req.params.addressId;
    const updateFields = req.body;

    try {
        // Dynamisches Erstellen von SQL-Update-Anweisungen (um SQL-Injection zu verhindern)
        const setClauses = [];
        const values = [];

        // Durchlaufen des Anfragekörpers, Filtern von Nullwerten und Erstellen von Update-Feldern
        Object.entries(updateFields).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        });

        // Hinzufügen der Adresse-ID am Ende der Parameter
        values.push(addressId);

        if (setClauses.length === 0) {
            return res.status(400).json({ message: 'Keine gültigen Felder zum Aktualisieren' });
        }

        // Ausführen der Update-Abfrage
        const sql = `UPDATE address SET ${setClauses.join(', ')} WHERE address_id = ?`;
        const [result] = await pool.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Adresse nicht gefunden' });
        }

        res.json({ message: 'Adresse erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Update-Fehler:', err);
        res.status(500).json({ message: 'Serverfehler beim Aktualisieren der Adresse' });
    }
});

// Verfügbare Bücher abrufen
app.get('/api/books', async (req, res) => {
    try {
        const [books] = await pool.query('SELECT * FROM book');
        console.log(books)
        res.json(books);
    } catch (err) {
        console.error('Fehler beim Abrufen der Bücher:', err);
        res.status(500).send('Interner Serverfehler');
    }
});

// Warenkorbmodul
app.get('/api/v1/cart', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const [cartItems] = await pool.query(`
            SELECT c.*, b.title, b.price
            FROM cart c
            JOIN book b ON c.book_id = b.id
            WHERE c.user_id = ?
        `, [req.user.userId]);

        res.json(cartItems);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Serverfehler' });
    }
});

// Produktmodul
app.get('/api/v1/shop', async (req, res) => {
    try {
        const { category, price_min, price_max, sort } = req.query;
        let query = 'SELECT * FROM book WHERE status = "available"';
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        if (price_min) {
            query += ' AND price >= ?';
            params.push(price_min);
        }
        if (price_max) {
            query += ' AND price <= ?';
            params.push(price_max);
        }
        if (sort) {
            query += ` ORDER BY ${sort.replace('-', '')} ${sort.startsWith('-') ? 'DESC' : 'ASC'}`;
        }

        const [books] = await pool.query(query, params);
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Serverfehler' });
    }
});

// Bestellmodul
app.post('/api/v1/orders', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Bestellung erstellen
        const [orderResult] = await connection.query(
            'INSERT INTO orders (user_id, shipping_address_id, payment_method) VALUES (?, ?, ?)',
            [req.user.user_id, req.body.shipping_address_id, req.body.payment_method]
        );

        // Bestellpositionen hinzufügen
        const orderId = orderResult.insertId;
        for (const item of req.body.items) {
            await connection.query(
                'INSERT INTO order_items (order_id, book_id, quantity) VALUES (?, ?, ?)',
                [orderId, item.book_id, item.quantity]
            );
        }

        await connection.commit();
        res.status(201).json({ orderId });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: 'Serverfehler' });
    } finally {
        connection.release();
    }
});

// Verwaltungsfunktion: Buchpreise aktualisieren
app.post('/api/v1/admin/pricing', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Administratorrechte prüfen
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Verboten' });
    }

    const { title, adjustment } = req.body;
    try {
        await pool.query(
            'UPDATE book SET price = price * ? WHERE title = ?',
            [adjustment, title]
        );
        res.json({ message: 'Preise erfolgreich aktualisiert' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Serverfehler' });
    }
});

// Aktualisierung von Buchinformationen (mit Berechtigungsprüfung)
app.put('/api/v1/books/:id', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Überprüfung der Administratorrechte
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Verboten: Keine Admin-Rechte' });
    }

    const bookId = req.params.id;
    const updateFields = req.body;

    try {
        // Dynamisches Erstellen von SQL-Update-Anweisungen (um SQL-Injection zu verhindern)
        const setClauses = [];
        const values = [];

        // Durchlaufen des Anfragekörpers, Filtern von Nullwerten und Erstellen von Update-Feldern
        Object.entries(updateFields).forEach(([key, value]) => {
            if (value !== null && value !== undefined && key !== 'id') {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        });

        // Hinzufügen der Buch-ID am Ende der Parameter
        values.push(bookId);

        if (setClauses.length === 0) {
            return res.status(400).json({ message: 'Keine gültigen Felder zum Aktualisieren' });
        }

        // Ausführen der Update-Abfrage
        const sql = `UPDATE book SET ${setClauses.join(', ')} WHERE book_id = ?`;
        const [result] = await pool.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        res.json({ message: 'Buchinformationen erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Update-Fehler:', err);
        res.status(500).json({ message: 'Serverfehler beim Aktualisieren' });
    }
});

// Buchinformationen aktualisieren oder anpassen (mit Berechtigungsprüfung)
app.patch('/api/v1/books/:id', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Überprüfung der Administratorrechte
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Verboten: Keine Admin-Rechte' });
    }

    const bookId = req.params.id;
    const updateFields = req.body;

    try {
        // Dynamisches Erstellen von SQL-Update-Anweisungen (um SQL-Injection zu verhindern)
        const setClauses = [];
        const values = [];

        // Durchlaufen des Anfragekörpers, Filtern von Nullwerten und Erstellen von Update-Feldern
        Object.entries(updateFields).forEach(([key, value]) => {
            if (value !== null && value !== undefined && key !== 'id') {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
        });

        // Hinzufügen der Buch-ID am Ende der Parameter
        values.push(bookId);

        if (setClauses.length === 0) {
            return res.status(400).json({ message: 'Keine gültigen Felder zum Aktualisieren' });
        }

        // Ausführen der Update-Abfrage
        const sql = `UPDATE book SET ${setClauses.join(', ')} WHERE book_id = ?`;
        const [result] = await pool.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        res.json({ message: 'Buchinformationen erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Update-Fehler:', err);
        res.status(500).json({ message: 'Serverfehler beim Aktualisieren' });
    }
});

// Buch löschen (mit Berechtigungsprüfung)
app.delete('/api/v1/books/:id', authenticate, async (req, res) => {
    if (!req.user || !req.user.userType) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Überprüfung der Administratorrechte
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Verboten: Keine Admin-Rechte' });
    }

    const bookId = req.params.id;

    try {
        // Ausführung der Löschabfrage
        const sql = 'DELETE FROM book WHERE book_id = ?';
        const [result] = await pool.query(sql, [bookId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        res.status(204).send(); // Keine Inhalte zurückgeben (erfolgreich gelöscht)
    } catch (err) {
        console.error('Fehler beim Löschen:', err);
        res.status(500).json({ message: 'Serverfehler beim Löschen' });
    }
});

// 1. Warenkorbverwaltung (nur für privat/Gewerbliche Nutzer)
// Artikel in den Warenkorb legen
app.post('/api/v1/cart', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { book_id, quantity = 1 } = req.body;

    try {
        // Prüfen, ob das Buch existiert
        const [book] = await pool.query('SELECT book_id FROM book WHERE book_id = ?', [book_id]);
        if (book.length === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        // Warenkorb-Eintrag erstellen
        await pool.query(
            'INSERT INTO cart (user_id, book_id, quantity) VALUES (?, ?, ?)',
            [req.user.userId, book_id, quantity]
        );

        res.status(201).json({ message: 'Artikel zum Warenkorb hinzugefügt' });
    } catch (err) {
        console.error('Warenkorb-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Warenkorb aktualisieren
app.put('/api/v1/cart/:cartId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { quantity } = req.body;
    const cartId = req.params.cartId;

    try {
        await pool.query(
            'UPDATE cart SET quantity = ? WHERE user_id = ? AND cart_id = ?',
            [quantity, req.user.userId, cartId]
        );

        res.json({ message: 'Warenkorb aktualisiert' });
    } catch (err) {
        console.error('Warenkorb-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Warenkorb löschen
app.delete('/api/v1/cart/:cartId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const cartId = req.params.cartId;

    try {
        const [result] = await pool.query(
            'DELETE FROM cart WHERE user_id = ? AND cart_id = ?',
            [req.user.userId, cartId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Warenkorb-Eintrag nicht gefunden' });
        }

        res.json({ message: 'Warenkorb-Eintrag gelöscht' });
    } catch (err) {
        console.error('Warenkorb-Löschfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// 2. Adresseverwaltung (nur für privat/Gewerbliche Nutzer)
// Adresse speichern
app.post('/api/v1/addresses', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { address_type, street, house_number, post_office_box, postal_code, city, country } = req.body;

    try {
        await pool.query(
            'INSERT INTO address (user_id, address_type, street, house_number, post_office_box, postal_code, city, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?,)',
            [req.user.userId, address_type, street, house_number, post_office_box, postal_code, city, country]
        );

        res.status(201).json({ message: 'Adresse gespeichert' });
    } catch (err) {
        console.error('Adressenspeicherungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Adresse aktualisieren
app.put('/api/v1/addresses/:addressId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const updateData = req.body;
    const addressId = req.params.addressId;

    try {
        await pool.query(
            'UPDATE address SET ? WHERE address_id = ? AND user_id = ?',
            [updateData, addressId, req.user.userId]
        );

        res.json({ message: 'Adresse aktualisiert' });
    } catch (err) {
        console.error('Adressaktualisierungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Adresse löschen
app.delete('/api/v1/addresses/:addressId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const addressId = req.params.addressId;

    try {
        const [result] = await pool.query(
            'DELETE FROM address WHERE address_id = ? AND user_id = ?',
            [addressId, req.user.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Adresse nicht gefunden' });
        }

        res.json({ message: 'Adresse gelöscht' });
    } catch (err) {
        console.error('Adresslöschfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// 3. Wunschliste-Verwaltung (nur für privat/Gewerbliche Nutzer)
// In Wunschliste hinzufügen
app.post('/api/v1/wishlist', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { book_id, priority = 1 } = req.body;

    try {
        // Prüfen, ob das Buch existiert
        const [book] = await pool.query('SELECT book_id FROM book WHERE book_id = ?', [book_id]);
        if (book.length === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        // Wunschliste-Eintrag erstellen
        await pool.query(
            'INSERT INTO wishlist (user_id, book_id, priority) VALUES (?, ?, ?)',
            [req.user.userId, book_id, priority]
        );

        res.status(201).json({ message: 'In Wunschliste hinzugefügt' });
    } catch (err) {
        console.error('Wunschlisten-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Wunschliste-Eintrag löschen
app.delete('/api/v1/wishlist/:wishlistId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const wishlistId = req.params.wishlistId;

    try {
        const [result] = await pool.query(
            'DELETE FROM wishlist WHERE wishlist_id = ? AND user_id = ?',
            [wishlistId, req.user.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Wunschliste-Eintrag nicht gefunden' });
        }

        res.json({ message: 'Wunschliste-Eintrag gelöscht' });
    } catch (err) {
        console.error('Wunschlisten-Löschfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// 4. Buchverwaltung (nur für Administratoren)
// Neues Buch erstellen
app.post('/api/v1/books', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const {
        isbn, title, author, description, page_count, publication_year,
        quality, price, cover_design, publisher_id, category_id
    } = req.body;

    try {
        // Pflichtfelder-Prüfung
        if (!isbn || !title || !author || !price || !publisher_id || !category_id) {
            return res.status(400).json({ message: 'Fehlende Pflichtfelder' });
        }

        // Neues Buch erstellen
        const [result] = await pool.query(
            'INSERT INTO book SET ?',
            {
                isbn, title, author, description, page_count, publication_year,
                quality, price, cover_design, publisher_id, category_id, created_at: new Date()
            }
        );

        res.status(201).json({
            message: 'Buch erfolgreich erstellt',
            bookId: result.insertId
        });
    } catch (err) {
        console.error('Bucherstellung-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Verlagsverwaltung (nur für Admins)
// Verlag erstellen
app.post('/api/v1/publishers', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { name, contact_info } = req.body;

    try {
        // Überprüfen auf Pflichtfelder
        if (!name) {
            return res.status(400).json({ message: 'Verlagsname ist erforderlich' });
        }

        // Neuen Verlag erstellen
        const [result] = await pool.query(
            'INSERT INTO publisher (name, contact_info) VALUES (?, ?)',
            [name, contact_info]
        );

        res.status(201).json({
            message: 'Verlag erfolgreich erstellt',
            publisherId: result.insertId
        });
    } catch (err) {
        console.error('Verlags-Erstellungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Verlage suchen
app.get('/api/v1/publishers', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { name } = req.query;

    try {
        let query = 'SELECT * FROM publisher WHERE 1=1';
        const params = [];

        if (name) {
            query += ' AND name LIKE ?';
            params.push(`%${name}%`);
        }

        const [publishers] = await pool.query(query, params);
        res.json(publishers);
    } catch (err) {
        console.error('Verlags-Suchfehler:', err);
        res.status(500).json({ message: 'Suchfehler' });
    }
});

// Verlag aktualisieren
app.put('/api/v1/publishers/:publisherId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const publisherId = req.params.publisherId;
    const updateData = req.body;

    try {
        // Überprüfen ob Verlag existiert
        const [existingPublisher] = await pool.query(
            'SELECT publisher_id FROM publisher WHERE publisher_id = ?',
            [publisherId]
        );
        if (existingPublisher.length === 0) {
            return res.status(404).json({ message: 'Verlag nicht gefunden' });
        }

        // Aktualisieren
        await pool.query(
            'UPDATE publisher SET ? WHERE publisher_id = ?',
            [updateData, publisherId]
        );

        res.json({ message: 'Verlag erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Verlags-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Aktualisierungsfehler' });
    }
});

// Verlag löschen
app.delete('/api/v1/publishers/:publisherId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const publisherId = req.params.publisherId;

    try {
        // Überprüfen ob Verlag existiert
        const [existingPublisher] = await pool.query(
            'SELECT publisher_id FROM publisher WHERE publisher_id = ?',
            [publisherId]
        );
        if (existingPublisher.length === 0) {
            return res.status(404).json({ message: 'Verlag nicht gefunden' });
        }

        // Löschen
        await pool.query(
            'DELETE FROM publisher WHERE publisher_id = ?',
            [publisherId]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Verlags-Löschfehler:', err);
        res.status(500).json({ message: 'Löschfehler' });
    }
});

// Kategorienverwaltung (nur für Admins)
// Kategorie erstellen
app.post('/api/v1/categories', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { name } = req.body;

    try {
        // Überprüfen auf Pflichtfelder
        if (!name) {
            return res.status(400).json({ message: 'Kategoriename ist erforderlich' });
        }

        // Neue Kategorie erstellen
        const [result] = await pool.query(
            'INSERT INTO category (name,) VALUES (?)',
            [name]
        );

        res.status(201).json({
            message: 'Kategorie erfolgreich erstellt',
            categoryId: result.insertId
        });
    } catch (err) {
        console.error('Kategorie-Erstellungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Kategorien suchen
app.get('/api/v1/categories', async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM category');
        res.json(categories);
    } catch (err) {
        console.error('Kategorie-Suchfehler:', err);
        res.status(500).json({ message: 'Suchfehler' });
    }
});

// Kategorie aktualisieren
app.put('/api/v1/categories/:categoryId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const categoryId = req.params.categoryId;
    const updateData = req.body;

    try {
        // Überprüfen ob Kategorie existiert
        const [existingCategory] = await pool.query(
            'SELECT category_id FROM category WHERE category_id = ?',
            [categoryId]
        );
        if (existingCategory.length === 0) {
            return res.status(404).json({ message: 'Kategorie nicht gefunden' });
        }

        // Aktualisieren
        await pool.query(
            'UPDATE category SET ? WHERE category_id = ?',
            [updateData, categoryId]
        );

        res.json({ message: 'Kategorie erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Kategorie-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Aktualisierungsfehler' });
    }
});

// Kategorie löschen
app.delete('/api/v1/categories/:categoryId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const categoryId = req.params.categoryId;

    try {
        // Überprüfen ob Kategorie existiert
        const [existingCategory] = await pool.query(
            'SELECT category_id FROM category WHERE category_id = ?',
            [categoryId]
        );
        if (existingCategory.length === 0) {
            return res.status(404).json({ message: 'Kategorie nicht gefunden' });
        }

        // Löschen
        await pool.query(
            'DELETE FROM category WHERE category_id = ?',
            [categoryId]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Kategorie-Löschfehler:', err);
        res.status(500).json({ message: 'Löschfehler' });
    }
});

// Bibliotheksverwaltung (nur für Privat/Gewerblich)
// Bibliothek erstellen
app.post('/api/v1/libraries', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { name, is_default } = req.body;

    try {
        // Überprüfen auf Pflichtfelder
        if (!name) {
            return res.status(400).json({ message: 'Bibliotheksname ist erforderlich' });
        }

        // Neue Bibliothek erstellen
        const [result] = await pool.query(
            'INSERT INTO library (user_id, name, is_default) VALUES (?, ?, ?)',
            [req.user.userId, name, is_default]
        );

        res.status(201).json({
            message: 'Bibliothek erfolgreich erstellt',
            libraryId: result.insertId
        });
    } catch (err) {
        console.error('Bibliotheks-Erstellungsfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Bibliothek aktualisieren
app.put('/api/v1/libraries/:libraryId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const libraryId = req.params.libraryId;
    const updateData = req.body;

    try {
        // Überprüfen ob Bibliothek existiert
        const [existingLibrary] = await pool.query(
            'SELECT library_id FROM library WHERE library_id = ? AND user_id = ?',
            [libraryId, req.user.userId]
        );
        if (existingLibrary.length === 0) {
            return res.status(404).json({ message: 'Bibliothek nicht gefunden' });
        }

        // Aktualisieren
        await pool.query(
            'UPDATE library SET ? WHERE library_id = ?',
            [updateData, libraryId]
        );

        res.json({ message: 'Bibliothek erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Bibliotheks-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Aktualisierungsfehler' });
    }
});

// Bibliothek löschen
app.delete('/api/v1/libraries/:libraryId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const libraryId = req.params.libraryId;

    try {
        // Überprüfen ob Bibliothek existiert
        const [existingLibrary] = await pool.query(
            'SELECT library_id FROM library WHERE library_id = ? AND user_id = ?',
            [libraryId, req.user.userId]
        );
        if (existingLibrary.length === 0) {
            return res.status(404).json({ message: 'Bibliothek nicht gefunden' });
        }

        // Löschen
        await pool.query(
            'DELETE FROM library WHERE library_id = ?',
            [libraryId]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Bibliotheks-Löschfehler:', err);
        res.status(500).json({ message: 'Löschfehler' });
    }
});

// Benutzer-Buch-Verwaltung (nur für Privat/Gewerblich)
// Buch zum Benutzer hinzufügen
app.post('/api/v1/user-books', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { book_id, library_id, is_for_sale, condition_notes, price_override } = req.body;

    try {
        // Überprüfen ob Buch existiert
        const [book] = await pool.query(
            'SELECT book_id FROM book WHERE book_id = ?',
            [book_id]
        );
        if (book.length === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        // Überprüfen ob Bibliothek zum Benutzer gehört
        const [library] = await pool.query(
            'SELECT library_id FROM library WHERE library_id = ? AND user_id = ?',
            [library_id, req.user.userId]
        );
        if (library.length === 0) {
            return res.status(404).json({ message: 'Bibliothek nicht gefunden' });
        }

        // Hinzufügen
        const [result] = await pool.query(
            'INSERT INTO user_books (user_id, book_id, library_id, is_for_sale, condition_notes, price_override) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.userId, book_id, library_id, is_for_sale, condition_notes, price_override]
        );

        res.status(201).json({
            message: 'Buch erfolgreich hinzugefügt',
            userBookId: result.insertId
        });
    } catch (err) {
        console.error('Benutzer-Buch-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Benutzer-Bücher suchen
app.get('/api/v1/user-books', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { book_id, status, library_id } = req.query;

    try {
        let query = `
            SELECT ub.*, b.title, b.author, b.price AS book_price
            FROM user_books ub
            JOIN book b ON ub.book_id = b.book_id
            WHERE ub.user_id = ?
        `;
        const params = [req.user.userId];

        if (book_id) params.push(book_id);
        if (status) params.push(status);
        if (library_id) params.push(library_id);

        // Dynamische WHERE-Klauseln erstellen
        const whereClauses = [];
        if (book_id) whereClauses.push('ub.book_id = ?');
        if (status) whereClauses.push('ub.status = ?');
        if (library_id) whereClauses.push('ub.library_id = ?');

        if (whereClauses.length > 0) {
            query += ' AND ' + whereClauses.join(' AND ');
        }

        const [userBooks] = await pool.query(query, params);
        res.json(userBooks);
    } catch (err) {
        console.error('Benutzer-Bücher-Suchfehler:', err);
        res.status(500).json({ message: 'Suchfehler' });
    }
});

// Benutzer-Buch aktualisieren
app.put('/api/v1/user-books/:userBookId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const userBookId = req.params.userBookId;
    const updateData = req.body;

    try {
        // Überprüfen ob Eintrag existiert
        const [existingEntry] = await pool.query(
            'SELECT user_book_id FROM user_books WHERE user_book_id = ? AND user_id = ?',
            [userBookId, req.user.userId]
        );
        if (existingEntry.length === 0) {
            return res.status(404).json({ message: 'Eintrag nicht gefunden' });
        }

        // Aktualisieren
        await pool.query(
            'UPDATE user_books SET ? WHERE user_book_id = ?',
            [updateData, userBookId]
        );

        res.json({ message: 'Eintrag erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Benutzer-Buch-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Aktualisierungsfehler' });
    }
});

// Benutzer-Buch löschen
app.delete('/api/v1/user-books/:userBookId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const userBookId = req.params.userBookId;

    try {
        // Überprüfen ob Eintrag existiert
        const [existingEntry] = await pool.query(
            'SELECT user_book_id FROM user_books WHERE user_book_id = ? AND user_id = ?',
            [userBookId, req.user.userId]
        );
        if (existingEntry.length === 0) {
            return res.status(404).json({ message: 'Eintrag nicht gefunden' });
        }

        // Löschen
        await pool.query(
            'DELETE FROM user_books WHERE user_book_id = ?',
            [userBookId]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Benutzer-Buch-Löschfehler:', err);
        res.status(500).json({ message: 'Löschfehler' });
    }
});

// Bestellverwaltung (nur für Privat/Gewerblich)
// Bestellung erstellen
app.post('/api/v1/orders', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { shipping_address_id, payment_method, items } = req.body;

    try {
        // Transaktion starten
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        // Bestellung anlegen
        const [orderResult] = await connection.query(
            'INSERT INTO orders (user_id, shipping_address_id, payment_method) VALUES (?, ?, ?)',
            [req.user.userId, shipping_address_id, payment_method]
        );
        const orderId = orderResult.insertId;

        // Positionen hinzufügen
        for (const item of items) {
            await connection.query(
                'INSERT INTO order_items (order_id, book_id, quantity) VALUES (?, ?, ?)',
                [orderId, item.book_id, item.quantity]
            );
        }

        await connection.commit();
        res.status(201).json({ orderId });

    } catch (err) {
        await connection.rollback();
        console.error('Bestellungs-Fehler:', err);
        res.status(500).json({ message: 'Bestellung konnte nicht erstellt werden' });
    }
});

// Bestellungen suchen
app.get('/api/v1/orders', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { status, date_from, date_to } = req.query;

    try {
        let query = `
            SELECT o.*, b.title AS book_title, b.price AS book_price
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN book b ON oi.book_id = b.book_id
            WHERE o.user_id = ?
        `;
        const params = [req.user.userId];

        if (status) params.push(status);
        if (date_from) params.push(date_from);
        if (date_to) params.push(date_to);

        // Dynamische WHERE-Klauseln
        const whereClauses = [];
        if (status) whereClauses.push('o.status = ?');
        if (date_from && date_to) {
            whereClauses.push('o.created_at BETWEEN ? AND ?');
            params.push(date_from, date_to);
        } else if (date_from) {
            whereClauses.push('o.created_at >= ?');
            params.push(date_from);
        } else if (date_to) {
            whereClauses.push('o.created_at <= ?');
            params.push(date_to);
        }

        if (whereClauses.length > 0) {
            query += ' AND ' + whereClauses.join(' AND ');
        }

        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (err) {
        console.error('Bestell-Suchfehler:', err);
        res.status(500).json({ message: 'Suchfehler' });
    }
});

// Bestellung aktualisieren
app.put('/api/v1/orders/:orderId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const orderId = req.params.orderId;
    const updateData = req.body;

    try {
        // Überprüfen ob Bestellung existiert
        const [existingOrder] = await pool.query(
            'SELECT id FROM orders WHERE id = ? AND user_id = ?',
            [orderId, req.user.userId]
        );
        if (existingOrder.length === 0) {
            return res.status(404).json({ message: 'Bestellung nicht gefunden' });
        }

        // Aktualisieren
        await pool.query(
            'UPDATE orders SET ? WHERE id = ?',
            [updateData, orderId]
        );

        res.json({ message: 'Bestellung erfolgreich aktualisiert' });
    } catch (err) {
        console.error('Bestell-Aktualisierungsfehler:', err);
        res.status(500).json({ message: 'Aktualisierungsfehler' });
    }
});

// Bestellung löschen
app.delete('/api/v1/orders/:orderId', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const orderId = req.params.orderId;

    try {
        // Überprüfen ob Bestellung existiert
        const [existingOrder] = await pool.query(
            'SELECT id FROM orders WHERE id = ? AND user_id = ?',
            [orderId, req.user.userId]
        );
        if (existingOrder.length === 0) {
            return res.status(404).json({ message: 'Bestellung nicht gefunden' });
        }

        // Löschen
        await pool.query(
            'DELETE FROM orders WHERE id = ?',
            [orderId]
        );

        res.status(204).send();
    } catch (err) {
        console.error('Bestell-Löschfehler:', err);
        res.status(500).json({ message: 'Löschfehler' });
    }
});

// Benachrichtigungsverwaltung (für Benutzerkommunikation)
// Benachrichtigungen abrufen (nur für den eigenen Account)
app.get('/api/v1/notifications', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { page = 1, limit = 10, is_read = null } = req.query;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT n.*, u.username AS sender_name, b.title AS book_title, sh.search_query AS search_term
            FROM notification n
            LEFT JOIN user u ON n.user_id = u.user_id
            LEFT JOIN book b ON n.book_id = b.book_id
            LEFT JOIN search_history sh ON n.search_id = sh.search_id
            WHERE n.user_id = ?
        `;
        const params = [req.user.userId];

        // Filter für "is_read" hinzufügen wenn angegeben
        if (is_read !== null) {
            query += ' AND is_read = ?';
            params.push(is_read === 'true');
        }

        // Ergebnisse mit Pagination abrufen
        const [notifications] = await pool.query(query + ' LIMIT ?, ?', [...params, offset, limit]);
        const [total] = await pool.query('SELECT COUNT(*) AS total FROM notification WHERE user_id = ?', [req.user.userId]);

        res.json({
            notifications,
            pagination: {
                total: total[0].total,
                page,
                limit,
                totalPages: Math.ceil(total[0].total / limit)
            }
        });

    } catch (err) {
        console.error('Benachrichtigungs-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Benachrichtigung markieren als gelesen
app.patch('/api/v1/notifications/:notificationId/read', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const notificationId = req.params.notificationId;

    try {
        // Überprüfen ob Benutzer Eigentümer der Benachrichtigung ist
        const [existingNotification] = await pool.query(
            'SELECT user_id FROM notification WHERE notification_id = ?',
            [notificationId]
        );
        if (existingNotification.length === 0) {
            return res.status(404).json({ message: 'Benachrichtigung nicht gefunden' });
        }
        if (existingNotification[0].user_id !== req.user.userId && req.user.userType !== 'admin') {
            return res.status(403).json({ message: 'Nicht berechtigt' });
        }

        await pool.query(
            'UPDATE notification SET is_read = TRUE WHERE notification_id = ?',
            [notificationId]
        );

        res.json({ message: 'Benachrichtigung erfolgreich als gelesen markiert' });

    } catch (err) {
        console.error('Markierungs-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Benachrichtigung senden (nur für authentifizierte Benutzer)
app.post('/api/v1/notifications', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { recipient_id, book_id, search_id, message } = req.body;

    // Validierung der Eingabedaten
    if (!recipient_id || typeof recipient_id !== 'number') {
        return res.status(400).json({ message: 'Empfänger-ID ist erforderlich' });
    }
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Nachrichtinhalt ist erforderlich' });
    }

    try {
        // Überprüfen ob Empfänger existiert
        const [recipient] = await pool.query(
            'SELECT user_id FROM user WHERE user_id = ?',
            [recipient_id]
        );
        if (recipient.length === 0) {
            return res.status(404).json({ message: 'Empfänger nicht gefunden' });
        }

        // Benachrichtigung erstellen
        const [result] = await pool.query(
            'INSERT INTO notification (user_id, recipient_id, book_id, search_id, message) VALUES (?, ?, ?, ?, ?)',
            [req.user.userId, recipient_id, book_id, search_id, message]
        );

        res.status(201).json({
            message: 'Benachrichtigung erfolgreich gesendet',
            notificationId: result.insertId
        });

    } catch (err) {
        console.error('Sendefehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Administrationsfunktion: Alle ungelesenen Benachrichtigungen zurücksetzen
app.post('/api/v1/admin/reset-notifications', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    try {
        await pool.query(
            'UPDATE notification SET is_read = TRUE'
        );
        res.json({ message: 'Alle Benachrichtigungen erfolgreich als gelesen markiert' });
    } catch (err) {
        console.error('Reset-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Administrationsfunktion: Benachrichtigung löschen (nach ID)
app.delete('/api/v1/admin/notifications/:notificationId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const notificationId = req.params.notificationId;

    try {
        const [result] = await pool.query(
            'DELETE FROM notification WHERE notification_id = ?',
            [notificationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Benachrichtigung nicht gefunden' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Löschfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});
// Benachrichtigungsverwaltung (für Benutzerkommunikation)
// Benachrichtigungen abrufen (nur für den eigenen Account)
app.get('/api/v1/notifications', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { page = 1, limit = 10, is_read = null } = req.query;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT n.*, u.username AS sender_name, b.title AS book_title, sh.search_query AS search_term
            FROM notification n
            LEFT JOIN user u ON n.user_id = u.user_id
            LEFT JOIN book b ON n.book_id = b.book_id
            LEFT JOIN search_history sh ON n.search_id = sh.search_id
            WHERE n.user_id = ?
        `;
        const params = [req.user.userId];

        // Filter für "is_read" hinzufügen wenn angegeben
        if (is_read !== null) {
            query += ' AND is_read = ?';
            params.push(is_read === 'true');
        }

        // Ergebnisse mit Pagination abrufen
        const [notifications] = await pool.query(query + ' LIMIT ?, ?', [...params, offset, limit]);
        const [total] = await pool.query('SELECT COUNT(*) AS total FROM notification WHERE user_id = ?', [req.user.userId]);

        res.json({
            notifications,
            pagination: {
                total: total[0].total,
                page,
                limit,
                totalPages: Math.ceil(total[0].total / limit)
            }
        });

    } catch (err) {
        console.error('Benachrichtigungs-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Benachrichtigung markieren als gelesen
app.patch('/api/v1/notifications/:notificationId/read', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const notificationId = req.params.notificationId;

    try {
        // Überprüfen ob Benutzer Eigentümer der Benachrichtigung ist
        const [existingNotification] = await pool.query(
            'SELECT user_id FROM notification WHERE notification_id = ?',
            [notificationId]
        );
        if (existingNotification.length === 0) {
            return res.status(404).json({ message: 'Benachrichtigung nicht gefunden' });
        }
        if (existingNotification[0].user_id !== req.user.userId && req.user.userType !== 'admin') {
            return res.status(403).json({ message: 'Nicht berechtigt' });
        }

        await pool.query(
            'UPDATE notification SET is_read = TRUE WHERE notification_id = ?',
            [notificationId]
        );

        res.json({ message: 'Benachrichtigung erfolgreich als gelesen markiert' });

    } catch (err) {
        console.error('Markierungs-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Benachrichtigung senden (nur für authentifizierte Benutzer)
app.post('/api/v1/notifications', authenticate, async (req, res) => {
    if (!req.user || !['privat', 'gewerblich', 'admin'].includes(req.user.userType)) {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const { recipient_id, book_id, search_id, message } = req.body;

    // Validierung der Eingabedaten
    if (!recipient_id || typeof recipient_id !== 'number') {
        return res.status(400).json({ message: 'Empfänger-ID ist erforderlich' });
    }
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Nachrichtinhalt ist erforderlich' });
    }

    try {
        // Überprüfen ob Empfänger existiert
        const [recipient] = await pool.query(
            'SELECT user_id FROM user WHERE user_id = ?',
            [recipient_id]
        );
        if (recipient.length === 0) {
            return res.status(404).json({ message: 'Empfänger nicht gefunden' });
        }

        // Benachrichtigung erstellen
        const [result] = await pool.query(
            'INSERT INTO notification (user_id, recipient_id, book_id, search_id, message) VALUES (?, ?, ?, ?, ?)',
            [req.user.userId, recipient_id, book_id, search_id, message]
        );

        res.status(201).json({
            message: 'Benachrichtigung erfolgreich gesendet',
            notificationId: result.insertId
        });

    } catch (err) {
        console.error('Sendefehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Administrationsfunktion: Alle ungelesenen Benachrichtigungen zurücksetzen
app.post('/api/v1/admin/reset-notifications', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    try {
        await pool.query(
            'UPDATE notification SET is_read = TRUE'
        );
        res.json({ message: 'Alle Benachrichtigungen erfolgreich als gelesen markiert' });
    } catch (err) {
        console.error('Reset-Fehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

// Administrationsfunktion: Benachrichtigung löschen (nach ID)
app.delete('/api/v1/admin/notifications/:notificationId', authenticate, async (req, res) => {
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Zugriff verweigert' });
    }

    const notificationId = req.params.notificationId;

    try {
        const [result] = await pool.query(
            'DELETE FROM notification WHERE notification_id = ?',
            [notificationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Benachrichtigung nicht gefunden' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Löschfehler:', err);
        res.status(500).json({ message: 'Interner Serverfehler' });
    }
});

app.get('/api/v1/books/:id', async (req, res) => {
    const bookId = req.params.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM book WHERE book_id = ?',
            [bookId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Buch nicht gefunden' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Get-Fehler:', err);
        res.status(500).json({ message: 'Serverfehler beim Abrufen des Buches' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));