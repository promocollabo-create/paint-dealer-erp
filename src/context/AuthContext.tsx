"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data() as Omit<AppUser, "uid">;
            if (data.active === false) {
              setError("This account has been disabled. Contact your admin.");
              await firebaseSignOut(auth);
              setAppUser(null);
            } else {
              setAppUser({ uid: user.uid, ...data });
            }
          } else {
            // No role profile yet — block access rather than silently granting one.
            setError("No role assigned to this account yet. Contact your admin.");
            await firebaseSignOut(auth);
            setAppUser(null);
          }
        } catch (e) {
          console.error(e);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  async function sendReset(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("No authenticated user.");
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, appUser, loading, error, login, logout, sendReset, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Helper used by an admin-only "create staff/manager" flow (Phase 1 seed / user management). */
export async function createUserProfile(uid: string, email: string, name: string, role: UserRole) {
  await setDoc(doc(db, "users", uid), {
    email,
    name,
    role,
    active: true,
    createdAt: serverTimestamp()
  });
}
