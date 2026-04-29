"use client";
import { useState, useEffect } from "react";
import { 
  Wallet, ArrowUpRight, ArrowDownToLine, 
  Clock, CheckCircle2, Landmark, History,
  Banknote, Info, RefreshCw, X, UploadCloud, Camera, ShoppingCart, Calendar, ChevronRight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, getDoc } from "firebase/firestore";

// HELPER UNTUK MENCEGAH PEMBULATAN (MENAMPILKAN DESIMAL JIKA ADA)
const formatCurrency = (amount: number) => {
  return Number(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default function DriverWalletPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [driverCode, setDriverCode] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  // STATE DOMPET REAL-TIME
  const [digitalBalance, setDigitalBalance] = useState(0); 
  const [cashHakBersih, setCashHakBersih] = useState(0);   
  const [pendingReimburse, setPendingReimburse] = useState(0); 
  const [totalWithdrawn, setTotalWithdrawn] = useState(0); 
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [bankForm, setBankForm] = useState({
    bankName: "", accountNumber: "", accountName: ""
  });

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [isReimburseModalOpen, setIsReimburseModalOpen] = useState(false);
  const [selectedReimburse, setSelectedReimburse] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    setIsLoaded(true);
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
      const savedBank = localStorage.getItem("mtm_bank_details");
      if (savedBank) setBankForm(JSON.parse(savedBank));
    } else {
      window.location.href = "/";
    }
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file)); 
    }
  };

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
    
    let pct = 0.15; 
    if (appSettings && appSettings.commissions && appSettings.commissions[tier] !== undefined) {
       pct = Number(appSettings.commissions[tier]) / 100;
    } else {
       if (tier === 'ringan') pct = 0.16;
       else if (tier === 'sedang') pct = 0.15;
       else if (tier === 'berat') pct = 0.13;
    }
    return base * pct;
  };

  const getDriverNetIncome = (order: any, appSettings: any) => {
    const baseJasa = getSubtotalJasa(order);
    const ownerComm = getOwnerCommission(order, appSettings);
    const urgentFee = Number(order.urgentFee) || 0;
    return (baseJasa - ownerComm) + urgentFee;
  };

  const fetchWalletData = async () => {
    if (!driverCode) return;
    setIsLoading(true);

    try {
      const snapSettings = await getDoc(doc(db, "settings", "global"));
      let currentSettings = null;
      if (snapSettings.exists()) {
        currentSettings = snapSettings.data();
        setSettings(currentSettings);
      }

      const resProfile = await fetch("/api/drivers");
      const profileData = await resProfile.json();
      if (profileData.success) {
        const me = profileData.data.find((d: any) => d.code === driverCode);
        if (me) setDriverName(me.name);
      }

      const qWithdraw = query(collection(db, "withdrawals"), where("driverCode", "==", driverCode));
      const snapWithdraw = await getDocs(qWithdraw);
      
      let totalWithdrawnIncome = 0;
      let totalSuccessWithdrawn = 0;
      let reimburseMap: any = {};
      let trxList: any[] = [];

      snapWithdraw.forEach(doc => {
        const data = doc.data();
        const safeRawDate = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
        const dateGroup = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(safeRawDate);
        const timeStr = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(safeRawDate) + ' WIB';

        if (data.type === 'income') {
          totalWithdrawnIncome += Number(data.amount) || 0;
          if (data.status === 'completed') totalSuccessWithdrawn += Number(data.amount) || 0;
          
          trxList.push({
            id: doc.id,
            isWithdrawal: true,
            title: "Penarikan Saldo Pendapatan",
            amount: `- Rp ${formatCurrency(Number(data.amount) || 0)}`,
            dateGroup,
            time: timeStr,
            status: data.status === "completed" ? "success" : "pending",
            rawDate: safeRawDate
          });
        } else if (data.type === 'reimburse') {
          reimburseMap[data.orderId] = data.status; 
        }
      });

      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      
      let totalDigitalIncome = 0;
      let totalCashNet = 0;
      let totalPiutangTalangan = 0;

      if (result.success) {
        const completedOrders = result.data.filter((o: any) => o.status === "completed");

        completedOrders.forEach((o: any) => {
          const driverNetIncome = getDriverNetIncome(o, currentSettings);
          const talangan = Number(o.shoppingCost) || 0;
          
          const method = o.paymentMethod?.toLowerCase() || 'cash';
          const isDigital = method.includes('qris') || method.includes('transfer');
          const isBelanja = talangan > 0; 
          
          const safeRawDate = o.createdAt && !isNaN(new Date(o.createdAt).getTime()) ? new Date(o.createdAt).getTime() : Date.now();
          const dateGroup = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(safeRawDate);
          const timeStr = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(safeRawDate) + ' WIB';
          
          if (isDigital) {
            totalDigitalIncome += driverNetIncome;
            if (isBelanja) {
              const rStatus = reimburseMap[o.id] || 'none';
              if (rStatus === 'none' || rStatus === 'pending') {
                totalPiutangTalangan += talangan;
              }
            }
          } else {
            totalCashNet += driverNetIncome;
          }

          trxList.push({
            id: o.id,
            isWithdrawal: false,
            invoice: o.invoice,
            title: o.serviceName,
            amount: `${isDigital ? '+' : ''} Rp ${formatCurrency(driverNetIncome)}`,
            dateGroup,
            time: timeStr,
            status: "success",
            method: method,
            isDigital: isDigital,
            isBelanja: isBelanja,
            talangan: talangan,
            reimburseStatus: reimburseMap[o.id] || 'none', 
            rawDate: safeRawDate
          });
        });
      }

      trxList.sort((a, b) => b.rawDate - a.rawDate);

      setDigitalBalance(Math.max(0, totalDigitalIncome - totalWithdrawnIncome));
      setTotalWithdrawn(totalSuccessWithdrawn);
      setCashHakBersih(totalCashNet);
      setPendingReimburse(totalPiutangTalangan);
      setTransactions(trxList);
      
    } catch (error) {
      console.error("Gagal menarik data dompet", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWalletData(); }, [driverCode]);

  const groupedTransactions = transactions.reduce((acc, trx) => {
    if (!acc[trx.dateGroup]) acc[trx.dateGroup] = [];
    acc[trx.dateGroup].push(trx);
    return acc;
  }, {} as Record<string, any[]>);

  const submitIncomeWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const wAmount = Number(withdrawAmount);
    
    if (wAmount > digitalBalance) return alert("Nominal melebihi saldo digital yang tersedia!");
    if (wAmount <= 0) return alert("Masukkan nominal yang valid!");
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName) return alert("Harap lengkapi semua data rekening!");

    setIsWithdrawing(true);
    try {
      await addDoc(collection(db, "withdrawals"), {
        driverCode,
        driverName: driverName || driverCode,
        type: "income",
        amount: wAmount,
        bankName: bankForm.bankName,
        accountNumber: bankForm.accountNumber,
        accountName: bankForm.accountName,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      localStorage.setItem("mtm_bank_details", JSON.stringify(bankForm));
      alert("Permintaan Tarik Dana Pendapatan berhasil dikirim ke Owner!");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      fetchWalletData(); 

    } catch (error) {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const submitReimburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReimburse) return;
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName) return alert("Harap lengkapi data rekening!");
    if (!proofFile) return alert("Harap unggah FOTO STRUK PEMBELANJAAN sebagai bukti klaim reimburse!");

    setIsWithdrawing(true);
    let uploadedProofUrl = null;

    try {
      const CLOUD_NAME = "dwprlhbzb"; 
      const UPLOAD_PRESET = "mtm-mlg";  

      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("upload_preset", UPLOAD_PRESET);

      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });

      const cloudinaryData = await cloudinaryRes.json();
      if (cloudinaryData.secure_url) {
        uploadedProofUrl = cloudinaryData.secure_url;
      } else {
        throw new Error("Gagal mengunggah foto struk");
      }

      await addDoc(collection(db, "withdrawals"), {
        driverCode,
        driverName: driverName || driverCode,
        type: "reimburse",
        orderId: selectedReimburse.id,
        amount: selectedReimburse.talangan,
        bankName: bankForm.bankName,
        accountNumber: bankForm.accountNumber,
        accountName: bankForm.accountName,
        proofUrl: uploadedProofUrl,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      localStorage.setItem("mtm_bank_details", JSON.stringify(bankForm));
      alert(`Klaim Reimburse untuk Invoice ${selectedReimburse.invoice} berhasil diajukan!`);
      
      setIsReimburseModalOpen(false);
      setSelectedReimburse(null);
      setProofFile(null);
      setProofPreview(null);
      fetchWalletData();

    } catch (error) {
      alert("Terjadi kesalahan jaringan atau upload gambar.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // HYDRATION SAFE RENDER
  if (!isLoaded) return null;

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in duration-500 pb-24 px-2 md:px-0">
      
      {/* HEADER */}
      <div className="mb-6 flex justify-between items-end border-b border-slate-200 pb-5 pt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-blue-600" size={24} /> Dompet Mitra
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Pantau saldo digital dan pencairan dana Anda.</p>
        </div>
        <button 
          onClick={fetchWalletData} 
          disabled={isLoading}
          className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {showInfoBanner && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm relative animate-in slide-in-from-top-4">
          <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
          <div className="pr-4">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Catatan Keuangan</h4>
            <p className="text-[11px] font-medium text-blue-600 leading-relaxed">
              Semua nominal di dompet ini adalah murni <strong>Pendapatan Bersih Jasa</strong>. Khusus Uang Talangan Belanja dicatat secara terpisah agar tidak terkena potongan komisi.
            </p>
          </div>
          <button onClick={() => setShowInfoBanner(false)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 p-1 bg-white/50 hover:bg-white rounded-full transition-all">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KARTU SALDO UTAMA (DIGITAL) */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden mb-6 border border-slate-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs md:text-sm font-semibold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Landmark size={16} className="text-blue-400"/> Saldo Jasa (Bisa Ditarik)
            </p>
            {totalWithdrawn > 0 && (
              <div className="text-right">
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-widest mb-0.5">Total Dicairkan</p>
                <p className="text-xs font-bold text-emerald-400">Rp {formatCurrency(totalWithdrawn)}</p>
              </div>
            )}
          </div>

          <div className="mb-8 flex items-end">
            <span className="text-xl text-slate-400 font-medium mr-2 mb-1.5">Rp</span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              {isLoading ? "..." : formatCurrency(digitalBalance)}
            </h1>
          </div>

          <button 
            onClick={() => {
              if (digitalBalance <= 0) return alert("Saldo digital Anda Rp 0. Tidak ada dana yang bisa ditarik.");
              setWithdrawAmount(digitalBalance.toString());
              setIsWithdrawModalOpen(true);
            }}
            disabled={isLoading || digitalBalance <= 0}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm shadow-lg border border-blue-500"
          >
            <ArrowDownToLine size={18} /> Tarik Saldo Ke Rekening Anda
          </button>
        </div>
      </div>

      {/* REKAP KILAT - TERMASUK PIUTANG TALANGAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
          <Banknote size={48} className="absolute -bottom-3 -right-3 text-emerald-50 opacity-60 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">Tunai (Di Tangan)</p>
          <h4 className="text-xl md:text-2xl font-black text-slate-800 mt-1">
            Rp {isLoading ? "..." : formatCurrency(cashHakBersih)}
          </h4>
          <p className="text-[10px] text-slate-500 font-medium mt-2 bg-slate-50 inline-block px-2 py-1 rounded-md border border-slate-100">
            Pendapatan masuk via Pembayaran Cash.
          </p>
        </div>
        
        <div className="bg-rose-50 p-4 md:p-5 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
          <ShoppingCart size={48} className="absolute -bottom-3 -right-3 text-rose-100 opacity-60 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs font-bold text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">Piutang Talangan</p>
          <h4 className="text-xl md:text-2xl font-black text-rose-700 mt-1">
            Rp {isLoading ? "..." : formatCurrency(pendingReimburse)}
          </h4>
          <p className="text-[10px] text-rose-600 font-medium mt-2 bg-rose-100/50 inline-block px-2 py-1 rounded-md border border-rose-100">
            Uang pribadi yang mengendap di Owner.
          </p>
        </div>
      </div>

      {/* TRANSAKSI MUTASI */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 px-1 flex items-center gap-2">
          <History size={16} className="text-blue-500"/> Riwayat Mutasi & Reimburse
        </h3>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <RefreshCw size={28} className="text-blue-500 animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-400">Menarik data perbankan...</p>
          </div>
        ) : Object.keys(groupedTransactions).length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm opacity-80">
            <History size={40} className="text-slate-300 mb-3" />
            <p className="text-xs font-bold text-slate-500">Belum ada aktivitas mutasi dompet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedTransactions).map((dateGroup, idx) => (
              <div key={idx} className="animate-in fade-in slide-in-from-bottom-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                  <Calendar size={12} /> {dateGroup}
                </h4>
                
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                  {groupedTransactions[dateGroup].map((trx: any, tIdx: number) => (
                    <div key={`${trx.id}-${tIdx}`} className="p-4 md:p-5 flex flex-col hover:bg-slate-50/80 transition-colors">
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                            trx.isWithdrawal ? 'bg-slate-50 border-slate-200 text-slate-600' :
                            trx.method === 'cash' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          }`}>
                            {trx.isWithdrawal ? <ArrowDownToLine size={20} /> : 
                             trx.method === 'cash' ? <Banknote size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm mb-0.5 line-clamp-1 pr-2">{trx.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-slate-400">{trx.time}</span>
                              {!trx.isWithdrawal && (
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                  {trx.method === 'cash' ? 'CASH' : 'QRIS/TF'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <h4 className={`font-black text-sm md:text-base ${
                            trx.isWithdrawal ? 'text-slate-800' :
                            trx.method === 'cash' ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {trx.amount}
                          </h4>
                          {trx.isWithdrawal && (
                            <span className={`text-[10px] font-bold flex items-center justify-end gap-1 mt-1 ${trx.status === 'success' ? 'text-emerald-600' : 'text-amber-500'}`}>
                              {trx.status === 'success' ? <><CheckCircle2 size={12} /> Selesai</> : <><Clock size={12} /> Diproses</>}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* KOTAK REIMBURSE */}
                      {!trx.isWithdrawal && trx.isBelanja && trx.isDigital && trx.talangan > 0 && (
                        <div className="mt-4 bg-rose-50/60 border border-rose-100 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5"><ShoppingCart size={12} /> Talangan Anda Terpakai</p>
                            <p className="text-base font-black text-rose-700 mt-0.5">Rp {formatCurrency(trx.talangan)}</p>
                          </div>
                          <div>
                            {trx.reimburseStatus === 'none' && (
                              <button 
                                onClick={() => { setSelectedReimburse(trx); setIsReimburseModalOpen(true); }} 
                                className="w-full md:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <UploadCloud size={14} /> Klaim Reimburse Ke Owner
                              </button>
                            )}
                            {trx.reimburseStatus === 'pending' && (
                              <span className="w-full md:w-auto px-4 py-2.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200 flex items-center justify-center gap-1.5">
                                <Clock size={14} className="animate-spin-slow" /> Menunggu Transfer Owner
                              </span>
                            )}
                            {trx.reimburseStatus === 'completed' && (
                              <span className="w-full md:w-auto px-4 py-2.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5">
                                <CheckCircle2 size={14} /> Owner Telah Mencairkan
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {!trx.isWithdrawal && trx.isBelanja && !trx.isDigital && trx.talangan > 0 && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] text-slate-500 font-medium flex items-start gap-2">
                          <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <p>Uang talangan sebesar <strong className="text-slate-700">Rp {formatCurrency(trx.talangan)}</strong> sudah Anda terima langsung (Tunai/Cash) dari pelanggan.</p>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: KLAIM REIMBURSE */}
      {isReimburseModalOpen && selectedReimburse && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md relative flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><ShoppingCart size={18} className="text-blue-600" /> Form Klaim Reimburse</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">INV: {selectedReimburse.invoice}</p>
              </div>
              <button onClick={() => {setIsReimburseModalOpen(false); setSelectedReimburse(null); setProofFile(null); setProofPreview(null);}} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full border border-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form id="reimburseForm" onSubmit={submitReimburse} className="space-y-5">
                
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-widest">Hak Diganti</span>
                  <span className="text-2xl font-black text-blue-700">Rp {formatCurrency(selectedReimburse.talangan)}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest ml-1">Unggah Struk Asli <span className="text-rose-500">*</span></label>
                  {proofPreview ? (
                    <div className="relative inline-block w-full">
                      <img src={proofPreview} alt="Bukti" className="w-full h-40 object-cover rounded-xl border-2 border-slate-200 shadow-sm" />
                      <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-lg hover:bg-rose-600 hover:scale-110 transition-all">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer bg-slate-50 border-2 border-slate-300 border-dashed hover:border-blue-400 hover:bg-blue-50/50 text-slate-500 font-medium py-8 px-4 rounded-xl flex flex-col items-center justify-center transition-colors w-full group">
                      <div className="bg-white p-3 rounded-full shadow-sm border border-slate-200 mb-3 group-hover:scale-110 transition-transform">
                        <Camera size={24} className="text-blue-500" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">Buka Kamera / Galeri</span>
                      <span className="text-[10px] text-slate-400 mt-1">Pastikan nominal di struk terlihat jelas</span>
                      <input required type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Rekening Pencairan</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Bank / E-Wallet</label>
                      <input required type="text" placeholder="BCA / DANA" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">No. Rekening</label>
                      <input required type="text" placeholder="1234567890" value={bankForm.accountNumber} onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Atas Nama (Pemilik Rekening)</label>
                    <input required type="text" placeholder="Nama Lengkap" value={bankForm.accountName} onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white pb-safe">
              <button form="reimburseForm" type="submit" disabled={isWithdrawing || !proofFile} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-sm">
                {isWithdrawing ? <Clock size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                {isWithdrawing ? "Mengunggah Data..." : "Kirim Pengajuan Klaim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TARIK SALDO JASA */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md relative flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><ArrowDownToLine size={18} className="text-blue-600" /> Form Tarik Saldo</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Tersedia: Rp {formatCurrency(digitalBalance)}</p>
              </div>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full border border-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form id="withdrawForm" onSubmit={submitIncomeWithdrawal} className="space-y-5">
                
                <div className="space-y-2 mb-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nominal Ditarik <span className="text-rose-500">*</span></label>
                    <button type="button" onClick={() => setWithdrawAmount(digitalBalance.toString())} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Tarik Semua</button>
                  </div>
                  <div className="flex items-center w-full px-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all shadow-sm">
                    <span className="text-blue-500 font-black mr-3 text-lg border-r border-slate-200 pr-3">Rp</span>
                    <input 
                      type="number" required max={digitalBalance} step="any"
                      value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0" className="flex-1 w-full bg-transparent border-0 outline-none text-slate-800 font-black text-2xl" 
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Rekening Tujuan</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Bank / E-Wallet</label>
                      <input required type="text" placeholder="BCA / DANA" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">No. Rekening</label>
                      <input required type="text" placeholder="1234567890" value={bankForm.accountNumber} onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Atas Nama (Pemilik Rekening)</label>
                    <input required type="text" placeholder="Nama Lengkap" value={bankForm.accountName} onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all text-sm font-bold text-slate-700" />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white pb-safe">
              <button form="withdrawForm" type="submit" disabled={isWithdrawing || !withdrawAmount || Number(withdrawAmount) <= 0} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-sm">
                {isWithdrawing ? <Clock size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
                {isWithdrawing ? "Memproses Dana..." : "Kirim Permintaan Pencairan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}