let loginMode = "signin";
let loginSubmitting = false;
let firebaseAuth;

document.addEventListener("DOMContentLoaded", () => {
    const setupNotice = document.getElementById("loginSetup");
    if (new URLSearchParams(window.location.search).has("setup")) {
        setupNotice.hidden = false;
    }

    document.getElementById("authModeToggle").addEventListener("click", toggleLoginMode);
    document.getElementById("forgotPassword").addEventListener("click", resetPassword);
    document.getElementById("loginForm").addEventListener("submit", submitLogin);

    try {
        firebaseAuth = window.initializeFirebase();
        document.getElementById("loginSubmit").disabled = false;
        firebaseAuth.onAuthStateChanged((user) => {
            if (user && !loginSubmitting) {
                loginSubmitting = true;
                finishSignIn(user).catch((error) => {
                    loginSubmitting = false;
                    document.getElementById("loginSubmit").disabled = false;
                    showLoginError(error);
                });
            }
        });
    } catch (error) {
        showLoginError(error);
        setupNotice.hidden = false;
    }
});

function toggleLoginMode() {
    loginMode = loginMode === "signin" ? "signup" : "signin";
    const isSignup = loginMode === "signup";
    document.getElementById("loginTitle").textContent = isSignup ? "Create your account" : "Welcome back";
    document.getElementById("loginSubtitle").textContent = isSignup
        ? "Sign up with your email to get started."
        : "Sign in to securely access your account.";
    document.getElementById("signupNameField").hidden = !isSignup;
    document.getElementById("signupName").required = isSignup;
    document.getElementById("loginPassword").autocomplete = isSignup
        ? "new-password"
        : "current-password";
    document.getElementById("loginSubmit").textContent = isSignup ? "Create account" : "Sign in";
    document.getElementById("authModeToggle").textContent = isSignup
        ? "Already have an account? Sign in"
        : "Create a new account";
    document.getElementById("forgotPassword").hidden = isSignup;
    setLoginMessage("");
}

async function submitLogin(event) {
    event.preventDefault();
    if (!firebaseAuth || loginSubmitting) {
        return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const displayName = document.getElementById("signupName").value.trim();
    if (loginMode === "signup" && !displayName) {
        setLoginMessage("Enter your name to create an account.", true);
        return;
    }

    loginSubmitting = true;
    const submitButton = document.getElementById("loginSubmit");
    submitButton.disabled = true;
    setLoginMessage("");
    try {
        let user;
        if (loginMode === "signup") {
            const credential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            user = credential.user;
            await user.updateProfile({ displayName });
        } else {
            const credential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            user = credential.user;
        }
        await finishSignIn(user);
    } catch (error) {
        setLoginMessage(
            friendlyAuthError(error),
            true,
            error.code === "auth/operation-not-allowed"
        );
        loginSubmitting = false;
        submitButton.disabled = false;
    }
}

async function finishSignIn(user) {
    if (!loginSubmitting) {
        loginSubmitting = true;
    }
    window.location.replace("/");
}

async function resetPassword() {
    if (!firebaseAuth) {
        setLoginMessage("Firebase is still initializing. Refresh the page and try again.", true);
        return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
        setLoginMessage("Enter your email above, then select Forgot password again.", true);
        document.getElementById("loginEmail").focus();
        return;
    }

    try {
        await firebaseAuth.sendPasswordResetEmail(email);
        setLoginMessage("If an account exists for that email, Firebase has sent a password reset link.");
    } catch (error) {
        const messages = {
            "auth/invalid-email": "Enter a valid email address.",
            "auth/operation-not-allowed": "Email/Password sign-in is disabled. Enable it in Firebase Authentication settings.",
            "auth/network-request-failed": "Could not reach Firebase. Check your internet connection."
        };
        setLoginMessage(messages[error.code] || error.message || "Could not send the password reset email.", true);
    }
}

function friendlyAuthError(error) {
    const messages = {
        "auth/email-already-in-use": "This email already has an account. Sign in instead.",
        "auth/invalid-credential": "Email or password is incorrect. Check your details, reset your password, or create a new account.",
        "auth/user-not-found": "No account found for this email. Check the address or create a new account.",
        "auth/wrong-password": "Email or password is incorrect. Check your details or reset your password.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/operation-not-allowed": "Email/Password sign-in is disabled for this Firebase project. Enable the Email/Password provider in Firebase Authentication, then try again.",
        "auth/weak-password": "Choose a password with at least 6 characters.",
        "auth/network-request-failed": "Could not reach Firebase. Check your internet connection.",
        "firestore/failed-precondition": "Firestore is not ready. Create the Firestore database in the Firebase console and try again.",
        "firestore/permission-denied": "Firestore denied this request. Publish the rules from firestore.rules in the Firebase console.",
        "firestore/unavailable": "Firestore could not be reached. Check your connection and confirm the database is created in Firebase.",
        "unavailable": "Firebase could not be reached. Check your connection and try again."
    };
    if (error.message && /client is offline|failed to get document/i.test(error.message)) {
        return "Firebase sign-in succeeded, but Firestore is unreachable. Check your internet connection, create the Firestore database, and publish firestore.rules.";
    }
    return messages[error.code] || error.message || "Sign-in failed.";
}

function showLoginError(error) {
    setLoginMessage(error.message || String(error), true);
}

function setLoginMessage(message, isError = false, showFirebaseSettings = false) {
    const messageElement = document.getElementById("loginMessage");
    messageElement.textContent = message;
    messageElement.style.color = isError ? "#dc2626" : "#16a34a";
    document.getElementById("firebaseSettingsLink").hidden = !showFirebaseSettings;
}
