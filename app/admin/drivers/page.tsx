"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, Filter, MoreVertical, 
  MapPin, Phone, Car, ShieldCheck, 
  Power, MessageCircle, Wallet, Info, CalendarDays
} from "lucide-react";

// DATA DUMMY DRIVER 
const initialDrivers = [
  { id: "01", name: "Ahmad Riyadi", area: "Malang Kota", phone: "081234567890", orders: 5, revenue: "Rp 150K", status: "aktif", vehicle: "Motor Honda Beat (N 1234 AB)" },
  { id: "02", name: "Budi Santoso", area: "Kab. Malang", phone: "082198765432", orders: 3, revenue: "Rp 120K", status: "aktif", vehicle: "Mobil Avanza (N 4321 CD)" },
  { id: "03", name: "Reza Rahadian", area: "Batu & Sekitarnya", phone: "081345678912", orders: 0, revenue: "Rp 0", status: "suspend", vehicle: "Motor Vario (N 5678 EF)" },
  { id: "04", name: "Deni Pratama", area: "Malang Kota", phone: "085612349876", orders: 0, revenue: "Rp 0", status: "offline", vehicle: "Mobil Innova (N 9999 ZZ)" },
  { id: "05", name: "Wahyu Hidayat", area: "Kepanjen", phone: "089912345678", orders: 8, revenue: "Rp 240K", status: "aktif", vehicle: "Motor Scoopy (N 1111 XX)" },
];

export default function DriverManagementPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE DENGAN INFO RESET HARIAN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Armada & Driver</h2>
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[13px] font-medium">
            <CalendarDays size={14} className="text-blue-500" />
            <span>Data performa harian direset otomatis setiap pukul 00.00 WIB</span>
          </div>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Mitra Baru
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari nama, kode, atau plat nomor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-medium"
          />
        </div>

        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 w-full md:w-auto overflow-x-auto no-scrollbar">
          {["Semua", "Aktif", "Offline", "Suspend"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status.toLowerCase())}
              className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap ${
                filterStatus === status.toLowerCase()
                ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* GRID KARTU DRIVER */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {initialDrivers.map((driver) => (
          <div key={driver.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 group relative overflow-hidden flex flex-col">
            
            {/* Ornamen Background Kartu */}
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-10 opacity-20 transition-colors ${
              driver.status === 'aktif' ? 'bg-emerald-500' : 
              driver.status === 'offline' ? 'bg-slate-400' : 'bg-rose-500'
            }`}></div>

            {/* Header Kartu (Avatar & Info Utama) */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700 font-black text-lg border border-slate-300 shadow-inner">
                    {driver.name.split(" ")[0][0]}{driver.name.split(" ")[1] ? driver.name.split(" ")[1][0] : ""}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    driver.status === 'aktif' ? 'bg-emerald-500' : 
                    driver.status === 'offline' ? 'bg-slate-400' : 'bg-rose-500'
                  }`}></div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-[15px] tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">{driver.name}</h3>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{driver.id}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-blue-500" /> {driver.area}
                  </p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-blue-600 p-1.5 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Info Kontak & Kendaraan */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <Car size={14} className="text-slate-400" /> {driver.vehicle}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {driver.phone}
                </span>
                <button className="text-[10px] font-bold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                  <MessageCircle size={12} /> Chat WA
                </button>
              </div>
            </div>

            {/* AREA METRIK DAN TOMBOL BAWAH */}
            <div className="mt-auto border-t border-slate-100 pt-4">
              
              {/* Statistik Mini (Harian) - Row Atas */}
              <div className="flex items-center justify-around mb-4">
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-1.5 text-[15px] font-black text-slate-800">
                    <ShieldCheck size={16} className="text-blue-500" /> {driver.orders}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Selesai Hari Ini</span>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-1.5 text-[15px] font-black text-slate-800 whitespace-nowrap">
                    <Wallet size={16} className="text-emerald-500" /> {driver.revenue}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 block">Omzet Harian</span>
                </div>
              </div>

              {/* Tombol Aksi Status - Row Bawah (Lebar Penuh) */}
              <button className={`w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all border shadow-sm active:scale-[0.98] ${
                driver.status === 'aktif' 
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                : driver.status === 'suspend'
                ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
              }`}>
                <Power size={14} strokeWidth={2.5} />
                {driver.status === 'aktif' ? 'Suspend Driver' : 'Aktifkan Driver'}
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}