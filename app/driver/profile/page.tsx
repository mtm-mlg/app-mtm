"use client";
import { useState, useEffect } from "react";
import { 
  User, Phone, Car, ShieldCheck, 
  LogOut, ChevronRight, Settings, HelpCircle, 
  MapPin, KeyRound, Camera, Edit3, 
  ToggleRight, ToggleLeft, Briefcase, Info,
  Hammer, Clock, Brain, RefreshCw, X, Save,
  Landmark, CreditCard, CheckCircle2, ShoppingCart
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export default function DriverProfilePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [driverProfile, setDriverProfile] = useState<any>({
    code: "", name: "", area: "", phone: "", vehicle: "", completedOrders: 0, profileUrl: "",
    bankDetails: { bankName: "", accountNumber: "", accountName: "" }
  });
  const [docId, setDocId] = useState<string>(""); 

  // STATE PREFERENSI LAYANAN (DITAMBAH BELANJA)
  const [activeServices, setActiveServices] = useState({
    jarak: true, tenaga: false, waktu: true, pikiran: false, belanja: true 
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", area: "", vehicle: "" });
  const [bankForm, setBankForm] = useState({ bankName: "", accountNumber: "", accountName: "" });
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
      const res = await fetch("/api/drivers");
      const result = await res.json();
      let apiData: any = null; 
      
      if (result.success) {
        apiData = result.data.find((d: any) => d.code === sessionCode);
      }

      const q = query(collection(db, "drivers"), where("code", "==", sessionCode));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const fireData = snap.docs[0].data() as any; 
        setDocId(snap.docs[0].id);
        
        const finalData = { ...fireData, completedOrders: apiData?.completedOrders || 0 };
        setDriverProfile(finalData);
        
        setProfileForm({ 
          name: finalData.name || "", 
          phone: finalData.phone || "", 
          area: finalData.area || "", 
          vehicle: finalData.vehicle || "" 
        });
        
        if (finalData.bankDetails) {
          setBankForm({
            bankName: finalData.bankDetails.bankName || "",
            accountNumber: finalData.bankDetails.accountNumber || "",
            accountName: finalData.bankDetails.accountName || ""
          });
          localStorage.setItem("mtm_bank_details", JSON.stringify(finalData.bankDetails));
        }
        
        setNewUsername(finalData.code || "");
        // Update Preferensi dari database (jika belanja belum ada, set true)
        if (finalData.preferences) {
           setActiveServices({
             ...finalData.preferences,
             belanja: finalData.preferences.belanja ?? true
           });
        }
      }
    } catch (error: any) { 
      console.error("Gagal memuat profil", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleService = async (service: keyof typeof activeServices) => {
    const newPrefs = { ...activeServices, [service]: !activeServices[service] };
    setActiveServices(newPrefs); 

    if (docId) {
      try {
        await updateDoc(doc(db, "drivers", docId), { preferences: newPrefs });
      } catch (error) {
        console.error("Gagal menyimpan preferensi", error);
      }
    }
  };

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "drivers", docId), profileForm);
      setDriverProfile({ ...driverProfile, ...profileForm });
      setIsProfileModalOpen(false);
      alert("Profil Operasional berhasil diperbarui!");
    } catch (error) {
      alert("Gagal menyimpan perubahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "drivers", docId), { bankDetails: bankForm });
      setDriverProfile({ ...driverProfile, bankDetails: bankForm });
      localStorage.setItem("mtm_bank_details", JSON.stringify(bankForm));
      setIsBankModalOpen(false);
      alert("Data Rekening/E-Wallet berhasil diperbarui!");
    } catch (error) {
      alert("Gagal menyimpan data rekening.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) return;
    
    const formattedUsername = newUsername.trim().toLowerCase().replace(/\s/g, '');
    if (!formattedUsername) return alert("Username tidak boleh kosong!");
    if (formattedUsername === driverProfile.code) return setIsSecurityModalOpen(false);

    setIsSubmitting(true);
    try {
      const checkQ = query(collection(db, "drivers"), where("code", "==", formattedUsername));
      const checkSnap = await getDocs(checkQ);
      
      if (!checkSnap.empty) {
        alert("Username tersebut sudah digunakan oleh orang lain. Pilih yang lain!");
        setIsSubmitting(false);
        return;
      }

      await updateDoc(doc(db, "drivers", docId), { code: formattedUsername });
      localStorage.setItem("mtm_user", formattedUsername); 
      
      alert("Username berhasil diubah!");
      setIsSecurityModalOpen(false);
      fetchProfile(formattedUsername); 
    } catch (error) {
      alert("Gagal mengubah username.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Apakah Anda yakin ingin keluar dari akun? Anda tidak akan menerima notifikasi pesanan.")) {
      localStorage.removeItem("mtm_user");
      window.location.href = "/"; 
    }
  };

  return (
    <div className={`max-w-[800px] mx-auto pb-24 transition-all duration-700 px-2 md:px-0 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      <div className="mb-6 pt-2 flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <User className="text-blue-600" size={28} /> ID Digital Mitra
        </h2>
        {(isLoading || isUploading) && <RefreshCw size={20} className="animate-spin text-blue-500" />}
      </div>

      {/* ID CARD */}
      <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden mb-6 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="h-32 bg-gradient-to-r from-slate-800 to-slate-900 relative">
           <div className="absolute inset-0 bg-blue-500/20 mix-blend-overlay"></div>
        </div>
        <div className="px-6 md:px-8 pb-6 md:pb-8 relative">
          <div className="flex justify-between items-end -mt-16 mb-4">
            <div className="relative group cursor-pointer">
              <label className="block w-28 h-28 md:w-32 md:h-32 rounded-full bg-white p-1.5 shadow-xl cursor-pointer">
                <div className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-3xl overflow-hidden relative uppercase">
                  {driverProfile.profileUrl ? (
                    <img src={driverProfile.profileUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    driverProfile.name ? driverProfile.name.substring(0,2) : "DR"
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm">
                      <RefreshCw size={24} className="text-white animate-spin mb-1" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} className="hidden" />
              </label>
              <div className="absolute bottom-2 right-2 bg-blue-600 w-8 h-8 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm pointer-events-none">
                <Camera size={14} className="text-white" />
              </div>
            </div>
            <div className="mb-2">
              <span className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
                <CheckCircle2 size={14} className="text-emerald-500" /> Terverifikasi
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight capitalize mb-1">
              {driverProfile.name || "Memuat..."}
            </h1>
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              ID Mitra: <span className="uppercase text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">{driverProfile.code || "---"}</span>
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Kinerja Akun</p>
              <p className="text-sm md:text-base font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck size={18} className="text-blue-500" /> {driverProfile.completedOrders} Pesanan Selesai
              </p>
            </div>
            <button onClick={() => setIsProfileModalOpen(true)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm">
               <Edit3 size={14} /> Edit Profil
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-[3rem] -z-10"></div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
            <Briefcase size={16} className="text-blue-500"/> Data Operasional
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 mt-0.5"><MapPin size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Area Utama</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.area || "Belum diatur"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 mt-0.5"><Phone size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nomor WhatsApp</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.phone || "Belum diatur"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-600 mt-0.5"><Car size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Kendaraan & Plat</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.vehicle || "Belum diatur"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-[3rem] -z-10"></div>
          <div className="flex justify-between items-start mb-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Landmark size={16} className="text-emerald-500"/> Pencairan Dana
            </h3>
            <button onClick={() => setIsBankModalOpen(true)} className="text-[10px] font-bold text-emerald-600 hover:text-white hover:bg-emerald-500 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg transition-colors shadow-sm">
               Ubah
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 mt-0.5"><Landmark size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Bank / E-Wallet</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.bankDetails?.bankName || <span className="text-rose-500 text-xs italic">Wajib diisi</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 mt-0.5"><CreditCard size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">No Rekening / HP</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.bankDetails?.accountNumber || <span className="text-rose-500 text-xs italic">Wajib diisi</span>}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 mt-0.5"><User size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Atas Nama</p>
                <p className="text-sm font-bold text-slate-700">{driverProfile.bankDetails?.accountName || <span className="text-rose-500 text-xs italic">Wajib diisi</span>}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5 KATEGORI JASA (TERMASUK BELANJA) */}
      {/* ========================================== */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">
          Preferensi Layanan
        </h3>
        <p className="text-[11px] font-medium text-slate-500 mb-5 leading-relaxed">
          Pesanan dari kategori yang <strong className="text-rose-500">dimatikan</strong> tidak akan masuk ke Radar Anda. Pilihan tersimpan otomatis.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div onClick={() => handleToggleService('jarak')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeServices.jarak ? 'border-blue-200 bg-blue-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white shadow-sm border border-slate-100 text-blue-600 rounded-xl"><MapPin size={18} /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Jasa Jarak</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Antar jemput (KM)</p>
              </div>
            </div>
            {activeServices.jarak ? <ToggleRight size={36} className="text-blue-600" /> : <ToggleLeft size={36} className="text-slate-300" />}
          </div>

          <div onClick={() => handleToggleService('tenaga')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeServices.tenaga ? 'border-orange-200 bg-orange-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white shadow-sm border border-slate-100 text-orange-600 rounded-xl"><Hammer size={18} /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Jasa Tenaga</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Angkut & bongkar muat</p>
              </div>
            </div>
            {activeServices.tenaga ? <ToggleRight size={36} className="text-orange-500" /> : <ToggleLeft size={36} className="text-slate-300" />}
          </div>

          <div onClick={() => handleToggleService('waktu')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeServices.waktu ? 'border-emerald-200 bg-emerald-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white shadow-sm border border-slate-100 text-emerald-600 rounded-xl"><Clock size={18} /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Jasa Waktu</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Sewa driver per jam</p>
              </div>
            </div>
            {activeServices.waktu ? <ToggleRight size={36} className="text-emerald-500" /> : <ToggleLeft size={36} className="text-slate-300" />}
          </div>

          <div onClick={() => handleToggleService('pikiran')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeServices.pikiran ? 'border-purple-200 bg-purple-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white shadow-sm border border-slate-100 text-purple-600 rounded-xl"><Brain size={18} /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Jasa Pikiran</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Keahlian & tugas khusus</p>
              </div>
            </div>
            {activeServices.pikiran ? <ToggleRight size={36} className="text-purple-600" /> : <ToggleLeft size={36} className="text-slate-300" />}
          </div>

          <div onClick={() => handleToggleService('belanja')} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${activeServices.belanja ? 'border-rose-200 bg-rose-50/50 shadow-sm' : 'border-slate-100 hover:bg-slate-50 grayscale opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white shadow-sm border border-slate-100 text-rose-600 rounded-xl"><ShoppingCart size={18} /></div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Jasa Belanja</h4>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Titip beli & Talangan</p>
              </div>
            </div>
            {activeServices.belanja ? <ToggleRight size={36} className="text-rose-600" /> : <ToggleLeft size={36} className="text-slate-300" />}
          </div>
        </div>
      </div>

      {/* KEAMANAN & LOGOUT */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="divide-y divide-slate-100">
          <button onClick={() => setIsSecurityModalOpen(true)} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors"><KeyRound size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Ubah Username & Login</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-rose-50 transition-colors active:bg-rose-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-100 transition-colors"><LogOut size={18} /></div>
              <span className="text-sm font-bold text-rose-600">Keluar dari Akun (Logout)</span>
            </div>
          </button>
        </div>
      </div>

      {/* MODAL 1: EDIT PROFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">Edit Profil</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Perbarui data operasional Anda.</p>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <input required type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                <input required type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Area Utama</label>
                <input type="text" value={profileForm.area} onChange={(e) => setProfileForm({...profileForm, area: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kendaraan & Plat</label>
                <input type="text" placeholder="Contoh: Vario (N 1234 AB)" value={profileForm.vehicle} onChange={(e) => setProfileForm({...profileForm, vehicle: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 text-sm font-medium transition-colors" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT REKENING */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-emerald-800 flex items-center gap-2"><Landmark size={20}/> Data Rekening</h3>
                <p className="text-xs text-emerald-600/80 font-medium mt-0.5">Tujuan transfer pencairan & reimburse.</p>
              </div>
              <button onClick={() => setIsBankModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-emerald-100 shadow-sm"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveBank} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank / E-Wallet <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="BCA / DANA / Gopay" value={bankForm.bankName} onChange={(e) => setBankForm({...bankForm, bankName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 text-sm font-medium transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">No. Rekening / HP <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="1234567890" value={bankForm.accountNumber} onChange={(e) => setBankForm({...bankForm, accountNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 text-sm font-medium transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Atas Nama <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Nama pemilik rekening" value={bankForm.accountName} onChange={(e) => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 text-sm font-medium transition-colors" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Simpan Rekening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: UBAH USERNAME */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-amber-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg text-amber-800 flex items-center gap-2"><KeyRound size={20} /> Keamanan Akses</h3>
                <p className="text-xs text-amber-700/80 font-medium mt-0.5">Ubah Username untuk Login.</p>
              </div>
              <button onClick={() => setIsSecurityModalOpen(false)} className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-amber-100 shadow-sm"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveSecurity} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username Baru <span className="text-rose-500">*</span></label>
                <input required type="text" placeholder="Tanpa spasi" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-amber-500 text-sm font-bold transition-colors" />
                <p className="text-[10px] text-slate-400 mt-1 ml-1 flex items-start gap-1 leading-relaxed"><Info size={12} className="shrink-0 mt-0.5"/> Jika Anda mengubahnya, Anda akan Login menggunakan username ini di masa depan.</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98]">
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} Update Username
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}