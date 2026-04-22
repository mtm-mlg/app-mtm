// app/api/driver/orders/update/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "ID Pesanan dan Status diperlukan" }, { status: 400 });
    }

    const orderRef = doc(db, "orders", orderId);
    
    // Update status di Firestore
    await updateDoc(orderRef, {
      status: status, // misal: 'active' (saat diterima) atau 'completed' (saat selesai)
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true, message: `Status pesanan diperbarui ke ${status}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}