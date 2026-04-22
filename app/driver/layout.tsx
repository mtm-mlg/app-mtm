"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Wallet, User, Car, Bell } from "lucide-react";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-50 shadow-sm">
          <div className="h-20 flex items-center px-6 border-b border-slate-100">
            <div className="bg-blue-600 p-2 rounded-xl text-white mr-3">
              <Car size={20} strokeWidth={2.5} />
            </div>
            <h1 className="font-black text-xl text-slate-800 tracking-tight">MTM Driver</h1>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link key={item.name} href={item.path}>
                  <div className={`flex items-center px-4 py-3.5 rounded-xl transition-all ${isActive ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-semibold"}`}>
                    <item.icon size={20} className="mr-3" strokeWidth={isActive ? 2.5 : 2} />
                    {item.name}
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
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header Atas (Hanya Laptop) */}
        {isDesktop && (
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-40">
            <h2 className="font-bold text-lg text-slate-700">Portal Mitra Pengemudi</h2>
            <button className="p-2.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-100"></span>
            </button>
          </header>
        )}

        {/* Konten Halaman */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 scroll-smooth">
          {children}
        </main>

        {/* ========================================== */}
        {/* BOTTOM NAV (HANYA MUNCUL DI HP) */}
        {/* ========================================== */}
        {!isDesktop && (
          <nav className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link key={item.name} href={item.path} className="flex flex-col items-center gap-1">
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] font-bold ${isActive ? "text-blue-600" : "text-slate-400"}`}>
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