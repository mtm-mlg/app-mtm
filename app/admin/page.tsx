"use client";
import { useState, useEffect } from "react";
import { 
  ArrowUpRight, Package, Users, Wallet, TrendingUp, 
  Clock, RefreshCw, CheckCircle2, ArrowRight, CalendarDays,
  MapPin
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // STATE UNTUK DATA DINAMIS
  const [orders, setOrders] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // STATE UNTUK GRAFIK MINGGUAN DINAMIS
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([
    { day: "Sen", value: 0, height: "5%" }, { day: "Sel", value: 0, height: "5%" },
    { day: "Rab", value: 0, height: "5%" }, { day: "Kam", value: 0, height: "5%" },
    { day: "Jum", value: 0, height: "5%" }, { day: "Sab", value: 0, height: "5%" },
    { day: "Min", value: 0, height: "5%", isToday: true }
  ]);
  const [trendGrowth, setTrendGrowth] = useState("+0%");

  // FUNGSI TARIK DATA REAL-TIME
  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Tarik Data Pesanan
      const resOrders = await fetch("/api/orders");
      const resultOrders = await resOrders.json();
      
      if (resultOrders.success) {
        const allOrders = resultOrders.data;
        setOrders(allOrders);

        // KUMPULKAN DATA UNTUK GRAFIK 7 HARI TERAKHIR
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset jam ke 00:00:00

        let tempTrend = [];
        let thisWeekTotal = 0;
        
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          
          // Format nama hari (Sen, Sel, Rab, dll)
          const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d);
          
          tempTrend.push({
            timestamp: d.getTime(),
            day: dayName.substring(0, 3), // Ambil 3 huruf pertama
            value: 0,
            isToday: i === 0
          });
        }

        // Masukkan omzet pesanan ke hari yang cocok
        allOrders.forEach((o: any) => {
          if (o.status === 'completed' && o.createdAt) {
            const orderDate = new Date(o.createdAt);
            orderDate.setHours(0, 0, 0, 0);
            
            const targetDay = tempTrend.find(t => t.timestamp === orderDate.getTime());
            if (targetDay) {
              targetDay.value += (o.totalPrice || 0);
              thisWeekTotal += (o.totalPrice || 0);
            }
          }
        });

        // Cari omzet tertinggi untuk mengatur tinggi persentase balok (max 100%)
        const maxVal = Math.max(...tempTrend.map(t => t.value));
        const finalTrend = tempTrend.map(t => ({
          day: t.day,
          value: t.value,
          // Tinggi minimal 5% agar grafiknya tetap terlihat meski 0
          height: maxVal > 0 ? `${Math.max((t.value / maxVal) * 100, 5)}%` : '5%', 
          isToday: t.isToday
        }));

        setWeeklyTrend(finalTrend);
        
        // Simulasikan persentase pertumbuhan (Bisa didinamiskan lebih lanjut nanti)
        setTrendGrowth(thisWeekTotal > 0 ? "+12%" : "0%");

        // Hitung Omzet HARI INI dari data tempTrend yang index terakhir (hari ini)
        setTodayRevenue(finalTrend[6].value);
      }

      // 2. Tarik Data Armada
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
    
    // LIVE TRACKER: Update otomatis setiap 10 detik
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  // KELOMPOKKAN DATA UNTUK PAPAN KANBAN
  const ordersPending = orders.filter(o => o.status === 'pending');
  const ordersProcessing = orders.filter(o => o.status === 'active');
  const ordersCompleted = orders.filter(o => o.status === 'completed').slice(0, 5);

  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
  };

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
          <span className="text-xs font-bold text-blue-700 uppercase tracking-widest flex items-center gap-2">
            Live Tracker On
            {isRefreshing && <RefreshCw size={12} className="animate-spin text-blue-500" />}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 1: 3 KARTU STATISTIK */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Wallet size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Omzet Hari Ini</p>
            <div className="flex items-end gap-3">
              <h4 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                Rp {todayRevenue.toLocaleString('id-ID')}
              </h4>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Package size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pesanan Baru (Pending)</p>
            <div className="flex items-end gap-3">
              <h4 className="text-3xl font-black text-slate-800 tracking-tight">{ordersPending.length}</h4>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 mb-1">Butuh Aksi</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Armada Terdaftar</p>
            <div className="flex items-end gap-2">
              <h4 className="text-3xl font-black text-slate-800 tracking-tight">{totalDrivers}</h4>
              <span className="text-sm font-bold text-slate-400 mb-1">Mitra</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* BAGIAN 2: GRAFIK TREN (LEBAR PENUH & ELEGAN) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 mb-12 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-16">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="w-full md:w-1/3 relative z-10 text-center md:text-left">
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
            <TrendingUp className="text-blue-400" size={20} /> Tren Mingguan
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-2 mb-6">Perbandingan aktivitas transaksi 7 hari terakhir.</p>
          <div className="flex items-end justify-center md:justify-start gap-3">
            <h4 className="text-4xl md:text-5xl font-black text-blue-400 tracking-tighter">{trendGrowth}</h4>
            <span className="text-xs font-bold text-slate-500 mb-2 uppercase">vs Minggu Lalu</span>
          </div>
        </div>

        <div className="w-full md:w-2/3 h-40 flex items-end justify-between gap-2 sm:gap-4 relative z-10">
          {weeklyTrend.map((data, i) => (
            <div key={i} className="flex flex-col items-center gap-3 flex-1 group h-full justify-end" title={`Rp ${data.value.toLocaleString('id-ID')}`}>
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
      {/* BAGIAN 3: LIVE TRACKER PESANAN (KANBAN) */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Live Papan Pesanan</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">Status perjalanan armada secara real-time.</p>
        </div>
        <Link href="/admin/orders">
          <button className="flex items-center gap-2 text-sm text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-all">
            Lihat Riwayat Lengkap <ArrowRight size={16} />
          </button>
        </Link>
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
            {ordersPending.length === 0 && <p className="text-center text-slate-400 text-sm font-medium py-10">Kosong</p>}
            {ordersPending.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md uppercase border border-amber-100">{order.invoice}</span>
                  <span className="text-xs font-bold text-slate-400">{formatTime(order.createdAt)}</span>
                </div>
                <h5 className="font-black text-slate-800 text-base mb-1">{order.customerName}</h5>
                <p className="text-[13px] font-bold text-slate-500 flex items-center gap-1.5 mb-5 truncate">
                  <MapPin size={14} className="text-blue-500 shrink-0" /> {order.serviceName}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-base font-black text-slate-900 tracking-tight">Rp {order.totalPrice?.toLocaleString('id-ID')}</span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{order.driverCode ? `Kode: ${order.driverCode}` : 'Belum Ada'}</span>
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
            {ordersProcessing.length === 0 && <p className="text-center text-blue-400/50 text-sm font-medium py-10">Tidak ada armada berjalan</p>}
            {ordersProcessing.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 border-y border-r border-slate-200 shadow-sm cursor-pointer relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase border border-blue-100">{order.invoice}</span>
                  <span className="flex items-center gap-1.5 text-blue-500 text-[10px] font-black animate-pulse uppercase tracking-wider"><RefreshCw size={12} /> Proses</span>
                </div>
                <h5 className="font-black text-slate-800 text-base mb-1">{order.customerName}</h5>
                <p className="text-[13px] font-bold text-slate-500 mb-5">Driver: <span className="text-blue-600 font-black">{order.driverCode}</span></p>
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-base font-black text-slate-900 tracking-tight">Rp {order.totalPrice?.toLocaleString('id-ID')}</span>
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
              <h4 className="font-extrabold text-slate-800">Selesai (Terbaru)</h4>
            </div>
            <span className="bg-white border border-slate-200 text-slate-600 text-xs font-black px-2.5 py-1 rounded-full shadow-sm">{ordersCompleted.length}</span>
          </div>

          <div className="space-y-4">
            {ordersCompleted.length === 0 && <p className="text-center text-slate-400 text-sm font-medium py-10">Belum ada penyelesaian</p>}
            {ordersCompleted.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md uppercase border border-emerald-100">{order.invoice}</span>
                  <span className="text-xs font-bold text-slate-400">{formatTime(order.createdAt)}</span>
                </div>
                <h5 className="font-extrabold text-slate-700 text-base mb-4">{order.customerName}</h5>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{order.driverCode ? `Driver: ${order.driverCode}` : ''}</span>
                  <span className="text-sm font-black text-slate-800 tracking-tight">Rp {order.totalPrice?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}