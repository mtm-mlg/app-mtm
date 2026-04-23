// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";

// ==================================================================
// FUNGSI POST: Untuk Menyimpan Pesanan Baru dari Form Owner
// ==================================================================
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

// ==================================================================
// FUNGSI GET: Untuk Menarik Semua Data Pesanan ke Tabel Riwayat
// ==================================================================
export async function GET() {
  try {
    // Tarik semua data dari koleksi "orders", urutkan dari yang paling baru
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Konversi timestamp Firebase ke format string yang bisa dibaca frontend
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}