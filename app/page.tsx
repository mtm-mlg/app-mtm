import Link from "next/link";
import { LayoutDashboard, Car, ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen relative flex items-center justify-center bg-[#F4F7FC] overflow-hidden">
      
      {/* ORNAMEN BACKGROUND (EFEK GLOWING MODERN) */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-400/20 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl w-full px-6 flex flex-col items-center">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 mb-2">
            <ShieldCheck size={36} className="text-blue-600" />
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
            MTM <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">App</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            Sistem manajemen operasional untuk layanan jasa on-demand di wilayah Malang dan sekitarnya.
          </p>
        </div>

        {/* KARTU PORTAL (GLASSMORPHISM EFFECT) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          
          {/* KARTU OWNER */}
          <Link href="/admin" className="group">
            <div className="h-full bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-transparent rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
              
              <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/30">
                <LayoutDashboard size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">Portal Owner</h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Masuk ke Dashboard Pusat untuk input orderan, pantau armada driver, dan kelola invoice tagihan.
              </p>
              <div className="inline-flex items-center text-blue-600 font-bold group-hover:gap-3 transition-all">
                Masuk sebagai Owner <ArrowRight size={20} className="ml-2" />
              </div>
            </div>
          </Link>

          {/* KARTU DRIVER */}
          <Link href="/driver" className="group">
            <div className="h-full bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
              
              <div className="h-16 w-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/30">
                <Car size={32} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">Portal Driver</h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Terima orderan baru, atur status ketersediaan (Ready/Off), dan pantau komisi Anda secara real-time.
              </p>
              <div className="inline-flex items-center text-emerald-600 font-bold group-hover:gap-3 transition-all">
                Masuk sebagai Driver <ArrowRight size={20} className="ml-2" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </main>
  );
}