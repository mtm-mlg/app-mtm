"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, MapPin, Phone, Car, ShieldCheck, 
  MessageCircle, Wallet, CalendarDays, RefreshCw, X, Save,
  Ban, CheckCircle2, Trash2, MoreVertical
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

export default function DriverManagementPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // STATE FORM MODAL
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDriver, setNewDriver] = useState({
    code: "", name: "", phone: "", vehicle: "", area: ""
  });

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/drivers");
      const result = await res.json();
      if (result.success) {
        setDrivers(result.data);
      }
    } catch (error) {
      console.error("Gagal menarik data driver:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchDrivers();
  }, []);

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

  // LOGIKA BEKUKAN (SUSPEND) ATAU AKTIFKAN DRIVER
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
        console.error(error);
      }
    }
  };

  // LOGIKA HAPUS PERMANEN DRIVER
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
        console.error(error);
      }
    }
  };

  const openWhatsApp = (phone: string) => {
    let formattedPhone = phone;
    if (phone.startsWith('0')) formattedPhone = '62' + phone.substring(1);
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const filteredDrivers = drivers.filter(driver => {
    return (
      driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      driver.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      driver.vehicle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className={`max-w-[1400px] mx-auto pb-16 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Armada & Driver</h2>
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[13px] font-medium">
            <CalendarDays size={14} className="text-blue-500" />
            <span>Pantau total omzet dan kinerja mitra armada secara real-time.</span>
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
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari nama driver, username, atau plat nomor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-all text-[13px] font-medium"
          />
        </div>
        <div className="text-[13px] font-medium text-slate-500 px-2 flex items-center gap-2 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100">
          <Car size={16} className="text-slate-400"/>
          Total Armada Aktif: <span className="font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{filteredDrivers.length}</span>
        </div>
      </div>

      {/* TAMPILAN KONDISIONAL (LOADING / KOSONG / GRID) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <RefreshCw size={36} className="animate-spin text-blue-500 mb-3" />
          <p className="text-sm font-medium text-slate-500">Menyinkronkan data armada...</p>
        </div>
      ) : 
      
      filteredDrivers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Car size={36} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Belum Ada Mitra / Tidak Ditemukan</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">Anda belum mendaftarkan driver atau kata kunci pencarian tidak cocok dengan data manapun.</p>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm mx-auto">
            <Plus size={16} /> Daftarkan Driver Pertama Anda
          </button>
        </div>
      ) : 

      (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDrivers.map((driver) => {
            const dStatus = driver.status || 'aktif';
            const isSuspended = dStatus === 'suspend';
            
            return (
              <div key={driver.code} className={`bg-white rounded-2xl p-5 shadow-sm border transition-all duration-300 relative flex flex-col ${isSuspended ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'}`}>
                
                {/* HEADER KARTU DRIVER */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3.5 items-center">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg uppercase shadow-inner border ${isSuspended ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {driver.name ? driver.name.substring(0,2) : "DR"}
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

                  {/* KOTAK AKSI / DROPDOWN */}
                  <div className="flex items-center gap-1.5">
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

                {/* INFO KONTAK & KENDARAAN */}
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

                {/* STATISTIK KINERJA */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Selesai</p>
                      <p className="text-sm font-bold text-slate-800">{driver.completedOrders || 0} <span className="text-[10px] text-slate-400 font-normal">Pesanan</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Omzet</p>
                      <p className="text-sm font-bold text-slate-800 tracking-tight">Rp {(driver.totalRevenue || 0).toLocaleString('id-ID')}</p>
                    </div>
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
    </div>
  );
}