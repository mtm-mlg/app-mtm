"use client";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, RefreshCw 
} from "lucide-react";

export default function DriverHistoryPage() {
  const [driverCode, setDriverCode] = useState<string>("");
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Ambil sesi login
  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
    } else {
      window.location.href = "/";
    }
  }, []);

  // 2. Tarik Data History Real-time dari API
  const fetchHistory = async () => {
    if (!driverCode) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      if (result.success) {
        // Ambil SEMUA pesanan (termasuk selesai & batal)
        setOrders(result.data);
      }
    } catch (error) {
      console.error("Gagal menarik data riwayat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [driverCode]);

  // HELPER FORMAT TANGGAL (SUDAH DIPERBAIKI BUG-NYA) 🛠️
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    
    // Jaring Pengaman: Jika tanggalnya rusak/invalid, kembalikan strip
    if (isNaN(date.getTime())) return "-"; 

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // HELPER MENGHITUNG PENDAPATAN BERSIH DRIVER PER PESANAN
  const calculateDriverIncome = (tier: string, total: number) => {
    if (tier === 'ringan') return total * 0.70; 
    if (tier === 'sedang') return total * 0.80; 
    if (tier === 'berat') return total * 0.90;  
    return total; // Default
  };

  // FILTER PENCARIAN & HANYA TAMPILKAN YANG SUDAH SELESAI ATAU DIBATALKAN
  const filteredHistory = orders.filter(order => {
    const isHistoryStatus = order.status === "completed" || order.status === "cancelled";
    const matchSearch = order.invoice?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        order.serviceName?.toLowerCase().includes(searchTerm.toLowerCase());
    return isHistoryStatus && matchSearch;
  });

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in duration-500 pb-20">
      
      {/* HEADER SECTION */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2">
            <ClipboardList className="text-blue-600" size={28} /> Riwayat Pesanan
          </h2>
          <p className="text-sm text-slate-500 font-medium">Catatan seluruh tugas yang telah Anda selesaikan.</p>
        </div>
        <button 
          onClick={fetchHistory} 
          disabled={isLoading}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95"
        >
          <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* SEARCH (STICKY DI HP) */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-4 pt-2 mb-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari ID Invoice atau Nama Jasa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium shadow-sm"
          />
        </div>
      </div>

      {/* STATE LOADING */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <RefreshCw size={36} className="text-blue-500 animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-500">Sinkronisasi Riwayat...</p>
        </div>
      ) : 

      /* STATE KOSONG */
      filteredHistory.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center opacity-60 bg-white rounded-3xl border border-slate-200 border-dashed mt-4">
          <ClipboardList size={48} className="text-slate-300 mb-4" />
          <h4 className="font-bold text-slate-500 mb-1">Belum Ada Riwayat</h4>
          <p className="text-sm text-slate-400 max-w-[250px]">Pesanan yang Anda selesaikan akan muncul di sini.</p>
        </div>
      ) : 

      /* LIST KARTU RIWAYAT REAL-TIME */
      (
        <div className="space-y-4">
          {filteredHistory.map((order) => {
            const myIncome = calculateDriverIncome(order.commissionTier, order.totalPrice || 0);

            return (
              <div key={order.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99] relative overflow-hidden">
                
                {/* Garis Warna di Kiri (Hijau untuk selesai, Merah untuk batal) */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${order.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3">
                    <span className="text-[10px] md:text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-widest inline-block w-fit">
                      {order.invoice}
                    </span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Calendar size={12}/> {formatDate(order.createdAt)}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  {order.status === "completed" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                      <CheckCircle2 size={12} /> SELESAI
                    </span>
                  ) : (
                   <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                      <XCircle size={12} /> BATAL
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center mb-3 pl-2">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base md:text-lg">{order.serviceName}</h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">{order.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Pendapatan Anda</span>
                    <span className={`font-black text-lg md:text-xl ${order.status === 'completed' ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>
                      Rp {myIncome.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-slate-200 pl-2">
                  {order.origin && order.destination ? (
                    <p className="text-xs md:text-sm font-semibold text-slate-500 flex items-center gap-1.5 line-clamp-1">
                      <MapPin size={14} className="text-blue-500 shrink-0" /> {order.origin} <span className="mx-1 text-slate-300">➔</span> {order.destination}
                    </p>
                  ) : (
                    <p className="text-xs md:text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-500 shrink-0" /> Selesai dikerjakan
                    </p>
                  )}
                </div>
                
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}