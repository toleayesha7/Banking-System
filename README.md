# NovaBank demo

NovaBank uses Firebase Authentication for email/password accounts and the
Firebase Web SDK for Cloud Firestore user profiles, bank accounts, and
transaction history. Firestore security rules restrict each user to their own
records. The Node.js backend serves the frontend and does not need a Firebase
Admin credential to run the website.

## Firebase project setup

Configure the Firebase project provided for this app:
<https://console.firebase.google.com/u/0/project/banking-system-d03ca/overview>

1. The Web app settings you provided are configured in
   `frontend/firebase-config.js`. If you regenerate them, update that file.
   The configured project ID is `banking-system-d03ca`.
2. In **Authentication → Sign-in method**, enable **Email/Password** (open
   [the provider settings](https://console.firebase.google.com/project/banking-system-d03ca/authentication/providers)).
   This provider setting must be enabled in Firebase; it cannot be switched on
   by application code. Users created from the separate login page are
   automatically listed under **Authentication → Users** in the console.
3. In **Firestore Database**, create a database. Choose a location and start
   with locked/production rules. In **Firestore → Rules**, publish the rules
   from `firestore.rules`. Those rules enforce user ownership for browser SDK
   reads and writes. Without a created Firestore database, authentication can
   succeed but the dashboard cannot load or save account history. You can open
   the [Firestore database setup page](https://console.cloud.google.com/datastore/setup?project=banking-system-d03ca).

## Run locally on Windows

Open PowerShell in the project directory and start the backend:

```powershell
npm start
```

Open <http://127.0.0.1:3000/login> in Chrome. Do not open the HTML files
directly; the app requires the local server. Firebase Authentication must
include `localhost` in its authorized domains.

If you want to migrate the existing local demo account, an Admin SDK credential
is needed only for this one-time operation. Keep the service-account JSON
outside the project, set its path and project ID in PowerShell, then run:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\path\service-account.json"
$env:FIREBASE_PROJECT_ID = "banking-system-d03ca"
npm run migrate:local-data -- "FIREBASE_AUTH_UID"
```

The migration command uses the configured Admin credentials and refuses to
overwrite a Firebase user's existing bank account. Skip it if you want each
user to create a new account instead.

## Firebase data and history

- `users/{firebaseUid}` stores a profile and the user's bank account.
- The account form fills the customer's name from their Firebase profile and
  assigns a random 12-digit account number automatically.
- `users/{firebaseUid}/transactions/{transactionId}` stores every deposit and
  withdrawal as a separate Firestore document.
- Logging out only signs out of Firebase. It does not delete the profile,
  account, or transactions. Signing back in as the same Firebase user loads the
  same account and recent transaction history.
- The dashboard displays the 50 most recent transactions; all transactions
  remain stored in Firestore.
- **Reset Demo** intentionally deletes that signed-in user's account and
  transaction records. It does not delete their Firebase Authentication login.
- View registered login accounts under **Authentication → Users** in the
  console. View their application profile/account documents under Firestore
  **Data → users**. The UID connects the Authentication user to their Firestore
  document.

The supplied `data/bank-data.json` is the old local demo store. It is not
automatically copied to Firestore or assigned to a user; do not attach it to
the first person who signs up. Back it up, then migrate its account only after
deciding which Firebase UID should own it.

## API

The browser app uses the Firebase Web SDK directly for Firestore. The backend
serves only static app files and needs no service-account key for regular use.

This is a learning demo, not a real banking service. Do not use the application
to store real financial information.
