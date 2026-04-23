"use client";
import { useState, useEffect } from "react";
import { 
  Power, MapPin, Navigation, Clock, ShieldCheck, 
  ArrowRight, Phone, AlertCircle, Wallet, CheckCircle2, User, Camera, UploadCloud, RefreshCw, LogOut
} from "lucide-react";

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  
  // STATE BARU UNTUK DOMPET & STATISTIK DRIVER
  const [completedCount, setCompletedCount] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [driverCode, setDriverCode] = useState<string>("");

  // STATE UNTUK FOTO BUKTI
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    // Ambil data sesi login dari browser
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
    } else {
      window.location.href = "/";
    }
  }, []);

  // FUNGSI KELUAR AKUN (LOGOUT)
  const handleLogout = () => {
    if (isOnline) {
      alert("Harap matikan tombol Power (Offline) terlebih dahulu sebelum keluar!");
      return;
    }
    
    if (confirm("Apakah Anda yakin ingin keluar dari akun Driver?")) {
      localStorage.removeItem("mtm_user");
      window.location.href = "/"; // Kembali ke halaman Login
    }
  };

  // FUNGSI TARIK DATA & HITUNG DOMPET DRIVER
  const fetchActiveOrder = async () => {
    if (!isOnline || !driverCode) return;
    
    setIsLoadingOrder(true);
    try {
      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      
      if (result.success) {
        const allOrders = result.data;

        // 1. Cari pesanan yang sedang aktif/pending untuk dikerjakan di layar utama
        const currentActive = allOrders.find((o:any) => o.status === 'pending' || o.status === 'active');
        setActiveOrder(currentActive || null);

        // 2. Filter pesanan yang sudah 'completed' (Selesai)
        const completedOrders = allOrders.filter((o:any) => o.status === 'completed');
        setCompletedCount(completedOrders.length);

        // 3. Hitung Pendapatan Bersih Driver
        let totalIncome = 0;
        completedOrders.forEach((o:any) => {
          let ownerCut = 0;
          if (o.commissionTier === 'ringan') ownerCut = o.totalPrice * 0.30; 
          else if (o.commissionTier === 'sedang') ownerCut = o.totalPrice * 0.20; 
          else if (o.commissionTier === 'berat') ownerCut = o.totalPrice * 0.10;  
          
          totalIncome += (o.totalPrice - ownerCut);
        });
        
        setDailyRevenue(totalIncome);
      }
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOnline) {
      fetchActiveOrder(); 
      interval = setInterval(fetchActiveOrder, 10000); 
    } else {
      setActiveOrder(null); 
    }
    return () => clearInterval(interval); 
  }, [isOnline, driverCode]);


  // FUNGSI HANDLE FOTO SAAT KAMERA/GALERI DIPILIH
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file)); 
    }
  };

  const handleOrderStatus = async (newStatus: string) => {
    if (!activeOrder) return;
    
    if (newStatus === 'completed' && !proofFile) {
      alert("Harap unggah foto bukti penyelesaian terlebih dahulu!");
      return;
    }

    setIsProcessing(true);
    let uploadedProofUrl = null;

    try {
      if (newStatus === 'completed' && proofFile) {
        // GANTI BAGIAN INI DENGAN DATA CLOUDINARY ANDA
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
          throw new Error("Gagal mengunggah gambar ke Cloudinary");
        }
      }

      // UPDATE KE FIREBASE
      const res = await fetch('/api/driver/orders/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: activeOrder.id, 
          status: newStatus,
          proofUrl: uploadedProofUrl 
        })
      });
      
      const result = await res.json();
      
      if (result.success) {
        if (newStatus === 'active') {
          alert("Pesanan Diterima! Silakan menuju lokasi.");
        } else if (newStatus === 'completed') {
          alert("Pekerjaan Selesai! Bukti foto telah terkirim.");
          setProofFile(null); 
          setProofPreview(null);
        }
        fetchActiveOrder(); 
      } else {
        alert("Gagal memperbarui status: " + result.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan jaringan atau upload gagal.");
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500">
      
      {/* HEADER PROFIL & TOGGLE ONLINE */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className={`absolute -top-24 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10 transition-colors duration-700 pointer-events-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center font-black text-slate-500 text-lg md:text-xl shrink-0 uppercase">
            {driverCode.substring(0, 2)}
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 text-xl md:text-2xl leading-tight capitalize">
              {driverCode === "01" ? "Ahmad Riyadi" : driverCode === "02" ? "Budi Santoso" : `Driver ${driverCode}`}
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-500 flex items-center gap-1.5">
              Kode Akun: <span className="uppercase text-blue-600 font-bold">{driverCode}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          
          <div className={`flex-1 md:flex-none py-3 md:py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-colors ${
            isOnline ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-500 border border-slate-200"
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></div>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </div>

          {/* TOMBOL POWER (ONLINE/OFFLINE) */}
          <button 
            onClick={() => setIsOnline(!isOnline)}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 active:scale-95 shrink-0 ${
              isOnline ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30" : "bg-slate-800 hover:bg-slate-900 text-white"
            }`}
            title={isOnline ? "Matikan (Offline)" : "Nyalakan (Online)"}
          >
            <Power size={24} strokeWidth={2.5} />
          </button>

          {/* TOMBOL KELUAR AKUN (LOGOUT) */}
          <button 
            onClick={handleLogout}
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 active:scale-95 shrink-0 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600"
            title="Keluar dari Portal Driver"
          >
            <LogOut size={24} strokeWidth={2.5} />
          </button>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KOLOM KIRI: STATISTIK & PENDAPATAN */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-bl-full blur-2xl"></div>
            <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wallet size={16} /> Pendapatan Bersih
            </p>
            
            <h1 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">
              Rp {dailyRevenue.toLocaleString('id-ID')}
            </h1>
            
            <div className="flex items-center gap-6 border-t border-slate-700/50 pt-5">
              <div>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pesanan Selesai</p>
                <p className="text-lg font-black flex items-center gap-1.5">
                  <ShieldCheck size={18} className="text-blue-400"/> {completedCount} Order
                </p>
              </div>
              <div className="w-px h-10 bg-slate-700"></div>
              <div>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status Dompet</p>
                <p className="text-lg font-black text-emerald-400">Aktif</p>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: RADAR PESANAN MASUK */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-base md:text-lg font-bold text-slate-800 uppercase tracking-widest">Radar Pesanan</h3>
          </div>
          
          {/* STATE 1: OFFLINE */}
          {!isOnline && (
            <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-slate-100">
                <Power size={36} className="text-slate-300" />
              </div>
              <h4 className="font-extrabold text-slate-600 text-lg mb-1">Anda Sedang Offline</h4>
              <p className="text-sm text-slate-500 font-medium max-w-sm">Tekan tombol Power di atas untuk mulai menerima dan mencari pesanan di sekitar Anda.</p>
            </div>
          )}

          {/* STATE 2: MENCARI PESANAN */}
          {isOnline && isLoadingOrder && !activeOrder && (
             <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                  <div className="bg-white p-4 rounded-full shadow-md border border-blue-100 relative z-10">
                    <Navigation size={36} className="text-blue-500 animate-pulse" />
                  </div>
                </div>
                <h4 className="font-extrabold text-blue-800 text-lg mb-1">Menyinkronkan Data...</h4>
             </div>
          )}

          {/* STATE 3: KOSONG (MENUNGGU) */}
          {isOnline && !isLoadingOrder && !activeOrder && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                <div className="bg-white p-4 rounded-full shadow-md border border-blue-100 relative z-10">
                  <Navigation size={36} className="text-blue-500 animate-pulse" />
                </div>
              </div>
              <h4 className="font-extrabold text-blue-800 text-lg mb-1">Menunggu Pesanan...</h4>
              <p className="text-sm text-blue-600/80 font-medium max-w-sm">Sistem kami sedang mencari pesanan yang ditugaskan ke Anda.</p>
            </div>
          )}

          {/* STATE 4: ADA PESANAN MASUK DARI DATABASE */}
          {isOnline && activeOrder && (
            <div className={`rounded-3xl border-2 shadow-lg overflow-hidden animate-in slide-in-from-bottom-6 duration-500 ${activeOrder.status === 'pending' ? 'bg-white border-amber-400 shadow-amber-400/20' : 'bg-white border-emerald-500 shadow-emerald-500/20'}`}>
              
              <div className={`${activeOrder.status === 'pending' ? 'bg-amber-400 text-amber-950' : 'bg-emerald-500 text-white'} text-xs md:text-sm font-black p-3 md:p-4 text-center uppercase tracking-widest flex items-center justify-center gap-2`}>
                {activeOrder.status === 'pending' ? <><AlertCircle size={18} /> Pesanan Baru Masuk!</> : <><Navigation size={18} /> Pesanan Sedang Berjalan</>}
              </div>
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                  <div>
                    <span className="text-[10px] md:text-xs font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 mb-2 inline-block uppercase">{activeOrder.invoice} • {activeOrder.category}</span>
                    <h4 className="font-black text-xl md:text-2xl text-slate-800">{activeOrder.serviceName}</h4>
                    <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-1.5"><User size={14}/> {activeOrder.customerName}</p>
                  </div>
                  <div className="sm:text-right">
                    <h3 className="text-3xl font-black text-emerald-600">Rp {activeOrder.totalPrice?.toLocaleString('id-ID')}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Pembayaran: {activeOrder.paymentMethod}</p>
                  </div>
                </div>

                {activeOrder.category === 'Jarak' && activeOrder.origin && activeOrder.destination && (
                  <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 relative mb-8">
                    <div className="absolute top-8 bottom-8 left-[31px] w-0.5 bg-slate-200 dashed"></div>
                    
                    <div className="flex gap-4 relative mb-6">
                      <div className="w-6 h-6 rounded-full border-4 border-white bg-blue-500 shadow-sm shrink-0 relative z-10"></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Jemput</p>
                        <p className="text-sm md:text-base font-bold text-slate-800">{activeOrder.origin}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full border-4 border-white bg-rose-500 shadow-sm shrink-0 relative z-10"></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Antar (Tujuan)</p>
                        <p className="text-sm md:text-base font-bold text-slate-800">{activeOrder.destination}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeOrder.status === 'active' && (
                  <div className="mt-6 mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 border-dashed text-center">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-center gap-2">
                      <Camera size={16} className="text-slate-500"/> Foto Bukti Selesai
                    </h4>
                    
                    {proofPreview ? (
                      <div className="relative inline-block">
                        <img src={proofPreview} alt="Bukti" className="w-full max-w-xs h-40 object-cover rounded-xl border-2 border-emerald-500 shadow-sm" />
                        <button onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md">
                           <AlertCircle size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all flex flex-col items-center justify-center shadow-sm w-full">
                        <UploadCloud size={24} className="mb-2 text-blue-500" />
                        <span className="text-sm">Ketuk untuk Buka Kamera / Galeri</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          className="hidden" 
                          onChange={handlePhotoChange} 
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  {activeOrder.status === 'pending' ? (
                    <button 
                      onClick={() => handleOrderStatus('active')}
                      disabled={isProcessing}
                      className="flex-1 bg-slate-900 hover:bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all text-base shadow-md flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Clock className="animate-spin" size={18} /> : "Terima Pesanan"} <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleOrderStatus('completed')}
                      disabled={isProcessing || !proofFile} 
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all text-base shadow-md flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <><RefreshCw className="animate-spin" size={18} /> Mengunggah Foto...</>
                      ) : (
                        <><CheckCircle2 size={18} /> Selesaikan Tugas</>
                      )}
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}