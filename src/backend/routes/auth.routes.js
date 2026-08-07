
///src/routes/auth.routes.js 
const router = require('express').Router();
const { login, refresh, logout, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

router.post('/refresh',
  body('refreshToken').notEmpty(),
  validate,
  refresh
);

router.post('/logout', authenticate, logout);

router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  changePassword
);

module.exports = router;


