// Dynamic import to avoid ESM compatibility issues with Next.js 15
let firebaseAdmin: any = null;

async function initFirebaseAdmin() {
  if (!firebaseAdmin) {
    try {
      const { initializeApp, getApps, cert } =
        await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      const { getFirestore } = await import("firebase-admin/firestore");

      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
              /\\n/g,
              "\n"
            )!,
          }),
        });
      }

      firebaseAdmin = {
        auth: getAuth(),
        db: getFirestore(),
      };
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
      throw error;
    }
  }

  return firebaseAdmin;
}

// Export async getters
export const getAuth = async () => {
  const admin = await initFirebaseAdmin();
  return admin.auth;
};

export const getDb = async () => {
  const admin = await initFirebaseAdmin();
  return admin.db;
};

// For backward compatibility - these will be promises
export const auth = getAuth();
export const db = getDb();
