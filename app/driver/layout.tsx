"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, ClipboardList, Wallet, User, 
  Car, Bell, Package, MapPin, CheckCircle2 
} from "lucide-react";

// IMPORT FIREBASE
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(true);
  const [driverCode, setDriverCode] = useState<string>("");

  // STATE NOTIFIKASI
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    // Logika Responsive Layar
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);

    // Ambil Data Sesi Driver
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
    }

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // =========================================================
  // LISTENER FIREBASE: MENDETEKSI PESANAN BARU SECARA REAL-TIME
  // =========================================================
  useEffect(() => {
    if (!driverCode) return;

    // Tarik semua pesanan berstatus 'pending'
    const q = query(collection(db, "orders"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter: Hanya tampilkan pesanan yang ditugaskan untuk Driver ini ATAU dilempar ke semua (Kosong)
      const myNotifs = pendingOrders.filter((o: any) => 
        o.driverCode === driverCode || !o.driverCode || o.driverCode === ""
      );
      
      // Urutkan dari yang terbaru (opsional)
      myNotifs.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setNotifications(myNotifs);
    });

    return () => unsubscribe(); // Bersihkan listener saat komponen dilepas
  }, [driverCode]);

  const navItems = [
    { name: "Beranda", icon: Home, path: "/driver" },
    { name: "Riwayat", icon: ClipboardList, path: "/driver/history" },
    { name: "Saldo", icon: Wallet, path: "/driver/wallet" },
    { name: "Profil", icon: User, path: "/driver/profile" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* ========================================== */}
      {/* SIDEBAR (HANYA MUNCUL DI LAPTOP/TABLET) */}
      {/* ========================================== */}
      {isDesktop && (
        <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col z-50 shadow-sm shrink-0">
          <div className="h-20 flex items-center px-6 border-b border-slate-100">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-md shadow-blue-500/20 shrink-0">
              <Car size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="ml-3 font-black text-xl text-slate-800 tracking-tight whitespace-nowrap">
              MTM Driver
            </h1>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
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
        </aside>
      )}

      {/* ========================================== */}
      {/* AREA KONTEN UTAMA */}
      {/* ========================================== */}
      <div className="flex-1 flex flex-col relative overflow-hidden w-full max-w-full">
        
        {/* ========================================== */}
        {/* HEADER ATAS (SEKARANG MUNCUL DI HP & LAPTOP) */}
        {/* ========================================== */}
        <header className="relative h-16 md:h-20 flex items-center justify-between px-4 md:px-8 z-[999] bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 w-full">
          
          <div className="flex items-center gap-3">
            {!isDesktop && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm shrink-0">
                <Car size={16} className="text-white" strokeWidth={2.5} />
              </div>
            )}
            <h2 className="text-sm md:text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">
              Portal Mitra
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            
            {/* DROPDOWN NOTIFIKASI */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 md:p-2.5 rounded-xl bg-white shadow-sm hover:shadow-md border border-slate-200 text-slate-600 relative transition-all active:scale-95 shrink-0"
              >
                <Bell size={18} className="md:w-5 md:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 md:h-5 md:w-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] md:text-[10px] font-black text-white animate-pulse shadow-sm">
                    {notifications.length}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 top-full mt-3 w-[280px] md:w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 origin-top-right">
                  <div className="bg-slate-800 p-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <Bell size={16} className="text-amber-400" /> Pemberitahuan
                    </h3>
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto hide-scrollbar bg-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400 opacity-50" />
                        <p className="text-xs font-medium">Tidak ada pesanan baru saat ini.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              setIsNotifOpen(false);
                              if (pathname !== "/driver") router.push("/driver");
                            }}
                            className="p-4 bg-white hover:bg-blue-50/80 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                {notif.category}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-600">Baru</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 mb-1 line-clamp-1">{notif.serviceName}</h4>
                            <p className="text-[11px] font-medium text-slate-500 flex items-start gap-1.5 line-clamp-2">
                              <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400"/> {notif.customerAddress}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-3 bg-white border-t border-slate-100 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Buka beranda untuk melihat Radar
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AVATAR DRIVER */}
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs md:text-sm shadow-inner uppercase shrink-0">
              {driverCode ? driverCode.substring(0,2) : "DR"}
            </div>

          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:px-8 md:pt-4 md:pb-8 pb-24 scroll-smooth w-full max-w-[100vw]">
          {children}
        </main>

        {/* ========================================== */}
        {/* BOTTOM NAV (HANYA MUNCUL DI HP) */}
        {/* ========================================== */}
        {!isDesktop && (
          <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-2 py-2 flex justify-between items-center z-[100] shadow-[0_-10px_20px_rgba(0,0,0,0.04)] pb-safe">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
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