"use client";
import { useState, useEffect } from "react";
import { 
  ArrowUpRight, Package, Users, Wallet, TrendingUp, 
  Clock, RefreshCw, CheckCircle2, ArrowRight, CalendarDays,
  MapPin
} from "lucide-react";

export default function AdminDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Data Dummy untuk Chart Mingguan
  const weeklyTrend = [
    { day: "Sen", value: 45, height: "45%" },
    { day: "Sel", value: 60, height: "60%" },
    { day: "Rab", value: 35, height: "35%" },
    { day: "Kam", value: 80, height: "80%" },
    { day: "Jum", value: 55, height: "55%" },
    { day: "Sab", value: 90, height: "90%" },
    { day: "Min", value: 100, height: "100%", isToday: true },
  ];

  // Data Dummy Kanban
  const ordersPending = [
    { id: "INV-008", customer: "Bapak Andi", service: "Antar Jemput (Motor)", time: "10:30", price: "Rp 35.000" },
    { id: "INV-009", customer: "Ibu Siti", service: "Kirim Paket Dokumen", time: "10:45", price: "Rp 45.000" },
  ];
  const ordersProcessing = [
    { id: "INV-006", customer: "Toko Laris", driver: "Ahmad (01)", time: "09:15", price: "Rp 120.000" },
    { id: "INV-007", customer: "PT. Maju", driver: "Budi (02)", time: "09:40", price: "Rp 85.000" },
  ];
  const ordersCompleted = [
    { id: "INV-001", customer: "Reza", driver: "Deni (04)", time: "07:20", price: "Rp 25.000" },
    { id: "INV-002", customer: "Keluarga Rahman", driver: "Ahmad (01)", time: "08:00", price: "Rp 60.000" },
  ];

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HEADER & NOTIFIKASI RESET */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 mt-2">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Ringkasan Operasional</h2>
          <div className="flex items-center gap-2 mt-1.5 text-slate-500 text-sm font-medium">
            <CalendarDays size={16} className="text-blue-500" />
            <span>Data otomatis direset setiap pukul 00.00 WIB</span>
          </div>
        </div>
        <div className="bg-blue-50/80 border border-blue-100 px-5 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">Live Tracker On</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 1: 3 KARTU STATISTIK (SEJAJAR HORIZONTAL & PROPORSIONAL) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Omzet Hari Ini</p>
            <div className="flex items-end gap-3">
              <h4 className="text-3xl font-black text-slate-800 tracking-tight">450K</h4>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 mb-1">+12%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Package size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pesanan Baru</p>
            <div className="flex items-end gap-3">
              <h4 className="text-3xl font-black text-slate-800 tracking-tight">12</h4>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 mb-1">+4 Order</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver Aktif (Ready)</p>
            <div className="flex items-end gap-2">
              <h4 className="text-3xl font-black text-slate-800 tracking-tight">4</h4>
              <span className="text-lg font-bold text-slate-400 mb-0.5">/ 10</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* BAGIAN 2: GRAFIK TREN (LEBAR PENUH & ELEGAN) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 mb-12 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-16">
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        {/* Info Text */}
        <div className="w-full md:w-1/3 relative z-10 text-center md:text-left">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
            <TrendingUp className="text-blue-400" size={20} /> Tren Mingguan
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-2 mb-6">Perbandingan aktivitas transaksi 7 hari terakhir.</p>
          <div className="flex items-end justify-center md:justify-start gap-3">
            <h4 className="text-5xl font-black text-blue-400 tracking-tighter">+28%</h4>
            <span className="text-xs font-bold text-slate-500 mb-2 uppercase">vs Minggu Lalu</span>
          </div>
        </div>

        {/* Bar Chart Area */}
        <div className="w-full md:w-2/3 h-40 flex items-end justify-between gap-2 sm:gap-4 relative z-10">
          {weeklyTrend.map((data, i) => (
            <div key={i} className="flex flex-col items-center gap-3 flex-1 group h-full justify-end">
              <div className="w-full bg-slate-800 rounded-lg relative flex items-end h-full overflow-hidden transition-colors group-hover:bg-slate-700">
                <div 
                  className={`w-full rounded-lg transition-all duration-1000 ${data.isToday ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-slate-500'}`} 
                  style={{ height: data.height }}
                ></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${data.isToday ? 'text-blue-400' : 'text-slate-500'}`}>{data.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 3: LIVE TRACKER PESANAN (KANBAN YANG RAPI) */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Live Papan Pesanan</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">Status perjalanan armada secara real-time.</p>
        </div>
        <button className="flex items-center gap-2 text-sm text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-all">
          Lihat Riwayat Lengkap <ArrowRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* KOLOM 1: PENDING */}
        <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={16} strokeWidth={2.5} /></div>
              <h4 className="font-extrabold text-slate-800">Belum Diproses</h4>
            </div>
            <span className="bg-white border border-slate-200 text-slate-600 text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersPending.length}</span>
          </div>
          
          <div className="space-y-4">
            {ordersPending.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md uppercase border border-amber-100">{order.id}</span>
                  <span className="text-xs font-bold text-slate-400">{order.time}</span>
                </div>
                <h5 className="font-black text-slate-800 text-base mb-1">{order.customer}</h5>
                <p className="text-[13px] font-bold text-slate-500 flex items-center gap-1.5 mb-5">
                  <MapPin size={14} className="text-blue-500" /> {order.service}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-base font-black text-slate-900 tracking-tight">{order.price}</span>
                  <button className="bg-slate-900 text-white text-[11px] font-bold px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors shadow-sm">Tugaskan</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 2: PROCESSING */}
        <div className="bg-blue-50/50 rounded-3xl p-5 border border-blue-100 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><RefreshCw size={16} strokeWidth={2.5} className="animate-spin-slow" /></div>
              <h4 className="font-extrabold text-blue-900">Sedang Jalan</h4>
            </div>
            <span className="bg-white border border-blue-200 text-blue-600 text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersProcessing.length}</span>
          </div>

          <div className="space-y-4">
            {ordersProcessing.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 border-y border-r border-slate-200 shadow-sm cursor-pointer relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase border border-blue-100">{order.id}</span>
                  <span className="flex items-center gap-1.5 text-blue-500 text-[10px] font-black animate-pulse uppercase tracking-wider"><RefreshCw size={12} /> Proses</span>
                </div>
                <h5 className="font-black text-slate-800 text-base mb-1">{order.customer}</h5>
                <p className="text-[13px] font-bold text-slate-500 mb-5">Driver: <span className="text-blue-600">{order.driver}</span></p>
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-base font-black text-slate-900 tracking-tight">{order.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 3: COMPLETED */}
        <div className="bg-slate-50/50 rounded-3xl p-5 border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 size={16} strokeWidth={2.5} /></div>
              <h4 className="font-extrabold text-slate-800">Selesai</h4>
            </div>
            <span className="bg-white border border-slate-200 text-slate-600 text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersCompleted.length}</span>
          </div>

          <div className="space-y-4">
            {ordersCompleted.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md uppercase border border-emerald-100">{order.id}</span>
                  <span className="text-xs font-bold text-slate-400">{order.time}</span>
                </div>
                <h5 className="font-extrabold text-slate-700 text-base mb-4">{order.customer}</h5>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{order.driver}</span>
                  <span className="text-sm font-black text-slate-800 tracking-tight">{order.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}