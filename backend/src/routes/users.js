const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { checkUserQuota, requireActiveSubscription } = require('../middleware/quota');

router.use(authenticate);
router.use(tenantContext);
router.use(authorize('ADMIN'));

router.get('/', getUsers);
router.post('/', requireActiveSubscription, checkUserQuota, createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
