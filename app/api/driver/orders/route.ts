// app/api/driver/orders/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverCode = searchParams.get("driverCode");

    if (!driverCode) {
      return NextResponse.json({ error: "Driver Code diperlukan" }, { status: 400 });
    }

    // Mengambil pesanan yang ditugaskan ke driver ini dan belum selesai
    const q = query(
      collection(db, "orders"),
      where("driverCode", "==", driverCode),
      where("status", "in", ["pending", "active"]),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}