import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status, proofUrl } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "ID Pesanan dan Status diperlukan" }, { status: 400 });
    }

    const orderRef = doc(db, "orders", orderId);
    
    const updateData: any = {
      status: status, 
      updatedAt: new Date().toISOString()
    };

    if (proofUrl) {
      updateData.proofUrl = proofUrl;
    }

    await updateDoc(orderRef, updateData);

    return NextResponse.json({ 
      success: true, 
      message: `Status pesanan diperbarui ke ${status}${proofUrl ? ' dengan bukti foto' : ''}` 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}