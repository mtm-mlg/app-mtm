"use client";
import { useState, useEffect } from "react";
import { 
  User, Phone, Car, ShieldCheck, 
  LogOut, ChevronRight, Settings, HelpCircle, 
  MapPin, KeyRound, Camera, Edit3, 
  ToggleRight, ToggleLeft, Briefcase, Info,
  Hammer, Clock, Brain, RefreshCw, X, Save
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export default function DriverProfilePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // STATE DATA DRIVER
  const [driverProfile, setDriverProfile] = useState<any>({
    code: "", name: "", area: "", phone: "", vehicle: "", completedOrders: 0, profileUrl: ""
  });
  const [docId, setDocId] = useState<string>(""); // Untuk update ke Firebase

  // STATE PREFERENSI LAYANAN
  const [activeServices, setActiveServices] = useState({
    jarak: true, tenaga: false, waktu: true, pikiran: false 
  });

  // STATE MODAL
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  
  // FORM STATES
  const [editForm, setEditForm] = useState({ name: "", phone: "", area: "", vehicle: "" });
  const [newUsername, setNewUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const session = localStorage.getItem("mtm_user");
    if (!session) {
      window.location.href = "/";
      return;
    }
    fetchProfile(session);
  }, []);

  const fetchProfile = async (sessionCode: string) => {
    setIsLoading(true);
    try {
      // 1. Ambil data gabungan dari API
      const res = await fetch("/api/drivers");
      const result = await res.json();
      let apiData: any = null; // Tambahkan : any agar TypeScript tidak rewel
      
      if (result.success) {
        apiData = result.data.find((d: any) => d.code === sessionCode);
      }

      // 2. Ambil referensi Document ID dari Firebase langsung
      const q = query(collection(db, "drivers"), where("code", "==", sessionCode));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const fireData = snap.docs[0].data() as any; // Cast ke as any untuk bypass strict mode
        setDocId(snap.docs[0].id);
        
        const finalData = { ...fireData, completedOrders: apiData?.completedOrders || 0 };
        setDriverProfile(finalData);
        setEditForm({ 
          name: finalData.name || "", 
          phone: finalData.phone || "", 
          area: finalData.area || "", 
          vehicle: finalData.vehicle || "" 
        });
        setNewUsername(finalData.code || "");

        // Set preferensi dari database jika ada
        if (finalData.preferences) {
          setActiveServices(finalData.preferences);
        }
      }
    } catch (error: any) { // Tambahkan : any di error
      console.error("Gagal memuat profil", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // FUNGSI UPDATE PREFERENSI LAYANAN
  // ==========================================
  const handleToggleService = async (service: keyof typeof activeServices) => {
    const newPrefs = { ...activeServices, [service]: !activeServices[service] };
    setActiveServices(newPrefs); // Update UI Instan

    if (docId) {
      try {
        await updateDoc(doc(db, "drivers", docId), { preferences: newPrefs });
      } catch (error) {
        console.error("Gagal menyimpan preferensi", error);
      }
    }
  };

  // ==========================================
  // FUNGSI UPLOAD FOTO PROFIL (CLOUDINARY)
  // ==========================================
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!docId) return alert("Sistem belum siap, tunggu sebentar.");
      
      setIsUploading(true);
      const file = e.target.files[0];
      const CLOUD_NAME = "dwprlhbzb"; 
      const UPLOAD_PRESET = "mtm-mlg";  

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: "POST", body: formData,
        });
        const data = await res.json();
        
        if (data.secure_url) {
          await updateDoc(doc(db, "drivers", docId), { profileUrl: data.secure_url });
          setDriverProfile({ ...driverProfile, profileUrl: data.secure_url });
          alert("Foto profil berhasil diperbarui!");
        }
      } catch (error) {
        alert("Gagal mengunggah foto. Pastikan koneksi stabil.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  // ==========================================
  // FUNGSI SIMPAN PENGATURAN (NAMA, WA, DLL)
  // ==========================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "drivers", docId), editForm);
      setDriverProfile({ ...driverProfile, ...editForm });
      setIsSettingsModalOpen(false);
      alert("Profil berhasil diperbarui!");
    } catch (error) {
      alert("Gagal menyimpan perubahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // FUNGSI GANTI USERNAME / KODE
  // ==========================================
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return;
    
    const formattedUsername = newUsername.trim().toLowerCase().replace(/\s/g, '');
    if (!formattedUsername) return alert("Username tidak boleh kosong!");
    if (formattedUsername === driverProfile.code) return setIsSecurityModalOpen(false);

    setIsSubmitting(true);
    try {
      // Cek apakah username sudah dipakai
      const checkQ = query(collection(db, "drivers"), where("code", "==", formattedUsername));
      const checkSnap = await getDocs(checkQ);
      
      if (!checkSnap.empty) {
        alert("Username tersebut sudah digunakan oleh driver lain. Pilih yang lain!");
        setIsSubmitting(false);
        return;
      }

      await updateDoc(doc(db, "drivers", docId), { code: formattedUsername });
      localStorage.setItem("mtm_user", formattedUsername); // Update sesi browser
      
      alert("Username berhasil diubah!");
      setIsSecurityModalOpen(false);
      fetchProfile(formattedUsername); // Refresh data
    } catch (error) {
      alert("Gagal mengubah username.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
      localStorage.removeItem("mtm_user");
      window.location.href = "/"; 
    }
  };

  return (
    <div className={`max-w-[800px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="mb-6 px-2 flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <User className="text-blue-600" size={28} /> Profil Akun
        </h2>
        {(isLoading || isUploading) && <RefreshCw size={20} className="animate-spin text-blue-500" />}
      </div>

      {/* ========================================== */}
      {/* FOTO PROFIL, NAMA LENGKAP & STATS */}
      {/* ========================================== */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-r from-slate-800 to-slate-900 relative">
           <div className="absolute inset-0 bg-blue-500/20 mix-blend-overlay"></div>
        </div>

        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-12 mb-4">
            
            {/* WIDGET FOTO PROFIL CLOUDINARY */}
            <div className="relative group cursor-pointer">
              <label className="block w-24 h-24 rounded-full bg-white p-1.5 shadow-lg cursor-pointer">
                <div className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-3xl overflow-hidden relative uppercase">
                  {driverProfile.profileUrl ? (
                    <img src={driverProfile.profileUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    driverProfile.name ? driverProfile.name.substring(0,2) : "DR"
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} className="hidden" />
              </label>
              <div className="absolute bottom-1 right-1 bg-blue-600 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm pointer-events-none">
                <Camera size={12} className="text-white" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
                {driverProfile.name || "Loading..."}
              </h1>
              <button onClick={() => setIsSettingsModalOpen(true)} className="text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={16} /></button>
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-widest inline-block mt-1">
              Username: {driverProfile.code || "---"}
            </span>
          </div>

          {/* RATING DIHAPUS, TUGAS SELESAI DIBUAT FULL */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="w-full text-center bg-slate-50 rounded-2xl py-3 border border-slate-100 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-2 text-xl font-black text-slate-800">
                <ShieldCheck size={20} className="text-blue-500" /> {driverProfile.completedOrders}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tugas Berhasil Diselesaikan</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 4 KATEGORI JASA (TERSAVE OTOMATIS) */}
      {/* ========================================== */}
      <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-[3rem] -z-10"></div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-1.5">
          <Briefcase size={14} className="text-blue-500"/> Preferensi Layanan
        </h3>
        <p className="text-[11px] font-medium text-slate-500 mb-5 ml-1 leading-relaxed">
          Pilih kategori pesanan yang ingin Anda kerjakan hari ini. (Otomatis Tersimpan)
        </p>
        
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${activeServices.jarak ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-70'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><MapPin size={20} /></div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Kategori Jarak</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Antar jemput fisik berbasis KM.</p>
              </div>
            </div>
            <button onClick={() => handleToggleService('jarak')} className="active:scale-95 transition-transform">
              {activeServices.jarak ? <ToggleRight size={40} className="text-blue-600" /> : <ToggleLeft size={40} className="text-slate-300" />}
            </button>
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${activeServices.tenaga ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-70'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><Hammer size={20} /></div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Kategori Tenaga</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Angkut fisik & bongkar muat.</p>
              </div>
            </div>
            <button onClick={() => handleToggleService('tenaga')} className="active:scale-95 transition-transform">
              {activeServices.tenaga ? <ToggleRight size={40} className="text-orange-500" /> : <ToggleLeft size={40} className="text-slate-300" />}
            </button>
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${activeServices.waktu ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-70'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Clock size={20} /></div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Kategori Waktu</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Sewa driver berbasis Jam/Hari.</p>
              </div>
            </div>
            <button onClick={() => handleToggleService('waktu')} className="active:scale-95 transition-transform">
              {activeServices.waktu ? <ToggleRight size={40} className="text-emerald-500" /> : <ToggleLeft size={40} className="text-slate-300" />}
            </button>
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${activeServices.pikiran ? 'border-purple-200 bg-purple-50/30' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-70'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-xl"><Brain size={20} /></div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Kategori Pikiran</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Jasa keahlian, tugas, IT, dll.</p>
              </div>
            </div>
            <button onClick={() => handleToggleService('pikiran')} className="active:scale-95 transition-transform">
              {activeServices.pikiran ? <ToggleRight size={40} className="text-purple-600" /> : <ToggleLeft size={40} className="text-slate-300" />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* INFORMASI KONTAK, AREA & ARMADA */}
      {/* ========================================== */}
      <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
             Informasi Operasional
          </h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500"><MapPin size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Area Utama</p>
                <p className="text-sm font-bold text-slate-800">{driverProfile.area || "Belum diatur"}</p>
              </div>
            </div>
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Ubah</button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500"><Phone size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nomor WhatsApp</p>
                <p className="text-sm font-bold text-slate-800">{driverProfile.phone || "Belum diatur"}</p>
              </div>
            </div>
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Ubah</button>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-blue-600"><Car size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Kendaraan & Plat</p>
                <p className="text-sm font-bold text-slate-800">{driverProfile.vehicle || "Belum diatur"}</p>
              </div>
            </div>
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 px-3 py-1.5 bg-blue-100 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
               <Edit3 size={10} /> Ganti
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* PENGATURAN LAIN-LAIN */}
      {/* ========================================== */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="divide-y divide-slate-100">
          <button onClick={() => setIsSettingsModalOpen(true)} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-200 transition-colors"><Settings size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Pengaturan Aplikasi</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <button onClick={() => setIsSecurityModalOpen(true)} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors"><KeyRound size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Ubah Username & Keamanan</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
        </div>
      </div>

      {/* TOMBOL LOGOUT */}
      <button onClick={handleLogout} className="w-full bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
        <LogOut size={18} /> Keluar dari Akun
      </button>


      {/* ========================================================= */}
      {/* MODAL POP-UP PENGATURAN APLIKASI (NAMA, WA, KENDARAAN) */}
      {/* ========================================================= */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full relative overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">Pengaturan Profil</h3>
                <p className="text-xs text-slate-500 font-medium">Perbarui data operasional Anda.</p>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Lengkap</label>
                <input required type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nomor WhatsApp</label>
                <input required type="tel" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Area Utama</label>
                <input type="text" value={editForm.area} onChange={(e) => setEditForm({...editForm, area: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Kendaraan & Plat Nomor</label>
                <input type="text" placeholder="Contoh: Vario (N 1234 AB)" value={editForm.vehicle} onChange={(e) => setEditForm({...editForm, vehicle: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium" />
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL POP-UP UBAH USERNAME (KEAMANAN) */}
      {/* ========================================================= */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full relative overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">Keamanan Akses</h3>
                <p className="text-xs text-slate-500 font-medium">Ubah Username untuk Login.</p>
              </div>
              <button onClick={() => setIsSecurityModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSecurity} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Username Baru <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Tanpa spasi" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-100 text-sm font-bold" />
                <p className="text-[10px] text-slate-400 mt-1 ml-1 flex items-center gap-1"><Info size={12}/> Jika Anda mengubahnya, Anda akan Login menggunakan username ini di masa depan.</p>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />} Update Username
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}