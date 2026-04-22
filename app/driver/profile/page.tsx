"use client";
import { useState, useEffect } from "react";
import { 
  User, Phone, Car, ShieldCheck, 
  LogOut, ChevronRight, Settings, HelpCircle, 
  Star, MapPin, KeyRound, Camera, Edit3, 
  ToggleRight, ToggleLeft, Briefcase, Info,
  Hammer, Clock, Brain
} from "lucide-react";

export default function DriverProfilePage() {
  const [isLoaded, setIsLoaded] = useState(false);

  // STATE UNTUK 4 KATEGORI JASA UTAMA
  const [activeServices, setActiveServices] = useState({
    jarak: true,   
    tenaga: false, 
    waktu: true,   
    pikiran: false 
  });

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleToggleService = (service: keyof typeof activeServices) => {
    setActiveServices({ ...activeServices, [service]: !activeServices[service] });
  };

  return (
    <div className={`max-w-[800px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="mb-6 px-2">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <User className="text-blue-600" size={28} /> Profil Akun
        </h2>
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
            
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-lg">
                <div className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-3xl overflow-hidden relative">
                  AH
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
              </div>
              <button className="absolute bottom-1 right-1 bg-blue-600 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                <Camera size={12} className="text-white" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ahmad Riyadi</h1>
              <button className="text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={16} /></button>
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-widest inline-block mt-1">Mitra Driver (DRV-001)</span>
          </div>

          <div className="flex gap-4 mt-5 pt-5 border-t border-slate-100">
            <div className="flex-1 text-center bg-slate-50 rounded-2xl py-3 border border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-lg font-black text-slate-800">
                <Star size={16} className="fill-amber-400 text-amber-400" /> 4.9
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Rating Total</span>
            </div>
            <div className="flex-1 text-center bg-slate-50 rounded-2xl py-3 border border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-lg font-black text-slate-800">
                <ShieldCheck size={16} className="text-blue-500" /> 142
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Total Selesai</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 4 KATEGORI JASA (SINKRON DENGAN OWNER) */}
      {/* ========================================== */}
      <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-[3rem] -z-10"></div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-1.5">
          <Briefcase size={14} className="text-blue-500"/> Preferensi Layanan
        </h3>
        <p className="text-[11px] font-medium text-slate-500 mb-5 ml-1 leading-relaxed">
          Pilih kategori pesanan yang ingin Anda kerjakan hari ini.
        </p>
        
        <div className="space-y-3">
          {/* Kategori Jarak */}
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

          {/* Kategori Tenaga */}
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

          {/* Kategori Waktu */}
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

          {/* Kategori Pikiran */}
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
                <p className="text-sm font-bold text-slate-800">Malang Kota & Sekitarnya</p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Ubah</button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-500"><Phone size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nomor WhatsApp</p>
                <p className="text-sm font-bold text-slate-800">0812-3456-7890</p>
              </div>
            </div>
            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Ubah</button>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-blue-600"><Car size={16} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Kendaraan Aktif</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-800">Motor Honda Beat</p>
                  <span className="text-[9px] font-black text-slate-600 bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-sm">N 1234 AB</span>
                </div>
              </div>
            </div>
            <button className="text-[10px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 px-3 py-1.5 bg-blue-100 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
               <Edit3 size={10} /> Ganti
            </button>
          </div>
          <p className="text-[10px] text-slate-400 ml-1 italic flex items-center gap-1"><Info size={12}/> Pastikan plat nomor sesuai dengan kendaraan yang sedang dipakai.</p>
        </div>
      </div>

      {/* ========================================== */}
      {/* PENGATURAN LAIN-LAIN */}
      {/* ========================================== */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="divide-y divide-slate-100">
          
          <button className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-200 transition-colors"><Settings size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Pengaturan Aplikasi</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

          <button className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors"><KeyRound size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Ubah Kata Sandi & Keamanan</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

          <button className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-slate-50 transition-colors active:bg-slate-100 group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors"><HelpCircle size={18} /></div>
              <span className="text-sm font-bold text-slate-700">Pusat Bantuan & Panduan</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

        </div>
      </div>

      {/* ========================================== */}
      {/* TOMBOL LOGOUT */}
      {/* ========================================== */}
      <button className="w-full bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
        <LogOut size={18} /> Keluar dari Akun
      </button>

    </div>
  );
}