"use client";
import { useState, useEffect } from "react";
import { 
  Search, FileDown, Filter, ChevronLeft, ChevronRight, 
  Info, Clock, Camera, X, Trash2, XCircle, Send, MapPin, Map, Weight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

// HELPER UNTUK MENCEGAH PEMBULATAN (MENAMPILKAN DESIMAL JIKA ADA)
const formatCurrency = (amount: number) => {
  return Number(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// =====================================================================
// FUNGSI PEMBUAT PAYLOAD QRIS DINAMIS
// =====================================================================
const generateDynamicQris = (baseNmid: string, amount: number) => {
  if (!baseNmid || baseNmid.length < 30 || baseNmid.includes("http")) return baseNmid;

  try {
    const payload = baseNmid.substring(0, baseNmid.length - 4); 
    const step1 = payload.replace("010211", "010212"); 

    const step2Parts = step1.split("5802ID");
    if (step2Parts.length < 2) return baseNmid;

    const strAmount = amount.toString();
    const tag54 = `54${String(strAmount.length).padStart(2, '0')}${strAmount}`;
    const step3 = `${step2Parts[0]}${tag54}5802ID${step2Parts[1]}`;

    let crc = 0xFFFF;
    for (let i = 0; i < step3.length; i++) {
      crc ^= step3.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
        else crc <<= 1;
      }
    }
    const finalCrc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return step3 + finalCrc;
  } catch (error) {
    console.error("Gagal parse QRIS:", error);
    return baseNmid; 
  }
};

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

  // ========================================================
  // ANTI-CACHE & AUTO-REFRESH SINKRONISASI
  // ========================================================
  const fetchAllData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Menggunakan Timestamp agar Next.js tidak memberikan data Cache lama
      const timestamp = new Date().getTime();
      const resOrders = await fetch(`/api/orders?_t=${timestamp}`, { cache: 'no-store' });
      const resultOrders = await resOrders.json();
      if (resultOrders.success) setOrders(resultOrders.data);

      const resDrivers = await fetch(`/api/drivers?_t=${timestamp}`, { cache: 'no-store' });
      const resultDrivers = await resDrivers.json();
      if (resultDrivers.success) setDrivers(resultDrivers.data);

      const docSnap = await getDoc(doc(db, "settings", "global"));
      if (docSnap.exists()) setSettings(docSnap.data());
    } catch (error) {
      console.error("Gagal menarik data:", error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchAllData(true); 
    // Auto-refresh setiap 10 detik agar status tabel Armada update otomatis!
    const interval = setInterval(() => fetchAllData(false), 10000);
    return () => clearInterval(interval);
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
    if (order.basePrice) return Number(order.basePrice) * qty; 
    const total = Number(order.totalPrice) || 0;
    const shopping = Number(order.shoppingCost) || 0;
    const urgent = Number(order.urgentFee) || 0;
    const calc = total - shopping - urgent;
    return calc > 0 ? calc : total;
  };

  const getOwnerComm = (order: any, appSettings: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier?.toLowerCase() || 'sedang';
    
    let pct = 0.15; 
    if (appSettings && appSettings.commissions && appSettings.commissions[tier] !== undefined) {
       pct = (100 - Number(appSettings.commissions[tier])) / 100;
    } else {
       if (tier === 'ringan') pct = 0.16;
       else if (tier === 'sedang') pct = 0.15;
       else if (tier === 'berat') pct = 0.13;
    }
    return base * pct;
  };

  const getDriverNet = (order: any, appSettings: any) => {
    const base = getSubtotalJasa(order);
    const ownerComm = getOwnerComm(order, appSettings);
    const urgent = Number(order.urgentFee) || 0;
    return (base - ownerComm) + urgent;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-amber-50 text-amber-600 border-amber-100">Menunggu</span>;
      case 'active': return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border inline-block bg-blue-50 text-blue-600 border-blue-100"><Clock size={10} className="inline mr-1 animate-spin-slow"/>Proses</span>;
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
        fetchAllData(false);
      } catch (error) { alert("Gagal menugaskan driver."); }
    }
  };

  const handleCancelOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Batalkan pesanan ${invoiceId}?`)) {
      try {
        await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
        alert(`Pesanan ${invoiceId} berhasil dibatalkan.`);
        fetchAllData(false);
      } catch (error) { alert("Terjadi kesalahan."); }
    }
  };

  const handleDeleteOrder = async (orderId: string, invoiceId: string) => {
    if (confirm(`Hapus permanen pesanan ${invoiceId} dari database?`)) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
        alert(`Pesanan ${invoiceId} berhasil dihapus permanen.`);
        fetchAllData(false); 
      } catch (error) { alert("Terjadi kesalahan menghapus."); }
    }
  };

  // ========================================================
  // INVOICE GENERATOR (REVISI HD NATIVE PRINT + LAYOUT BARU)
  // ========================================================
  const handleGenerateInvoice = async (order: any, sendWa?: boolean) => {
    if (!settings) return alert("Sedang memuat pengaturan, mohon klik lagi sebentar lagi...");
    setIsGeneratingPDF(order.id);
    
    let invoiceElement: HTMLDivElement | null = null;

    try {
      const targetDriver = drivers.find(d => d.code === order.driverCode);
      const currentDriverName = targetDriver ? targetDriver.name : "Belum Ditugaskan";
      const currentDriverPhone = targetDriver ? targetDriver.phone : "-";
      const currentDriverVehicle = targetDriver ? targetDriver.vehicle : "-";

      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      const companyInfo = settings.companyInfo || {}; 
      
      const qty = Number(order.quantity) || 1;
      const numTalangan = Number(order.shoppingCost) || 0;
      const urgentFee = Number(order.urgentFee) || 0;

      // LOGIKA BARU: Ongkir dikali qty. Tarif Jasa TETAP.
      const shippingFee = Number(order.shippingFee) || 0;
      const serviceFee = Number(order.serviceFee) || 0;
      
      let totalOngkir = 0;
      let totalJasa = 0;
      const isSplitFormat = shippingFee > 0 || serviceFee > 0;

      if (isSplitFormat) {
          totalOngkir = shippingFee * qty; // Ongkir dikalikan jumlah/KM
          totalJasa = serviceFee;          // Jasa DIBIARKAN FLAT
      } else {
          // Fallback jika order versi lama
          totalJasa = getSubtotalJasa(order); 
      }
      
      const currentTotal = totalOngkir + totalJasa + numTalangan + urgentFee;

      const displayDate = order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
        ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(order.createdAt)) + ' WIB'
        : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' WIB';

      let finalQrisLink = "";
      if (config.showQris && payInfo.qrisUrl) {
         const theQrisPayload = generateDynamicQris(payInfo.qrisUrl, currentTotal);
         finalQrisLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(theQrisPayload)}`;
      }

      // ==========================================
      // HTML PDF BROWSER PRINT (HD TEXT BASED)
      // ==========================================
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice_${order.invoice}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&display=swap');
            @page { size: A4 portrait; margin: 15mm; }
            body { 
              font-family: 'Merriweather', Georgia, serif; 
              color: #0f172a; 
              margin: 0; 
              padding: 10px 20px; 
              font-size: 13px; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            
            /* HEADER */
            .header-container { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .invoice-title { color: #1e3a8a; font-size: 38px; margin: 0 0 5px 0; font-weight: 900; letter-spacing: 1px; }
            .company-name { font-size: 16px; font-weight: 800; margin: 0 0 4px 0; color: #000; }
            .company-info { font-size: 11px; margin: 2px 0; color: #334155; }
            
            /* IDENTITY SECTIONS */
            .info-wrapper { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .col-left { width: 48%; }
            .col-right { width: 48%; }
            
            .info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .info-table td { padding: 4px 0; vertical-align: top; }
            .info-table .label { width: 100px; color: #334155; font-weight: 700; }
            .info-table .colon { width: 15px; font-weight: 700; }
            .info-table .val { font-weight: 700; color: #000; }
            
            .section-header { font-weight: 800; font-size: 14px; color: #000; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
            
            /* ITEM TABLE */
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .items-table th { background-color: #f8fafc; color: #000; padding: 12px; text-align: left; border-top: 2px solid #1e3a8a; border-bottom: 2px solid #1e3a8a; font-size: 13px; font-weight: 800; }
            .items-table th.right, .items-table td.right { text-align: right; }
            .items-table td { padding: 14px 12px; border-bottom: 1px solid #cbd5e1; color: #0f172a; font-size: 13px; }
            
            .item-title { font-weight: 700; color: #000; margin-bottom: 4px; }
            .item-desc { font-size: 11px; color: #475569; }
            .item-note { font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px; }
            
            .total-row td { padding: 16px 12px; border-bottom: 3px solid #1e3a8a; background-color: #f1f5f9; }
            .total-label { font-weight: 800; font-size: 14px; color: #000; }
            .total-value { font-weight: 900; font-size: 18px; color: #1e3a8a; }
            
            /* FOOTER PAYMENT */
            .bottom-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 100px; }
            .payment-box { width: 50%; }
            .sign-box { width: 45%; text-align: center; }
            .qris-img { width: 120px; height: 120px; border: 1px solid #cbd5e1; padding: 4px; border-radius: 6px; }
            
            /* ABSOLUTE BOTTOM FOOTER */
            .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-style: italic; color: #64748b; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="invoice-title">INVOICE</h1>
              <h2 class="company-name">${companyInfo.name || "Just Call Me - Mas Tulung Mas Kota Malang"}</h2>
              ${companyInfo.address ? `<p class="company-info">${companyInfo.address}</p>` : ''}
              ${companyInfo.phone ? `<p class="company-info">No. Telp : ${companyInfo.phone}</p>` : ''}
            </div>
            <div>
              ${companyInfo.logoUrl ? `<img src="${companyInfo.logoUrl}" style="height: 80px; object-fit: contain;" />` : ''}
            </div>
          </div>

          <div class="info-wrapper">
            <!-- Kolom Kiri -->
            <div class="col-left">
              <table class="info-table" style="margin-bottom: 25px;">
                <tr><td class="label">Nomor Invoice</td><td class="colon">:</td><td class="val" style="color: #1e3a8a;">${order.invoice}</td></tr>
                <tr><td class="label">Tanggal</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${displayDate}</td></tr>
              </table>
              
              <div class="section-header">Ditagihkan Kepada :</div>
              <table class="info-table">
                <tr><td class="label">Nama</td><td class="colon">:</td><td class="val">${order.customerName}</td></tr>
                <tr><td class="label">No. WhatsApp</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${order.customerPhone}</td></tr>
                <tr><td class="label">Alamat</td><td class="colon">:</td><td class="val" style="font-weight: 500; line-height: 1.4;">${order.customerAddress || "-"}</td></tr>
              </table>
            </div>

            <!-- Kolom Kanan -->
            <div class="col-right">
              <div class="section-header" style="margin-top: 54px;">Identitas Driver :</div>
              <table class="info-table">
                <tr><td class="label">Nama</td><td class="colon">:</td><td class="val">${currentDriverName}</td></tr>
                <tr><td class="label">No. WhatsApp</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${currentDriverPhone}</td></tr>
                <tr><td class="label">No. Polisi</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${currentDriverVehicle}</td></tr>
              </table>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Deskripsi Jasa</th>
                <th class="right" style="width: 180px;">Sub-Total</th>
              </tr>
            </thead>
            <tbody>
              ${totalOngkir > 0 ? `
              <tr>
                <td>
                  <div class="item-title">Ongkos Kirim</div>
                  <div class="item-desc">Jarak Tempuh: ${qty} ${order.unit || 'KM'}</div>
                </td>
                <td class="right val">Rp ${formatCurrency(totalOngkir)}</td>
              </tr>` : ''}

              ${totalJasa > 0 ? `
              <tr>
                <td>
                  <div class="item-title">"${order.serviceName}"</div>
                  <div class="item-desc">Tarif Jasa Pokok / Tambahan</div>
                  ${order.serviceDetails ? `<div class="item-note">${order.serviceDetails}</div>` : ''}
                </td>
                <td class="right val">Rp ${formatCurrency(totalJasa)}</td>
              </tr>` : ''}

              ${numTalangan > 0 ? `
              <tr>
                <td>
                  <div class="item-title">"Barang Belanjaan (Talangan)"</div>
                </td>
                <td class="right val">Rp ${formatCurrency(numTalangan)}</td>
              </tr>` : ''}
              
              ${urgentFee > 0 ? `
              <tr>
                <td>
                  <div class="item-title">Biaya Urgent / Prioritas</div>
                </td>
                <td class="right val">Rp ${formatCurrency(urgentFee)}</td>
              </tr>` : ''}

              <tr class="total-row">
                <td class="right total-label">TOTAL TAGIHAN</td>
                <td class="right total-value">Rp ${formatCurrency(currentTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div class="bottom-container">
            <div class="payment-box">
              ${config.showBank ? `
                <div class="section-header" style="text-decoration: underline; border: none; margin-bottom: 15px;">Pembayaran :</div>
                ${payInfo.banks && Array.isArray(payInfo.banks) ? payInfo.banks.map((bank:any) => `
                  <table class="info-table" style="margin-bottom: 12px; font-size: 11px;">
                    <tr><td class="label" style="width: 80px; font-weight: 500;">Nama Bank</td><td class="colon">:</td><td class="val">${bank.bankName || 'BANK'}</td></tr>
                    <tr><td class="label" style="width: 80px; font-weight: 500;">No. Rekening</td><td class="colon">:</td><td class="val">${bank.accountNumber || '-'}</td></tr>
                    <tr><td class="label" style="width: 80px; font-weight: 500;">Atas Nama</td><td class="colon">:</td><td class="val">${bank.accountName || '-'}</td></tr>
                  </table>
                `).join('') : ''}
              ` : ''}
            </div>
            
            <div class="sign-box">
              ${config.showQris && finalQrisLink !== "" ? `
                <div style="margin-bottom: 20px;">
                  <img src="${finalQrisLink}" alt="QRIS Dinamis" class="qris-img" crossorigin="anonymous" />
                </div>
              ` : ''}
              
              <div>
                <p style="margin: 0 0 50px 0; color: #334155; font-size: 12px;">Hormat Saya,</p>
                <p style="font-weight: 800; font-size: 13px; margin: 0; color: #000; border-bottom: 1px solid #000; display: inline-block; padding-bottom: 2px;">${config.signatureName || "Manajemen MTM"}</p>
                <p style="font-size: 10px; color: #64748b; margin: 4px 0 0 0;">${config.signatureRole || "Manajemen"}</p>
              </div>
            </div>
          </div>

          <div class="page-footer">
            "${config.footerNote || 'Terima kasih telah mempercayakan layanan Anda kepada kami. Harap simpan nota ini sebagai bukti pembayaran yang sah.'}"
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
        </html>
      `;

      // Buka tab baru untuk print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        alert("Perhatian: Pop-up diblokir oleh browser Anda. Izinkan pop-up untuk melihat/menyimpan PDF.");
      }

    } catch (error) { 
      alert("Gagal memproses PDF Invoice. Pastikan sinyal internet stabil."); 
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
    const headers = ["No,Invoice,Waktu,Kriteria,Nama Pelanggan,Layanan,Catatan/Detail,Armada,Tarif Ongkir,Tarif Jasa,Talangan Barang,Jatah Driver,Komisi Owner,Total Tagihan,Metode Bayar,Status\n"];
    
    const rows = filteredOrders.map((o, index) => {
      const wkt = formatDateSafe(o.createdAt).replace(/,/g, ''); 
      const ownerComm = getOwnerComm(o, settings);
      const driverNet = getDriverNet(o, settings);
      const subtotalJasa = getSubtotalJasa(o);
      const belanja = Number(o.shoppingCost) || 0;
      const urgentFee = Number(o.urgentFee) || 0;
      const currentTotal = subtotalJasa + belanja + urgentFee;
      
      const qty = Number(o.quantity) || 1;
      const shippingF = (Number(o.shippingFee) || 0) * qty;
      const serviceF = Number(o.serviceFee) || 0; // Jasa flat tidak dikali qty

      const detailAman = o.serviceDetails ? `"${o.serviceDetails.replace(/"/g, '""')}"` : "-";
      const layananAman = o.serviceName ? `"${o.serviceName.replace(/"/g, '""')}"` : "-";
      const namaAman = o.customerName ? `"${o.customerName.replace(/"/g, '""')}"` : "-";

      return `${index + 1},${o.invoice},${wkt},${o.commissionTier || 'Sedang'},${namaAman},${layananAman},${detailAman},${o.driverCode || 'Kosong'},${shippingF},${serviceF},${belanja},${driverNet},${ownerComm},${currentTotal},${o.paymentMethod},${o.status}`;
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

  if (!isLoaded) return null;

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
          <button onClick={() => fetchAllData(true)} className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-[13px] font-medium text-blue-600 hover:bg-blue-100 whitespace-nowrap active:scale-95 transition-all">
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
                  
                  const qty = Number(order.quantity) || 1;
                  const shippingFee = Number(order.shippingFee) || 0;
                  const serviceFee = Number(order.serviceFee) || 0;

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
                      <div className="text-[11px] flex flex-col gap-1 w-44">
                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-100">
                          <span className="text-slate-500 font-bold flex items-center gap-1"><Weight size={12}/> Kriteria:</span>
                          <span className="text-indigo-600 font-bold capitalize bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{order.commissionTier || 'Sedang'}</span>
                        </div>

                        {(shippingFee > 0 || serviceFee > 0) ? (
                          <>
                            {shippingFee > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Ongkir ({qty}x):</span> 
                                <span className="text-slate-700 font-medium">Rp {formatCurrency(shippingFee * qty)}</span>
                              </div>
                            )}
                            {serviceFee > 0 && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Jasa (Flat):</span> 
                                <span className="text-slate-700 font-medium">Rp {formatCurrency(serviceFee)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Ongkir/Jasa ({qty}x):</span> 
                            <span className="text-slate-700 font-medium">Rp {formatCurrency(subtotalJasa)}</span>
                          </div>
                        )}

                        {currentShopping > 0 && (
                          <div className="flex justify-between text-rose-600">
                            <span>Talangan:</span> 
                            <span className="font-medium">Rp {formatCurrency(currentShopping)}</span>
                          </div>
                        )}
                        {currentUrgent > 0 && (
                          <div className="flex justify-between text-orange-600">
                            <span>Urgent:</span> 
                            <span className="font-medium">Rp {formatCurrency(currentUrgent)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold mt-0.5 pt-1 border-t border-slate-200">
                          <span className="text-slate-600">Total Tagihan:</span> 
                          <span className="text-slate-800">Rp {formatCurrency(realTotal)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-[11px] flex flex-col gap-1.5 w-36">
                        <div className="flex justify-between text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          <span>Driver:</span> 
                          <span className="font-bold">Rp {formatCurrency(getDriverNet(order, settings))}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          <span>Owner:</span> 
                          <span className="font-bold">Rp {formatCurrency(getOwnerComm(order, settings))}</span>
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

      {/* KANDANG RAHASIA UNTUK PDF (MENCEGAH REACT CRASH) */}
      <div id="pdf-hidden-container" className="fixed top-[9999px] left-[9999px] invisible pointer-events-none opacity-0"></div>

    </div>
  );
}