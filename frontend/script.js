// ===============================
// BANKING SYSTEM JAVASCRIPT
// ===============================


// Account data is loaded from the signed-in user's Firestore documents.
let account = null;
let transactions = [];
let userProfile = null;
let currentUser = null;
// Current transaction type
let currentTransaction = "";


// ===============================
// PAGE LOAD
// ===============================

document.addEventListener("DOMContentLoaded", function () {
    try {
        const auth = window.initializeFirebase();
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.replace("/login");
                return;
            }

            currentUser = user;
            userProfile = {
                email: user.email || "",
                displayName: user.displayName || user.email?.split("@")[0] || ""
            };
            document.getElementById("currentEmail").textContent = user.email || "Signed in";
            updateSignedInProfile();
            fillAccountCreationDetails(user);
            try {
                applyBankState(await firestoreOperation("account.read"));
            } catch (error) {
                showNotification(friendlyFirestoreError(error));
            }
        });
    } catch (error) {
        window.location.replace("/login?setup=1");
    }
});

async function firestoreOperation(operation, options = {}) {
    const user = window.firebase.auth().currentUser;
    if (!user) {
        throw new Error("Sign in to access your bank account.");
    }
    const firestore = window.firebase.firestore();
    const userDocument = firestore.collection("users").doc(user.uid);

    if (operation === "account.read") {
        return readBankState(userDocument);
    }

    if (operation === "account.create") {
        const body = JSON.parse(options.body);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const accountNumber = typeof body.accountNumber === "string"
            ? body.accountNumber.trim()
            : "";
        const initialBalance = parseCurrencyAmount(body.initialBalance, true);
        if (!name || name.length > 100) {
            throw new Error("Name must contain 1 to 100 characters.");
        }
        if (!/^\d{12}$/.test(accountNumber)) {
            throw new Error("The assigned account number is invalid. Refresh and try again.");
        }
        if (initialBalance === null) {
            throw new Error("Initial balance must be zero or a positive amount with up to two decimals.");
        }

        const created = await firestore.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(userDocument);
            if (snapshot.data()?.account) {
                return false;
            }
            transaction.set(userDocument, {
                profile: {
                    email: user.email || "",
                    displayName: user.displayName || user.email?.split("@")[0] || ""
                },
                account: { name, accountNumber, balance: initialBalance }
            }, { merge: true });
            return true;
        });
        if (!created) {
            throw new Error("An account already exists. Reset the demo before creating another.");
        }
        return readBankState(userDocument);
    }

    if (operation === "transaction.create") {
        const body = JSON.parse(options.body);
        const amount = parseCurrencyAmount(body.amount);
        if (body.type !== "deposit" && body.type !== "withdraw") {
            throw new Error("Transaction type must be deposit or withdraw.");
        }
        if (amount === null) {
            throw new Error("Amount must be positive and have no more than two decimal places.");
        }

        const transactionDocument = userDocument.collection("transactions").doc();
        const result = await firestore.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(userDocument);
            const account = snapshot.data()?.account;
            if (!account) {
                return "missing-account";
            }

            const currentBalance = parseCurrencyPaise(account.balance, true);
            const amountPaise = parseCurrencyPaise(body.amount);
            if (currentBalance === null || amountPaise === null) {
                throw new Error("Stored account balance is invalid.");
            }
            if (body.type === "withdraw" && amountPaise > currentBalance) {
                return "insufficient-balance";
            }
            const updatedBalance = body.type === "deposit"
                ? currentBalance + amountPaise
                : currentBalance - amountPaise;
            if (!Number.isSafeInteger(updatedBalance)) {
                return "amount-limit";
            }

            transaction.update(userDocument, { "account.balance": updatedBalance / 100 });
            transaction.set(transactionDocument, {
                type: body.type === "deposit" ? "Deposit" : "Withdrawal",
                amount,
                transactionType: body.type,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return null;
        });
        if (result === "missing-account") {
            throw new Error("Create an account before making a transaction.");
        }
        if (result === "insufficient-balance") {
            throw new Error("Insufficient balance.");
        }
        if (result === "amount-limit") {
            throw new Error("Transaction amount exceeds the supported balance limit.");
        }
        return readBankState(userDocument);
    }

    if (operation === "account.reset") {
        const transactionCollection = userDocument.collection("transactions");
        while (true) {
            const snapshot = await transactionCollection.limit(400).get();
            if (snapshot.empty) {
                break;
            }
            const batch = firestore.batch();
            snapshot.docs.forEach(document => batch.delete(document.ref));
            await batch.commit();
        }
        await userDocument.delete();
        return { account: null, transactions: [] };
    }

    throw new Error("Unsupported Firestore operation.");
}

async function readBankState(userDocument) {
    const [userSnapshot, transactionSnapshot] = await Promise.all([
        userDocument.get(),
        userDocument.collection("transactions")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get()
    ]);
    const userData = userSnapshot.data();
    return {
        account: userData ? userData.account || null : null,
        profile: userData ? userData.profile || null : null,
        transactions: transactionSnapshot.docs.map(document => {
            const transaction = document.data();
            return {
                type: transaction.type,
                amount: transaction.amount,
                transactionType: transaction.transactionType,
                date: transaction.legacyDate || (
                    transaction.createdAt && typeof transaction.createdAt.toDate === "function"
                        ? transaction.createdAt.toDate().toLocaleString("en-IN")
                        : ""
                )
            };
        })
    };
}

function fillAccountCreationDetails(user) {
    const name = getCustomerName(user.displayName || user.email?.split("@")[0]);
    document.getElementById("nameInput").value = name;
    document.getElementById("accountInput").value = generateAccountNumber();
}

function getCustomerName(name) {
    const normalizedName = typeof name === "string" ? name.trim() : "";
    return normalizedName && normalizedName.toLowerCase() !== "guest"
        ? normalizedName
        : "NovaBank Customer";
}

function updateSignedInProfile() {
    const displayName = getCustomerName(userProfile?.displayName);
    document.getElementById("welcomeName").textContent = displayName;
    document.getElementById("summaryName").textContent = displayName;
    document.getElementById("accountName").textContent = displayName;
    document.getElementById("detailName").textContent = displayName;
    document.getElementById("detailEmail").textContent =
        userProfile?.email || "Not available";
    document.getElementById("profileAvatar").textContent =
        displayName.charAt(0).toUpperCase();
    document.getElementById("accountAvatar").textContent =
        displayName.charAt(0).toUpperCase();
}

function generateAccountNumber() {
    const randomValues = new Uint32Array(2);
    window.crypto.getRandomValues(randomValues);
    const random = (BigInt(randomValues[0]) << 32n) | BigInt(randomValues[1]);
    const accountNumber = 100000000000n + (random % 900000000000n);
    return accountNumber.toString();
}

function parseCurrencyAmount(value, allowZero = false) {
    const paise = parseCurrencyPaise(value, allowZero);
    return paise === null ? null : paise / 100;
}

function parseCurrencyPaise(value, allowZero = false) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    const paise = Math.round(value * 100);
    if (
        !Number.isSafeInteger(paise)
        || Math.abs(value * 100 - paise) > 1e-7
        || (allowZero ? paise < 0 : paise <= 0)
    ) {
        return null;
    }
    return paise;
}

async function signOut() {
    try {
        await window.firebase.auth().signOut();
        window.location.replace("/login");
    } catch (error) {
        showNotification(friendlyFirestoreError(error));
    }
}

function applyBankState(state) {
    account = state.account;
    transactions = state.transactions;
    userProfile = state.profile || userProfile;

    if (account) {
        document.getElementById("accountModal")
            .classList.remove("show");
        updateDashboard();
    } else {
        if (currentUser) {
            fillAccountCreationDetails(currentUser);
        }
        document.getElementById("accountModal")
            .classList.add("show");
    }
}


// ===============================
// CREATE ACCOUNT
// ===============================

async function createAccount() {

    const name =
        document.getElementById("nameInput").value.trim();

    const accountNumber =
        document.getElementById("accountInput").value.trim();

    const initialBalance =
        Number(document.getElementById("initialBalance").value);

    const message =
        document.getElementById("accountMessage");


    if (name === "") {

        message.textContent = "Please enter your name.";
        message.style.color = "#dc2626";
        return;
    }


    if (!/^\d{12}$/.test(accountNumber)) {

        message.textContent = "A valid account number could not be assigned. Refresh the page and try again.";
        message.style.color = "#dc2626";
        return;
    }


    if (initialBalance < 0 || isNaN(initialBalance)) {

        message.textContent = "Please enter a valid balance.";
        message.style.color = "#dc2626";
        return;
    }


    try {
        document.getElementById("firestoreSetupLink").hidden = true;
        applyBankState(await firestoreOperation("account.create", {
            body: JSON.stringify({ name, accountNumber, initialBalance })
        }));
        showNotification("Account created successfully!");
    } catch (error) {
        const needsDatabase = isMissingFirestoreDatabase(error);
        message.textContent = friendlyFirestoreError(error);
        message.style.color = "#dc2626";
        document.getElementById("firestoreSetupLink").hidden = !needsDatabase;
    }

}


// ===============================
// UPDATE DASHBOARD
// ===============================

function updateDashboard() {

    if (!account) return;

    const storedName = typeof account.name === "string" ? account.name.trim() : "";
    const accountName = getCustomerName(
        storedName.toLowerCase() === "guest"
            ? userProfile?.displayName
            : storedName || userProfile?.displayName
    );

    // Name
    document.getElementById("welcomeName")
        .textContent = accountName;


    document.getElementById("summaryName")
        .textContent = accountName;


    document.getElementById("accountName")
        .textContent = accountName;

    document.getElementById("detailEmail")
        .textContent = userProfile?.email || currentUser?.email || "Not available";

    document.getElementById("detailName")
        .textContent = accountName;


    // Balance
    document.getElementById("balance")
        .textContent = formatMoney(account.balance);


    document.getElementById("detailBalance")
        .textContent = formatMoney(account.balance);


    // Account number
    document.getElementById("summaryAccount")
        .textContent = account.accountNumber;


    document.getElementById("detailAccount")
        .textContent = account.accountNumber;


    const lastFour =
        account.accountNumber.slice(-4);

    document.getElementById("lastFour")
        .textContent = lastFour;


    // Avatar
    const firstLetter =
        accountName.charAt(0).toUpperCase();


    document.getElementById("profileAvatar")
        .textContent = firstLetter;


    document.getElementById("accountAvatar")
        .textContent = firstLetter;


    // Transaction count
    document.getElementById("transactionCount")
        .textContent = transactions.length;


    renderRecentTransactions();

    renderAllTransactions();

}


// ===============================
// FORMAT MONEY
// ===============================

function formatMoney(amount) {

    return "₹" + Number(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}


// ===============================
// OPEN TRANSACTION MODAL
// ===============================

function openTransaction(type) {

    if (!account) {
        closeTransaction();
        document.getElementById("accountModal").classList.add("show");
        showNotification("Create your bank account before making a deposit or withdrawal.");
        return;
    }

    currentTransaction = type;


    const modal =
        document.getElementById("transactionModal");


    const title =
        document.getElementById("modalTitle");


    const description =
        document.getElementById("modalDescription");


    const icon =
        document.getElementById("modalIcon");


    const amount =
        document.getElementById("amount");


    const message =
        document.getElementById("modalMessage");


    amount.value = "";

    message.textContent = "";


    if (type === "deposit") {

        title.textContent = "Deposit Money";

        description.textContent =
            "Add money to your bank account.";

        icon.textContent = "↓";

    }


    else if (type === "withdraw") {

        title.textContent = "Withdraw Money";

        description.textContent =
            "Withdraw money from your account.";

        icon.textContent = "↑";

    }


    modal.classList.add("show");

    setTimeout(() => amount.focus(), 100);

}


// ===============================
// CLOSE MODAL
// ===============================

function closeTransaction() {

    document.getElementById("transactionModal")
        .classList.remove("show");

}


// ===============================
// PERFORM TRANSACTION
// ===============================

async function performTransaction() {

    if (!account) {
        closeTransaction();
        document.getElementById("accountModal").classList.add("show");
        showNotification("Create your bank account before making a deposit or withdrawal.");
        return;
    }


    const amount =
        Number(document.getElementById("amount").value);


    const message =
        document.getElementById("modalMessage");


    if (isNaN(amount) || amount <= 0) {

        message.textContent =
            "Please enter a valid amount.";

        message.style.color = "#dc2626";

        return;
    }


    if (currentTransaction !== "deposit" && currentTransaction !== "withdraw") {
        message.textContent = "Choose a valid transaction type.";
        message.style.color = "#dc2626";
        return;
    }

    try {
        applyBankState(await firestoreOperation("transaction.create", {
            body: JSON.stringify({ type: currentTransaction, amount })
        }));

        message.textContent = currentTransaction === "deposit"
            ? "Amount deposited successfully!"
            : "Amount withdrawn successfully!";
        message.style.color = "#16a34a";

        setTimeout(closeTransaction, 700);
    } catch (error) {
        message.textContent = friendlyFirestoreError(error);
        message.style.color = "#dc2626";
    }
}


// ===============================
// RENDER RECENT TRANSACTIONS
// ===============================

function renderRecentTransactions() {

    const container =
        document.getElementById("recentTransactions");


    if (transactions.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div>↕</div>

                <p>No transactions yet</p>

                <span>
                    Your transactions will appear here.
                </span>

            </div>

        `;

        return;
    }


    const recent =
        transactions.slice(0, 5);


    container.innerHTML =
        recent.map(createTransactionHTML).join("");

}


// ===============================
// RENDER ALL TRANSACTIONS
// ===============================

function renderAllTransactions() {

    const container =
        document.getElementById("allTransactions");


    if (transactions.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div>↕</div>

                <p>No transactions yet</p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        transactions.map(createTransactionHTML).join("");

}


// ===============================
// TRANSACTION HTML
// ===============================

function createTransactionHTML(transaction) {

    const isDeposit =
        transaction.transactionType === "deposit";


    const iconClass =
        isDeposit
            ? "deposit-icon"
            : "withdraw-icon";


    const amountClass =
        isDeposit
            ? "amount-positive"
            : "amount-negative";


    const sign =
        isDeposit ? "+" : "-";


    const icon =
        isDeposit ? "↓" : "↑";


    return `

        <div class="transaction">

            <div class="transaction-icon ${iconClass}">
                ${icon}
            </div>

            <div class="transaction-info">

                <strong>
                    ${transaction.type}
                </strong>

                <span>
                    ${transaction.date}
                </span>

            </div>

            <div class="transaction-amount ${amountClass}">
                ${sign}${formatMoney(transaction.amount)}
            </div>

        </div>

    `;

}


// ===============================
// NAVIGATION
// ===============================

function showSection(sectionName) {

    const sections =
        document.querySelectorAll(".section");


    sections.forEach(section => {

        section.classList.remove("active-section");

    });


    document
        .getElementById(sectionName)
        .classList.add("active-section");


    const links =
        document.querySelectorAll(".nav-link");


    links.forEach(link => {

        link.classList.remove("active");

    });


    links.forEach(link => {

        if (
            link
            .getAttribute("onclick")
            .includes(sectionName)
        ) {

            link.classList.add("active");

        }

    });

}


// ===============================
// ===============================
// RESET BANK
// ===============================

async function resetBank() {

    const confirmReset =
        confirm(
            "Are you sure you want to reset the demo account?"
        );


    if (!confirmReset) return;


    try {
        applyBankState(await firestoreOperation("account.reset"));
    } catch (error) {
        showNotification(friendlyFirestoreError(error));
    }

}


// ===============================
// NOTIFICATION
// ===============================

function showNotification(message) {

    alert(message);

}

function friendlyFirestoreError(error) {
    const messages = {
        "firestore/failed-precondition":
            "Firestore isn't ready. Create the database in the Firebase console, then publish the rules from firestore.rules.",
        "firestore/not-found":
            "This Firebase project has no default Firestore database yet. Create one in the Firebase console, then try again.",
        "not-found":
            "This Firebase project has no default Firestore database yet. Create one in the Firebase console, then try again.",
        "firestore/permission-denied":
            "Firestore denied access. Publish the rules in firestore.rules from the Firebase console, then retry.",
        "firestore/unavailable":
            "Firestore could not be reached. Check your internet connection and confirm that the Firestore database exists.",
        unavailable:
            "Firebase could not be reached. Check your internet connection and retry."
    };
    if (isMissingFirestoreDatabase(error)) {
        return "Your Firebase project is missing its default Firestore database. Create the database in the Firebase console, then retry account creation.";
    }
    if (error.message && /client is offline|failed to get document/i.test(error.message)) {
        return "Firestore is unreachable. Check your internet connection, create the Firestore database, and publish firestore.rules in the Firebase console.";
    }
    return messages[error.code] || error.message || "The Firestore operation failed.";
}

function isMissingFirestoreDatabase(error) {
    return error.code === "firestore/not-found"
        || error.code === "not-found"
        || /database\s*\(default\)\s*does not exist/i.test(error.message || "");
}