"use client";
import { useState, useEffect } from "react";
import { 
  Search, FileDown, Filter, ChevronLeft, ChevronRight, 
  Info, Clock, Camera, X
} from "lucide-react";

export default function OrderHistoryPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // STATE UNTUK DATA BACKEND
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // STATE UNTUK PENCARIAN, FILTER & PAGINATION
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // STATE UNTUK MODAL FOTO BUKTI
  const [proofModal, setProofModal] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/orders");
      const result = await res.json();
      if (result.success) {
        setOrders(result.data);
      }
    } catch (error) {
      console.error("Gagal menarik data pesanan:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchOrders(); 
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const getOwnerCommission = (tier: string, total: number) => {
    if (tier === 'ringan') return total * 0.30; 
    if (tier === 'sedang') return total * 0.20; 
    if (tier === 'berat') return total * 0.10;  
    return 0;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase border inline-block bg-amber-50 text-amber-600 border-amber-100">Menunggu</span>;
      case 'active': return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase border inline-block bg-blue-50 text-blue-600 border-blue-100">Proses</span>;
      case 'completed': return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase border inline-block bg-emerald-50 text-emerald-600 border-emerald-100">Selesai</span>;
      case 'cancelled': return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase border inline-block bg-rose-50 text-rose-600 border-rose-100">Batal</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] uppercase">{status}</span>;
    }
  };

  // LOGIKA PENCARIAN & FILTER STATUS
  const filteredOrders = orders.filter(order => {
    const matchSearch = order.invoice?.toLowerCase().includes(searchTerm.toLowerCase()) || order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Konversi status filter (karena di DB pakai lowercase bahasa Inggris)
    let targetStatus = "semua";
    if (statusFilter === "Selesai") targetStatus = "completed";
    if (statusFilter === "Proses") targetStatus = "active";
    if (statusFilter === "Menunggu") targetStatus = "pending";

    const matchStatus = statusFilter === "Semua" || order.status === targetStatus;
    
    return matchSearch && matchStatus;
  });

  // LOGIKA PAGINATION
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Jika sedang mencari/filter, kembalikan ke halaman 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const exportToExcel = () => {
    if (filteredOrders.length === 0) return alert("Tidak ada data untuk diekspor!");
    const headers = ["No,Invoice,Waktu,Nama Pelanggan,Jenis Jasa,Rincian Jasa,Kode Driver,Total Bayar,Potongan Owner,Pembayaran,Status,Link Foto Bukti\n"];
    const rows = filteredOrders.map((o, index) => {
      const wkt = formatDate(o.createdAt).replace(/,/g, ''); 
      const komisi = getOwnerCommission(o.commissionTier, o.totalPrice);
      const linkFoto = o.proofUrl ? o.proofUrl : "Tidak Ada";
      return `${index + 1},${o.invoice},${wkt},${o.customerName},${o.category},${o.serviceName},${o.driverCode || 'Belum Ada'},${o.totalPrice},${komisi},${o.paymentMethod},${o.status},${linkFoto}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `Rekap_Pesanan_MTM_${new Date().toLocaleDateString('id-ID')}.csv`);
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
          disabled={isLoading || filteredOrders.length === 0}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
        >
          <FileDown size={16} /> Unduh Excel
        </button>
      </div>

      {/* FILTER CONTROL BAR */}
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
          
          {/* FILTER STATUS AKTIF */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50 outline-none cursor-pointer"
          >
            <option value="Semua">Semua Status</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Proses">Proses</option>
            <option value="Selesai">Selesai</option>
          </select>

          <button onClick={fetchOrders} className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-[13px] font-bold text-blue-600 hover:bg-blue-100 whitespace-nowrap active:scale-95 transition-all">
             Refresh Data
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
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
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Clock size={28} className="animate-spin text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Memuat data dari database...</p>
                  </td>
                </tr>
              ) : 
              
              paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Search size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Pesanan tidak ditemukan.</p>
                  </td>
                </tr>
              ) : 
              
              (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Hitung nomor urut yang benar berdasarkan halaman */}
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-400">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-bold text-blue-600">{order.invoice}</span>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-bold text-slate-700">{order.customerName}</p>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">{order.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase border border-slate-200 tracking-wider mb-1 inline-block">{order.category}</span>
                      <p className="text-[12px] font-semibold text-slate-600 truncate max-w-[150px]">{order.serviceName}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                      {order.driverCode ? `Driver (${order.driverCode})` : <span className="text-slate-400 italic">Belum Ada</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-black text-slate-800 text-right">
                      Rp {order.totalPrice?.toLocaleString('id-ID')}
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{order.paymentMethod}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-bold text-emerald-600 text-right">
                      Rp {getOwnerCommission(order.commissionTier, order.totalPrice).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.proofUrl ? (
                        <button 
                          onClick={() => setProofModal(order.proofUrl)}
                          className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-all shadow-sm mx-auto flex"
                          title="Lihat Bukti Foto"
                        >
                          <Camera size={16} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION DINAMIS */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Menampilkan {filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredOrders.length)} dari {filteredOrders.length} data
          </p>
          <div className="flex gap-1.5 items-center">
            <span className="text-xs font-bold text-slate-400 mr-2">Halaman {currentPage} / {totalPages || 1}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL POP-UP FOTO */}
      {proofModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-3 rounded-2xl shadow-2xl max-w-sm w-full relative">
            <button 
              onClick={() => setProofModal(null)}
              className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-md hover:bg-rose-600 transition-colors active:scale-95 z-10"
            >
              <X size={18} strokeWidth={3} />
            </button>
            <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center min-h-[300px]">
              <img src={proofModal} alt="Bukti Selesai" className="w-full h-auto max-h-[60vh] object-contain" />
            </div>
            <p className="text-center text-[13px] font-bold text-slate-600 mt-3 mb-1">
              📸 Bukti Penyelesaian Tugas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}