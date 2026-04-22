// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validasi Data Sederhana
    if (!body.customerName || !body.totalPrice) {
      return NextResponse.json(
        { success: false, error: "Data pesanan tidak lengkap." },
        { status: 400 }
      );
    }

    // 2. Generate Nomor Invoice (Contoh: INV-MTM-1713800000)
    const invoiceNumber = `INV-MTM-${Date.now()}`;

    // 3. Simpan ke Koleksi 'orders' di Firestore
    const docRef = await addDoc(collection(db, "orders"), {
      invoice: invoiceNumber,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      category: body.category,
      serviceName: body.serviceName,
      unit: body.unit,
      quantity: body.quantity,
      basePrice: body.basePrice,
      urgentFee: body.urgentFee || 0,
      totalPrice: body.totalPrice,
      commissionTier: body.commissionTier,
      driverCode: body.driverCode || null, // Null jika belum ditugaskan
      paymentMethod: body.paymentMethod,
      status: "pending", // Status awal: pending, active, completed, cancelled
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ 
      success: true, 
      message: "Pesanan berhasil dibuat!",
      orderId: docRef.id,
      invoice: invoiceNumber
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}