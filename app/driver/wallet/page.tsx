"use client";
import { useState, useEffect } from "react";
import { 
  Wallet, ArrowUpRight, ArrowDownToLine, 
  Clock, CheckCircle2, Landmark, History, ChevronRight,
  Banknote, QrCode, Info, AlertTriangle, RefreshCw, X, UploadCloud, Camera, ShoppingCart
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

export default function DriverWalletPage() {
  const [driverCode, setDriverCode] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // STATE DOMPET REAL-TIME
  const [digitalBalance, setDigitalBalance] = useState(0); 
  const [cashHakBersih, setCashHakBersih] = useState(0);   
  const [transactions, setTransactions] = useState<any[]>([]);

  // STATE INFO BANK
  const [bankForm, setBankForm] = useState({
    bankName: "", accountNumber: "", accountName: ""
  });

  // STATE MODAL TARIK SALDO (INCOME)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // STATE MODAL KLAIM REIMBURSE (TALANGAN)
  const [isReimburseModalOpen, setIsReimburseModalOpen] = useState(false);
  const [selectedReimburse, setSelectedReimburse] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
      const savedBank = localStorage.getItem("mtm_bank_details");
      if (savedBank) setBankForm(JSON.parse(savedBank));
    } else {
      window.location.href = "/";
    }
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file)); 
    }
  };

  // FUNGSI TARIK DATA DOMPET
  const fetchWalletData = async () => {
    if (!driverCode) return;
    setIsLoading(true);

    try {
      const resProfile = await fetch("/api/drivers");
      const profileData = await resProfile.json();
      if (profileData.success) {
        const me = profileData.data.find((d: any) => d.code === driverCode);
        if (me) setDriverName(me.name);
      }

      const qWithdraw = query(collection(db, "withdrawals"), where("driverCode", "==", driverCode));
      const snapWithdraw = await getDocs(qWithdraw);
      
      let totalWithdrawnIncome = 0;
      let reimburseMap: any = {};
      let trxList: any[] = [];

      snapWithdraw.forEach(doc => {
        const data = doc.data();
        if (data.type === 'income') {
          totalWithdrawnIncome += Number(data.amount) || 0;
          trxList.push({
            id: doc.id,
            isWithdrawal: true,
            title: "Penarikan Saldo Pendapatan",
            amount: `- Rp ${(Number(data.amount) || 0).toLocaleString('id-ID')}`,
            date: formatDate(data.createdAt),
            status: data.status === "completed" ? "success" : "pending",
            rawDate: new Date(data.createdAt).getTime()
          });
        } else if (data.type === 'reimburse') {
          reimburseMap[data.orderId] = data.status; 
        }
      });

      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      
      let totalDigitalIncome = 0;
      let totalCashNet = 0;

      if (result.success) {
        const completedOrders = result.data.filter((o: any) => o.status === "completed");

        completedOrders.forEach((o: any) => {
          const base = Number(o.basePrice) || Number(o.totalPrice) || 0;
          let driverCutPercent = 0.80; 

          if (o.commissionTier === 'ringan') driverCutPercent = 0.70; 
          if (o.commissionTier === 'berat') driverCutPercent = 0.90;  

          const driverNetIncome = base * driverCutPercent; 
          const talangan = Number(o.shoppingCost) || 0;
          
          const method = o.paymentMethod?.toLowerCase() || 'cash';
          const isDigital = method.includes('qris') || method.includes('transfer');
          const isBelanja = o.category?.includes('Belanja');
          const safeRawDate = o.createdAt ? new Date(o.createdAt).getTime() : 0;
          
          if (isDigital) {
            totalDigitalIncome += driverNetIncome;
          } else {
            totalCashNet += driverNetIncome;
          }

          trxList.push({
            id: o.id,
            isWithdrawal: false,
            invoice: o.invoice,
            title: o.serviceName,
            amount: `${isDigital ? '+' : ''} Rp ${driverNetIncome.toLocaleString('id-ID')}`,
            date: formatDate(o.createdAt),
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
      setCashHakBersih(totalCashNet);
      setTransactions(trxList);
      
    } catch (error) {
      console.error("Gagal menarik data dompet", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchWalletData(); }, [driverCode]);

  // SUBMIT TARIK SALDO PENDAPATAN
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

  // SUBMIT KLAIM REIMBURSE
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

  return (
    <div className="max-w-[800px] mx-auto animate-in fade-in duration-500 pb-24 px-2 md:px-0">
      
      {/* HEADER */}
      <div className="mb-6 flex justify-between items-end border-b border-slate-200 pb-5 pt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-blue-600" size={24} /> Dompet Mitra
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Pantau saldo digital dan klaim reimburse.</p>
        </div>
        <button 
          onClick={fetchWalletData} 
          disabled={isLoading}
          className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm">
        <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
        <div>
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Catatan Keuangan</h4>
          <p className="text-[11px] font-medium text-blue-600 leading-relaxed">
            Semua nominal di bawah adalah <strong>Pendapatan Bersih</strong> (sudah dipotong komisi owner). Uang Talangan Belanja dipisahkan di rincian transaksi bawah.
          </p>
        </div>
      </div>

      {/* KARTU SALDO UTAMA */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden mb-6 border border-slate-700">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <p className="text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Landmark size={16} /> Saldo Jasa (Bisa Ditarik)
          </p>

          <div className="mb-8 flex items-end">
            <span className="text-lg text-slate-400 font-medium mr-2 mb-1">Rp</span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              {isLoading ? "..." : digitalBalance.toLocaleString('id-ID')}
            </h1>
          </div>

          <button 
            onClick={() => {
              if (digitalBalance <= 0) return alert("Saldo digital Anda Rp 0. Tidak ada dana yang bisa ditarik.");
              setWithdrawAmount(digitalBalance.toString());
              setIsWithdrawModalOpen(true);
            }}
            disabled={isLoading || digitalBalance <= 0}
            className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <ArrowDownToLine size={16} /> Tarik Saldo Ke Rekening
          </button>
        </div>
      </div>

      {/* REKAP KILAT */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
          <Banknote size={40} className="absolute -bottom-2 -right-2 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform" />
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tunai (Di Tangan)</p>
          <h4 className="text-lg md:text-xl font-bold text-slate-800">
            Rp {isLoading ? "..." : cashHakBersih.toLocaleString('id-ID')}
          </h4>
          <p className="text-[10px] text-slate-400 font-medium mt-1">Pendapatan via Cash.</p>
        </div>
        
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
          <QrCode size={40} className="absolute -bottom-2 -right-2 text-blue-50 opacity-50 group-hover:scale-110 transition-transform" />
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Digital</p>
          <h4 className="text-lg md:text-xl font-bold text-slate-800">
            Rp {isLoading ? "..." : digitalBalance.toLocaleString('id-ID')}
          </h4>
          <p className="text-[10px] text-slate-400 font-medium mt-1">Pendapatan via QRIS/TF.</p>
        </div>
      </div>

      {/* TRANSAKSI */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 px-1">Riwayat & Reimburse</h3>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <RefreshCw size={28} className="text-blue-500 animate-spin mb-3" />
              <p className="text-xs font-medium text-slate-400">Menyinkronkan data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center opacity-60">
              <History size={40} className="text-slate-300 mb-3" />
              <p className="text-xs font-medium text-slate-500">Belum ada aktivitas dompet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((trx, index) => (
                <div key={`${trx.id}-${index}`} className="p-4 md:p-5 flex flex-col hover:bg-slate-50/50 transition-colors">
                  
                  {/* BARIS UTAMA */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        trx.isWithdrawal ? 'bg-slate-100 text-slate-600' :
                        trx.method === 'cash' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {trx.isWithdrawal ? <ArrowDownToLine size={18} /> : 
                         trx.method === 'cash' ? <Banknote size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">{trx.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-medium text-slate-400">{trx.date}</span>
                          {!trx.isWithdrawal && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                              {trx.method === 'cash' ? 'CASH' : 'QRIS/TF'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <h4 className={`font-bold text-sm md:text-base ${
                        trx.isWithdrawal ? 'text-slate-700' :
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

                  {/* KOTAK REIMBURSE (Jika Belanja + QRIS) */}
                  {!trx.isWithdrawal && trx.isBelanja && trx.isDigital && trx.talangan > 0 && (
                    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><ShoppingCart size={12} /> Talangan Anda</p>
                        <p className="text-sm font-bold text-slate-800 mt-1">Rp {trx.talangan.toLocaleString('id-ID')}</p>
                      </div>
                      <div>
                        {trx.reimburseStatus === 'none' && (
                          <button 
                            onClick={() => { setSelectedReimburse(trx); setIsReimburseModalOpen(true); }} 
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <UploadCloud size={14} /> Klaim Reimburse
                          </button>
                        )}
                        {trx.reimburseStatus === 'pending' && (
                          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200 flex items-center gap-1.5">
                            <Clock size={14} /> Menunggu Proses
                          </span>
                        )}
                        {trx.reimburseStatus === 'completed' && (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Sudah Dicairkan
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: KLAIM REIMBURSE */}
      {/* ======================================================== */}
      {isReimburseModalOpen && selectedReimburse && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md relative flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><ShoppingCart size={18} className="text-blue-600" /> Klaim Uang Talangan</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{selectedReimburse.invoice}</p>
              </div>
              <button onClick={() => {setIsReimburseModalOpen(false); setSelectedReimburse(null); setProofFile(null); setProofPreview(null);}} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full border border-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form id="reimburseForm" onSubmit={submitReimburse} className="space-y-4">
                
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-widest">Nominal Diganti</span>
                  <span className="text-xl font-bold text-blue-700">Rp {selectedReimburse.talangan.toLocaleString('id-ID')}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Foto Struk Pembelanjaan <span className="text-rose-500">*</span></label>
                  {proofPreview ? (
                    <div className="relative inline-block w-full">
                      <img src={proofPreview} alt="Bukti" className="w-full h-32 object-cover rounded-xl border border-slate-300" />
                      <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1.5 shadow-md hover:bg-rose-600">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer bg-slate-50 border border-slate-300 border-dashed hover:border-blue-400 hover:bg-blue-50 text-slate-500 font-medium py-6 px-4 rounded-xl flex flex-col items-center justify-center transition-colors w-full">
                      <Camera size={24} className="mb-2 text-slate-400" />
                      <span className="text-sm font-bold text-slate-600">Ambil Foto Struk</span>
                      <input required type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank / E-Wallet</label>
                    <input required type="text" placeholder="BCA / DANA" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">No. Rekening</label>
                    <input required type="text" placeholder="1234567890" value={bankForm.accountNumber} onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Atas Nama</label>
                  <input required type="text" placeholder="Nama Pemilik" value={bankForm.accountName} onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white pb-safe">
              <button form="reimburseForm" type="submit" disabled={isWithdrawing || !proofFile} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl shadow-sm transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-sm">
                {isWithdrawing ? <Clock size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                {isWithdrawing ? "Mengunggah..." : "Kirim Klaim"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: TARIK SALDO JASA */}
      {/* ======================================================== */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-md relative flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><ArrowDownToLine size={18} className="text-blue-600" /> Tarik Saldo Jasa</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Tersedia: Rp {digitalBalance.toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full border border-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              <form id="withdrawForm" onSubmit={submitIncomeWithdrawal} className="space-y-4">
                
                <div className="space-y-1.5 mb-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nominal Ditarik <span className="text-rose-500">*</span></label>
                  <div className="flex items-center w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus-within:border-blue-400 transition-colors">
                    <span className="text-blue-500 font-bold mr-2 text-sm border-r border-slate-200 pr-3">Rp</span>
                    <input 
                      type="number" required max={digitalBalance}
                      value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0" className="flex-1 w-full bg-transparent border-0 outline-none text-slate-800 font-bold text-lg" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank / E-Wallet</label>
                    <input required type="text" placeholder="BCA / DANA" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">No. Rekening</label>
                    <input required type="text" placeholder="1234567890" value={bankForm.accountNumber} onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Atas Nama</label>
                  <input required type="text" placeholder="Nama Pemilik" value={bankForm.accountName} onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 text-sm font-medium" />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white pb-safe">
              <button form="withdrawForm" type="submit" disabled={isWithdrawing} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl shadow-sm transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-sm">
                {isWithdrawing ? <Clock size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                {isWithdrawing ? "Memproses..." : "Kirim Permintaan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}