"use client";
import { useState, useEffect } from "react";
import { 
  Search, FileDown, Filter, ChevronLeft, ChevronRight, 
  Info, Clock, Camera, X, Trash2, XCircle, Send, MapPin, Map
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function OrderHistoryPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [proofModal, setProofModal] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const resOrders = await fetch("/api/orders");
      const resultOrders = await resOrders.json();
      if (resultOrders.success) setOrders(resultOrders.data);

      const resDrivers = await fetch("/api/drivers");
      const resultDrivers = await resDrivers.json();
      if (resultDrivers.success) setDrivers(resultDrivers.data);

      const docSnap = await getDoc(doc(db, "settings", "global"));
      if (docSnap.exists()) setSettings(docSnap.data());
    } catch (error) {
      console.error("Gagal menarik data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchAllData(); 
  }, []);

  const formatDateSafe = (dateString: any) => {
    const fallbackDate = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date());

    if (!dateString) return fallbackDate;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return fallbackDate; 
    
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

  const getOwnerComm = (order: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier || 'sedang';
    if (tier === 'ringan') return base * 0.30;
    if (tier === 'sedang') return base * 0.20;
    if (tier === 'berat') return base * 0.10;
    return 0;
  };

  const getDriverNet = (order: any) => {
    const ownerComm = getOwnerComm(order);
    const base = getSubtotalJasa(order);
    const urgent = Number(order.urgentFee) || 0;
    return (base - ownerComm) + urgent;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-amber-50 text-amber-600 border-amber-100">Menunggu</span>;
      case 'active': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-blue-50 text-blue-600 border-blue-100">Proses</span>;
      case 'completed': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-emerald-50 text-emerald-600 border-emerald-100">Selesai</span>;
      case 'cancelled': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-rose-50 text-rose-600 border-rose-100">Batal</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[10px] uppercase font-bold">{status}</span>;
    }
  };

  const handleAssignDriver = async (orderId: string, driverCode: string) => {
    if (!driverCode) return;
    if (confirm(`Tugaskan pesanan ini kepada Driver ${driverCode}?`)) {
      try {
        await updateDoc(doc(db, "orders", orderId), { driverCode: driverCode, status: "active" });
        alert(`Driver ${driverCode} berhasil ditugaskan!`);
        fetchAllData();
      } catch (error) { alert("Gagal menugaskan driver."); }
    }
  };

  const handleCancelOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Batalkan pesanan ${invoiceId}?`)) {
      try {
        await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
        alert(`Pesanan ${invoiceId} berhasil dibatalkan.`);
        fetchAllData();
      } catch (error) { alert("Terjadi kesalahan."); }
    }
  };

  const handleDeleteOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Hapus permanen pesanan ${invoiceId} dari database?`)) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
        alert(`Pesanan ${invoiceId} berhasil dihapus permanen.`);
        fetchAllData(); 
      } catch (error) { alert("Terjadi kesalahan menghapus."); }
    }
  };

  const handleGenerateInvoice = async (order: any) => {
    if (!settings) return alert("Sedang memuat pengaturan, mohon klik lagi sebentar lagi...");
    setIsGeneratingPDF(order.id);
    
    try {
      const targetDriver = drivers.find(d => d.code === order.driverCode);
      const driverName = targetDriver ? targetDriver.name : "Belum Ditugaskan";
      const driverPhone = targetDriver ? targetDriver.phone : "-";
      const driverVehicle = targetDriver ? targetDriver.vehicle : "-";

      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      
      const unitPrice = getUnitPrice(order);
      const subtotalJasa = getSubtotalJasa(order);
      const shoppingCost = Number(order.shoppingCost) || 0;
      const urgentFee = Number(order.urgentFee) || 0;
      const currentTotal = subtotalJasa + shoppingCost + urgentFee;

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
            <p style="font-size: 14px; margin: 5px 0 0 0;">Tanggal: ${formatDateSafe(order.createdAt)}</p>
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
            ${shoppingCost > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-size: 15px; font-weight: bold; color: #e11d48;">Harga Barang Belanjaan (Talangan)</td>
              <td style="padding: 15px 10px; text-align: right;">1 Lumpsum</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${shoppingCost.toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #e11d48;">Rp ${shoppingCost.toLocaleString('id-ID')}</td>
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
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(invoiceElement);
      pdf.save(`Invoice_${order.invoice}.pdf`);

    } catch (error) {
      alert("Gagal memproses PDF Invoice.");
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchSearch = order.invoice?.toLowerCase().includes(searchTerm.toLowerCase()) || order.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    let targetStatus = "semua";
    if (statusFilter === "Selesai") targetStatus = "completed";
    if (statusFilter === "Proses") targetStatus = "active";
    if (statusFilter === "Menunggu") targetStatus = "pending";
    if (statusFilter === "Batal") targetStatus = "cancelled";

    const matchStatus = statusFilter === "Semua" || order.status === targetStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const exportToExcel = () => {
    if (filteredOrders.length === 0) return alert("Tidak ada data untuk diekspor!");
    const headers = ["No,Invoice,Waktu,Nama Pelanggan,Layanan,Catatan/Detail,Armada,Total Ongkir,Talangan Barang,Jatah Driver,Komisi Owner,Total Tagihan,Metode Bayar,Status\n"];
    
    const rows = filteredOrders.map((o, index) => {
      const wkt = formatDateSafe(o.createdAt).replace(/,/g, ''); 
      const ownerComm = getOwnerComm(o);
      const driverNet = getDriverNet(o);
      const subtotalJasa = getSubtotalJasa(o);
      const belanja = Number(o.shoppingCost) || 0;
      const urgentFee = Number(o.urgentFee) || 0;
      const currentTotal = subtotalJasa + belanja + urgentFee;

      const detailAman = o.serviceDetails ? `"${o.serviceDetails.replace(/"/g, '""')}"` : "-";
      const layananAman = o.serviceName ? `"${o.serviceName.replace(/"/g, '""')}"` : "-";
      const namaAman = o.customerName ? `"${o.customerName.replace(/"/g, '""')}"` : "-";

      return `${index + 1},${o.invoice},${wkt},${namaAman},${layananAman},${detailAman},${o.driverCode || 'Kosong'},${subtotalJasa},${belanja},${driverNet},${ownerComm},${currentTotal},${o.paymentMethod},${o.status}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `Rekap_Keuangan_MTM_${new Date().toLocaleDateString('id-ID')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-16 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Riwayat & Keuangan Pesanan</h2>
          <p className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-1.5">
            <Info size={14} className="text-blue-500" /> Pantau rincian biaya, pendapatan driver, komisi, serta unduh data ke Excel.
          </p>
        </div>
        <button onClick={exportToExcel} disabled={isLoading || filteredOrders.length === 0} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 text-sm">
          <FileDown size={16} /> Unduh Excel Laporan
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari Invoice atau Pelanggan..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-medium" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-50 outline-none cursor-pointer">
            <option value="Semua">Semua Status</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Proses">Proses</option>
            <option value="Selesai">Selesai</option>
            <option value="Batal">Batal</option>
          </select>
          <button onClick={fetchAllData} className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-[13px] font-medium text-blue-600 hover:bg-blue-100 whitespace-nowrap active:scale-95 transition-all">
             Refresh Data
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Invoice / Waktu</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Layanan & Detail</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Armada</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rincian Tagihan</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pendapatan</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center">Bukti / Aksi</th>
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
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Search size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Pesanan tidak ditemukan.</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const subtotalJasa = getSubtotalJasa(order);
                  const currentShopping = Number(order.shoppingCost) || 0;
                  const currentUrgent = Number(order.urgentFee) || 0;
                  const realTotal = subtotalJasa + currentShopping + currentUrgent;

                  return (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group align-top">
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-500">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-bold text-blue-600">{order.invoice}</span>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">{formatDateSafe(order.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-bold text-slate-700">{order.customerName}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">{order.customerPhone}</p>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-normal min-w-[240px] max-w-[300px]">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase border border-slate-200 tracking-wider mb-1 inline-block">
                        {order.category}
                      </span>
                      <p className="text-[12px] font-bold text-slate-800 leading-snug">{order.serviceName}</p>
                      
                      {order.serviceDetails ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed whitespace-pre-wrap shadow-sm">
                          <span className="font-bold text-amber-900 block mb-0.5 border-b border-amber-200/50 pb-0.5">Catatan/Detail:</span>
                          {order.serviceDetails}
                        </div>
                      ) : (
                        <div className="mt-1.5 p-1.5 bg-slate-50 border border-slate-100 rounded-md text-[10px] text-slate-400 italic flex items-center gap-1 w-max">
                          <Info size={12} /> Tidak ada catatan
                        </div>
                      )}

                      {/* ================================================= */}
                      {/* LOKASI DARI & KE DENGAN TAMPILAN RAPI */}
                      {/* ================================================= */}
                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
                        {order.origin && (
                          <div className="flex items-start gap-1.5">
                            <div className="p-1 bg-blue-50 text-blue-500 rounded mt-0.5 shrink-0"><MapPin size={10} /></div>
                            <div className="w-full leading-tight">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Dari</p>
                              <p className="text-[11px] font-semibold text-slate-700 line-clamp-2">{order.origin}</p>
                            </div>
                          </div>
                        )}
                        {order.destination && (
                          <div className="flex items-start gap-1.5 relative">
                            {order.origin && <div className="absolute left-[9px] -top-2 bottom-4 w-px border-l border-dashed border-slate-300"></div>}
                            <div className="p-1 bg-rose-50 text-rose-500 rounded mt-0.5 shrink-0 z-10"><Map size={10} /></div>
                            <div className="w-full leading-tight">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Ke</p>
                              <p className="text-[11px] font-semibold text-slate-700 line-clamp-2">{order.destination}</p>
                            </div>
                          </div>
                        )}
                        {(!order.origin && !order.destination) && order.customerAddress && (
                          <div className="flex items-start gap-1.5">
                            <div className="p-1 bg-slate-100 text-slate-500 rounded mt-0.5 shrink-0"><MapPin size={10} /></div>
                            <div className="w-full leading-tight">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Alamat</p>
                              <p className="text-[11px] font-semibold text-slate-700 line-clamp-2">{order.customerAddress}</p>
                            </div>
                          </div>
                        )}
                      </div>

                    </td>
                    
                    <td className="px-4 py-3 text-[12px] font-medium">
                      {order.driverCode ? (
                        <span className="text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">{order.driverCode}</span>
                      ) : (
                        <select 
                          onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                          className="w-full max-w-[120px] px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[11px] font-bold outline-none cursor-pointer"
                        >
                          <option value="">Belum Ada</option>
                          {drivers.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                        </select>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-[11px] flex flex-col gap-1 w-36">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Jasa ({order.quantity || 1}x):</span> 
                          <span className="text-slate-700 font-medium">Rp {subtotalJasa.toLocaleString('id-ID')}</span>
                        </div>
                        {currentShopping > 0 && (
                          <div className="flex justify-between text-rose-600">
                            <span>Talangan:</span> 
                            <span className="font-medium">Rp {currentShopping.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        {currentUrgent > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>Urgent:</span> 
                            <span className="font-medium">Rp {currentUrgent.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold mt-0.5 pt-1 border-t border-slate-200">
                          <span className="text-slate-600">Total:</span> 
                          <span className="text-slate-800">Rp {realTotal.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-[11px] flex flex-col gap-1 w-32">
                        <div className="flex justify-between text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          <span>Driver:</span> 
                          <span className="font-bold">Rp {getDriverNet(order).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <span>Owner:</span> 
                          <span className="font-bold">Rp {getOwnerComm(order).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5 w-16 mx-auto">
                        {order.proofUrl && (
                          <button onClick={() => setProofModal(order.proofUrl)} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded transition-all shadow-sm">
                            <Camera size={14} />
                          </button>
                        )}
                        {(order.status === 'pending' || order.status === 'active') && (
                          <button onClick={() => handleCancelOrder(order.id, order.invoice)} className="p-1.5 text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 hover:text-amber-700 rounded transition-all shadow-sm">
                            <XCircle size={14} />
                          </button>
                        )}
                        {(order.status === 'completed' || order.status === 'cancelled') && (
                          <button onClick={() => handleDeleteOrder(order.id, order.invoice)} className="p-1.5 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 rounded transition-all shadow-sm">
                            <Trash2 size={14} />
                          </button>
                        )}
                        {(order.status === 'active' || order.status === 'completed') && (
                          <button onClick={() => handleGenerateInvoice(order)} disabled={isGeneratingPDF === order.id} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 rounded transition-all shadow-sm disabled:opacity-50">
                            {isGeneratingPDF === order.id ? <Clock size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
            Menampilkan {filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredOrders.length)} dari {filteredOrders.length} data
          </p>
          <div className="flex gap-1.5 items-center">
            <span className="text-[11px] font-medium text-slate-500 mr-2">Halaman {currentPage} / {totalPages || 1}</span>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {proofModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-3 rounded-2xl shadow-2xl max-w-sm w-full relative">
            <button onClick={() => setProofModal(null)} className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-md hover:bg-rose-600 transition-colors active:scale-95 z-10"><X size={18} strokeWidth={3} /></button>
            <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center min-h-[300px]">
              <img src={proofModal} alt="Bukti Selesai" className="w-full h-auto max-h-[60vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}