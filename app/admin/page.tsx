"use client";
import { useState, useEffect } from "react";
import { 
  Package, Users, Wallet, TrendingUp, TrendingDown, 
  Clock, RefreshCw, CheckCircle2, ArrowRight, CalendarDays,
  MapPin, ShieldCheck, ChevronRight, Download, Landmark, User, Weight, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, deleteDoc } from "firebase/firestore";

// HELPER UNTUK MENCEGAH PEMBULATAN RUPIAH (MENAMPILKAN DESIMAL JIKA ADA)
const formatCurrency = (amount: number) => {
  return Number(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// =====================================================================
// FUNGSI PEMBUAT PAYLOAD QRIS DINAMIS
// =====================================================================
const generateDynamicQris = (baseNmid: string, amount: number) => {
  if (!baseNmid || baseNmid.length < 30 || baseNmid.includes("http")) return baseNmid;

  try {
    const payload = baseNmid.substring(0, baseNmid.length - 4); 
    const step1 = payload.replace("010211", "010212"); 

    const step2Parts = step1.split("5802ID");
    if (step2Parts.length < 2) return baseNmid;

    const strAmount = amount.toString();
    const tag54 = `54${String(strAmount.length).padStart(2, '0')}${strAmount}`;
    const step3 = `${step2Parts[0]}${tag54}5802ID${step2Parts[1]}`;

    let crc = 0xFFFF;
    for (let i = 0; i < step3.length; i++) {
      crc ^= step3.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
        else crc <<= 1;
      }
    }
    const finalCrc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return step3 + finalCrc;
  } catch (error) {
    console.error("Gagal parse QRIS:", error);
    return baseNmid; 
  }
};

export default function AdminDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [ownerBalance, setOwnerBalance] = useState(0); 
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [onlineDrivers, setOnlineDrivers] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  const [settings, setSettings] = useState<any>(null); 
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [trendGrowth, setTrendGrowth] = useState({ value: "0%", isPositive: true });

  // ========================================================
  // RUMUS REAL TANPA PEMBULATAN (TERKONEKSI KE SETTINGS)
  // ========================================================
  const getSubtotalJasa = (order: any) => {
    const qty = Number(order.quantity) || 1;
    if (order.basePrice) return Number(order.basePrice) * qty; 
    const total = Number(order.totalPrice) || 0;
    const shopping = Number(order.shoppingCost) || 0;
    const urgent = Number(order.urgentFee) || 0;
    const calc = total - shopping - urgent;
    return calc > 0 ? calc : total;
  };

  const getOwnerCommission = (order: any, appSettings: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier?.toLowerCase() || 'sedang';
    
    let pct = 0.15; // Default fallback 15%
    
    const comms = appSettings?.commissions || appSettings?.commissionTiers;

    if (comms && comms[tier] !== undefined) {
       // PENTING: Karena di Settings yang disimpan adalah jatah Driver (Misal 85%), 
       // maka Owner dapat sisanya (100 - 85 = 15%).
       pct = (100 - Number(comms[tier])) / 100;
    } else {
       if (tier === 'ringan') pct = 0.16;
       else if (tier === 'sedang') pct = 0.15;
       else if (tier === 'berat') pct = 0.13;
    }
    
    return base * pct;
  };

  const getDriverProfit = (order: any, appSettings: any) => {
    const base = getSubtotalJasa(order);
    const ownerComm = getOwnerCommission(order, appSettings);
    const urgent = Number(order.urgentFee) || 0;
    return (base - ownerComm) + urgent;
  };

  const getTotalTagihan = (order: any) => {
    const base = getSubtotalJasa(order);
    const shopping = Number(order.shoppingCost) || 0;
    const urgent = Number(order.urgentFee) || 0;
    return base + shopping + urgent;
  };

  // ========================================================
  // TARIK DATA REAL-TIME & KALKULASI PINTAR
  // ========================================================
  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const snapSettings = await getDoc(doc(db, "settings", "global"));
      let currentSettings = null;
      if (snapSettings.exists()) {
        currentSettings = snapSettings.data();
        setSettings(currentSettings);
      }

      // NO-CACHE UNTUK MENGAMBIL DATA TERBARU
      const timestamp = new Date().getTime();
      const resOrders = await fetch(`/api/orders?_t=${timestamp}`, { cache: "no-store" });
      const resultOrders = await resOrders.json();
      
      const resDrivers = await fetch(`/api/drivers?_t=${timestamp}`, { cache: "no-store" });
      const resultDrivers = await resDrivers.json();

      const snapWithdraw = await getDocs(collection(db, "withdrawals"));
      let totalOwnerWithdrawn = 0;
      snapWithdraw.forEach(document => {
        const d = document.data();
        if (d.type === 'owner_withdraw') {
          totalOwnerWithdrawn += (Number(d.amount) || 0);
        }
      });
      
      if (resultOrders.success) {
        const allOrders = resultOrders.data;
        setOrders(allOrders);

        let totalAllTimeOwnerComm = 0;
        let tempTrend = [];
        let thisWeekTotal = 0;
        let lastWeekTotal = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const msPerDay = 1000 * 60 * 60 * 24;
        
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

        allOrders.forEach((o: any) => {
          if (o.status === 'completed') {
            const commission = getOwnerCommission(o, currentSettings);
            totalAllTimeOwnerComm += commission;

            if (o.createdAt) {
              const orderDate = new Date(o.createdAt);
              orderDate.setHours(0, 0, 0, 0);
              
              const diffDays = Math.round((today.getTime() - orderDate.getTime()) / msPerDay);

              if (diffDays >= 0 && diffDays <= 6) {
                const targetDay = tempTrend.find(t => t.timestamp === orderDate.getTime());
                if (targetDay) {
                  targetDay.value += commission;
                  thisWeekTotal += commission;
                }
              } 
              else if (diffDays >= 7 && diffDays <= 13) {
                lastWeekTotal += commission;
              }
            }
          }
        });

        // SENGAJA TIDAK DIBATASI MATH.MAX(0) AGAR OWNER BISA MELIHAT JIKA SALDONYA MINUS EFEK BUG
        setOwnerBalance(totalAllTimeOwnerComm - totalOwnerWithdrawn);

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
      }

      if (resultDrivers.success) {
        const driversList = resultDrivers.data;
        setTotalDrivers(driversList.length);
        
        const actives = driversList.filter((d: any) => d.isOnline === true && d.status !== 'suspend');
        setOnlineDrivers(actives.length);
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
    // Auto-refresh 15 detik
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleWithdrawOwner = async () => {
    if (ownerBalance <= 0) return alert("Saldo Kas Owner tidak mencukupi untuk ditarik.");
    if (confirm(`Apakah Anda yakin ingin menarik/mencairkan Saldo Kas Owner sebesar Rp ${formatCurrency(ownerBalance)}?\n\nSaldo di layar akan di-reset (di-Nol-kan).`)) {
      setIsWithdrawing(true);
      try {
        await addDoc(collection(db, "withdrawals"), {
          type: "owner_withdraw",
          amount: ownerBalance,
          createdAt: new Date().toISOString()
        });
        alert("Pencairan Saldo Kas Owner berhasil dicatat!\nSaldo sekarang adalah Rp 0.");
        fetchDashboardData();
      } catch (error) {
        alert("Gagal memproses penarikan.");
      } finally {
        setIsWithdrawing(false);
      }
    }
  };

  // TOMBOL DARURAT UNTUK MERESET EFEK BUG
  const handleFixNegativeBalance = async () => {
    if (confirm("Sistem mendeteksi saldo Anda Minus karena Anda sempat melakukan 'Tarik & Reset' saat kalkulator komisi sedang error sebelumnya.\n\nKlik OK untuk MERESET riwayat penarikan Owner, sehingga saldo Anda kembali normal sesuai akumulasi total order asli.")) {
      setIsWithdrawing(true);
      try {
        const snap = await getDocs(collection(db, "withdrawals"));
        const deletePromises = snap.docs
          .filter(d => d.data().type === 'owner_withdraw')
          .map(d => deleteDoc(doc(db, "withdrawals", d.id)));
        
        await Promise.all(deletePromises);
        alert("Koreksi berhasil! Saldo kas telah dipulihkan ke nominal yang sebenarnya.");
        fetchDashboardData();
      } catch (error) {
        alert("Gagal melakukan koreksi.");
      } finally {
        setIsWithdrawing(false);
      }
    }
  };

  const ordersPending = orders.filter(o => o.status === 'pending');
  const ordersProcessing = orders.filter(o => o.status === 'active');
  const ordersCompleted = orders.filter(o => o.status === 'completed').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10); 

  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* HEADER */}
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
      {/* BAGIAN 1: 3 KARTU STATISTIK */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        
        {/* KARTU SALDO OWNER */}
        <div className={`rounded-[1.5rem] p-6 shadow-xl relative overflow-hidden group ${ownerBalance < 0 ? 'bg-gradient-to-br from-rose-900 to-rose-800' : 'bg-gradient-to-br from-slate-900 to-slate-800'}`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
          
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="h-12 w-12 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center shrink-0 backdrop-blur-md border border-white/5">
              <Wallet size={20} strokeWidth={2.5} />
            </div>
            <button 
              onClick={handleWithdrawOwner}
              disabled={isWithdrawing || ownerBalance <= 0}
              className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors active:scale-95 shadow-md"
            >
              {isWithdrawing ? <RefreshCw size={12} className="animate-spin"/> : <Download size={12} />} 
              {isWithdrawing ? "Memproses..." : "Tarik & Reset"}
            </button>
          </div>

          <div className="relative z-10">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Kas Owner</p>
            <h4 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              <span className="text-lg text-slate-500 font-bold mr-1">Rp</span>
              {formatCurrency(ownerBalance)}
            </h4>
          </div>

          {/* TOMBOL DARURAT KOREKSI BUG */}
          {ownerBalance < 0 && (
             <div className="absolute bottom-0 left-0 right-0 bg-rose-600/80 backdrop-blur-sm p-2 flex justify-between items-center z-20 animate-in slide-in-from-bottom-5">
                <span className="text-[9px] text-white font-bold uppercase tracking-widest ml-2 flex items-center gap-1"><AlertTriangle size={10}/> Efek Bug Lama</span>
                <button onClick={handleFixNegativeBalance} className="text-[9px] bg-white text-rose-700 font-bold px-3 py-1 rounded shadow-sm hover:bg-rose-50 transition-colors active:scale-95">Perbaiki Saldo</button>
             </div>
          )}
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
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 animate-pulse">Butuh Driver</span>
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
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 mb-0.5">{onlineDrivers} Aktif</span>
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
            <TrendingUp className="text-emerald-500" size={20} /> Tren Profit Owner
          </h3>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-2 mb-6">Perbandingan profit bersih yang didapatkan selama 7 hari terakhir.</p>
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
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold py-1 px-3 rounded-lg pointer-events-none whitespace-nowrap shadow-lg">
                Rp {formatCurrency(data.value)}
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
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Pantau pergerakan transaksi dan pembagian profit secara live.</p>
        </div>
        <Link href="/admin/orders">
          <button className="flex items-center justify-center w-full md:w-auto gap-2 text-xs md:text-sm text-blue-600 font-bold bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-xl transition-all border border-blue-100">
            Riwayat Lengkap <ChevronRight size={16} />
          </button>
        </Link>
      </div>

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
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2 truncate">
                  <MapPin size={12} className="text-amber-500 shrink-0" /> {order.serviceName}
                </p>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold flex items-center gap-1"><Weight size={10}/> Kriteria</p>
                    <p className="text-[11px] font-bold text-indigo-600 capitalize mt-0.5">{order.commissionTier || 'Sedang'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Total Tagihan</p>
                    <p className="text-xs font-black text-slate-800 mt-0.5">Rp {formatCurrency(getTotalTagihan(order))}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1"><Landmark size={10}/> Profit Owner</p>
                    <span className="text-[11px] font-black text-emerald-600 tracking-tight">Rp {formatCurrency(getOwnerCommission(order, settings))}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-blue-500 uppercase flex justify-end gap-1"><User size={10}/> Profit Driver</p>
                    <span className="text-[11px] font-black text-blue-600 tracking-tight">Rp {formatCurrency(getDriverProfit(order, settings))}</span>
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
                  <div className="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-100 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-500">Driver Bertugas:</span>
                     <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">{order.driverCode}</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold flex items-center gap-1"><Weight size={10}/> Kriteria</p>
                      <p className="text-[11px] font-bold text-indigo-600 capitalize mt-0.5">{order.commissionTier || 'Sedang'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Total Tagihan</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">Rp {formatCurrency(getTotalTagihan(order))}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1"><Landmark size={10}/> Profit Owner</p>
                      <span className="text-[11px] font-black text-emerald-600 tracking-tight">Rp {formatCurrency(getOwnerCommission(order, settings))}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-blue-500 uppercase flex justify-end gap-1"><User size={10}/> Profit Driver</p>
                      <span className="text-[11px] font-black text-blue-600 tracking-tight">Rp {formatCurrency(getDriverProfit(order, settings))}</span>
                    </div>
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
              <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{order.invoice}</span>
                  <span className="text-[9px] font-bold text-slate-400">{formatTime(order.createdAt)}</span>
                </div>
                <h5 className="font-extrabold text-slate-700 text-sm mb-2 truncate">{order.customerName}</h5>
                
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold flex items-center gap-1"><Weight size={10}/> Kriteria</p>
                    <p className="text-[10px] font-bold text-indigo-600 capitalize mt-0.5">{order.commissionTier || 'Sedang'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Total Tagihan</p>
                    <p className="text-[11px] font-black text-slate-800 mt-0.5">Rp {formatCurrency(getTotalTagihan(order))}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-[8px] font-bold text-emerald-500 uppercase flex items-center gap-1"><Landmark size={10}/> Profit Owner</p>
                    <span className="text-[10px] font-black text-emerald-600 tracking-tight">Rp {formatCurrency(getOwnerCommission(order, settings))}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-blue-500 uppercase flex justify-end gap-1"><User size={10}/> {order.driverCode}</p>
                    <span className="text-[10px] font-black text-blue-600 tracking-tight">Rp {formatCurrency(getDriverProfit(order, settings))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

    </div>
  );
}