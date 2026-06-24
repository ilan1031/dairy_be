# Dairy System - Backend API Documentation

Welcome to the API documentation for the Dairy System backend. This documentation is designed for mobile application developers integrating the backend endpoints.

## General Information

* **Base URL**: `http://<server-ip>:<port>/api`
* **HTTP Method**: **ALL** API routes (prefixed with `/api`) enforce the `POST` method. Any request sent with other methods (GET, PUT, DELETE, etc.) will receive a `405 Method Not Allowed` response.
* **Content-Type**: `application/json` is required for all request bodies.
* **Security & Authentication**:
  * Authentication uses multi-cookie session management.
  * Upon successful login or registration, the server sets three distinct HTTP-only cookies:
    1. `dairy_session`: Contains the active user identity session context (role, user ID, email). Used to control database data tenancy.
    2. `dairy_login`: Validates the authentication status. Enforces token expiry controls.
    3. `dairy_subscription`: Dictates user subscription status (active, blocked, plan type). Used by subscription billing check middlewares.
  * The client must preserve and send all three cookies in the `Cookie` header for protected endpoints (`Cookie: dairy_session=<token1>; dairy_login=<token2>; dairy_subscription=<token3>`).
  * If the HTTP client (e.g., Retrofit in Android/Kotlin, HttpClient in iOS/Swift, or Axios in React Native) does not automatically manage cookie storage, the tokens must be manually parsed from the `Set-Cookie` headers during login/registration and supplied in the `Cookie` header of subsequent requests.

---

## 1. Authentication & Session APIs (`/api/auth`)

### 1.1 Login
* **Route**: `/api/auth/login`
* **Method**: `POST`
* **Auth Required**: No
* **Description**: Authenticate a user or a super administrator.
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
* **Success Response (200 OK)**:
  *Sets `dairy_session` cookie in the header.*
  ```json
  {
    "success": true,
    "profile": {
      "businessName": "Dairy Farm",
      "ownerName": "John Doe",
      "mobileNumber": "1234567890",
      "emailAddress": "user@example.com",
      "signupTimestamp": 1785934000000,
      "isLightTheme": true,
      "language": "en"
    },
    "user": {
      "id": "user_id_123",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "user",
      "active": true,
      "profile": {
        "displayName": "John Doe",
        "phone": "1234567890"
      },
      "permissions": {
        "canCreate": true,
        "canRead": true,
        "canUpdate": true,
        "canDelete": false,
        "allowedPages": ["Dashboard", "Sales", "Bills", "Profiles", "Settings"]
      },
      "createdAt": 1785934000000,
      "updatedAt": 1785934000000
    },
    "isSuperAdmin": false
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"success": false, "error": "Email and password required"}`
  * `401 Unauthorized`: `{"success": false, "error": "Invalid email address or password"}`
  * `403 Forbidden`: `{"success": false, "error": "Account is inactive"}`
  * `500 Internal Error`: `{"success": false, "error": "<error message>"}`

---

### 1.2 Register
* **Route**: `/api/auth/register`
* **Method**: `POST`
* **Auth Required**: No
* **Description**: Register a new user account along with their business profile.
* **Request Body**:
  ```json
  {
    "businessName": "Dairy Farm",
    "ownerName": "John Doe",
    "mobileNumber": "1234567890",
    "emailAddress": "user@example.com",
    "password": "securepassword123"
  }
  ```
* **Success Response (200 OK)**:
  *Sets `dairy_session` cookie in the header.*
  ```json
  {
    "success": true,
    "profile": {
      "businessName": "Dairy Farm",
      "ownerName": "John Doe",
      "mobileNumber": "1234567890",
      "emailAddress": "user@example.com",
      "signupTimestamp": 1785934000000,
      "isLightTheme": true,
      "language": "en"
    },
    "user": {
      "id": "generated_user_id",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "user",
      "active": true,
      "profile": {
        "displayName": "John Doe",
        "phone": "1234567890"
      },
      "permissions": {
        "canCreate": true,
        "canRead": true,
        "canUpdate": true,
        "canDelete": false,
        "allowedPages": ["Dashboard", "Sales", "Bills", "Profiles", "Settings"]
      },
      "createdAt": 1785934000000,
      "updatedAt": 1785934000000
    },
    "isSuperAdmin": false
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"success": false, "error": "All registration fields are required"}`
  * `500 Internal Error`: `{"success": false, "error": "<error message>"}`

---

### 1.3 Who Am I (Session Check)
* **Route**: `/api/auth/whoami`
* **Method**: `POST`
* **Auth Required**: Yes (Cookie)
* **Description**: Checks current cookie session and returns the active user context along with their subscription status.
* **Request Body**: `{}`
* **Success Response (200 OK - Authenticated)**:
  ```json
  {
    "authenticated": true,
    "email": "user@example.com",
    "userId": "user_id_123",
    "isSuperAdmin": false,
    "user": {
      "id": "user_id_123",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "user",
      "active": true,
      "permissions": { ... },
      "subscription": {
        "plan": "premium",
        "expiresAt": 1817452800000
      }
    },
    "subscriptionStatus": {
      "active": true,
      "blocked": false,
      "plan": "premium",
      "daysLeft": 365,
      "paymentMessage": ""
    }
  }
  ```
* **Response (Not Authenticated / Expired)**:
  ```json
  {
    "authenticated": false
  }
  ```

---

### 1.4 Logout
* **Route**: `/api/auth/logout`
* **Method**: `POST`
* **Auth Required**: No
* **Description**: Logs out the user and clears the `dairy_session` cookie.
* **Request Body**: `{}`
* **Success Response (200 OK)**:
  *Clears the cookie.*
  ```json
  {
    "success": true
  }
  ```

---

### 1.5 Change Password
* **Route**: `/api/auth/change-password`
* **Method**: `POST`
* **Auth Required**: Yes
* **Description**: Updates the password for the current session user (or another target user if requested by a Super Admin).
* **Request Body**:
  ```json
  {
    "currentPassword": "oldpassword123", 
    "newPassword": "newsecurepassword123",
    "userId": "optional_target_user_id_only_for_superadmin"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```
* **Error Responses**:
  * `400 Bad Request`: `{"success": false, "error": "New password must be at least 6 characters"}`
  * `401 Unauthorized`: `{"success": false, "error": "Current password is incorrect"}`
  * `404 Not Found`: `{"success": false, "error": "User not found"}`

---

## 2. Data Operations APIs (`/api/data`)

Most data APIs require the user to have an active (non-expired) subscription and the necessary page permission (RBAC) to run.

### 2.1 Bootstrap (Fetch All Initial Data)
* **Route**: `/api/data/bootstrap`
* **Method**: `POST`
* **Auth Required**: Yes
* **Description**: Pulls down all configuration, settings, customers, pricing, sales logs, and user catalogs needed to render the mobile app dashboard. Usually called once on app startup.
* **Request Body**: `{}`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "profile": { ... },
      "customers": [ ... ],
      "sales": [ ... ],
      "priceConfigs": [ ... ],
      "priceLogs": [ ... ],
      "inventory": [ ... ],
      "users": [ ... ],
      "billingConfig": { ... },
      "auditLogs": [ ... ],
      "permissionCatalog": { ... },
      "sessionUser": { ... },
      "isSuperAdmin": false,
      "subscriptionStatus": { ... }
    }
  }
  ```

---

### 2.2 Save Profile
* **Route**: `/api/data/profile/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings Edit permission)
* **Description**: Saves or edits business profile configurations.
* **Request Body**:
  ```json
  {
    "businessName": "Dairy Farm LTD",
    "ownerName": "John Doe",
    "mobileNumber": "9876543210",
    "emailAddress": "user@example.com",
    "isLightTheme": true,
    "language": "en"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... } // Saved profile details
  }
  ```

---

### 2.3 Save Customer
* **Route**: `/api/data/customers/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Profiles Create/Edit permission)
* **Description**: Adds a new customer or edits details of an existing customer. If `id` is omitted, the backend generates a unique ID.
* **Request Body**:
  ```json
  {
    "id": "optional_cust_id_to_edit",
    "name": "Alice Smith",
    "phone": "9998887776",
    "qrPreference": "YES",
    "address": "456 Greenfield Road",
    "notes": "Prefers morning deliveries"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cust_generated_uuid",
      "name": "Alice Smith",
      "phone": "9998887776",
      "qrPreference": "YES",
      "address": "456 Greenfield Road",
      "notes": "Prefers morning deliveries",
      "ownerUserId": "user_id_123",
      "updatedAt": 1785936521000
    }
  }
  ```
* **Error Responses**:
  * `403 Forbidden`: `{"success": false, "error": "Customer limit reached for this subscription plan"}`

---

### 2.4 Delete Customer
* **Route**: `/api/data/customers/delete`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Profiles Delete permission)
* **Description**: Removes a customer from the database.
* **Request Body**:
  ```json
  {
    "id": "customer_id_to_delete"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### 2.5 Save Sale
* **Route**: `/api/data/sales/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Sales Create/Edit permission)
* **Description**: Logs a milk sales transaction. It calculates pricing internally based on rate config or takes explicit overrides.
* **Request Body**:
  ```json
  {
    "id": "optional_sale_id_to_edit",
    "customerId": "customer_id_abc",
    "customerName": "Alice Smith",
    "milkType": "cow",
    "liters": 2.5,
    "ratePerLiter": 50,
    "totalAmount": 125,
    "paymentStatus": "PENDING",
    "paymentType": "PENDING",
    "location": "Latitude, Longitude"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "sale_uuid",
      "customerId": "customer_id_abc",
      "customerName": "Alice Smith",
      "milkType": "cow",
      "liters": 2.5,
      "ratePerLiter": 50,
      "totalAmount": 125,
      "paymentStatus": "PENDING",
      "paymentType": "PENDING",
      "location": "Latitude, Longitude",
      "ownerUserId": "user_id_123",
      "createdAt": 1785937100000,
      "updatedAt": 1785937100000
    }
  }
  ```
* **Error Responses**:
  * `403 Forbidden`: `{"success": false, "error": "Sales entry limit reached for your plan"}` or `{"success": false, "error": "Milk type 'cow' is not allowed on your subscription"}`

---

### 2.6 Delete Sale
* **Route**: `/api/data/sales/delete`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Sales Delete permission)
* **Description**: Deletes a logged milk sale entry.
* **Request Body**:
  ```json
  {
    "id": "sale_id_to_delete"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### 2.7 Mark Sale Paid
* **Route**: `/api/data/sales/mark-paid`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Sales Edit permission)
* **Description**: Mark an existing pending transaction as paid and specify payment instrument used.
* **Request Body**:
  ```json
  {
    "id": "sale_id_to_update",
    "paymentType": "ONLINE"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "sale_id_to_update",
      "paymentStatus": "PAID",
      "paymentType": "ONLINE",
      "updatedAt": 1785937400000,
      ...
    }
  }
  ```

---

### 2.8 Save Price Configuration
* **Route**: `/api/data/prices/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings Edit permission)
* **Description**: Sets the standard pricing (per liter) for a specific milk variety. Logs the change in `price_logs` automatically.
* **Request Body**:
  ```json
  {
    "milkType": "buffalo",
    "newPrice": 65
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "updatedPrice": {
        "milkType": "buffalo",
        "currentPrice": 65,
        "updatedAt": 1785937600000
      },
      "log": {
        "id": "plog_1785937600000_abc123",
        "milkType": "buffalo",
        "oldPrice": 60,
        "newPrice": 65,
        "timestamp": 1785937600000
      }
    }
  }
  ```

---

### 2.9 Delete Price Configuration
* **Route**: `/api/data/prices/delete`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings Edit permission)
* **Description**: Deletes a custom milk grade pricing configuration and removes it from the catalog.
* **Request Body**:
  ```json
  {
    "milkType": "Cow Milk",
    "ownerUserId": "optional_owner_user_id"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### 2.10 Save Inventory
* **Route**: `/api/data/inventory/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Inventory Create/Edit permission)
* **Description**: Logs milk production volume/stock availability for a given date.
* **Request Body**:
  ```json
  {
    "dateStr": "2026-06-24",
    "cowLiters": 120.5,
    "buffaloLiters": 80.0,
    "a2Liters": 30.0,
    "customStocksRaw": "{\"goat\": 10}"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "dateStr": "2026-06-24",
      "cowLiters": 120.5,
      "buffaloLiters": 80.0,
      "a2Liters": 30.0,
      "customStocksRaw": "{\"goat\": 10}",
      "ownerUserId": "user_id_123",
      "updatedAt": 1785938000000
    }
  }
  ```

---

### 2.11 Save Billing Config
* **Route**: `/api/data/billing/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings Edit permission)
* **Description**: Configures global parameters for billing forms (volume limits, payment method UI toggles, preset volume options).
* **Request Body**:
  ```json
  {
    "paymentMethods": [
      {
        "code": "CASH",
        "label": "Cash",
        "color": "#4caf50",
        "icon": "cash-multiple",
        "enabled": true,
        "marksPending": false
      },
      {
        "code": "ONLINE",
        "label": "Online Pay",
        "color": "#2196f3",
        "icon": "qrcode-scan",
        "enabled": true,
        "marksPending": false
      }
    ],
    "volumePresets": [1, 2, 5, 10],
    "allowCustomRate": true,
    "requireLocation": false,
    "defaultLocation": "Greenfield Farm Gate 1",
    "showStockWarnings": true,
    "maxVolume": 100,
    "volumeStep": 0.5
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... } // Echoes back the saved configuration
  }
  ```

---

### 2.12 Save Branding Settings
* **Route**: `/api/data/branding/save`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings Edit permission)
* **Description**: Updates cooperative depot name, system subtitle names, custom physical address, and custom logo image.
* **Request Body**:
  ```json
  {
    "brandingConfig": {
      "logo": "data:image/png;base64,iVBORw0KGgo...",
      "bankName": "Ganga Premium Cooperative",
      "systemName": "Ganga Dairy System",
      "address": "123 Dairy Road, Erode, Tamil Nadu"
    },
    "ownerUserId": "optional_owner_user_id"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "logo": "data:image/png;base64,iVBORw0KGgo...",
      "bankName": "Ganga Premium Cooperative",
      "systemName": "Ganga Dairy System",
      "address": "123 Dairy Road, Erode, Tamil Nadu"
    }
  }
  ```

---

### 2.13 Log Audit Event
* **Route**: `/api/data/audit/log`
* **Method**: `POST`
* **Auth Required**: Yes
* **Description**: Logs system operation telemetry (for action accountability).
* **Request Body**:
  ```json
  {
    "id": "audit_uuid",
    "userName": "John Doe",
    "action": "EXPORT_REPORTS",
    "resourceType": "reports",
    "resourceId": "June_2026_Report",
    "details": { "format": "PDF" },
    "createdAt": 1785938500000
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```

---

### 2.14 Get Audit Logs
* **Route**: `/api/data/audit/list`
* **Method**: `POST`
* **Auth Required**: Yes (Requires Settings View permission)
* **Description**: Retrieve paginated audit activity. Can accept `selectedUserId` query parameter when requested by superadmins to filter audit records for that specific user context.
* **Request Body**:
  ```json
  {
    "page": 1,
    "limit": 20,
    "search": "John",
    "resourceType": "reports",
    "selectedUserId": "optional_user_id_to_filter"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "logs": [
        {
          "id": "audit_uuid",
          "userId": "user_id_123",
          "userName": "John Doe",
          "userEmail": "user@example.com",
          "action": "EXPORT_REPORTS",
          "resourceType": "reports",
          "resourceId": "June_2026_Report",
          "details": { "format": "PDF" },
          "createdAt": 1785938500000
        }
      ],
      "total": 1,
      "page": 1,
      "pages": 1
    }
  }
  ```

---

## 3. Super Admin Panel APIs (`/api/admin`)

These administrative APIs can only be performed by sessions belonging to accounts with the Super Admin role.

### 3.1 List Users
* **Route**: `/api/admin/users/list`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Request Body**: `{}`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "user_id_123",
        "name": "John Doe",
        "email": "user@example.com",
        "role": "user",
        "active": true,
        "subscription": {
          "plan": "premium",
          "expiresAt": 1817452800000
        },
        "permissions": { ... },
        "createdAt": 1785934000000,
        "updatedAt": 1785934000000
      }
    ]
  }
  ```

---

### 3.2 Create User
* **Route**: `/api/admin/users/create`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Registers a user with custom roles, access permissions, and subscription limits.
* **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "supersecurepassword",
    "role": "user",
    "active": true,
    "subscription": {
      "plan": "starter",
      "expiresAt": 1788566400000
    },
    "permissions": {
      "canCreate": true,
      "canRead": true,
      "canUpdate": true,
      "canDelete": false,
      "allowedPages": ["Dashboard", "Sales"],
      "canUseSubscription": true,
      "canViewOthers": false,
      "pagePermissions": {
        "Dashboard": ["view"],
        "Sales": ["view", "create"]
      },
      "resourceLimits": {
        "maxCustomers": 50,
        "maxSales": 500,
        "allowedMilkTypes": ["cow"]
      }
    }
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... } // Saved user model representation
  }
  ```

---

### 3.3 Update User
* **Route**: `/api/admin/users/update`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Modify account parameters, grant permissions, or extend plans.
* **Request Body**:
  ```json
  {
    "id": "user_id_to_edit",
    "name": "Jane Doe Updated",
    "password": "optional_new_password_if_changing",
    "active": true,
    "permissions": { ... }
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```

---

### 3.4 Delete User
* **Route**: `/api/admin/users/delete`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Request Body**:
  ```json
  {
    "id": "user_id_to_delete"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### 3.5 Get & Update Permission Catalog
* **Routes**: 
  * `/api/admin/catalog/get`
  * `/api/admin/catalog/update`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Standard definitions of tabs, page structures, and permission rules available to users.
* **Request Body (for `/catalog/update`)**:
  ```json
  {
    "pages": [
      { "key": "Dashboard", "label": "Dashboard Tab", "actions": ["view"] },
      { "key": "Sales", "label": "Sales Log", "actions": ["view", "create", "edit", "delete"] }
    ],
    "fields": {
      "Sales": [
        { "key": "ratePerLiter", "label": "Edit Selling Rate" }
      ]
    },
    "updatedAt": 1785940000000
  }
  ```
* **Success Response**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```

---

### 3.6 List Available System Pages
* **Route**: `/api/admin/users/pages`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Lists core application routing tab IDs.
* **Request Body**: `{}`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": ["Dashboard", "Sales", "Bills", "Inventory", "Profiles", "Reports", "Settings"]
  }
  ```

---

### 3.7 Get Token Expiration Configuration
* **Route**: `/api/admin/token-config/get`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Retrieves active JWT lifespans for sessions, logins, and subscription checks.
* **Request Body**: `{}`
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "sessionExpirySeconds": 86400,
    "loginExpirySeconds": 86400,
    "subscriptionExpirySeconds": 2592000
  }
  ```

---

### 3.8 Update Token Expiration Configuration
* **Route**: `/api/admin/token-config/update`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Updates the lifespan configurations for session, login, and subscription JWTs.
* **Request Body**:
  ```json
  {
    "sessionExpirySeconds": 172800,
    "loginExpirySeconds": 172800,
    "subscriptionExpirySeconds": 5184000
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionExpirySeconds": 172800,
      "loginExpirySeconds": 172800,
      "subscriptionExpirySeconds": 5184000
    }
  }
  ```

---

## 4. Bulk Data Import (`/api/data/import`)
* **Route**: `/api/data/import`
* **Method**: `POST`
* **Auth Required**: Yes (Super Admin Only)
* **Description**: Allows database seeding/restore via bulk JSON payloads.
* **Request Body**:
  ```json
  {
    "profile": { ... },
    "customers": [ ... ],
    "sales": [ ... ],
    "priceConfigs": [ ... ],
    "priceLogs": [ ... ],
    "inventory": [ ... ],
    "users": [ ... ],
    "auditLogs": [ ... ],
    "billingConfig": { ... }
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { ... } // Re-bootstrapped dump
  }
  ```

---

## 5. Web Client Reference Mappings

To help with mobile development (Android/iOS/Flutter), here is how the frontend Next.js web application maps user actions to backend API endpoints and coordinates them:

### 5.1 Auth API Functions (`lib/authApi.ts`)
*   `whoamiApi()`: Calls `/api/auth/whoami` to verify the current session cookie and fetch the logged-in user profile.
*   `logoutApi()`: Calls `/api/auth/logout` to clear all three session cookies on the client side.
*   `changePasswordApi(body)`: Calls `/api/auth/change-password` with `{ oldPassword, newPassword }` to update credentials.

### 5.2 Data API Functions (`lib/dataApi.ts`)
*   `bootstrap(selectedUserId)`: Calls `/api/data/bootstrap`. Passes an optional `selectedUserId` body parameter. When a Super Admin is logged in, this parameter retrieves all data impersonating that specific user, which is critical for the "View as" feature.
*   `saveProfileApi(profile)`: Calls `/api/data/profile/save` to store cooperative/depot profile details.
*   `saveCustomerApi(customer)`: Calls `/api/data/customers/save` to add or update customer records.
*   `deleteCustomerApi(id)`: Calls `/api/data/customers/delete` with `{ id }`.
*   `saveSaleApi(sale)`: Calls `/api/data/sales/save` to log transactions.
*   `deleteSaleApi(id)`: Calls `/api/data/sales/delete` with `{ id }`.
*   `markSalePaidApi(id, paymentType)`: Calls `/api/data/sales/mark-paid` with `{ id, paymentType }`.
*   `savePriceApi(milkType, newPrice, oldMilkType, ownerUserId)`: Calls `/api/data/prices/save` with `{ milkType, newPrice, oldMilkType, ownerUserId }` to register or rename milk categories.
*   `deletePriceApi(milkType, ownerUserId)`: Calls `/api/data/prices/delete` with `{ milkType, ownerUserId }`.
*   `saveInventoryApi(inventory)`: Calls `/api/data/inventory/save`.
*   `saveBillingApi(config, ownerUserId)`: Calls `/api/data/billing/save` with `{ config, ownerUserId }`.
*   `saveBrandingApi(config, ownerUserId)`: Calls `/api/data/branding/save` with `{ brandingConfig: config, ownerUserId }`.
*   `logAuditApi(entry)`: Calls `/api/data/audit/log`.
*   `listAuditApi(options)`: Calls `/api/data/audit/list` (optionally including `selectedUserId`).
*   `listUsersApi()`: Calls `/api/admin/users/list` to fetch all system accounts.
*   `createUserApi(user)`: Calls `/api/admin/users/create`.
*   `updateUserApi(user)`: Calls `/api/admin/users/update`.
*   `deleteUserApi(id)`: Calls `/api/admin/users/delete`.
*   `importDataApi(payload)`: Calls `/api/data/import` for database restoration.
*   `getCatalogApi()`: Calls `/api/admin/catalog/get`.
*   `updateCatalogApi(catalog)`: Calls `/api/admin/catalog/update`.
*   `getTokenConfigApi()`: Calls `/api/admin/token-config/get`.
*   `updateTokenConfigApi(config)`: Calls `/api/admin/token-config/update`.

### 5.3 Mobile Client Implementation Guide

For mobile development, you must construct a network client (e.g. using Retrofit in Kotlin, URLSession in Swift, or Axios/Fetch in React Native) that handles:
1.  **Cookie Persistence**: Automatically retrieve `Set-Cookie` response headers (`dairy_session`, `dairy_login`, `dairy_subscription`) upon calling `/api/auth/login` or `/api/auth/register`, store them securely in the app, and attach them in the `Cookie` header of every subsequent request.
2.  **Explicit POST requests**: Since the backend strictly enforces the `POST` method on all endpoints, ensure your mobile client is configured to send all requests as `POST` with a JSON content type header (`Content-Type: application/json`).
3.  **Tenancy Impersonation**: For superadmin roles, include `selectedUserId: "<target_user_id>"` in the request bodies of `/bootstrap` and `/audit/list` to mirror the web app's capability to switch and view data scoped to a specific tenant.

