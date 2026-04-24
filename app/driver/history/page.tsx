"use client";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, RefreshCw,
  FileDown, Trash2, Filter
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";

export default function DriverHistoryPage() {
  const [driverCode, setDriverCode] = useState<string>("");
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) { setDriverCode(session); } else { window.location.href = "/"; }

    const fetchGlobalData = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "global"));
        if (docSnap.exists()) setSettings(docSnap.data());
      } catch (error) { console.error("Gagal menarik settings:", error); }
    };
    fetchGlobalData();
  }, []);

  const fetchHistory = async () => {
    if (!driverCode) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/driver/orders?driverCode=${driverCode}`);
      const result = await res.json();
      if (result.success) { setOrders(result.data); }

      const resProfile = await fetch("/api/drivers");
      const resultProfile = await resProfile.json();
      if (resultProfile.success) {
        const me = resultProfile.data.find((d: any) => d.code === driverCode);
        if (me) setDriverProfile(me);
      }
    } catch (error) { console.error("Gagal menarik data riwayat:", error); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, [driverCode]);

  // HELPER TANGGAL AMAN (ANTI CRASH - MENGGUNAKAN TEKS BIASA)
  const formatDateTime = (dateString: any) => {
    if (!dateString) return "Data Lama";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Data Lama";
    
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const calculateDriverIncome = (order: any) => {
    const baseJasa = Number(order.basePrice) || Number(order.totalPrice) || 0;
    const tier = order.commissionTier || 'sedang';
    let driverPct = 0.80; 
    if (tier === 'ringan') driverPct = 0.70; 
    if (tier === 'berat') driverPct = 0.90;  
    return (baseJasa * driverPct) + (Number(order.shoppingCost) || 0) + (Number(order.urgentFee) || 0);
  };

  // LOGIKA FILTER TANGGAL ANTI-CRASH
  const filteredHistory = orders.filter(order => {
    const isHistoryStatus = order.status === "completed" || order.status === "cancelled";
    const matchSearch = order.invoice?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        order.serviceName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchDate = true;
    if (filterDate) {
      if (order.createdAt) {
        const dateObj = new Date(order.createdAt);
        if (!isNaN(dateObj.getTime())) {
          const orderDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          matchDate = orderDateStr === filterDate;
        } else { matchDate = false; }
      } else { matchDate = false; }
    }
    return isHistoryStatus && matchSearch && matchDate;
  });

  const handleResetHistory = async () => {
    if (filteredHistory.length === 0) return;
    if (confirm("Hapus permanen semua riwayat yang tampil saat ini?")) {
      setIsDeleting(true);
      try {
        for (const order of filteredHistory) { await deleteDoc(doc(db, "orders", order.id)); }
        alert("Riwayat berhasil dibersihkan!");
        fetchHistory();
      } catch (error) { alert("Gagal menghapus."); } finally { setIsDeleting(false); }
    }
  };

  const handleGenerateInvoice = async (order: any) => {
    if (!settings) return;
    setIsGeneratingPDF(order.id);
    try {
      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      const baseJasa = Number(order.basePrice) || Number(order.totalPrice) || 0;
      const numTalangan = Number(order.shoppingCost) || 0;
      const urgentFee = Number(order.urgentFee) || 0;
      const currentTotal = baseJasa + numTalangan + urgentFee;

      // Gunakan tanggal saat ini jika data lama tidak punya createdAt
      const displayDate = order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
        ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(order.createdAt))
        : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

      const invoiceElement = document.createElement("div");
      invoiceElement.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:800px;background:white;color:#1e293b;font-family:Arial;padding:40px;";
      invoiceElement.innerHTML = `
        <div style="text-align:center;margin-bottom:30px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;">
          ${settings.companyInfo?.logoUrl ? `<img src="${settings.companyInfo.logoUrl}" style="height:60px;margin-bottom:10px;object-fit:contain;" crossorigin="anonymous"/>` : ''}
          <h1 style="font-size:32px;font-weight:900;margin:0;">${settings.companyInfo?.name || 'MTM APP'}</h1>
          <p style="font-size:14px;color:#64748b;letter-spacing:4px;margin-top:5px;">INVOICE TAGIHAN LAYANAN</p>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
          <div>
            <p style="font-size:14px;color:#64748b;margin:0 0 5px 0;">Ditagihkan Kepada:</p>
            <h2 style="font-size:20px;font-weight:bold;margin:0;">${order.customerName}</h2>
            <p style="font-size:14px;margin:5px 0 0 0;">${order.customerPhone}</p>
            <p style="font-size:14px;margin:5px 0 0 0;max-width:300px;">Alamat: ${order.customerAddress || "-"}</p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:14px;color:#64748b;margin:0 0 5px 0;">Nomor Invoice:</p>
            <h2 style="font-size:20px;font-weight:bold;color:#2563eb;margin:0;">${order.invoice}</h2>
            <p style="font-size:14px;margin:5px 0 0 0;">Tanggal: ${displayDate}</p>
          </div>
        </div>
        <div style="background-color:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:30px;">
          <h3 style="font-size:16px;margin:0 0 10px 0;border-bottom:1px solid #cbd5e1;padding-bottom:5px;">INFO DRIVER PENGANTAR</h3>
          <div style="display:flex;justify-content:space-between;font-size:14px;">
            <div>Nama: <strong>${driverProfile?.name || driverCode}</strong></div>
            <div>Kontak: <strong>${driverProfile?.phone || "-"}</strong></div>
            <div>Plat: <strong>${driverProfile?.vehicle || "-"}</strong></div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
          <tr style="background-color:#f1f5f9;border-bottom:2px solid #cbd5e1;">
            <th style="padding:10px;text-align:left;">DESKRIPSI JASA</th>
            <th style="padding:10px;text-align:right;">QTY</th>
            <th style="padding:10px;text-align:right;">TARIF</th>
            <th style="padding:10px;text-align:right;">SUBTOTAL</th>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:15px 10px;font-weight:bold;">${order.serviceName}<div style="font-size:12px;font-weight:normal;color:#64748b;">Ongkos Kirim / Jasa</div></td>
            <td style="padding:15px 10px;text-align:right;">${order.quantity || 1} ${order.unit || 'Pcs'}</td>
            <td style="padding:15px 10px;text-align:right;">Rp ${baseJasa.toLocaleString('id-ID')}</td>
            <td style="padding:15px 10px;text-align:right;font-weight:bold;">Rp ${baseJasa.toLocaleString('id-ID')}</td>
          </tr>
          ${numTalangan > 0 ? `<tr><td style="padding:15px 10px;font-weight:bold;color:#e11d48;">Talangan Barang</td><td style="padding:15px 10px;text-align:right;">1 Lumpsum</td><td style="padding:15px 10px;text-align:right;">Rp ${numTalangan.toLocaleString('id-ID')}</td><td style="padding:15px 10px;text-align:right;font-weight:bold;color:#e11d48;">Rp ${numTalangan.toLocaleString('id-ID')}</td></tr>` : ''}
          ${urgentFee > 0 ? `<tr><td style="padding:15px 10px;font-weight:bold;color:#d97706;">Biaya Urgent</td><td style="padding:15px 10px;text-align:right;">1 Lumpsum</td><td style="padding:15px 10px;text-align:right;">Rp ${urgentFee.toLocaleString('id-ID')}</td><td style="padding:15px 10px;text-align:right;font-weight:bold;color:#d97706;">Rp ${urgentFee.toLocaleString('id-ID')}</td></tr>` : ''}
        </table>
        <div style="display:flex;justify-content:flex-end;margin-bottom:40px;">
          <div style="background-color:#f8fafc;padding:15px 30px;border-radius:8px;border:1px solid #cbd5e1;min-width:300px;">
            <div style="display:flex;justify-content:space-between;font-size:16px;align-items:center;">
              <span>Total Tagihan</span><strong style="font-size:24px;">Rp ${currentTotal.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(invoiceElement);
      const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      document.body.removeChild(invoiceElement);
      pdf.save(`Struk_${order.invoice}.pdf`);
    } catch (e) { alert("Gagal."); } finally { setIsGeneratingPDF(null); }
  };

  return (
    <div className="max-w-[1000px] mx-auto animate-in fade-in duration-500 pb-10 px-2 md:px-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 mt-2">
            <ClipboardList className="text-blue-600" size={24} /> Riwayat Pesanan
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Catatan rincian tugas dan pendapatan yang diselesaikan.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={fetchHistory} disabled={isLoading || isDeleting} className="flex-1 md:flex-none p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 text-xs font-bold">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={handleResetHistory} disabled={isLoading || isDeleting || filteredHistory.length === 0} className="flex-1 md:flex-none p-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 text-xs font-bold">
            <Trash2 size={16} /> Reset
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari ID Invoice..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white transition-all text-sm font-medium" />
        </div>
        <div className="relative w-full md:w-48 shrink-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white transition-all text-sm font-medium cursor-pointer" />
        </div>
      </div>

      {isLoading || isDeleting ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <RefreshCw size={36} className="text-blue-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-500">Menyinkronkan Riwayat...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center opacity-70 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <ClipboardList size={48} className="text-slate-300 mb-4" />
          <h4 className="font-bold text-slate-600 mb-1">Tidak Ada Data</h4>
          <p className="text-xs text-slate-500 max-w-[250px]">Atur ulang filter atau cari ID lain.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((order) => (
            <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors relative overflow-hidden group">
              <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${order.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              <div className="flex justify-between items-start mb-3 pl-2">
                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase">{order.invoice}</span>
                  <span className="text-[10px] md:text-xs font-semibold text-slate-500 flex items-center gap-1"><Calendar size={12}/> {formatDateTime(order.createdAt)}</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{order.status === 'completed' ? 'SELESAI' : 'BATAL'}</span>
              </div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4 pl-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base leading-snug">{order.serviceName}</h3>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase">{order.category}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 md:text-right min-w-[140px]">
                  <span className="text-[9px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">Net Income</span>
                  <span className={`font-bold text-base md:text-lg ${order.status === 'completed' ? 'text-emerald-600' : 'text-slate-300 line-through'}`}>Rp {calculateDriverIncome(order).toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 pl-2">
                <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 line-clamp-1 flex-1">
                  <MapPin size={12} className="text-blue-500 shrink-0" /> {order.origin || 'Selesai dikerjakan'} {order.destination && <><span className="text-slate-300">➔</span> {order.destination}</>}
                </p>
                {order.status === 'completed' && (
                  <button onClick={() => handleGenerateInvoice(order)} disabled={isGeneratingPDF === order.id} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 text-xs font-bold rounded-lg transition-all active:scale-95">
                    {isGeneratingPDF === order.id ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />} Struk
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}