import { pool } from './pool.js';
import { initializeDatabase } from './init.js';
import * as finance from './finance.js';
import * as households from './households.js';
import * as users from './users.js';

function withInitialization(fn) {
  return async (...args) => {
    await initializeDatabase();
    return fn(...args);
  };
}

export { pool, initializeDatabase };

export const listSections = withInitialization(finance.listSections);
export const listCategories = withInitialization(finance.listCategories);
export const listEntries = withInitialization(finance.listEntries);
export const createSection = withInitialization(finance.createSection);
export const updateSection = withInitialization(finance.updateSection);
export const deleteSection = withInitialization(finance.deleteSection);
export const createCategory = withInitialization(finance.createCategory);
export const updateCategory = withInitialization(finance.updateCategory);
export const deleteCategory = withInitialization(finance.deleteCategory);
export const createEntry = withInitialization(finance.createEntry);
export const updateEntry = withInitialization(finance.updateEntry);
export const deleteEntry = withInitialization(finance.deleteEntry);

export const listHouseholds = withInitialization(households.listHouseholds);
export const findHouseholdById = withInitialization(households.findHouseholdById);
export const findHouseholdBySlug = withInitialization(households.findHouseholdBySlug);
export const createHousehold = withInitialization(households.createHousehold);
export const updateHousehold = withInitialization(households.updateHousehold);
export const deleteHousehold = withInitialization(households.deleteHousehold);

export const findUserByUsername = withInitialization(users.findUserByUsername);
export const findUserById = withInitialization(users.findUserById);
export const recordUserLogin = withInitialization(users.recordUserLogin);
export const listUsersSummary = withInitialization(users.listUsersSummary);
export const createUserAccount = withInitialization(users.createUserAccount);
export const updateUserPassword = withInitialization(users.updateUserPassword);
export const reassignUserHousehold = withInitialization(users.reassignUserHousehold);
export const setUserAdminFlag = withInitialization(users.setUserAdminFlag);
export const deleteUserAccount = withInitialization(users.deleteUserAccount);
export const countUsers = withInitialization(users.countUsers);
