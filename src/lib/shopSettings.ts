import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShopSettings } from "@/types";

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "Your Paint Shop",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  ntnStrn: "",
  invoicePrefix: "INV-",
  currency: "PKR",
  updatedAt: 0
};

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    const snap = await getDoc(doc(db, "settings", "shop"));
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ShopSettings>) };
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_SETTINGS;
}
