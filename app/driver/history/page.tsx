"use client";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, RefreshCw,
  FileDown, Trash2, Filter, Wallet, ShieldCheck, Map,
  ShoppingCart
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

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

  // FORMAT TANGGAL LENGKAP UNTUK KARTU (DENGAN FALLBACK)
  const formatDateFull = (order: any) => {
    const dateString = order.createdAt || order.updatedAt;
    
    if (!dateString) {
      const now = new Date();
      return new Intl.DateTimeFormat('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
      }).format(now);
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      const now = new Date();
      return new Intl.DateTimeFormat('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
      }).format(now);
    }
    
    return new Intl.DateTimeFormat('id-ID', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  // ========================================================
  // RUMUS PERHITUNGAN
  // ========================================================
  const getSubtotalJasa = (order: any) => {
    const qty = Number(order.quantity) || 1;
    if (order.basePrice) return Number(order.basePrice) * qty; 
    const total = Number(order.totalPrice) || 0;
    const shopping = Number(order.shoppingCost) || 0;
    const urgent = Number(order.urgentFee) || 0;
    const calc = total - shopping - urgent;
    return calc > 0 ? calc : total;
  };

  const getOwnerCommission = (order: any, appSettings: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier?.toLowerCase() || 'sedang';
    
    let pct = 0.15; 
    const comms = appSettings?.commissions || appSettings?.commissionTiers;

    if (comms && comms[tier] !== undefined) {
       pct = (100 - Number(comms[tier])) / 100;
    } else {
       if (tier === 'ringan') pct = 0.16;
       else if (tier === 'sedang') pct = 0.15;
       else if (tier === 'berat') pct = 0.13;
    }
    return base * pct;
  };

  const getDriverNetIncome = (order: any, appSettings: any) => {
    const baseJasa = getSubtotalJasa(order);
    const ownerComm = getOwnerCommission(order, appSettings);
    const urgentFee = Number(order.urgentFee) || 0;
    return (baseJasa - ownerComm) + urgentFee;
  };

  // ========================================================
  // KALKULASI & FILTERING
  // ========================================================
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

  // ========================================================
  // INVOICE GENERATOR (REVISI HD NATIVE PRINT + LAYOUT BARU)
  // ========================================================
  const handleGenerateInvoice = async (order: any) => {
    if (!settings) return alert("Menunggu pengaturan, silakan coba lagi...");
    setIsGeneratingPDF(order.id);

    try {
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

      // Pengecekan Profil
      const currentDriverName = driverProfile?.name || driverCode;
      const currentDriverPhone = driverProfile?.phone || "-";
      const currentDriverVehicle = driverProfile?.vehicle || "-";

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

  return (
    <div className="max-w-[1000px] mx-auto animate-in fade-in duration-500 pb-10 px-2 md:px-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 mt-2">
            <ClipboardList className="text-blue-600" size={24} /> Riwayat Pesanan
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Pantau rincian tugas historis Anda.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={fetchHistory} disabled={isLoading || isDeleting} className="flex-1 md:flex-none p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-600 rounded-xl shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2 text-xs font-bold">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6 mt-2">
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
                          <span className="text-[10px] font-semibold text-slate-500">{formatDateFull(order)}</span>
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
                          <span className={`font-bold text-lg ${order.status === 'completed' ? 'text-emerald-600' : 'text-slate-300 line-through'}`}>Rp {formatCurrency(getDriverNetIncome(order, settings))}</span>
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