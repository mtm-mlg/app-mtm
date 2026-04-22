import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Mengambil parameter titik jemput (origin) dan tujuan (destination) dari URL
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Titik jemput dan tujuan wajib diisi." },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  try {
    // Memanggil Google Maps Distance Matrix API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        origin
      )}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== "OK" || data.rows[0].elements[0].status !== "OK") {
      throw new Error("Gagal menghitung rute. Pastikan lokasi valid.");
    }

    // Mengambil jarak dalam satuan meter, lalu ubah ke KM
    const distanceText = data.rows[0].elements[0].distance.text; // Contoh: "15.5 km"
    const distanceValue = data.rows[0].elements[0].distance.value; // Contoh: 15500 (meter)
    
    // Estimasi waktu tempuh
    const durationText = data.rows[0].elements[0].duration.text; 

    return NextResponse.json({
      success: true,
      distance: {
        text: distanceText,
        value: distanceValue / 1000, // Konversi meter ke KM
      },
      duration: durationText,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}