"use client";
import { useState } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, Filter 
} from "lucide-react";

// DATA DUMMY RIWAYAT DRIVER
const historyOrders = [
  { id: "INV-00120", date: "22 Apr 2026, 14:30", service: "Antar Jemput (Motor)", price: "Rp 36.000", status: "Selesai", type: "Jarak", route: "Stasiun Kota -> Jl. Suhat" },
  { id: "INV-00118", date: "22 Apr 2026, 11:15", service: "Kirim Paket", price: "Rp 24.000", status: "Selesai", type: "Barang", route: "Klojen -> Blimbing" },
  { id: "INV-00115", date: "22 Apr 2026, 09:00", service: "Angkut Pindahan Kos", price: "Rp 90.000", status: "Selesai", type: "Tenaga", route: "Lowokwaru -> Dinoyo" },
  { id: "INV-00110", date: "21 Apr 2026, 16:45", service: "Sewa Sopir Harian", price: "Rp 150.000", status: "Selesai", type: "Waktu", route: "Malang -> Surabaya" },
  { id: "INV-00105", date: "21 Apr 2026, 10:20", service: "Antar Jemput (Mobil)", price: "Rp 0", status: "Dibatalkan", type: "Jarak", route: "Bandara -> Batu" },
];

export default function DriverHistoryPage() {
  const [activeTab, setActiveTab] = useState("Hari Ini");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={28} /> Riwayat Pesanan
        </h2>
        <p className="text-sm text-slate-500 font-medium">Catatan seluruh perjalanan dan tugas yang telah Anda kerjakan.</p>
      </div>

      {/* TABS & SEARCH (STICKY DI HP) */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-4 pt-2 mb-2">
        {/* Tab Filter */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl mb-4">
          {["Hari Ini", "Minggu Ini", "Bulan Ini"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                activeTab === tab 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Pencarian */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari ID Invoice..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium shadow-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm transition-colors active:scale-95">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* LIST KARTU RIWAYAT */}
      <div className="space-y-4">
        {historyOrders.map((order) => (
          <div key={order.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]">
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] md:text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-widest">{order.id}</span>
                <span className="text-[10px] md:text-xs font-bold text-slate-400 flex items-center gap-1"><Calendar size={12}/> {order.date}</span>
              </div>
              
              {/* Status Badge */}
              {order.status === "Selesai" ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  <CheckCircle2 size={12} /> SELESAI
                </span>
              ) : (
               <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                  <XCircle size={12} /> BATAL
                </span>
              )}
            </div>

            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-slate-800 text-base md:text-lg">{order.service}</h3>
              <span className={`font-black text-lg md:text-xl ${order.status === 'Selesai' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
                {order.price}
              </span>
            </div>

            <div className="pt-3 border-t border-dashed border-slate-200">
              <p className="text-xs md:text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-500" /> {order.route}
              </p>
            </div>
            
          </div>
        ))}
      </div>

      {/* EMPTY STATE (JIKA TIDAK ADA DATA) */}
      {/* <div className="py-12 flex flex-col items-center justify-center text-center opacity-60">
        <ClipboardList size={48} className="text-slate-300 mb-4" />
        <h4 className="font-bold text-slate-500 mb-1">Belum Ada Riwayat</h4>
        <p className="text-sm text-slate-400">Pesanan yang Anda selesaikan akan muncul di sini.</p>
      </div> */}

    </div>
  );
}