import express from 'express';
import * as usersController from '../controllers/users.controller';
import * as catalogController from '../controllers/catalog.controller';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

router.use(requireAdmin);

router.post('/users/list', usersController.listUsers);
router.post('/users/pages', usersController.listPages);
router.post('/users/create', usersController.createUser);
router.post('/users/update', usersController.updateUser);
router.post('/users/delete', usersController.removeUser);
router.post('/catalog/get', catalogController.getCatalog);
router.post('/catalog/update', catalogController.updateCatalog);

export default router;
