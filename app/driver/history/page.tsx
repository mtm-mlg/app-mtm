"use client";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Calendar, MapPin, 
  CheckCircle2, XCircle, Search, RefreshCw,
  FileDown, Trash2, Filter, Wallet, ShieldCheck, Map,
  ShoppingCart
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

  // FORMAT TANGGAL LENGKAP UNTUK KARTU AGAR FILTER TANGGAL TERLIHAT FUNGSINYA
  const formatDateFull = (dateString: any) => {
    if (!dateString) return "Data Lama";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Data Lama";
    return new Intl.DateTimeFormat('id-ID', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    }).format(date);
  };

  // ========================================================
  // RUMUS PERHITUNGAN (SINKRON DENGAN ADMIN, MENGGUNAKAN PERSENAN REAL)
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
       // KOREKSI RUMUS: Karena di Settings yang disimpan adalah jatah Driver (Misal 85%), 
       // maka Owner dapat sisanya (100 - 85 = 15%).
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
    // Driver otomatis mendapatkan sisanya (100% - Komisi Owner) + Uang Urgent
    return (baseJasa - ownerComm) + urgentFee;
  };

  // ========================================================
  // KALKULASI SALDO KESELURUHAN (TIDAK TERPENGARUH FILTER)
  // ========================================================
  const myCompletedOrders = orders.filter(o => o.status === 'completed');
  const totalHistoricalIncome = myCompletedOrders.reduce((sum, order) => sum + getDriverNetIncome(order, settings), 0);
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

  // ========================================================
  // PDF GENERATOR UPDATE (FIX BUG BLANK PUTIH)
  // ========================================================
  const handleGenerateInvoice = async (order: any) => {
    if (!settings) return alert("Menunggu pengaturan, silakan coba lagi...");
    setIsGeneratingPDF(order.id);
    
    let invoiceElement: HTMLDivElement | null = null;

    try {
      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      const companyInfo = settings.companyInfo || {}; 
      
      const subtotalJasa = getSubtotalJasa(order);
      const numTalangan = Number(order.shoppingCost) || 0;
      const urgentFee = Number(order.urgentFee) || 0;
      const currentTotal = subtotalJasa + numTalangan + urgentFee;
      
      const qty = Number(order.quantity) || 1;
      const shippingFee = Number(order.shippingFee) || 0;
      const serviceFee = Number(order.serviceFee) || 0;
      const isSplitFormat = shippingFee > 0 || serviceFee > 0;

      const driverName = driverProfile?.name || driverCode;
      const driverPhone = driverProfile?.phone || "-";
      const driverVehicle = driverProfile?.vehicle || "-";

      const displayDate = order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
        ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(order.createdAt))
        : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());

      // ==========================================
      // PEMBUATAN LINK QRIS DINAMIS
      // ==========================================
      let finalQrisLink = "";
      if (config.showQris && payInfo.qrisUrl) {
         const theQrisPayload = generateDynamicQris(payInfo.qrisUrl, currentTotal);
         finalQrisLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(theQrisPayload)}`;
      }

      invoiceElement = document.createElement("div");
      
      // FIX BLANK: Render di background yang pasti ditangkap oleh html2canvas
      invoiceElement.style.cssText = "position:fixed; top:0; left:0; width:800px; background:white; color:black; font-family:'Bookman Old Style', Georgia, serif; padding:40px; z-index:-9999; opacity: 1; pointer-events: none;";
      
      invoiceElement.innerHTML = `
        ${config.showLogo ? `
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid black;">
            <div style="flex: 1; padding-right: 16px; padding-bottom: 4px;">
              <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0 0 4px 0;">INVOICE</h1>
              <h2 style="font-size: 14px; font-weight: bold; margin: 0 0 2px 0;">${companyInfo.name || "Nama Perusahaan"}</h2>
              ${companyInfo.address ? `<p style="margin: 2px 0 0 0; font-size: 11px; line-height: 1.2;">${companyInfo.address}</p>` : ''}
              ${companyInfo.phone ? `<p style="margin: 2px 0 0 0; font-size: 11px; line-height: 1.2;">No. Telp : ${companyInfo.phone}</p>` : ''}
            </div>
            ${companyInfo.logoUrl ? `
              <img src="${companyInfo.logoUrl}" style="height: 80px; width: auto; max-width: 150px; object-fit: contain; flex-shrink: 0; margin-bottom: -10px;" alt="Logo" crossorigin="anonymous" />
            ` : ''}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; font-size: 11px;">
          <div style="width: 48%;">
            <p style="font-weight: bold; font-size: 12px; margin: 0 0 8px 0;">Ditagihkan Kepada :</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr><td style="width: 80px; vertical-align: top; padding: 2px 0;">Nama</td><td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: 600; vertical-align: top; padding: 2px 0;">${order.customerName}</td></tr>
                <tr><td style="vertical-align: top; padding: 2px 0;">No. WhatsApp</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0;">${order.customerPhone}</td></tr>
                <tr><td style="vertical-align: top; padding: 2px 0;">Alamat</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0; line-height: 1.3;">${order.customerAddress || "-"}</td></tr>
              </tbody>
            </table>
          </div>
          
          <div style="width: 48%;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
              <tbody>
                <tr><td style="width: 90px; vertical-align: top; font-weight: bold; padding: 2px 0;">Nomor Invoice</td><td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; color: #1d4ed8; vertical-align: top; padding: 2px 0;">${order.invoice}</td></tr>
                <tr><td style="vertical-align: top; font-weight: bold; padding: 2px 0;">Tanggal</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0;">${displayDate}</td></tr>
              </tbody>
            </table>
            <p style="font-weight: bold; font-size: 12px; margin: 0 0 6px 0;">Identitas Driver :</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr><td style="width: 90px; vertical-align: top; padding: 2px 0;">Nama</td><td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: 600; vertical-align: top; padding: 2px 0;">${driverName}</td></tr>
                <tr><td style="vertical-align: top; padding: 2px 0;">No. WhatsApp</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0;">${driverPhone}</td></tr>
                <tr><td style="vertical-align: top; padding: 2px 0;">No. Polisi</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0;">${driverVehicle}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <table style="width: 100%; text-align: left; border-collapse: collapse; margin-bottom: 32px; font-size: 11px; border-top: 2px solid black; border-bottom: 2px solid black;">
          <thead>
            <tr style="border-bottom: 2px solid black;">
              <th style="padding: 10px 8px; font-weight: bold; width: 45%; border-right: 1px solid #cbd5e1; text-align: center;">Deskripsi Jasa</th>
              <th style="padding: 10px 8px; text-align: center; font-weight: bold; width: 15%; border-right: 1px solid #cbd5e1;">QTY</th>
              <th style="padding: 10px 8px; text-align: center; font-weight: bold; width: 20%; border-right: 1px solid #cbd5e1;">Tarif</th>
              <th style="padding: 10px 8px; text-align: center; font-weight: bold; width: 20%;">Sub-Total</th>
            </tr>
          </thead>
          <tbody>
            ${isSplitFormat ? `
              ${shippingFee > 0 ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                  <div style="font-weight: bold;">Ongkos Kirim</div>
                  <div style="font-size: 9px; color: #475569; margin-top: 4px;">Antar Jemput (Kendaraan)</div>
                </td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">${qty} ${order.unit || 'KM'}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(shippingFee)}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(shippingFee * qty)}</td>
              </tr>` : ''}

              ${serviceFee > 0 ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                  <div style="font-weight: bold;">"${order.serviceName}"</div>
                  ${order.serviceDetails ? `<div style="font-size: 9px; color: #475569; margin-top: 4px; white-space: pre-wrap; line-height: 1.3;">${order.serviceDetails}</div>` : ''}
                </td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">1 Ls</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(serviceFee)}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(serviceFee)}</td>
              </tr>` : ''}
            ` : `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                  <div style="font-weight: bold;">"${order.serviceName}"</div>
                  <div style="font-size: 9px; color: #475569; margin-top: 4px;">Ongkos Kirim / Tarif Jasa</div>
                  ${order.serviceDetails ? `<div style="font-size: 9px; color: #475569; margin-top: 4px; white-space: pre-wrap; line-height: 1.3;">${order.serviceDetails}</div>` : ''}
                </td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">${qty} ${order.unit || 'Ls'}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(subtotalJasa/qty)}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(subtotalJasa)}</td>
              </tr>
            `}

            ${numTalangan > 0 ? `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
              <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                 <div style="font-weight: bold;">"Barang Belanjaan (Talangan)"</div>
              </td>
              <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">1 Ls</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(numTalangan)}</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(numTalangan)}</td>
            </tr>` : ''}
            
            ${urgentFee > 0 ? `
            <tr style="border-bottom: 2px solid black;">
              <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                <div style="font-weight: bold;">Biaya Urgent / Prioritas</div>
              </td>
              <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">1 Ls</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(urgentFee)}</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(urgentFee)}</td>
            </tr>` : ''}

            <tr style="background-color: #f8fafc;">
              <td colspan="3" style="padding: 16px 8px; text-align: right; font-weight: bold; font-size: 13px; border-right: 1px solid #cbd5e1;">TOTAL TAGIHAN</td>
              <td style="padding: 16px 8px; text-align: right; font-weight: 900; font-size: 14px;">Rp ${formatCurrency(currentTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 32px; padding-top: 8px;">
          
          <div style="width: 50%;">
            ${config.showBank ? `
              <div>
                <p style="font-size: 12px; font-weight: bold; text-decoration: underline; text-underline-offset: 4px; margin: 0 0 12px 0;">Pembayaran :</p>
                ${payInfo.banks && Array.isArray(payInfo.banks) ? payInfo.banks.map((bank:any) => `
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;">
                    <tbody>
                      <tr><td style="width: 80px; vertical-align: top; padding: 2px 0;">Nama Bank</td><td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.bankName || 'BANK'}</td></tr>
                      <tr><td style="vertical-align: top; padding: 2px 0;">No. Rekening</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.accountNumber || '-'}</td></tr>
                      <tr><td style="vertical-align: top; padding: 2px 0;">Atas Nama</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.accountName || '-'}</td></tr>
                    </tbody>
                  </table>
                `).join('') : ''}
              </div>
            ` : ''}
          </div>
          
          <div style="width: 45%; display: flex; flex-direction: column; align-items: center;">
            ${config.showQris && finalQrisLink !== "" ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <p style="font-weight: bold; font-size: 11px; margin: 0 0 6px 0;">Scan QRIS (Otomatis Rp ${formatCurrency(currentTotal)})</p>
                <div style="border: 1px solid black; padding: 4px; background: white; display: inline-block;">
                  <img src="${finalQrisLink}" alt="QRIS Dinamis" style="width: 112px; height: 112px;" crossorigin="anonymous" />
                </div>
              </div>
            ` : ''}
            
            <div style="text-align: center; width: 100%; margin-top: 8px;">
              <p style="font-size: 11px; margin: 0 0 64px 0;">Hormat Saya,</p>
              <div style="border-bottom: 1px solid black; display: inline-block; min-width: 150px; padding-bottom: 4px; margin: 0 auto;">
                <p style="font-size: 12px; font-weight: bold; margin: 0; line-height: 1;">${config.signatureName || "Nama Manajer"}</p>
              </div>
              <p style="font-size: 10px; color: #334155; margin: 4px 0 0 0;">${config.signatureRole || "Manajemen MTM"}</p>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 48px; font-size: 10px; font-style: italic; color: #475569; padding: 0 24px;">
          "${config.footerNote || ''}"
        </div>
      `;

      // APPEND KE BODY AGAR RENDER HTML2CANVAS TIDAK BLANK
      document.body.appendChild(invoiceElement);

      // JEDA 300ms AGAR GAMBAR QR DAN LOGO TERMUAT SEBELUM DIPOTRET
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Struk_${order.invoice}.pdf`);

    } catch (e) { 
      alert("Gagal memproses PDF Invoice. Pastikan koneksi internet stabil."); 
    } finally { 
      // HAPUS ELEMEN DARI BODY AGAR BERSIH
      if (invoiceElement && document.body.contains(invoiceElement)) {
        document.body.removeChild(invoiceElement);
      }
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
          <h3 className="text-xl md:text-3xl font-black">Rp {formatCurrency(totalHistoricalIncome)}</h3>
          
          {/* UANG TALANGAN */}
          {totalHistoricalReimburse > 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5 mt-3 inline-block w-full max-w-[250px]">
              <p className="text-[9px] md:text-[10px] text-rose-300 uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><ShoppingCart size={12}/> Total Uang Talangan</p>
              <p className="text-sm md:text-base font-bold text-rose-100">Rp {formatCurrency(totalHistoricalReimburse)}</p>
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
                          
                          {/* FITUR TANGGAL LENGKAP PADA KARTU AGAR FILTER TANGGAL TERLIHAT BEKERJA */}
                          <span className="text-[10px] font-semibold text-slate-500">{formatDateFull(order.createdAt)}</span>
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