"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, MapPin, Phone, Car, ShieldCheck, 
  MessageCircle, Wallet, CalendarDays, RefreshCw, X, Save
} from "lucide-react";

export default function DriverManagementPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // STATE UNTUK DATA BACKEND
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // STATE UNTUK TAMBAH MITRA
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDriver, setNewDriver] = useState({
    code: "", name: "", phone: "", vehicle: "", area: ""
  });

  // FUNGSI TARIK DATA DARI API
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

  // FUNGSI SIMPAN DRIVER BARU
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.code || !newDriver.name) {
      alert("Kode Akun dan Nama wajib diisi!");
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
        alert("Mitra baru berhasil ditambahkan!");
        setIsAddModalOpen(false);
        setNewDriver({ code: "", name: "", phone: "", vehicle: "", area: "" }); // Reset form
        fetchDrivers(); // Refresh data
      } else {
        alert("Gagal menyimpan: " + result.error);
      }
    } catch (error) {
      alert("Kesalahan jaringan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
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
    <div className={`max-w-[1400px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Armada & Driver</h2>
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[13px] font-medium">
            <CalendarDays size={14} className="text-blue-500" />
            <span>Pantau total omzet dan kinerja armada Anda secara real-time.</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDrivers} className="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm border border-blue-200">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Segarkan
          </button>
          
          {/* TOMBOL TAMBAH MITRA AKTIF */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Tambah Mitra
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-3">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari nama driver, kode akun, atau plat..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium"
          />
        </div>
        <div className="text-sm font-bold text-slate-500 px-2">
          Total Armada: <span className="text-blue-600">{filteredDrivers.length}</span> Driver
        </div>
      </div>

      {/* STATE LOADING */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw size={40} className="animate-spin text-blue-500 mb-4" />
          <p className="text-slate-500 font-bold">Memuat Data Armada...</p>
        </div>
      ) : 
      
      /* STATE KOSONG */
      filteredDrivers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
          <Car size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada Mitra / Tidak Ditemukan</h3>
          <p className="text-slate-500 text-sm mb-6">Anda belum mendaftarkan driver atau pencarian tidak cocok.</p>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm mx-auto"
          >
            <Plus size={16} /> Daftarkan Driver Pertama Anda
          </button>
        </div>
      ) : 

      /* GRID KARTU DRIVER DINAMIS */
      (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDrivers.map((driver) => {
            const dStatus = driver.status || 'aktif';
            return (
              <div key={driver.code} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 group relative overflow-hidden flex flex-col">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-10 opacity-20 transition-colors ${dStatus === 'aktif' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>

                <div className="flex justify-between items-start mb-5">
                  <div className="flex gap-3 items-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700 font-black text-lg border border-slate-300 shadow-inner uppercase">
                        {driver.name ? driver.name.substring(0,2) : "DR"}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${dStatus === 'aktif' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">{driver.name}</h3>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">{driver.code}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-blue-500" /> {driver.area || "Area belum ditentukan"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                      <Car size={14} className="text-slate-400" /> {driver.vehicle || "Kendaraan belum ditentukan"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                      <Phone size={14} className="text-slate-400" /> {driver.phone || "-"}
                    </span>
                    {driver.phone && (
                      <button onClick={() => openWhatsApp(driver.phone)} className="text-[10px] font-bold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded flex items-center gap-1 transition-colors active:scale-95 shadow-sm">
                        <MessageCircle size={12} /> Chat WA
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-auto border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-around mb-4">
                    <div className="text-center flex-1">
                      <div className="flex items-center justify-center gap-1.5 text-[15px] font-black text-slate-800">
                        <ShieldCheck size={16} className="text-blue-500" /> {driver.completedOrders || 0}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Selesai Total</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="text-center flex-1">
                      <div className="flex items-center justify-center gap-1.5 text-[14px] font-black text-slate-800 whitespace-nowrap">
                        <Wallet size={16} className="text-emerald-500" /> Rp {(driver.totalRevenue || 0).toLocaleString('id-ID')}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Total Omzet</span>
                    </div>
                  </div>

                  <div className="text-center bg-blue-50/50 rounded-lg py-2 border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      Jatah Komisi Sistem: <span className="font-black">Rp {(driver.ownerCommission || 0).toLocaleString('id-ID')}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL POP-UP TAMBAH MITRA DRIVER */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full relative overflow-hidden flex flex-col">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">Pendaftaran Mitra Baru</h3>
                <p className="text-xs text-slate-500 font-medium">Buat akun untuk driver armada Anda.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">Kode Login Akun <span className="text-rose-500">*</span></label>
                  <input required type="text" placeholder="Contoh: 05 atau budi123" value={newDriver.code} onChange={(e) => setNewDriver({...newDriver, code: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">No. WhatsApp <span className="text-rose-500">*</span></label>
                  <input required type="tel" placeholder="0812..." value={newDriver.phone} onChange={(e) => setNewDriver({...newDriver, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Lengkap <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Masukkan nama lengkap driver" value={newDriver.name} onChange={(e) => setNewDriver({...newDriver, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Area Operasional</label>
                <input type="text" placeholder="Contoh: Malang Kota, Kepanjen, dll" value={newDriver.area} onChange={(e) => setNewDriver({...newDriver, area: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Kendaraan & Plat Nomor</label>
                <input type="text" placeholder="Contoh: Vario (N 1234 AB)" value={newDriver.vehicle} onChange={(e) => setNewDriver({...newDriver, vehicle: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
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