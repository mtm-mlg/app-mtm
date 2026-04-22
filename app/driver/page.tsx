"use client";
import { useState } from "react";
import { 
  Power, MapPin, Navigation, Clock, ShieldCheck, 
  ArrowRight, Phone, AlertCircle, Wallet
} from "lucide-react";

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  
  // Dummy Data Order Masuk / Aktif
  const activeOrder = isOnline ? {
    id: "INV-00123",
    customer: "Budi Santoso",
    service: "Antar Jemput (Motor)",
    pickup: "Stasiun Kota Baru Malang",
    dropoff: "Jl. Soekarno Hatta No. 9",
    price: "Rp 45.000",
    distance: "4.5 KM",
    status: "new"
  } : null;

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500">
      
      {/* ========================================== */}
      {/* HEADER PROFIL & TOGGLE ONLINE (FULL WIDTH) */}
      {/* ========================================== */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className={`absolute -top-24 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10 transition-colors duration-700 pointer-events-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-100 border border-slate-200 shadow-inner flex items-center justify-center font-black text-slate-500 text-lg md:text-xl shrink-0">
            AH
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 text-xl md:text-2xl leading-tight">Ahmad Riyadi</h2>
            <p className="text-xs md:text-sm font-semibold text-slate-500">Area: Malang Kota • N 1234 AB</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
          {/* STATUS TEKS */}
          <div className={`flex-1 md:flex-none py-3 md:py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-colors ${
            isOnline ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-500 border border-slate-200"
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></div>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </div>

          {/* TOMBOL TOGGLE RAKSASA */}
          <button 
            onClick={() => setIsOnline(!isOnline)}
            className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 active:scale-95 shrink-0 ${
              isOnline ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30" : "bg-slate-800 hover:bg-slate-900 text-white"
            }`}
          >
            <Power size={28} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================== */}
        {/* KOLOM KIRI: STATISTIK & PENDAPATAN (5 Kolom) */}
        {/* ========================================== */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-bl-full blur-2xl"></div>
            
            <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wallet size={16} /> Pendapatan Hari Ini
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">Rp 150K</h1>
            
            <div className="flex items-center gap-6 border-t border-slate-700/50 pt-5">
              <div>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pesanan Selesai</p>
                <p className="text-lg font-black flex items-center gap-1.5"><ShieldCheck size={18} className="text-blue-400"/> 5 Order</p>
              </div>
              <div className="w-px h-10 bg-slate-700"></div>
              <div>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Harian</p>
                <p className="text-lg font-black text-emerald-400">Tercapai</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* KOLOM KANAN: RADAR PESANAN MASUK (7 Kolom) */}
        {/* ========================================== */}
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
          {isOnline && !activeOrder && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                <div className="bg-white p-4 rounded-full shadow-md border border-blue-100 relative z-10">
                  <Navigation size={36} className="text-blue-500 animate-pulse" />
                </div>
              </div>
              <h4 className="font-extrabold text-blue-800 text-lg mb-1">Mencari Pesanan...</h4>
              <p className="text-sm text-blue-600/80 font-medium max-w-sm">Tetap aktif, sistem kami sedang memindai pesanan yang masuk di area Anda.</p>
            </div>
          )}

          {/* STATE 3: ADA PESANAN MASUK */}
          {isOnline && activeOrder && (
            <div className="bg-white rounded-3xl border-2 border-amber-400 shadow-[0_10px_30px_rgba(251,191,36,0.15)] overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
              <div className="bg-amber-400 text-amber-950 text-xs md:text-sm font-black p-3 md:p-4 text-center uppercase tracking-widest flex items-center justify-center gap-2">
                <AlertCircle size={18} /> Pesanan Baru Masuk!
              </div>
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                  <div>
                    <span className="text-[10px] md:text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 mb-2 inline-block">JARAK: {activeOrder.distance}</span>
                    <h4 className="font-black text-xl md:text-2xl text-slate-800">{activeOrder.service}</h4>
                  </div>
                  <h3 className="text-3xl font-black text-emerald-600 sm:text-right">{activeOrder.price}</h3>
                </div>

                <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 relative mb-8">
                  {/* Garis Konektor Rute */}
                  <div className="absolute top-8 bottom-8 left-[31px] w-0.5 bg-slate-200 dashed"></div>
                  
                  <div className="flex gap-4 relative mb-6">
                    <div className="w-6 h-6 rounded-full border-4 border-white bg-blue-500 shadow-sm shrink-0 relative z-10"></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Jemput</p>
                      <p className="text-sm md:text-base font-bold text-slate-800">{activeOrder.pickup}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full border-4 border-white bg-rose-500 shadow-sm shrink-0 relative z-10"></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Antar (Tujuan)</p>
                      <p className="text-sm md:text-base font-bold text-slate-800">{activeOrder.dropoff}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button className="flex-1 bg-slate-900 hover:bg-blue-600 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all text-base shadow-md flex items-center justify-center gap-2">
                    Terima Pesanan <ArrowRight size={18} />
                  </button>
                  <button className="sm:w-32 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold py-4 rounded-xl transition-all text-sm">
                    Tolak
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}