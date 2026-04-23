"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, PlusCircle, ClipboardList, 
  Car, Settings, Search, Bell, LogOut
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // FUNGSI LOGOUT (Menghapus Sesi & Kembali ke Login)
  const handleLogout = () => {
    if (confirm("Apakah Anda yakin ingin keluar dari Portal Owner?")) {
      localStorage.removeItem("mtm_user");
      router.push("/");
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

        {/* HEADER ATAS */}
        <header className="h-20 md:h-24 flex items-center justify-between px-5 md:px-8 z-10 bg-white/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200 md:border-none shrink-0 w-full">
          
          <div className="flex items-center gap-3">
            {!isDesktop && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-sm shrink-0">
                <Car size={18} className="text-white" strokeWidth={2.5} />
              </div>
            )}
            <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
              Portal Owner
            </h2>
          </div>
          
          <div className="flex items-center gap-3 md:gap-5">
            {isDesktop && (
              <div className="flex items-center bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <Search size={16} className="text-slate-400" />
                <input type="text" placeholder="Cari invoice..." className="bg-transparent border-none outline-none ml-2 text-sm w-40 text-slate-700 placeholder-slate-400 font-medium" />
              </div>
            )}

            <button className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-white shadow-sm hover:shadow-md border border-slate-200 text-slate-600 relative transition-all active:scale-95">
              <Bell size={18} className="md:w-5 md:h-5" />
              <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 h-2 w-2 md:h-2.5 md:w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>
            
            <div 
              onClick={!isDesktop ? handleLogout : undefined} // HP bisa tekan profil untuk keluar
              className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-md cursor-pointer border-2 border-white"
              title={!isDesktop ? "Ketuk untuk Keluar" : "Profil"}
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