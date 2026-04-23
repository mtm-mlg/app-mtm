import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, addDoc } from "firebase/firestore";

export async function GET() {
  try {
    const driversRef = collection(db, "drivers");
    const driversSnap = await getDocs(driversRef);
    const knownDrivers = driversSnap.docs.map(doc => doc.data());

    const q = query(collection(db, "orders"));
    const querySnapshot = await getDocs(q);
    const allOrders = querySnapshot.docs.map(doc => doc.data());

    const driversData = knownDrivers.map(driver => {
      const driverOrders = allOrders.filter(o => o.driverCode === driver.code);
      const completedOrders = driverOrders.filter(o => o.status === "completed");
      
      let totalRevenue = 0; 
      let ownerCommission = 0; 

      completedOrders.forEach(o => {
        totalRevenue += o.totalPrice || 0;
        let cut = 0;
        if (o.commissionTier === 'ringan') cut = o.totalPrice * 0.30;
        else if (o.commissionTier === 'sedang') cut = o.totalPrice * 0.20;
        else if (o.commissionTier === 'berat') cut = o.totalPrice * 0.10;
        ownerCommission += cut;
      });

      return {
        ...driver,
        completedOrders: completedOrders.length, 
        totalRevenue: totalRevenue, 
        ownerCommission: ownerCommission, 
      };
    });

    return NextResponse.json({ success: true, data: driversData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.code || !body.name) {
      return NextResponse.json({ success: false, error: "Kode dan Nama Driver wajib diisi" }, { status: 400 });
    }
    const docRef = await addDoc(collection(db, "drivers"), {
      ...body,
      status: "aktif",
      createdAt: new Date().toISOString()
    });
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}