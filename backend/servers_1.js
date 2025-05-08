const express = require('express');
const mysql = require('mysql2/promise'); // 使用Promise接口
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库配置
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Breakout_4',
    database: 'bookbay',
    waitForConnections: true,
    connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);

// JWT配置
const JWT_SECRET = 'your_jwt_secret_key';

// 认证中间件
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// 用户注册
app.post('/api/v1/auth/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 8 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, user_type, payment_method } = req.body;
    try {
        // 检查用户是否存在
        const [users] = await pool.query('SELECT id FROM user WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 哈希密码
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

// 用户登录
app.post('/api/v1/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM user WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // 生成JWT
        const token = jwt.sign(
            { userId: user.id, userType: user.user_type },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 购物车模块
app.get('/api/v1/cart', authenticate, async (req, res) => {
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
        res.status(500).json({ message: 'Server error' });
    }
});

// 商品模块
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
        res.status(500).json({ message: 'Server error' });
    }
});

// 订单模块
app.post('/api/v1/orders', authenticate, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 创建订单
        const [orderResult] = await connection.query(
            'INSERT INTO orders (user_id, shipping_address_id, payment_method) VALUES (?, ?, ?)',
            [req.user.userId, req.body.shipping_address_id, req.body.payment_method]
        );

        // 添加订单项
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
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

// 其他模块实现类似，以下是管理功能示例
app.post('/api/v1/admin/pricing', authenticate, async (req, res) => {
    // 检查管理员权限
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { category, adjustment } = req.body;
    try {
        await pool.query(
            'UPDATE book SET price = price * ? WHERE category = ?',
            [adjustment, category]
        );
        res.json({ message: 'Prices updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));