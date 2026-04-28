"use client";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, RefreshCw,
  FileDown, Trash2, Filter, Wallet, ShieldCheck, Map, ArrowRight,
  ShoppingCart
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

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
  const [quickFilter, setQuickFilter] = useState("Semua"); 

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

  // FUNGSI PENGAMAN WAKTU AGAR TIDAK CRASH
  const formatTimeSafe = (dateString: any) => {
    if (!dateString) return "--:--";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--:--";
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const formatDateTime = (dateString: any) => {
    if (!dateString) return "Data Lama";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Data Lama";
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const getSubtotalJasa = (order: any) => {
    const qty = Number(order.quantity) || 1;
    if (order.basePrice) {
      return Number(order.basePrice) * qty; 
    }
    const total = Number(order.totalPrice) || 0;
    const shopping = Number(order.shoppingCost) || 0;
    const urgent = Number(order.urgentFee) || 0;
    const calc = total - shopping - urgent;
    return calc > 0 ? calc : total;
  };

  const getUnitPrice = (order: any) => {
    if (order.basePrice) return Number(order.basePrice);
    const sub = getSubtotalJasa(order);
    const qty = Number(order.quantity) || 1;
    return sub / qty;
  };

  const calculateDriverIncome = (order: any) => {
    const baseJasa = getSubtotalJasa(order);
    const tier = order.commissionTier || 'sedang';
    let driverPct = 0.80; 
    if (tier === 'ringan') driverPct = 0.70; 
    if (tier === 'sedang') driverPct = 0.80; 
    if (tier === 'berat') driverPct = 0.90;  
    return (baseJasa * driverPct) + (Number(order.urgentFee) || 0); 
  };

  // ========================================================
  // KALKULASI SALDO KESELURUHAN (TIDAK TERPENGARUH FILTER)
  // ========================================================
  const myCompletedOrders = orders.filter(o => o.status === 'completed');
  const totalHistoricalIncome = myCompletedOrders.reduce((sum, order) => sum + calculateDriverIncome(order), 0);
  const totalHistoricalReimburse = myCompletedOrders.reduce((sum, order) => sum + (Number(order.shoppingCost) || 0), 0);
  const totalHistoricalJobs = myCompletedOrders.length;

  const filteredHistory = orders.filter(order => {
    if (order.hiddenByDriver) return false;

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

    let matchQuick = true;
    if (quickFilter === "Selesai") matchQuick = order.status === "completed";
    if (quickFilter === "Batal") matchQuick = order.status === "cancelled";

    return isHistoryStatus && matchSearch && matchDate && matchQuick;
  });

  const groupedHistory = filteredHistory.reduce((acc, order) => {
    const dateStr = order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(order.createdAt))
      : "Data Terdahulu";
    
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(order);
    return acc;
  }, {} as Record<string, any[]>);

  const handleResetHistory = async () => {
    if (filteredHistory.length === 0) return;
    if (confirm("Sembunyikan daftar riwayat ini dari HP Anda?\n\n(Tenang, ini tidak akan menghapus data di sistem pusat Admin)")) {
      setIsDeleting(true);
      try {
        for (const order of filteredHistory) { 
          await updateDoc(doc(db, "orders", order.id), { hiddenByDriver: true }); 
        }
        alert("Riwayat berhasil dibersihkan dari layar Anda!");
        fetchHistory();
      } catch (error) { 
        alert("Gagal menyembunyikan riwayat."); 
      } finally { 
        setIsDeleting(false); 
      }
    }
  };

  const handleGenerateInvoice = async (order: any) => {
    if (!settings) return alert("Menunggu pengaturan, silakan coba lagi...");
    setIsGeneratingPDF(order.id);
    
    try {
      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      
      const unitPrice = getUnitPrice(order);
      const subtotalJasa = getSubtotalJasa(order);
      const numTalangan = Number(order.shoppingCost) || 0;
      const urgentFee = Number(order.urgentFee) || 0;
      const currentTotal = subtotalJasa + numTalangan + urgentFee;

      const driverName = driverProfile?.name || driverCode;
      const driverPhone = driverProfile?.phone || "-";
      const driverVehicle = driverProfile?.vehicle || "-";

      const displayDate = order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
        ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(order.createdAt))
        : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

      const invoiceElement = document.createElement("div");
      invoiceElement.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:800px;background:white;color:#1e293b;font-family:Arial, sans-serif;padding:40px;";
      
      invoiceElement.innerHTML = `
        ${config.showLogo ? `
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            ${settings.companyInfo?.logoUrl ? `<img src="${settings.companyInfo.logoUrl}" style="height: 60px; margin-bottom: 10px; object-fit: contain;" crossorigin="anonymous"/>` : ''}
            <h1 style="font-size: 32px; font-weight: 900; margin: 0;">${settings.companyInfo?.name || 'MTM APP'}</h1>
            <p style="font-size: 14px; color: #64748b; letter-spacing: 4px; margin-top: 5px;">INVOICE TAGIHAN LAYANAN</p>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <p style="font-size: 14px; color: #64748b; margin: 0 0 5px 0;">Ditagihkan Kepada:</p>
            <h2 style="font-size: 20px; font-weight: bold; margin: 0;">${order.customerName}</h2>
            <p style="font-size: 14px; margin: 5px 0 0 0;">${order.customerPhone}</p>
            <p style="font-size: 14px; margin: 5px 0 0 0; max-width: 300px;">Alamat: ${order.customerAddress || "-"}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 14px; color: #64748b; margin: 0 0 5px 0;">Nomor Invoice:</p>
            <h2 style="font-size: 20px; font-weight: bold; color: #2563eb; margin: 0;">${order.invoice}</h2>
            <p style="font-size: 14px; margin: 5px 0 0 0;">Tanggal: ${displayDate}</p>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
          <h3 style="font-size: 16px; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">INFO DRIVER / ARMADA PENGANTAR</h3>
          <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <div>Nama: <strong>${driverName}</strong></div><div>Kontak: <strong>${driverPhone}</strong></div><div>Plat: <strong>${driverVehicle}</strong></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px; text-align: left; font-size: 14px;">DESKRIPSI JASA</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">QTY/SATUAN</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">TARIF</th>
              <th style="padding: 10px; text-align: right; font-size: 14px;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-size: 15px; font-weight: bold;">
                ${order.serviceName} 
                ${order.serviceDetails ? `<div style="font-size: 12px; font-weight: normal; color: #475569; margin-top: 8px; white-space: pre-wrap; line-height: 1.5; padding: 10px; background-color: #fcfcfc; border-left: 3px solid #f59e0b; border-radius: 4px;"><strong>Catatan/Detail Pekerjaan:</strong><br/>${order.serviceDetails}</div>` : ''}
                <div style="font-size: 12px; font-weight: normal; color: #64748b; margin-top: 6px;">Ongkos Kirim / Tarif Jasa</div>
              </td>
              <td style="padding: 15px 10px; text-align: right; vertical-align: top;">${order.quantity || 1} ${order.unit || 'Pcs'}</td>
              <td style="padding: 15px 10px; text-align: right; vertical-align: top;">Rp ${(unitPrice).toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; vertical-align: top;">Rp ${(subtotalJasa).toLocaleString('id-ID')}</td>
            </tr>
            ${numTalangan > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-size: 15px; font-weight: bold; color: #e11d48;">Harga Barang Belanjaan (Talangan)</td>
              <td style="padding: 15px 10px; text-align: right;">1 Lumpsum</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${numTalangan.toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #e11d48;">Rp ${numTalangan.toLocaleString('id-ID')}</td>
            </tr>` : ''}
            ${urgentFee > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-weight: bold; color: #d97706;">Biaya Urgent / Prioritas</td>
              <td style="padding: 15px 10px; text-align: right;">1 Lumpsum</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${urgentFee.toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #d97706;">Rp ${urgentFee.toLocaleString('id-ID')}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="background-color: #f8fafc; padding: 15px 30px; border-radius: 8px; border: 1px solid #cbd5e1; min-width: 300px;">
            <div style="display: flex; justify-content: space-between; font-size: 16px; align-items: center;">
              <span>Total Tagihan</span><strong style="font-size: 24px;">Rp ${currentTotal.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
          <div style="flex: 1; display: flex; gap: 20px;">
            ${config.showBank ? `
              <div style="flex: 1;">
                <h4 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px;">TRANSFER BANK</h4>
                ${payInfo.banks && Array.isArray(payInfo.banks) ? payInfo.banks.map((bank:any) => `
                  <div style="margin-bottom: 10px;">
                    <p style="font-size: 14px; font-weight: bold; color: #2563eb; margin: 0;">${bank.bankName || 'BANK'} - ${bank.accountNumber || '-'}</p>
                    <p style="font-size: 12px; color: #475569; margin: 2px 0 0 0;">A/N: ${bank.accountName || '-'}</p>
                  </div>
                `).join('') : `
                  <div style="margin-bottom: 10px;">
                    <p style="font-size: 14px; font-weight: bold; color: #2563eb; margin: 0;">${payInfo.bankName || 'BANK'} - ${payInfo.accountNumber || '-'}</p>
                    <p style="font-size: 12px; color: #475569; margin: 2px 0 0 0;">A/N: ${payInfo.accountName || '-'}</p>
                  </div>
                `}
              </div>
            ` : ''}
            
            ${config.showQris ? `
              <div style="text-align: center;">
                <h4 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px;">SCAN QRIS</h4>
                ${payInfo.qrisUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payInfo.qrisUrl)}" style="width: 80px; height: 80px; border: 1px solid #ccc; padding: 5px; border-radius: 8px;" crossorigin="anonymous" />` : '<div style="font-size:12px; color:#94a3b8; border: 1px dashed #cbd5e1; padding: 20px;">Kosong</div>'}
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; padding-top: 10px; white-space: nowrap;">
            <p style="font-size: 12px; margin: 0 0 50px 0;">Salam Hormat,</p>
            <p style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #0f172a; display: inline-block; padding-bottom: 2px; margin: 0;">${config.signatureName || 'Manajemen MTM'}</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 5px; margin-bottom: 0;">${config.signatureRole || 'Penyedia Layanan'}</p>
          </div>
        </div>

        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px;">
          <p style="font-size: 11px; color: #94a3b8; font-style: italic; margin: 0;">"${config.footerNote || ''}"</p>
        </div>
      `;

      document.body.appendChild(invoiceElement);
      const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      document.body.removeChild(invoiceElement);
      pdf.save(`Struk_${order.invoice}.pdf`);

    } catch (e) { alert("Gagal memproses PDF Invoice."); } finally { setIsGeneratingPDF(null); }
  };

  return (
    <div className="max-w-[1000px] mx-auto animate-in fade-in duration-500 pb-10 px-2 md:px-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 mt-2">
            <ClipboardList className="text-blue-600" size={24} /> Riwayat Pesanan
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Pantau rincian tugas dan pendapatan historis Anda.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={fetchHistory} disabled={isLoading || isDeleting} className="flex-1 md:flex-none p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 text-xs font-bold">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KARTU STATISTIK KESELURUHAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-4 md:p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
          <p className="text-[10px] md:text-xs font-semibold text-blue-100 uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-1.5"><Wallet size={14} /> Total Saldo Jasa (Bersih)</p>
          <h3 className="text-xl md:text-3xl font-black">Rp {totalHistoricalIncome.toLocaleString('id-ID')}</h3>
          
          {/* UANG TALANGAN */}
          {totalHistoricalReimburse > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 mt-3 inline-block w-full max-w-[250px]">
              <p className="text-[9px] md:text-[10px] text-rose-300 uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><ShoppingCart size={12}/> Total Uang Talangan</p>
              <p className="text-sm md:text-base font-bold text-rose-100">Rp {totalHistoricalReimburse.toLocaleString('id-ID')}</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 md:mb-2 flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500"/> Total Tugas Selesai</p>
          <h3 className="text-xl md:text-3xl font-black text-slate-800">{totalHistoricalJobs} <span className="text-sm md:text-lg font-bold text-slate-400">Order</span></h3>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
          {['Semua', 'Selesai', 'Batal'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setQuickFilter(tab)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${quickFilter === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Cari ID / Nama Jasa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white transition-all text-sm font-medium" />
          </div>
          <div className="relative w-full md:w-40 shrink-0">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white transition-all text-sm font-medium cursor-pointer" />
          </div>
          <button 
            onClick={handleResetHistory} 
            disabled={isLoading || isDeleting || filteredHistory.length === 0} 
            className="w-full md:w-auto p-2.5 px-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 text-xs font-bold disabled:opacity-50"
          >
            <Trash2 size={16} /> Bersihkan Riwayat
          </button>
        </div>
      </div>

      {isLoading || isDeleting ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <RefreshCw size={36} className="text-blue-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-500">Memuat Riwayat...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center opacity-70 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <ClipboardList size={48} className="text-slate-300 mb-4" />
          <h4 className="font-bold text-slate-600 mb-1">Tidak Ada Data</h4>
          <p className="text-xs text-slate-500 max-w-[250px]">Riwayat kosong atau sudah dibersihkan dari layar ini.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedHistory).map((dateGroup, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                <Calendar size={14} /> {dateGroup}
              </h3>
              
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {groupedHistory[dateGroup].map((order: any) => (
                  <div key={order.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 absolute left-0 md:left-1/2 md:static">
                      {order.status === 'completed' ? <CheckCircle2 size={18} className="text-emerald-500"/> : <XCircle size={18} className="text-rose-500"/>}
                    </div>
                    
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] ml-auto md:ml-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase w-max">{order.invoice}</span>
                          <span className="text-[10px] font-semibold text-slate-400">{formatTimeSafe(order.createdAt)}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {order.status === 'completed' ? 'SELESAI' : 'BATAL'}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug">{order.serviceName}</h3>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase">{order.category}</p>
                      </div>

                      {(order.origin || order.destination || order.customerAddress) && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 space-y-2 relative">
                          {order.origin && (
                            <div className="flex gap-2">
                              <MapPin size={14} className="text-blue-500 shrink-0 mt-0.5" />
                              <p className="text-[10px] font-medium text-slate-600 line-clamp-1">{order.origin}</p>
                            </div>
                          )}
                          {order.destination && (
                            <div className="flex gap-2">
                              {order.origin && <div className="absolute left-[16px] top-6 bottom-5 w-px border-l-2 border-dashed border-slate-300"></div>}
                              <Map size={14} className="text-rose-500 shrink-0 mt-0.5" />
                              <p className="text-[10px] font-medium text-slate-600 line-clamp-1">{order.destination}</p>
                            </div>
                          )}
                          {(!order.origin && !order.destination) && order.customerAddress && (
                            <div className="flex gap-2">
                              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                              <p className="text-[10px] font-medium text-slate-600 line-clamp-1">{order.customerAddress}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[9px] font-semibold text-slate-400 block mb-0.5 uppercase tracking-wider">Pendapatan Bersih</span>
                          <span className={`font-bold text-lg ${order.status === 'completed' ? 'text-emerald-600' : 'text-slate-300 line-through'}`}>Rp {calculateDriverIncome(order).toLocaleString('id-ID')}</span>
                        </div>
                        {order.status === 'completed' && (
                          <button onClick={() => handleGenerateInvoice(order)} disabled={isGeneratingPDF === order.id} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-lg transition-all active:scale-95" title="Lihat Struk">
                            {isGeneratingPDF === order.id ? <RefreshCw size={18} className="animate-spin" /> : <FileDown size={18} />} 
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}