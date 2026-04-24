"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, PlusCircle, ClipboardList, 
  Car, Settings, Bell, LogOut, Clock, CheckCircle2
} from "lucide-react";

// IMPORT FIREBASE UNTUK NOTIFIKASI REAL-TIME
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // STATE UNTUK JAM REAL-TIME & NOTIFIKASI TARIK DANA
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    // 1. Logika Responsive Layar
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);

    // 2. Logika Jam Real-Time Berdetak
    setCurrentTime(new Date());
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 3. LOGIKA REAL-TIME NOTIFIKASI TARIK DANA DRIVER
    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawRequests(reqs);
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(timeInterval);
      unsubscribe(); // Bersihkan listener saat pindah halaman
    };
  }, []);

  // FUNGSI LOGOUT
  const handleLogout = () => {
    if (confirm("Apakah Anda yakin ingin keluar dari Portal Owner?")) {
      localStorage.removeItem("mtm_user");
      router.push("/");
    }
  };

  // FUNGSI MEMPROSES TARIK DANA
  const handleProcessWithdrawal = async (id: string, driverName: string, amount: number) => {
    if (confirm(`Apakah Anda SUDAH MENTRANSFER dana sebesar Rp ${amount.toLocaleString('id-ID')} ke rekening ${driverName}?\n\nKlik OK jika uang sudah berhasil dikirim.`)) {
      try {
        await updateDoc(doc(db, "withdrawals", id), { 
          status: "completed",
          processedAt: new Date().toISOString()
        });
        alert("Status tarik dana berhasil diperbarui!");
      } catch (error) {
        alert("Gagal memproses data. Periksa koneksi Anda.");
      }
    }
  };

  const menuItems = [
    { name: "Beranda", icon: LayoutDashboard, path: "/admin" },
    { name: "Order Baru", icon: PlusCircle, path: "/admin/orders/new" },
    { name: "Riwayat", icon: ClipboardList, path: "/admin/orders" },
    { name: "Armada", icon: Car, path: "/admin/drivers" },
    { name: "Setelan", icon: Settings, path: "/admin/settings" },
  ];

  const checkIsActive = (itemPath: string) => {
    if (itemPath === '/admin') {
      return pathname === '/admin';
    } else if (itemPath === '/admin/orders') {
      return pathname === '/admin/orders';
    } else {
      return pathname.startsWith(itemPath);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date).replace(/\./g, ':');
  };
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden w-full">
      
      {/* ========================================== */}
      {/* SIDEBAR (HANYA MUNCUL DI LAPTOP/TABLET) */}
      {/* ========================================== */}
      {isDesktop && (
        <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col z-50 shadow-sm shrink-0 transition-all duration-300">
          
          <div className="h-24 flex items-center px-6 border-b border-slate-100">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-md shadow-blue-500/20 shrink-0">
              <Car size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="ml-3 font-black text-xl text-slate-800 tracking-tight whitespace-nowrap">
              MTM Owner
            </h1>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
            {menuItems.map((item) => {
              const isActive = checkIsActive(item.path);
              return (
                <Link key={item.name} href={item.path}>
                  <div className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group ${isActive ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "hover:bg-blue-50 text-slate-500 hover:text-blue-700 font-semibold"}`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 mr-3 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                    <span className={`text-[14px] ${isActive ? "font-bold" : ""}`}>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* TOMBOL LOGOUT UNTUK LAPTOP */}
          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 font-bold transition-all duration-300 group"
            >
              <LogOut size={20} strokeWidth={2.5} className="shrink-0 mr-3 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[14px]">Keluar Akun</span>
            </button>
          </div>
        </aside>
      )}

      {/* ========================================== */}
      {/* AREA KONTEN UTAMA */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col relative overflow-hidden w-full max-w-full">
        
        {isDesktop && (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-indigo-400/10 blur-[100px] pointer-events-none"></div>
          </>
        )}

        {/* HEADER ATAS (DIPERBAIKI LAYER Z-INDEX NYA MENJADI Z-[999] MUTLAK) */}
        <header className="relative h-20 md:h-24 flex items-center justify-between px-4 md:px-8 z-[999] bg-white/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200 md:border-none shrink-0 w-full">
          
          <div className="flex items-center gap-2 md:gap-3">
            {!isDesktop && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm shrink-0">
                <Car size={16} className="text-white" strokeWidth={2.5} />
              </div>
            )}
            <h2 className="text-base md:text-xl font-bold text-slate-800 tracking-tight whitespace-nowrap">
              Portal Owner
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-5">
            
            {/* JAM REAL-TIME */}
            {currentTime && (
              <div className="flex items-center gap-1.5 md:gap-3 bg-slate-100/80 backdrop-blur-md px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-slate-200 shadow-inner md:mr-2">
                <Clock size={14} className="text-blue-600 hidden sm:block md:w-4 md:h-4" />
                <div className="flex flex-col text-center sm:text-left">
                  <span className="text-[10px] md:text-xs font-black text-slate-800 tracking-widest tabular-nums leading-none md:mb-1">
                    {formatTime(currentTime)} <span className="hidden sm:inline">WIB</span>
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none hidden md:block">
                    {formatDate(currentTime)}
                  </span>
                </div>
              </div>
            )}

            {/* ========================================== */}
            {/* DROPDOWN NOTIFIKASI TARIK DANA */}
            {/* ========================================== */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 md:p-3 rounded-lg md:rounded-2xl bg-white shadow-sm hover:shadow-md border border-slate-200 text-slate-600 relative transition-all active:scale-95 shrink-0"
                title="Notifikasi Penarikan Dana"
              >
                <Bell size={16} className="md:w-5 md:h-5" />
                {withdrawRequests.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 md:h-5 md:w-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] md:text-[9px] font-black text-white shadow-sm animate-pulse">
                    {withdrawRequests.length}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-3 w-[300px] md:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 origin-top-right">
                  <div className="bg-slate-800 p-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <Bell size={16} className="text-amber-400" /> Tarik Saldo Driver
                    </h3>
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {withdrawRequests.length} Permintaan
                    </span>
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto hide-scrollbar bg-slate-50 relative z-[1000]">
                    {withdrawRequests.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400 opacity-50" />
                        <p className="text-xs font-medium">Belum ada permintaan penarikan dana.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {withdrawRequests.map(req => (
                          <div key={req.id} className="p-4 bg-white hover:bg-blue-50/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{req.driverName || req.driverCode}</h4>
                                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{req.bankName || "Bank"} - {req.accountNumber || "No. Rekening"}</p>
                              </div>
                              <span className="text-sm font-black text-rose-600 tracking-tight">
                                Rp {req.amount?.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleProcessWithdrawal(req.id, req.driverName || req.driverCode, req.amount)}
                              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              <CheckCircle2 size={14} /> Tandai Sudah Ditransfer
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* AVATAR OWNER */}
            <div 
              onClick={!isDesktop ? handleLogout : undefined} 
              className="h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center text-white font-black text-[10px] md:text-sm shadow-md cursor-pointer border-2 border-white hover:ring-2 ring-slate-300 transition-all shrink-0"
              title={!isDesktop ? "Ketuk untuk Keluar" : "Akun Owner Utama"}
            >
              OW
            </div>
          </div>
        </header>

        {/* AREA KONTEN */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:px-8 md:pt-2 md:pb-12 pb-24 z-10 scroll-smooth w-full max-w-[100vw]">
          {children}
        </main>

        {/* ========================================== */}
        {/* BOTTOM NAVIGATION (HANYA MUNCUL DI HP) */}
        {/* ========================================== */}
        {!isDesktop && (
          <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-between items-center z-[100] shadow-[0_-10px_20px_rgba(0,0,0,0.04)] pb-safe pt-2 px-2 sm:px-4">
            {menuItems.map((item) => {
              const isActive = checkIsActive(item.path);
              return (
                <Link key={item.name} href={item.path} className="flex flex-col items-center justify-center flex-1 py-1 min-w-[60px] active:scale-95 transition-transform">
                  <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? "bg-blue-100 text-blue-600 shadow-inner" : "text-slate-400 hover:text-slate-600"}`}>
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[9px] sm:text-[10px] mt-1 text-center truncate w-full px-1 transition-all ${isActive ? "font-bold text-blue-600" : "font-semibold text-slate-400"}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
}