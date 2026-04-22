"use client";
import { useState, useEffect } from "react";
import { 
  Search, FileDown, Eye, MoreHorizontal, 
  Filter, Calendar, ChevronLeft, ChevronRight, Info
} from "lucide-react";

// DATA DUMMY
const initialOrders = [
  { id: 1, invoice: "INV202601001", waktu: "2026-04-22 14:20", pelanggan: "Bapak Andi", jenis: "Jarak", rincian: "Antar Jemput Motor", driver: "Ahmad (01)", total: 35000, komisiOwner: 7000, bayar: "QRIS", status: "Selesai" },
  { id: 2, invoice: "INV202601005", waktu: "2026-04-22 15:45", pelanggan: "Toko Laris", jenis: "Tenaga", rincian: "Angkut Barang", driver: "Budi (02)", total: 120000, komisiOwner: 24000, bayar: "Cash", status: "Proses" },
  { id: 3, invoice: "INV202601010", waktu: "2026-04-22 16:10", pelanggan: "Ibu Siti", jenis: "Waktu", rincian: "Sewa Sopir", driver: "Reza (03)", total: 250000, komisiOwner: 50000, bayar: "Transfer", status: "Pending" },
  { id: 4, invoice: "INV202601012", waktu: "2026-04-21 09:30", pelanggan: "PT. Maju Jaya", jenis: "Pikiran", rincian: "Konsultasi IT", driver: "Deni (04)", total: 500000, komisiOwner: 100000, bayar: "Transfer", status: "Selesai" },
  { id: 5, invoice: "INV202601015", waktu: "2026-04-21 11:15", pelanggan: "Reza Mahandika", jenis: "Jarak", rincian: "Antar Jemput Mobil", driver: "Ahmad (01)", total: 60000, komisiOwner: 12000, bayar: "QRIS", status: "Selesai" },
];

export default function OrderHistoryPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [orders, setOrders] = useState(initialOrders);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // FUNGSI EKSPOR EXCEL
  const exportToExcel = () => {
    const headers = ["No,Invoice,Waktu,Nama Pelanggan,Jenis Jasa,Rincian Jasa,Nama Driver,Total Bayar,Potongan Owner,Pembayaran,Status\n"];
    const rows = orders.map((o, index) => (
      `${index + 1},${o.invoice},${o.waktu},${o.pelanggan},${o.jenis},${o.rincian},${o.driver},${o.total},${o.komisiOwner},${o.bayar},${o.status}`
    )).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `Rekap_Pesanan_MTM_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-16 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER & ACTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Riwayat & Rekap Pesanan</h2>
          <p className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-1.5">
            <Info size={14} className="text-blue-500" /> Pantau dan unduh rekapan data operasional dalam format Excel.
          </p>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
        >
          <FileDown size={16} /> Unduh Excel
        </button>
      </div>

      {/* FILTER CONTROL BAR (Compact) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari Invoice atau Pelanggan..." 
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-medium"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap">
            <Calendar size={14} /> Filter Tanggal
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap">
            <Filter size={14} /> Semua Status
          </button>
        </div>
      </div>

      {/* DATA TABLE (COMPACT VIEW) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">No</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice / Waktu</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pelanggan</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jasa / Rincian</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Armada / Driver</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Bayar</th>
                <th className="px-4 py-3 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Owner</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order, index) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-4 py-3 text-[13px] font-medium text-slate-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-bold text-blue-600 hover:underline cursor-pointer">{order.invoice}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{order.waktu}</p>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-slate-700">{order.pelanggan}</td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase border border-slate-200 tracking-wider">{order.jenis}</span>
                    <p className="text-[12px] font-semibold text-slate-600 mt-1">{order.rincian}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">{order.driver}</td>
                  <td className="px-4 py-3 text-[13px] font-black text-slate-800 text-right">Rp {order.total.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-emerald-600 text-right">Rp {order.komisiOwner.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border inline-block ${
                      order.status === 'Selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      order.status === 'Proses' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Eye size={16} /></button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><MoreHorizontal size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION SIMPLE */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Menampilkan 1-5 dari 5 data</p>
          <div className="flex gap-1.5">
            <button className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 disabled:opacity-50 cursor-not-allowed"><ChevronLeft size={16} /></button>
            <button className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}