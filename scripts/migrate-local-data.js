const fs = require("node:fs");
const path = require("node:path");
const { applicationDefault, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

async function migrate() {
    const uid = process.argv[2];
    if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
        throw new Error("Usage: npm run migrate:local-data -- <Firebase Authentication UID>");
    }

    const dataFile = path.resolve(
        process.env.BANK_DATA_FILE || path.join(__dirname, "..", "data", "bank-data.json")
    );
    const store = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (!store.account || !Array.isArray(store.transactions)) {
        throw new Error("The local bank data file has no valid account and transaction list.");
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || "banking-system-d03ca";
    const app = getApps()[0] || initializeApp({
        credential: applicationDefault(),
        projectId
    });
    const [authUser, firestore] = await Promise.all([
        getAuth(app).getUser(uid),
        Promise.resolve(getFirestore(app))
    ]);
    const userDocument = firestore.collection("users").doc(uid);
    const transactions = store.transactions.slice(0, 50);

    await firestore.runTransaction(async (transaction) => {
        const existingUser = await transaction.get(userDocument);
        if (existingUser.data()?.account) {
            throw new Error("This Firebase user already has a bank account; migration was not applied.");
        }

        const existingData = existingUser.data() || {};
        transaction.set(userDocument, {
            profile: {
                email: authUser.email || "",
                displayName: authUser.displayName || store.account.name
            },
            account: {
                name: store.account.name,
                accountNumber: String(store.account.accountNumber),
                balance: store.account.balance
            },
            createdAt: existingData.createdAt || Timestamp.now(),
            lastLoginAt: Timestamp.now()
        }, { merge: true });

        for (const item of transactions) {
            const parsedDate = item.date ? new Date(item.date) : new Date();
            const createdAt = Number.isNaN(parsedDate.getTime())
                ? Timestamp.now()
                : Timestamp.fromDate(parsedDate);
            const transactionDocument = userDocument.collection("transactions").doc();
            transaction.create(transactionDocument, {
                type: item.type,
                amount: item.amount,
                transactionType: item.transactionType,
                createdAt,
                legacyDate: item.date || ""
            });
        }
    });

    console.log(`Migrated the local account and ${transactions.length} transaction(s) to Firebase UID ${uid}.`);
}

migrate().catch((error) => {
    console.error("Local data migration failed:", error.message);
    process.exitCode = 1;
});
