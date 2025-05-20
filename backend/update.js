router.post('/api/v1/auth/register', [
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