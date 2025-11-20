
declare var firebase: any;

// --- IMPORTANT: REPLACE WITH YOUR FIREBASE CONFIG ---
// 1. Go to https://console.firebase.google.com/
// 2. Create a project (if you haven't).
// 3. Add a Web App to your project.
// 4. Copy the `firebaseConfig` object and paste it below.
// 5. Go to "Firestore Database" -> "Create Database".
// 6. Start in "Test Mode" (for now) to allow read/write.

const firebaseConfig = {
  apiKey: "AIzaSyCTJFyk5JO6Ssv6JaWM3s-77y2tAKvLZPg",
  authDomain: "zehn-gah-db.firebaseapp.com",
  projectId: "zehn-gah-db",
  storageBucket: "zehn-gah-db.firebasestorage.app",
  messagingSenderId: "375213670994",
  appId: "1:375213670994:web:cb37886e2ec98d2143d58b"
};
// --------------------------------------------------

let db: any = null;

export const FirebaseService = {
    initialize() {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            try {
                // Check if config is still the placeholder
                if (firebaseConfig.apiKey === "YOUR_API_KEY") {
                    console.warn("Firebase config is missing! Please update services/firebaseService.ts");
                    return false;
                }
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                
                // Enable Offline Persistence
                // This allows the app to work with unstable internet and sync later
                db.enablePersistence({ synchronizeTabs: true })
                    .catch((err: any) => {
                        if (err.code == 'failed-precondition') {
                            console.warn("Firestore persistence failed: Multiple tabs open.");
                        } else if (err.code == 'unimplemented') {
                             console.warn("Firestore persistence not supported by browser.");
                        }
                    });

                return true;
            } catch (e) {
                console.error("Firebase Init Error:", e);
                return false;
            }
        } else if (typeof firebase !== 'undefined' && firebase.apps.length) {
            db = firebase.firestore();
            return true;
        }
        return false;
    },

    async saveUserData(userId: string, data: any) {
        if (!this.initialize() || !db) return null;
        try {
            // We use the 'merge' option to update fields without overwriting everything if structure changes
            await db.collection('users').doc(userId).set(data, { merge: true });
            return true;
        } catch (error) {
            console.error("Firestore Save Error:", error);
            return false;
        }
    },

    async loadUserData(userId: string) {
        if (!this.initialize() || !db) return null;
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                return doc.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error("Firestore Load Error:", error);
            throw error;
        }
    }
};
