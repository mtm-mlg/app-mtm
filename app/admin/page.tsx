"use client";
import { useState, useEffect } from "react";
import { 
  Package, Users, Wallet, TrendingUp, TrendingDown, 
  Clock, RefreshCw, CheckCircle2, ArrowRight, CalendarDays,
  MapPin, ShieldCheck, ChevronRight
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // STATE UNTUK DATA DINAMIS
  const [orders, setOrders] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0); // Omzet = Komisi Owner
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // STATE UNTUK GRAFIK MINGGUAN DINAMIS
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [trendGrowth, setTrendGrowth] = useState({ value: "0%", isPositive: true });

  // FUNGSI HITUNG KOMISI OWNER (Disamakan dengan riwayat pesanan)
  const getOwnerCommission = (tier: string, total: number) => {
    if (!total) return 0;
    if (tier === 'ringan') return total * 0.30; 
    if (tier === 'sedang') return total * 0.20; 
    if (tier === 'berat') return total * 0.10;  
    return total * 0.20; // Default jika kosong
  };

  // FUNGSI TARIK DATA REAL-TIME & KALKULASI PINTAR
  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const resOrders = await fetch("/api/orders");
      const resultOrders = await resOrders.json();
      
      if (resultOrders.success) {
        const allOrders = resultOrders.data;
        setOrders(allOrders);

        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        let tempTrend = [];
        let thisWeekTotal = 0;
        let lastWeekTotal = 0;
        const msPerDay = 1000 * 60 * 60 * 24;
        
        // 1. Buat struktur 7 hari ke belakang
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
          tempTrend.push({
            timestamp: d.getTime(),
            day: dayName.substring(0, 3), 
            value: 0,
            isToday: i === 0
          });
        }

        // 2. Masukkan data komisi ke dalam array hari yang cocok
        allOrders.forEach((o: any) => {
          if (o.status === 'completed' && o.createdAt) {
            const orderDate = new Date(o.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            
            // Hitung KOMISI OWNER (Bukan Total Belanja)
            const commission = getOwnerCommission(o.commissionTier, o.totalPrice);

            const diffDays = Math.round((today.getTime() - orderDate.getTime()) / msPerDay);

            // Jika pesanan dalam 7 hari terakhir (Minggu Ini)
            if (diffDays >= 0 && diffDays <= 6) {
              const targetDay = tempTrend.find(t => t.timestamp === orderDate.getTime());
              if (targetDay) {
                targetDay.value += commission;
                thisWeekTotal += commission;
              }
            } 
            // Jika pesanan antara 7-13 hari yang lalu (Minggu Lalu, untuk perbandingan tren)
            else if (diffDays >= 7 && diffDays <= 13) {
              lastWeekTotal += commission;
            }
          }
        });

        // 3. Normalisasi tinggi diagram & tentukan pertumbuhan (%)
        const maxVal = Math.max(...tempTrend.map(t => t.value));
        const finalTrend = tempTrend.map(t => ({
          day: t.day,
          value: t.value,
          height: maxVal > 0 ? `${Math.max((t.value / maxVal) * 100, 5)}%` : '5%', 
          isToday: t.timestamp === today.getTime()
        }));

        let growthPct = 0;
        if (lastWeekTotal === 0 && thisWeekTotal > 0) {
          growthPct = 100;
        } else if (lastWeekTotal > 0) {
          growthPct = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
        }

        setWeeklyTrend(finalTrend);
        setTrendGrowth({
          value: Math.abs(growthPct).toFixed(1) + "%",
          isPositive: growthPct >= 0
        });
        
        // Revenue Hari Ini adalah array terakhir (Hari ke-0 / isToday)
        setTodayRevenue(finalTrend[6].value);
      }

      // Tarik Jumlah Driver
      const resDrivers = await fetch("/api/drivers");
      const resultDrivers = await resDrivers.json();
      if (resultDrivers.success) {
        setTotalDrivers(resultDrivers.data.length);
      }
    } catch (error) {
      console.error("Gagal menarik data dashboard:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchDashboardData(); 
    
    // LIVE TRACKER: Update otomatis setiap 15 detik
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  // KELOMPOKKAN DATA UNTUK PAPAN KANBAN
  const ordersPending = orders.filter(o => o.status === 'pending');
  const ordersProcessing = orders.filter(o => o.status === 'active');
  const ordersCompleted = orders.filter(o => o.status === 'completed').slice(0, 10); // Ambil 10 selesai terbaru

  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HEADER & NOTIFIKASI RESET */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 mt-2">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard Eksekutif</h2>
          <div className="flex items-center gap-2 mt-1.5 text-slate-500 text-sm font-medium">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Sistem Operasional MTM berjalan normal.</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 px-5 py-2.5 rounded-xl flex items-center gap-3 shadow-sm w-fit">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
          <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            Live Tracker {isRefreshing && <RefreshCw size={12} className="animate-spin text-emerald-500" />}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 1: 3 KARTU STATISTIK (PREMIUM UI) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        
        {/* KARTU OMZET */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[1.5rem] p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0 backdrop-blur-md border border-white/5">
              <Wallet size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendapatan Bersih (Hari Ini)</p>
              <h4 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                <span className="text-lg text-slate-500 font-bold mr-1">Rp</span>
                {todayRevenue.toLocaleString('id-ID')}
              </h4>
            </div>
          </div>
        </div>

        {/* KARTU PESANAN */}
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all relative overflow-hidden">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Package size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Menunggu Diproses</p>
            <div className="flex items-center gap-3">
              <h4 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{ordersPending.length}</h4>
              {ordersPending.length > 0 && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 animate-pulse">Action Required</span>
              )}
            </div>
          </div>
          {ordersPending.length > 0 && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>}
        </div>

        {/* KARTU ARMADA */}
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users size={24} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Armada Terdaftar</p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{totalDrivers}</h4>
              <span className="text-xs font-bold text-slate-400 mb-0.5">Mitra Aktif</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* BAGIAN 2: GRAFIK TREN (KOMISI) */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 mb-12 shadow-sm relative flex flex-col md:flex-row items-center gap-8 md:gap-16">
        
        <div className="w-full md:w-1/3 relative z-10 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-8">
          <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-2">
            <TrendingUp className="text-emerald-500" size={20} /> Tren Pendapatan
          </h3>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-2 mb-6">Perbandingan komisi bersih yang didapatkan selama 7 hari terakhir.</p>
          <div className="flex items-end justify-center md:justify-start gap-3">
            <h4 className={`text-3xl md:text-5xl font-black tracking-tighter ${trendGrowth.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {trendGrowth.isPositive ? '+' : '-'}{trendGrowth.value}
            </h4>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 mb-1 md:mb-2 uppercase tracking-widest flex items-center gap-1">
              {trendGrowth.isPositive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} vs Minggu Lalu
            </span>
          </div>
        </div>

        <div className="w-full md:w-2/3 h-32 md:h-40 flex items-end justify-between gap-2 sm:gap-4 relative z-10">
          {weeklyTrend.length === 0 && <div className="w-full text-center text-sm text-slate-400 font-medium">Memuat data tren...</div>}
          {weeklyTrend.map((data, i) => (
            <div key={i} className="flex flex-col items-center gap-2 md:gap-3 flex-1 group h-full justify-end relative">
              
              {/* Tooltip Hover */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold py-1 px-3 rounded-lg pointer-events-none whitespace-nowrap shadow-lg">
                Rp {data.value.toLocaleString('id-ID')}
              </div>

              <div className="w-full bg-slate-50 rounded-md md:rounded-lg relative flex items-end h-full overflow-hidden border border-slate-100">
                <div 
                  className={`w-full rounded-md md:rounded-lg transition-all duration-1000 ${data.isToday ? 'bg-blue-600 shadow-[0_-5px_15px_rgba(37,99,235,0.3)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} 
                  style={{ height: data.height }}
                ></div>
              </div>
              <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-wider ${data.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{data.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 3: LIVE TRACKER PESANAN (KANBAN) */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-3 md:gap-4 mb-4 md:mb-6 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Papan Operasional Harian</h3>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Pantau pergerakan transaksi dan alokasi driver secara live.</p>
        </div>
        <Link href="/admin/orders">
          <button className="flex items-center justify-center w-full md:w-auto gap-2 text-xs md:text-sm text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-xl transition-all border border-blue-100">
            Riwayat Lengkap <ChevronRight size={16} />
          </button>
        </Link>
      </div>

      {/* CONTAINER HORIZONTAL SCROLL UNTUK HP */}
      <div className="flex overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 snap-x snap-mandatory hide-scrollbar">
        
        {/* KOLOM 1: PENDING */}
        <div className="bg-slate-50/80 rounded-3xl p-4 md:p-5 border border-slate-200 flex flex-col min-w-[300px] md:min-w-0 snap-center shrink-0 w-[85vw] md:w-auto">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shadow-sm"><Clock size={16} strokeWidth={2.5} /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Menunggu Driver</h4>
            </div>
            <span className="bg-amber-100 border border-amber-200 text-amber-700 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersPending.length}</span>
          </div>
          
          <div className="space-y-3">
            {ordersPending.length === 0 && <p className="text-center text-slate-400 text-xs md:text-sm font-medium py-10 border-2 border-dashed border-slate-200 rounded-2xl">Tidak ada antrean.</p>}
            {ordersPending.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-amber-500 border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase tracking-wider">{order.invoice}</span>
                  <span className="text-[10px] font-bold text-slate-400">{formatTime(order.createdAt)}</span>
                </div>
                <h5 className="font-black text-slate-800 text-sm mb-1 truncate">{order.customerName}</h5>
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-3 truncate">
                  <MapPin size={12} className="text-amber-500 shrink-0" /> {order.serviceName}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tagihan</p>
                    <span className="text-sm font-black text-slate-800 tracking-tight">Rp {order.totalPrice?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Potensi Komisi</p>
                    <span className="text-sm font-black text-emerald-600 tracking-tight">+ Rp {getOwnerCommission(order.commissionTier, order.totalPrice).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 2: PROCESSING */}
        <div className="bg-blue-50/30 rounded-3xl p-4 md:p-5 border border-blue-100 flex flex-col min-w-[300px] md:min-w-0 snap-center shrink-0 w-[85vw] md:w-auto">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shadow-sm"><RefreshCw size={16} strokeWidth={2.5} className="animate-spin-slow" /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Sedang Dikerjakan</h4>
            </div>
            <span className="bg-blue-100 border border-blue-200 text-blue-700 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersProcessing.length}</span>
          </div>

          <div className="space-y-3">
            {ordersProcessing.length === 0 && <p className="text-center text-slate-400 text-xs md:text-sm font-medium py-10 border-2 border-dashed border-slate-200 rounded-2xl">Tidak ada pesanan berjalan.</p>}
            {ordersProcessing.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md uppercase tracking-wider">{order.invoice}</span>
                    <span className="flex items-center gap-1 text-blue-500 text-[9px] font-black animate-pulse uppercase tracking-widest"><Clock size={10} /> Active</span>
                  </div>
                  <h5 className="font-black text-slate-800 text-sm mb-2 truncate">{order.customerName}</h5>
                  <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-500">Driver Bertugas:</span>
                     <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">{order.driverCode}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-xs font-black text-slate-600 tracking-tight">Total: Rp {order.totalPrice?.toLocaleString('id-ID')}</span>
                    <span className="text-xs font-black text-emerald-500 tracking-tight">+ Rp {getOwnerCommission(order.commissionTier, order.totalPrice).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KOLOM 3: COMPLETED */}
        <div className="bg-slate-50/50 rounded-3xl p-4 md:p-5 border border-slate-200 flex flex-col min-w-[300px] md:min-w-0 snap-center shrink-0 w-[85vw] md:w-auto">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg shadow-sm"><CheckCircle2 size={16} strokeWidth={2.5} /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Selesai (Terbaru)</h4>
            </div>
          </div>

          <div className="space-y-3">
            {ordersCompleted.length === 0 && <p className="text-center text-slate-400 text-xs md:text-sm font-medium py-10 border-2 border-dashed border-slate-200 rounded-2xl">Belum ada penyelesaian.</p>}
            {ordersCompleted.map(order => (
              <div key={order.id} className="bg-white p-3 md:p-4 rounded-xl border border-slate-100 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{order.invoice}</span>
                  <span className="text-[9px] font-bold text-slate-400">{formatTime(order.createdAt)}</span>
                </div>
                <h5 className="font-extrabold text-slate-700 text-xs md:text-sm mb-2 truncate">{order.customerName}</h5>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Driver: {order.driverCode || '-'}</span>
                  <span className="text-xs font-black text-emerald-600">+ Rp {getOwnerCommission(order.commissionTier, order.totalPrice).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      {/* STYLE CSS UNTUK MENYEMBUNYIKAN SCROLLBAR DI HP TAPI TETAP BISA SCROLL */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

    </div>
  );
}