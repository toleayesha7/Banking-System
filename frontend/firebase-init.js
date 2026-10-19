(function () {
    window.initializeFirebase = function () {
        const config = window.firebaseConfig;
        const requiredSettings = ["apiKey", "authDomain", "projectId", "appId"];

        if (typeof firebase === "undefined") {
            throw new Error("Firebase SDK did not load. Check your internet connection.");
        }
        if (typeof firebase.firestore !== "function") {
            throw new Error("Firebase Firestore SDK did not load. Check your internet connection.");
        }
        if (!config || requiredSettings.some((setting) => !config[setting])) {
            throw new Error("Firebase Web app settings are missing from firebase-config.js.");
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }

        window.firebase = firebase;
        return firebase.auth();
    };
})();
