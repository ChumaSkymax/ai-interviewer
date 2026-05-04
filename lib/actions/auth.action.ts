"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();
  const authInstance = await auth;

  // Create session cookie
  const sessionCookie = await authInstance.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION * 1000, // milliseconds
  });

  // Set cookie in the browser
  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;
  const dbInstance = await db;

  try {
    // check if user exists in db
    const userRecord = await dbInstance.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db
    await dbInstance.collection("users").doc(uid).set({
      name,
      email,
      // profileURL,
      // resumeURL,
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    const authInstance = await auth;
    const dbInstance = await db;

    const userRecord = await authInstance.getUserByEmail(email);
    if (!userRecord)
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };

    // Self-heal: ensure a Firestore profile exists so getCurrentUser
    // doesn't return null and bounce the user back to /sign-in.
    const profileRef = dbInstance.collection("users").doc(userRecord.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      await profileRef.set({
        name: userRecord.displayName ?? email.split("@")[0],
        email,
      });
    }

    await setSessionCookie(idToken);
    return { success: true };
  } catch (error: any) {
    console.error("signIn failed:", error);

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const authInstance = await auth;
    const dbInstance = await db;

    const decodedClaims = await authInstance.verifySessionCookie(
      sessionCookie,
      true
    );

    const userRecord = await dbInstance
      .collection("users")
      .doc(decodedClaims.uid)
      .get();

    // If the Firestore profile is missing, fall back to the verified
    // session claims so the user isn't redirected back to /sign-in.
    if (!userRecord.exists) {
      return {
        id: decodedClaims.uid,
        email: decodedClaims.email ?? "",
        name:
          (decodedClaims.name as string | undefined) ??
          decodedClaims.email?.split("@")[0] ??
          "",
      } as User;
    }

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    console.error("getCurrentUser failed:", error);

    // Invalid or expired session
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
