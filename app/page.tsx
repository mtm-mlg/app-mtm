"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Car, User, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Cek apakah sebelumnya sudah login
  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) {
      if (session === "owner") {
        router.push("/admin");
      } else {
        router.push("/driver");
      }
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      alert("Harap masukkan Username / Kode Driver!");
      return;
    }

    setIsLoading(true);

    // Simulasi loading sebentar agar terasa seperti aplikasi sungguhan
    setTimeout(() => {
      const formattedUser = username.trim().toLowerCase();
      
      if (formattedUser === "owner" || formattedUser === "admin") {
        // LOGIN SEBAGAI OWNER
        localStorage.setItem("mtm_user", "owner");
        router.push("/admin");
      } else {
        // LOGIN SEBAGAI DRIVER
        localStorage.setItem("mtm_user", formattedUser);
        router.push("/driver");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in zoom-in duration-500">
        
        {/* LOGO MTM */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5">
            <Car size={40} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">MTM App</h1>
          <p className="text-sm font-medium text-slate-500">Aplikasi Manajemen Transportasi & Logistik Terpadu</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-widest">Username / Kode Akun</label>
            <div className="flex items-center w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
              <User size={18} className="text-slate-400 mr-3 shrink-0" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: owner atau 01" 
                className="flex-1 w-full bg-transparent border-0 outline-none focus:ring-0 p-0 text-slate-800 text-base font-bold placeholder-slate-400" 
                autoComplete="off"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:bg-slate-400 disabled:cursor-wait"
          >
            {isLoading ? (
              <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Memproses...</span>
            ) : (
              <span className="flex items-center gap-2">Masuk ke Sistem <ArrowRight size={18} /></span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} /> Koneksi Aman
          </p>
        </div>

      </div>
    </div>
  );
}