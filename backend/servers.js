const express = require('express');
// const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// Datenbankkonfiguration
 const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'sebastian88',
    database: 'bookbay',
    waitForConnections: true,
    connectionLimit: 10
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

// Benutzerregistrierung
app.post('/api/v1/auth/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, user_type, payment_method } = req.body;
    try {
        // Überprüfen, ob der Benutzer bereits existiert
        const [users] = await pool.query('SELECT user_id FROM user WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Passwort hashen
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO user (username, email, password_hash, user_type, payment_method) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, user_type, payment_method]
        );

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
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

// Verfügbare Bücher abrufen
app.get('/api/books', async (req, res) => {
    try {
        const [books] = await pool.query('SELECT * FROM book');
        res.json(books);
    } catch (err) {
        console.error('Fehler beim Abrufen der Bücher:', err);
        res.status(500).send('Interner Serverfehler');
    }
});

// Beispielbuch abrufen
app.get('/api/book/sample', async (req, res) => {
    try {
        const [books] = await pool.query('SELECT * FROM book LIMIT 1');
        if (books.length === 0) {
            return res.status(404).send('Keine Bücher gefunden');
        }
        res.json(books[0]);
    } catch (err) {
        console.error('Fehler beim Abrufen des Beispielbuchs:', err);
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

const PORT = 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));