"use client";
import { useState, useEffect } from "react";
import { 
  Search, FileDown, Filter, ChevronLeft, ChevronRight, 
  Info, Clock, Camera, X, Trash2, XCircle, Send
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
  const [settings, setSettings] = useState<any>(null); // State Settings Ditambahkan
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [proofModal, setProofModal] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  // FETCH ORDERS + DRIVERS + SETTINGS
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
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

  const handleCancelOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Batalkan pesanan ${invoiceId}? Driver yang ditugaskan akan kehilangan orderan ini.`)) {
      try {
        await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
        alert(`Pesanan ${invoiceId} berhasil dibatalkan.`);
        fetchAllData();
      } catch (error) {
        alert("Terjadi kesalahan saat membatalkan pesanan.");
      }
    }
  };

  const handleDeleteOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Hapus permanen pesanan ${invoiceId} dari database? Data yang dihapus tidak dapat dikembalikan.`)) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
        alert(`Pesanan ${invoiceId} berhasil dihapus permanen.`);
        fetchAllData(); 
      } catch (error) {
        alert("Terjadi kesalahan saat menghapus data.");
      }
    }
  };

  // ==========================================================
  // LOGIKA CETAK PDF MENGGUNAKAN ARIAL & BARCODE QRIS
  // ==========================================================
  const handleGenerateInvoice = async (order: any) => {
    if (!settings) {
      alert("Sedang memuat pengaturan dari database, mohon klik lagi sebentar lagi...");
      return;
    }
    setIsGeneratingPDF(order.id);
    
    try {
      const targetDriver = drivers.find(d => d.code === order.driverCode);
      const driverName = targetDriver ? targetDriver.name : "Belum Ditugaskan";
      const driverPhone = targetDriver ? targetDriver.phone : "-";
      const driverVehicle = targetDriver ? targetDriver.vehicle : "-";

      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};

      const invoiceElement = document.createElement("div");
      invoiceElement.style.position = "absolute";
      invoiceElement.style.left = "-9999px";
      invoiceElement.style.top = "-9999px";
      invoiceElement.style.width = "800px"; 
      invoiceElement.style.backgroundColor = "white";
      invoiceElement.style.color = "#1e293b";
      invoiceElement.style.fontFamily = "Arial, sans-serif"; // <-- MENGGUNAKAN FONT ARIAL
      invoiceElement.style.padding = "40px";
      
      invoiceElement.innerHTML = `
        ${config.showLogo ? `
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            ${settings.companyInfo?.logoUrl ? `<img src="${settings.companyInfo.logoUrl}" style="height: 60px; margin-bottom: 10px; object-fit: contain;" crossorigin="anonymous"/>` : ''}
            <h1 style="font-size: 32px; font-weight: 900; margin: 0; font-family: Arial, sans-serif;">${settings.companyInfo?.name || 'MTM APP'}</h1>
            <p style="font-size: 14px; color: #64748b; letter-spacing: 4px; margin-top: 5px; font-family: Arial, sans-serif;">INVOICE TAGIHAN LAYANAN</p>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-family: Arial, sans-serif;">
          <div>
            <p style="font-size: 14px; color: #64748b; margin: 0 0 5px 0;">Ditagihkan Kepada:</p>
            <h2 style="font-size: 20px; font-weight: bold; margin: 0;">${order.customerName}</h2>
            <p style="font-size: 14px; margin: 5px 0 0 0;">${order.customerPhone}</p>
            <p style="font-size: 14px; margin: 5px 0 0 0; max-width: 300px;">Alamat: ${order.customerAddress || "-"}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 14px; color: #64748b; margin: 0 0 5px 0;">Nomor Invoice:</p>
            <h2 style="font-size: 20px; font-weight: bold; color: #2563eb; margin: 0;">${order.invoice}</h2>
            <p style="font-size: 14px; margin: 5px 0 0 0;">Tanggal: ${formatDate(order.createdAt)}</p>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; font-family: Arial, sans-serif;">
          <h3 style="font-size: 16px; margin: 0 0 10px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">INFO DRIVER / ARMADA</h3>
          <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <div><span style="color: #64748b;">Nama:</span> <strong>${driverName}</strong></div>
            <div><span style="color: #64748b;">Kontak:</span> <strong>${driverPhone}</strong></div>
            <div><span style="color: #64748b;">Plat:</span> <strong>${driverVehicle}</strong></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-family: Arial, sans-serif;">
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
                ${order.serviceName} <div style="font-size: 12px; font-weight: normal; color: #64748b;">Kategori: ${order.category}</div>
              </td>
              <td style="padding: 15px 10px; text-align: right;">${order.quantity} ${order.unit}</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${(order.basePrice || 0).toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold;">Rp ${((order.basePrice || 0) * (order.quantity || 1)).toLocaleString('id-ID')}</td>
            </tr>
            ${order.isUrgent ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-weight: bold; color: #e11d48;">Biaya Urgent</td>
              <td style="padding: 15px 10px; text-align: right;">1 Lumpsum</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${(order.urgentFee || 0).toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #e11d48;">Rp ${(order.urgentFee || 0).toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px; font-family: Arial, sans-serif;">
          <div style="background-color: #f8fafc; padding: 15px 30px; border-radius: 8px; border: 1px solid #cbd5e1; min-width: 300px;">
            <div style="display: flex; justify-content: space-between; font-size: 16px; align-items: center;">
              <span>Total Tagihan</span>
              <strong style="font-size: 24px;">Rp ${order.totalPrice.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 40px; font-family: Arial, sans-serif;">
          <div style="flex: 1; margin-right: 20px; display: flex;">
            ${config.showBank ? `
              <div style="flex: 1;">
                <h4 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px;">TRANSFER BANK</h4>
                <p style="font-size: 12px; margin: 0 0 2px 0;">Pilihan Bank:</p>
                <p style="font-size: 16px; font-weight: bold; color: #2563eb; margin: 0;">${payInfo.bankName || '-'} - ${payInfo.accountNumber || '-'}</p>
                <p style="font-size: 12px; margin: 2px 0 0 0;">A/N: ${payInfo.accountName || '-'}</p>
              </div>
            ` : ''}
            ${config.showQris ? `
              <div style="text-align: center;">
                <h4 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 10px;">SCAN QRIS</h4>
                ${payInfo.qrisUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payInfo.qrisUrl)}" style="width: 80px; height: 80px; border: 1px solid #ccc; padding: 5px; border-radius: 8px;" crossorigin="anonymous" />` : '<p style="font-size:12px;">Belum Ada Link</p>'}
              </div>
            ` : ''}
          </div>
          <div style="width: 200px; text-align: center; padding-top: 10px;">
            <p style="font-size: 14px; margin: 0 0 50px 0;">Salam Hormat,</p>
            <p style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #0f172a; display: inline-block; padding-bottom: 2px; margin: 0;">Direktur Utama</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 5px;">Manajemen MTM</p>
          </div>
        </div>

        <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; font-family: Arial, sans-serif;">
          <p style="font-size: 11px; color: #94a3b8; font-style: italic;">${config.footerNote || ''}</p>
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

      const pdfFileName = `${order.invoice}.pdf`;
      pdf.save(pdfFileName);

      let waNumber = order.customerPhone;
      if (waNumber.startsWith("0")) waNumber = "62" + waNumber.substring(1);
      
      const pesan = `*INVOICE TAGIHAN MTM*\n\nYth. Bapak/Ibu ${order.customerName},\nBerikut adalah rincian tagihan untuk pesanan Anda:\n\n*No Invoice:* ${order.invoice}\n*Jasa:* ${order.serviceName}\n*Driver:* ${driverName} (${driverVehicle})\n*Total Tagihan:* Rp ${order.totalPrice.toLocaleString('id-ID')}\n\nFile PDF Invoice telah kami kirimkan. Terima kasih telah menggunakan jasa kami.`;
      
      const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(pesan)}`;
      window.open(waLink, '_blank');

    } catch (error) {
      console.error(error);
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
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 mt-2 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Riwayat & Rekap Pesanan</h2>
          <p className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-1.5">
            <Info size={14} className="text-blue-500" /> Pantau dan unduh rekapan data operasional dalam format Excel.
          </p>
        </div>
        <button onClick={exportToExcel} disabled={isLoading || filteredOrders.length === 0} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 text-sm">
          <FileDown size={16} /> Unduh Excel
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari Invoice atau Pelanggan..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-all text-[13px] font-medium" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50 outline-none cursor-pointer">
            <option value="Semua">Semua Status</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Proses">Proses</option>
            <option value="Selesai">Selesai</option>
            <option value="Batal">Batal</option>
          </select>
          <button onClick={fetchAllData} className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-[13px] font-bold text-blue-600 hover:bg-blue-100 whitespace-nowrap active:scale-95 transition-all">
             Refresh Data
          </button>
        </div>
      </div>

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
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <Clock size={28} className="animate-spin text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Memuat data dari database...</p>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <Search size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Pesanan tidak ditemukan.</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
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
                        <button onClick={() => setProofModal(order.proofUrl)} className="p-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg transition-all shadow-sm mx-auto flex">
                          <Camera size={16} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {(order.status === 'pending' || order.status === 'active') && (
                          <button onClick={() => handleCancelOrder(order.id, order.invoice)} className="p-1.5 text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-all shadow-sm flex active:scale-95">
                            <XCircle size={16} />
                          </button>
                        )}
                        {(order.status === 'completed' || order.status === 'cancelled') && (
                          <button onClick={() => handleDeleteOrder(order.id, order.invoice)} className="p-1.5 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all shadow-sm flex active:scale-95">
                            <Trash2 size={16} />
                          </button>
                        )}
                        {(order.status === 'active' || order.status === 'completed') && (
                          <button onClick={() => handleGenerateInvoice(order)} disabled={isGeneratingPDF === order.id} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all shadow-sm flex active:scale-95 disabled:opacity-50">
                            {isGeneratingPDF === order.id ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Menampilkan {filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredOrders.length)} dari {filteredOrders.length} data
          </p>
          <div className="flex gap-1.5 items-center">
            <span className="text-xs font-bold text-slate-400 mr-2">Halaman {currentPage} / {totalPages || 1}</span>
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