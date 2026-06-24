import express from 'express';
import * as dataController from '../controllers/data.controller';
import { requireSession, requirePageAction, requireAnyPageAction, requireActiveSubscription } from '../middleware/auth';

const router = express.Router();

router.use(requireSession);

router.post('/bootstrap', requirePageAction('Dashboard', 'view'), dataController.bootstrap);
router.post('/profile/save', requireActiveSubscription, requirePageAction('Settings', 'edit'), dataController.saveProfile);
router.post('/customers/save', requireActiveSubscription, requireAnyPageAction('Profiles', ['create', 'edit']), dataController.saveCustomer);
router.post('/customers/delete', requireActiveSubscription, requirePageAction('Profiles', 'delete'), dataController.deleteCustomer);
router.post('/sales/save', requireActiveSubscription, requireAnyPageAction('Sales', ['create', 'edit']), dataController.saveSale);
router.post('/sales/delete', requireActiveSubscription, requirePageAction('Sales', 'delete'), dataController.deleteSale);
router.post('/sales/mark-paid', requireActiveSubscription, requirePageAction('Sales', 'edit'), dataController.markSalePaid);
router.post('/prices/save', requireActiveSubscription, requirePageAction('Settings', 'edit'), dataController.savePrice);
router.post('/inventory/save', requireActiveSubscription, requireAnyPageAction('Inventory', ['create', 'edit']), dataController.saveInventory);
router.post('/billing/save', requireActiveSubscription, requirePageAction('Settings', 'edit'), dataController.saveBilling);
router.post('/audit/log', dataController.logAudit);
router.post('/audit/list', requireActiveSubscription, requirePageAction('Settings', 'view'), dataController.listAudit);
router.post('/import', dataController.importData);

export default router;
