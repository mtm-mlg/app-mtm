"use client";
import { useState, useEffect } from "react";
import { 
  Wallet, ArrowUpRight, ArrowDownToLine, 
  Clock, CheckCircle2, Landmark, History, ChevronRight,
  Banknote, QrCode, Info, AlertTriangle, RefreshCw
} from "lucide-react";

export default function DriverWalletPage() {
  const [driverCode, setDriverCode] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // STATE DOMPET REAL-TIME
  const [digitalBalance, setDigitalBalance] = useState(0); 
  const [cashHakBersih, setCashHakBersih] = useState(0);   
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
    } else {
      window.location.href = "/";
    }
  }, []);

  // HELPER FORMAT TANGGAL (SUDAH KEBAL BUG) 🛠️
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-"; // Jaring pengaman
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // FUNGSI TARIK DATA DOMPET DAN RIWAYAT
  const fetchWalletData = async () => {
    if (!driverCode) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      
      if (result.success) {
        const completedOrders = result.data.filter((o: any) => o.status === "completed");
        
        let totalDigital = 0;
        let totalCashNet = 0;
        let trxList: any[] = [];

        completedOrders.forEach((o: any) => {
          const total = o.totalPrice || 0;
          let driverCutPercent = 1; 

          if (o.commissionTier === 'ringan') driverCutPercent = 0.70; 
          if (o.commissionTier === 'sedang') driverCutPercent = 0.80; 
          if (o.commissionTier === 'berat') driverCutPercent = 0.90;  

          const driverNetIncome = total * driverCutPercent;
          const method = o.paymentMethod?.toLowerCase() || 'cash';
          
          // Pengaman ekstra untuk sorting tanggal
          const raw = o.createdAt ? new Date(o.createdAt).getTime() : 0;
          const safeRawDate = isNaN(raw) ? 0 : raw;
          
          if (method.includes('qris') || method.includes('transfer')) {
            totalDigital += driverNetIncome;
            
            trxList.push({
              id: o.invoice,
              type: "earning",
              title: `${o.serviceName} (Net)`,
              amount: `+ Rp ${driverNetIncome.toLocaleString('id-ID')}`,
              date: formatDate(o.createdAt),
              status: "success",
              method: "qris",
              rawDate: safeRawDate
            });

          } else {
            totalCashNet += driverNetIncome;

            trxList.push({
              id: o.invoice,
              type: "earning",
              title: `${o.serviceName} (Net)`,
              amount: `Rp ${driverNetIncome.toLocaleString('id-ID')}`,
              date: formatDate(o.createdAt),
              status: "success",
              method: "cash",
              rawDate: safeRawDate
            });
          }
        });

        trxList.sort((a, b) => b.rawDate - a.rawDate);

        setDigitalBalance(totalDigital);
        setCashHakBersih(totalCashNet);
        setTransactions(trxList);
      }
    } catch (error) {
      console.error("Gagal menarik data dompet", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [driverCode]);

  const handleWithdraw = () => {
    if (digitalBalance <= 0) {
      alert("Saldo digital Anda Rp 0. Tidak ada dana yang bisa ditarik.");
      return;
    }
    
    setIsWithdrawing(true);
    setTimeout(() => {
      setIsWithdrawing(false);
      alert(`Permintaan penarikan dana sebesar Rp ${digitalBalance.toLocaleString('id-ID')} berhasil dikirim ke Admin! (Fitur dummy UI)`);
    }, 1500);
  };

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      {/* HEADER SECTION */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-1 flex items-center gap-2">
            <Wallet className="text-blue-600" size={28} /> Dompet Mitra
          </h2>
          <p className="text-sm text-slate-500 font-medium">Pantau saldo digital dan riwayat pendapatan bersih Anda.</p>
        </div>
        <button 
          onClick={fetchWalletData} 
          disabled={isLoading}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95"
        >
          <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* BANNER TRANSPARANSI KOMISI */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
        <div>
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Informasi Pendapatan</h4>
          <p className="text-[11px] font-medium text-blue-600 leading-relaxed">
            Semua nominal yang tampil di halaman ini adalah <strong className="font-black">Pendapatan Bersih (Hak Anda)</strong> yang sudah dipotong komisi sistem/owner.
          </p>
        </div>
      </div>

      {/* KARTU SALDO DIGITAL (NON-TUNAI) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden mb-6">
        <div className="absolute -top-24 -right-10 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Landmark size={16} /> Saldo Digital (Bisa Ditarik)
            </span>
          </div>

          <div className="mb-8 flex items-end justify-between">
            <div>
              <span className="text-lg md:text-xl text-slate-300 font-medium mr-2">Rp</span>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight inline-block">
                {isLoading ? "..." : digitalBalance.toLocaleString('id-ID')}
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleWithdraw}
              disabled={isWithdrawing || isLoading}
              className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isWithdrawing ? <Clock size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
              {isWithdrawing ? "Memproses..." : "Tarik Dana"}
            </button>
            <button className="px-5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center">
              <History size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* REKAP KILAT (PEMISAHAN TUNAI & DIGITAL BERSIIH) */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Banknote size={12} className="text-emerald-500"/> Tunai (Hak Bersih)
          </p>
          <div className="flex items-center gap-2">
            <h4 className="text-xl font-black text-slate-800">
              Rp {isLoading ? "..." : cashHakBersih.toLocaleString('id-ID')}
            </h4>
          </div>
          <p className="text-[9px] text-slate-400 font-semibold mt-1 leading-relaxed">Porsi bersih Anda dari uang fisik pelanggan.</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <QrCode size={12} className="text-blue-500"/> Dompet (Net)
          </p>
          <div className="flex items-center gap-2">
            <h4 className="text-xl font-black text-slate-800">
              Rp {isLoading ? "..." : digitalBalance.toLocaleString('id-ID')}
            </h4>
          </div>
          <p className="text-[9px] text-slate-400 font-semibold mt-1 leading-relaxed">Pendapatan bersih via QRIS/Transfer.</p>
        </div>
      </div>

      {/* DAFTAR RIWAYAT TRANSAKSI */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-widest">Aktivitas Terakhir</h3>
          <button className="text-xs font-bold text-blue-600 flex items-center gap-0.5 hover:text-blue-800">
            Lihat Semua <ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <RefreshCw size={30} className="text-blue-500 animate-spin mb-3" />
              <p className="text-xs font-bold text-slate-400">Memuat transaksi...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center opacity-60">
              <Wallet size={40} className="text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-500">Belum ada riwayat transaksi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((trx) => (
                <div key={trx.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.99]">
                  <div className="flex items-center gap-3 md:gap-4">
                    
                    {/* Ikon Tipe Transaksi */}
                    <div className={`p-2.5 rounded-2xl shrink-0 ${
                      trx.type === 'earning' && trx.method === 'cash' ? 'bg-amber-50 text-amber-600' :
                      trx.type === 'earning' ? 'bg-emerald-50 text-emerald-600' : 
                      trx.type === 'deduction' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {trx.type === 'earning' && trx.method === 'cash' ? <Banknote size={20} strokeWidth={2.5} /> : 
                       trx.type === 'earning' ? <ArrowUpRight size={20} strokeWidth={2.5} /> : 
                       trx.type === 'deduction' ? <AlertTriangle size={20} strokeWidth={2.5} /> :
                       <ArrowDownToLine size={20} strokeWidth={2.5} />}
                    </div>
                    
                    {/* Detail Teks */}
                    <div>
                      <h4 className="font-bold text-slate-800 text-[13px] md:text-sm mb-0.5">{trx.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-slate-500">{trx.date}</span>
                        
                        {trx.method === 'cash' && (
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-widest">CASH</span>
                        )}
                        {trx.method === 'qris' && (
                          <span className="text-[8px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-widest">QRIS/TF</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Jumlah Nominal */}
                  <div className="text-right">
                    <h4 className={`font-black text-sm md:text-base ${
                      trx.type === 'earning' && trx.method === 'cash' ? 'text-amber-600' :
                      trx.type === 'earning' ? 'text-emerald-600' : 
                      trx.type === 'deduction' ? 'text-rose-600' : 'text-slate-800'
                    }`}>
                      {trx.amount}
                    </h4>
                    {trx.status === 'success' && (
                      <span className="text-[9px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                        <CheckCircle2 size={10} className="text-emerald-500" /> Berhasil
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}