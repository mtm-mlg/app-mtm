"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, MapPin, Phone, Car, ShieldCheck, 
  MessageCircle, Wallet, CalendarDays, RefreshCw, X, Save,
  Ban, CheckCircle2, Trash2, TrendingUp, Landmark,
  ArrowDownToLine, ArrowUpRight, Clock, Receipt, Image as ImageIcon, User
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

export default function DriverManagementPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // STATE FILTER
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState(""); // NEW: Filter Tanggal Harian
  
  // STATE RAW DATA (SINGLE SOURCE OF TRUTH)
  const [rawDrivers, setRawDrivers] = useState<any[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [rawWithdrawals, setRawWithdrawals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // STATE FORM MODAL TAMBAH DRIVER
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDriver, setNewDriver] = useState({
    code: "", name: "", phone: "", vehicle: "", area: ""
  });

  // STATE MODAL PENARIKAN (WITHDRAWAL)
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [proofModal, setProofModal] = useState<string | null>(null);

  // ========================================================
  // RUMUS MATEMATIKA STANDARD 
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

  const getOwnerComm = (order: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier || 'sedang';
    if (tier === 'ringan') return base * 0.30;
    if (tier === 'sedang') return base * 0.20;
    if (tier === 'berat') return base * 0.10;
    return 0;
  };

  const getDriverNet = (order: any) => {
    const base = getSubtotalJasa(order);
    const ownerComm = getOwnerComm(order);
    const urgent = Number(order.urgentFee) || 0;
    return (base - ownerComm) + urgent;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // ========================================================
  // FETCH DATA MENTAH DARI DATABASE
  // ========================================================
  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const [resDrivers, resOrders, snapWithdraw] = await Promise.all([
        fetch("/api/drivers"),
        fetch("/api/orders"),
        getDocs(collection(db, "withdrawals"))
      ]);
      const driversResult = await resDrivers.json();
      const ordersResult = await resOrders.json();
      
      const allWithdrawals = snapWithdraw.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawWithdrawals(allWithdrawals);

      if (driversResult.success && ordersResult.success) {
        setRawDrivers(driversResult.data);
        setRawOrders(ordersResult.data);
      }
    } catch (error) {
      console.error("Gagal menarik data sinkronisasi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchDrivers();
  }, []);

  // ========================================================
  // KALKULASI DINAMIS (TERPENGARUH OLEH FILTER TANGGAL)
  // ========================================================
  const processedDrivers = rawDrivers.map((driver) => {
    // 1. Ambil order yang selesai untuk driver ini
    let targetOrders = rawOrders.filter((o: any) => o.driverCode === driver.code && o.status === 'completed');

    // 2. Filter berdasarkan tanggal (jika ada)
    if (filterDate) {
      targetOrders = targetOrders.filter((o: any) => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        if (isNaN(d.getTime())) return false;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dateStr === filterDate;
      });
    }

    // 3. Kalkulasi Uang
    let omzetKotor = 0;
    let komisiOwner = 0;
    let hakDriver = 0;

    targetOrders.forEach((o: any) => {
      omzetKotor += (getSubtotalJasa(o) + (Number(o.urgentFee) || 0));
      komisiOwner += getOwnerComm(o);
      hakDriver += getDriverNet(o);
    });

    const pendingW = rawWithdrawals.filter(w => w.driverCode === driver.code && w.status === 'pending');

    return {
      ...driver,
      realCompletedOrders: targetOrders.length,
      omzetKotor,
      komisiOwner,
      hakDriver,
      pendingWithdrawals: pendingW.length
    };
  }).filter(driver => {
    return (
      driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      driver.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      driver.vehicle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.code || !newDriver.name || !newDriver.phone) {
      alert("Peringatan: Username, Nama, dan No WhatsApp wajib diisi!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver)
      });
      const result = await res.json();
      
      if (result.success) {
        alert(`Mitra baru berhasil ditambahkan!\nUsername Driver: ${newDriver.code}`);
        setIsAddModalOpen(false);
        setNewDriver({ code: "", name: "", phone: "", vehicle: "", area: "" });
        fetchDrivers();
      } else {
        alert("Gagal menyimpan: " + result.error);
      }
    } catch (error) {
      alert("Kesalahan jaringan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleSuspend = async (code: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspend' ? 'aktif' : 'suspend';
    const actionName = newStatus === 'suspend' ? 'Membekukan' : 'Mengaktifkan';

    if (confirm(`Apakah Anda yakin ingin ${actionName} akun driver ${code}?`)) {
      try {
        const q = query(collection(db, "drivers"), where("code", "==", code));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          await updateDoc(doc(db, "drivers", docId), { status: newStatus });
          alert(`Akun driver ${code} berhasil ${newStatus === 'suspend' ? 'dibekukan' : 'diaktifkan kembali'}.`);
          fetchDrivers();
        }
      } catch (error) {
        alert("Terjadi kesalahan saat mengubah status driver.");
      }
    }
  };

  const handleDeleteDriver = async (code: string, name: string) => {
    if (confirm(`PERINGATAN KERAS!\nApakah Anda yakin ingin menghapus permanen data driver ${name} (${code})? Data ini tidak dapat dikembalikan!`)) {
      try {
        const q = query(collection(db, "drivers"), where("code", "==", code));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          await deleteDoc(doc(db, "drivers", docId));
          alert(`Akun driver ${name} telah berhasil dihapus dari sistem.`);
          fetchDrivers();
        }
      } catch (error) {
        alert("Terjadi kesalahan saat menghapus driver.");
      }
    }
  };

  const handleApproveWithdrawal = async (trxId: string, type: string) => {
    const typeName = type === 'income' ? 'Pencairan Saldo Jasa' : 'Reimburse Uang Talangan';
    if (confirm(`Apakah Anda sudah mentransfer uang ke rekening driver?\n\nJika YA, klik OK untuk menyelesaikan permintaan ${typeName} ini.`)) {
      try {
        await updateDoc(doc(db, "withdrawals", trxId), { 
          status: "completed",
          updatedAt: new Date().toISOString()
        });
        alert("Permintaan berhasil ditandai Selesai/Telah Ditransfer!");
        fetchDrivers();
      } catch (error) {
        alert("Terjadi kesalahan saat memperbarui status.");
      }
    }
  };

  const openWhatsApp = (phone: string) => {
    let formattedPhone = phone;
    if (phone.startsWith('0')) formattedPhone = '62' + phone.substring(1);
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-16 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Armada & Driver</h2>
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[13px] font-medium">
            <CalendarDays size={14} className="text-blue-500" />
            <span>Pantau total omzet, pembagian profit, dan kelola dana driver.</span>
          </div>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <button onClick={fetchDrivers} className="flex-1 lg:flex-none bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm border border-slate-200">
            <RefreshCw size={16} className={isLoading ? "animate-spin text-blue-500" : "text-slate-400"} /> Segarkan
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
            <Plus size={16} /> Tambah Mitra Baru
          </button>
        </div>
      </div>

      {/* FILTER & PENCARIAN */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-3">
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3 flex-1">
          <div className="relative w-full sm:w-[350px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama driver atau username..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-all text-[13px] font-medium"
            />
          </div>
          <div className="relative w-full sm:w-[200px]">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-all text-[13px] font-medium cursor-pointer"
            />
          </div>
        </div>
        
        <div className="text-[13px] font-medium text-slate-500 px-2 flex items-center justify-between sm:justify-start gap-3 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Car size={16} className="text-slate-400"/> Armada Aktif: <span className="font-bold text-blue-600">{processedDrivers.length}</span>
          </div>
          {filterDate && (
             <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded">
               Laporan Harian
             </span>
          )}
        </div>
      </div>

      {/* TAMPILAN KONDISIONAL */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <RefreshCw size={36} className="animate-spin text-blue-500 mb-3" />
          <p className="text-sm font-medium text-slate-500">Mengkalkulasi omzet & data armada...</p>
        </div>
      ) : processedDrivers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Car size={36} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Tidak Ditemukan</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Tidak ada armada yang sesuai dengan pencarian atau filter Anda saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {processedDrivers.map((driver) => {
            const dStatus = driver.status || 'aktif';
            const isSuspended = dStatus === 'suspend';
            
            return (
              <div key={driver.code} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all duration-300 relative flex flex-col ${isSuspended ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3.5 items-center">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-inner border overflow-hidden ${isSuspended ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {driver.profileUrl ? (
                          <img src={driver.profileUrl} alt="Profil" className="w-full h-full object-cover" />
                        ) : (
                          driver.name ? driver.name.substring(0,2) : "DR"
                        )}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} title={isSuspended ? 'Ditangguhkan' : 'Aktif'}></div>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm tracking-tight line-clamp-1 leading-snug">
                        {driver.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                          {driver.code}
                        </span>
                        {isSuspended && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-100 text-rose-600">
                            Beku
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* TOMBOL WALLET / PENARIKAN (DENGAN BADGE NOTIFIKASI) */}
                    <button 
                      onClick={() => { setSelectedDriver(driver); setIsWithdrawModalOpen(true); }}
                      className="relative p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors active:scale-95"
                      title="Riwayat Penarikan Saldo"
                    >
                      <Wallet size={15} />
                      {driver.pendingWithdrawals > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white"></span>
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => handleToggleSuspend(driver.code, dStatus)}
                      className={`p-1.5 rounded-lg border transition-colors active:scale-95 ${isSuspended ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'}`}
                      title={isSuspended ? 'Aktifkan Kembali' : 'Bekukan Akun'}
                    >
                      {isSuspended ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteDriver(driver.code, driver.name)}
                      className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-colors active:scale-95"
                      title="Hapus Permanen"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2.5 mb-4 flex-1">
                  <div className="flex items-start gap-2">
                    <Car size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 leading-tight">
                      {driver.vehicle || <span className="text-slate-400 italic">Kendaraan belum diatur</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-600 leading-tight">
                      {driver.area || <span className="text-slate-400 italic">Area operasional bebas</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] font-medium text-slate-600 font-mono">
                        {driver.phone || "-"}
                      </span>
                    </div>
                    {driver.phone && (
                      <button onClick={() => openWhatsApp(driver.phone)} className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md flex items-center gap-1 transition-colors active:scale-95">
                        <MessageCircle size={12} /> WhatsApp
                      </button>
                    )}
                  </div>
                </div>

                {/* STATISTIK KINERJA 2x2 (OMZET, OWNER, DRIVER) */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-auto">
                  <div className="flex flex-col bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5 flex items-center gap-1"><ShieldCheck size={10} /> Tugas Selesai</p>
                    <p className="text-sm font-black text-slate-800">{driver.realCompletedOrders || 0} <span className="text-[10px] text-slate-400 font-normal">Order</span></p>
                  </div>
                  <div className="flex flex-col bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5 flex items-center gap-1"><Wallet size={10} /> Omzet Gross</p>
                    <p className="text-sm font-black text-blue-700">Rp {(driver.omzetKotor || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex flex-col bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5 flex items-center gap-1"><Landmark size={10} /> Profit Owner</p>
                    <p className="text-sm font-black text-emerald-700">Rp {(driver.komisiOwner || 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex flex-col bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                    <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5 flex items-center gap-1"><User size={10} /> Profit Driver</p>
                    <p className="text-sm font-black text-indigo-700">Rp {(driver.hakDriver || 0).toLocaleString('id-ID')}</p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL POP-UP TAMBAH MITRA DRIVER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Car size={18} className="text-blue-500" /> Pendaftaran Mitra Baru</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Buat kredensial akun untuk driver armada Anda.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username (Kode) <span className="text-rose-500">*</span></label>
                  <input required type="text" placeholder="Cth: budi123" value={newDriver.code} onChange={(e) => setNewDriver({...newDriver, code: e.target.value.toLowerCase()})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-semibold text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">No. WhatsApp <span className="text-rose-500">*</span></label>
                  <input required type="tel" placeholder="0812..." value={newDriver.phone} onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Masukkan nama lengkap driver" value={newDriver.name} onChange={(e) => setNewDriver({...newDriver, name: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Area Operasional (Opsional)</label>
                <input type="text" placeholder="Contoh: Malang Kota, Kepanjen, dll" value={newDriver.area} onChange={(e) => setNewDriver({...newDriver, area: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kendaraan & Plat (Opsional)</label>
                <input type="text" placeholder="Contoh: Vario Hitam (N 1234 AB)" value={newDriver.vehicle} onChange={(e) => setNewDriver({...newDriver, vehicle: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium" />
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm">
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSubmitting ? "Menyimpan Data..." : "Simpan Mitra Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POP-UP MANAJEMEN PENARIKAN DANA (WITHDRAWAL) */}
      {isWithdrawModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full relative flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <Wallet size={20} className="text-blue-600" /> Permintaan Pencairan Dana
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Daftar mutasi untuk Mitra: <strong className="text-blue-600 uppercase">{selectedDriver.code}</strong></p>
              </div>
              <button onClick={() => { setIsWithdrawModalOpen(false); setSelectedDriver(null); }} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200 shadow-sm">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto no-scrollbar bg-slate-50/30">
              {rawWithdrawals.filter(w => w.driverCode === selectedDriver.code).length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-60 border-2 border-dashed border-slate-200 rounded-2xl">
                  <Receipt size={40} className="text-slate-300 mb-3" />
                  <h4 className="font-bold text-slate-500">Belum Ada Permintaan</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[250px]">Mitra ini belum pernah mengajukan pencairan saldo atau reimburse.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rawWithdrawals
                    .filter(w => w.driverCode === selectedDriver.code)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((trx, idx) => {
                      const isPending = trx.status === 'pending';
                      const isIncome = trx.type === 'income';

                      return (
                        <div key={trx.id} className={`bg-white rounded-2xl p-4 md:p-5 border shadow-sm transition-all ${isPending ? (isIncome ? 'border-blue-300 shadow-blue-100' : 'border-rose-300 shadow-rose-100') : 'border-slate-200 opacity-80'}`}>
                          
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 rounded-xl border ${isIncome ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                {isIncome ? <ArrowDownToLine size={20} /> : <ArrowUpRight size={20} />}
                              </div>
                              <div>
                                <h4 className={`font-bold text-sm ${isIncome ? 'text-blue-800' : 'text-rose-800'}`}>
                                  {isIncome ? 'Pencairan Saldo Jasa' : 'Reimburse Uang Talangan'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-bold text-slate-400">{formatDate(trx.createdAt)}</span>
                                  {isPending ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1"><Clock size={10}/> MENUNGGU TRANSFER</span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 size={10}/> SELESAI</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-left md:text-right bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border md:border-0 border-slate-100 w-full md:w-auto">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nominal Permintaan</p>
                              <h4 className="text-xl font-black text-slate-800">Rp {Number(trx.amount).toLocaleString('id-ID')}</h4>
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 w-full md:w-auto flex-1">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Landmark size={12}/> Rekening Tujuan:</h5>
                              <p className="text-sm font-bold text-slate-700 mb-0.5">{trx.bankName} - {trx.accountNumber}</p>
                              <p className="text-[11px] font-medium text-slate-500">A/N: {trx.accountName}</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                              {!isIncome && trx.proofUrl && (
                                <button 
                                  onClick={() => setProofModal(trx.proofUrl)}
                                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                  <ImageIcon size={14} /> Lihat Struk
                                </button>
                              )}

                              {isPending && (
                                <button 
                                  onClick={() => handleApproveWithdrawal(trx.id, trx.type)}
                                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                  <CheckCircle2 size={16} /> Tandai Sudah Ditransfer
                                </button>
                              )}
                            </div>
                          </div>
                          
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL VIEW BUKTI STRUK */}
      {proofModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white p-3 rounded-2xl shadow-2xl max-w-sm w-full relative">
            <button onClick={() => setProofModal(null)} className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-2 shadow-lg hover:bg-rose-600 hover:scale-110 transition-all z-10"><X size={16} strokeWidth={3} /></button>
            <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center min-h-[300px]">
              <img src={proofModal} alt="Bukti Struk" className="w-full h-auto max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}