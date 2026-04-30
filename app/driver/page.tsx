"use client";
import { useState, useEffect } from "react";
import { 
  Power, MapPin, Navigation, Clock, ShieldCheck, 
  ArrowRight, Phone, AlertCircle, Wallet, CheckCircle2, User, Camera, 
  UploadCloud, RefreshCw, LogOut, ShoppingCart, FileDown, Send, 
  ExternalLink, MessageCircle, Siren, CloudRain, TrendingUp, Map,
  Sun, Cloud, Image as ImageIcon, Plus, X
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"; 

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

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  
  const [driverName, setDriverName] = useState<string>("");
  const [driverVehicle, setDriverVehicle] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [driverProfileUrl, setDriverProfileUrl] = useState<string>(""); 
  
  const [completedCount, setCompletedCount] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState(0); 
  const [totalReimburse, setTotalReimburse] = useState(0); 
  
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [driverCode, setDriverCode] = useState<string>("");
  const [refreshProgress, setRefreshProgress] = useState(0); 

  const [weatherData, setWeatherData] = useState<{ temp: number, desc: string, code: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [shoppingInputs, setShoppingInputs] = useState<Record<string, number | "">>({});
  
  // STATE MULTI UPLOAD FOTO BUKTI (Array per order ID)
  const [proofFiles, setProofFiles] = useState<Record<string, File[]>>({});
  const [proofPreviews, setProofPreviews] = useState<Record<string, string[]>>({});
  
  const [processingOrders, setProcessingOrders] = useState<Record<string, boolean>>({});
  const [generatingPDFs, setGeneratingPDFs] = useState<Record<string, boolean>>({});

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem("mtm_user");
    if (session) {
      setDriverCode(session);
      const savedOnlineStatus = localStorage.getItem(`mtm_online_${session}`);
      if (savedOnlineStatus === "true") setIsOnline(true);
    } else {
      window.location.href = "/";
    }

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "global"));
        if (docSnap.exists()) setSettings(docSnap.data());
      } catch (e) {}
    };
    fetchSettings();
  }, []);

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (driverCode) {
      localStorage.setItem(`mtm_online_${driverCode}`, newStatus.toString());
      
      try {
        const q = query(collection(db, "drivers"), where("code", "==", driverCode));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
           const docId = querySnapshot.docs[0].id;
           await updateDoc(doc(db, "drivers", docId), { isOnline: newStatus });
        }
      } catch(e) {}
    }
  };

  const handleLogout = async () => {
    if (isOnline) {
      alert("Harap matikan status Online terlebih dahulu sebelum keluar dari aplikasi!");
      return;
    }
    if (confirm("Apakah Anda yakin ingin keluar dari akun Driver?")) {
      localStorage.removeItem("mtm_user");
      if (driverCode) localStorage.removeItem(`mtm_online_${driverCode}`);
      window.location.href = "/"; 
    }
  };

  useEffect(() => {
    if (!isOnline) {
      setWeatherData(null);
      return;
    }

    const fetchWeather = async (lat: number, lon: number) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        if (data && data.current_weather) {
           const code = data.current_weather.weathercode;
           const temp = data.current_weather.temperature;
           
           let desc = "Cerah";
           if ([1,2,3].includes(code)) desc = "Berawan";
           else if ([45,48].includes(code)) desc = "Berkabut";
           else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) desc = "Hujan";
           else if ([95,96,99].includes(code)) desc = "Badai Petir";

           setWeatherData({ temp, desc, code });
        }
      } catch (error) {} finally {
        setWeatherLoading(false);
      }
    };

    if ("geolocation" in navigator) {
       navigator.geolocation.getCurrentPosition(
         (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
         (error) => { fetchWeather(-7.983908, 112.621391); },
         { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
       );
    } else {
       fetchWeather(-7.983908, 112.621391);
    }
  }, [isOnline]);

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

  const fetchActiveOrders = async () => {
    if (!isOnline || !driverCode) return;
    
    setIsLoadingOrder(true);
    setRefreshProgress(0); 
    try {
      const snapSettings = await getDoc(doc(db, "settings", "global"));
      let currentSettings = null;
      if (snapSettings.exists()) {
        currentSettings = snapSettings.data();
        setSettings(currentSettings);
      }

      const resOrder = await fetch(`/api/orders`);
      const resultOrder = await resOrder.json();
      
      const resProfile = await fetch("/api/drivers");
      const resultProfile = await resProfile.json();

      let myPrefs = { jarak: true, tenaga: true, waktu: true, pikiran: true, belanja: true };

      if (resultProfile.success) {
        const myProfile = resultProfile.data.find((d: any) => d.code === driverCode);
        if (myProfile) {
          if (myProfile.status === 'suspend') {
            alert("Akses Ditolak!\nAkun Anda telah DIBEKUKAN oleh Admin.");
            localStorage.removeItem("mtm_user");
            localStorage.removeItem(`mtm_online_${driverCode}`);
            window.location.href = "/";
            return;
          }
          setDriverName(myProfile.name);
          setDriverVehicle(myProfile.vehicle || "-");
          setDriverPhone(myProfile.phone || "-");
          setDriverProfileUrl(myProfile.profileUrl || ""); 
          if (myProfile.preferences) { myPrefs = { ...myPrefs, ...myProfile.preferences }; }
        }
      }

      if (resultOrder.success) {
        const allOrders = resultOrder.data;
        
        // MENDAPATKAN TANGGAL HARI INI (FORMAT: YYYY-MM-DD)
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // HANYA AMBIL ORDER SELESAI HARI INI
        const myCompletedOrdersToday = allOrders.filter((o:any) => {
           if (o.driverCode !== driverCode || o.status !== 'completed') return false;
           
           // Cari tanggal penyelesaian (updatedAt) atau pembuatan (createdAt)
           const dateToCheck = o.updatedAt || o.createdAt;
           if (!dateToCheck) return false;
           
           const orderDate = new Date(dateToCheck);
           if (isNaN(orderDate.getTime())) return false;
           
           const orderDateString = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
           return orderDateString === todayString;
        });
        
        let calcNetJasaToday = 0;
        let calcTalanganToday = 0;
        
        myCompletedOrdersToday.forEach((o:any) => {
          calcNetJasaToday += getDriverNetIncome(o, currentSettings);
          calcTalanganToday += (Number(o.shoppingCost) || 0);
        });

        // SET KE STATE (Hanya Data Hari Ini)
        setDailyRevenue(calcNetJasaToday);
        setTotalReimburse(calcTalanganToday);
        setCompletedCount(myCompletedOrdersToday.length);

        const myTargets = allOrders.filter((o:any) => {
          const isActiveForMe = o.status === 'active' && o.driverCode === driverCode;
          const isPendingForMeOrAll = o.status === 'pending' && (o.driverCode === driverCode || !o.driverCode || o.driverCode === "");
          if (!isActiveForMe && !isPendingForMeOrAll) return false;

          if (isPendingForMeOrAll) {
            let catKey = "";
            const catLower = o.category?.toLowerCase() || "";
            if (catLower.includes("jarak")) catKey = "jarak";
            else if (catLower.includes("tenaga")) catKey = "tenaga";
            else if (catLower.includes("waktu")) catKey = "waktu";
            else if (catLower.includes("pikiran")) catKey = "pikiran";
            else if (catLower.includes("belanja")) catKey = "belanja";
            return catKey === "" || myPrefs[catKey as keyof typeof myPrefs] === true;
          }
          return true; 
        });

        setAvailableOrders(myTargets);
        
        const initialShopping: Record<string, number | ""> = {};
        myTargets.forEach((o:any) => {
           if (o.status === 'active' && o.shoppingCost) { initialShopping[o.id] = o.shoppingCost; }
        });
        setShoppingInputs(prev => ({...initialShopping, ...prev}));
      }
    } catch (error) {} finally {
      setIsLoadingOrder(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let progInterval: NodeJS.Timeout;
    
    if (isOnline) {
      fetchActiveOrders(); 
      interval = setInterval(fetchActiveOrders, 7000); 
      progInterval = setInterval(() => {
        setRefreshProgress(prev => (prev >= 100 ? 0 : prev + 1.43)); 
      }, 100);
    } else {
      setAvailableOrders([]); 
      setRefreshProgress(0);
    }
    
    return () => { clearInterval(interval); clearInterval(progInterval); };
  }, [isOnline, driverCode]);

  // ========================================================
  // FUNGSI MULTI UPLOAD FOTO BUKTI
  // ========================================================
  const handlePhotoChange = (orderId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incomingFiles = Array.from(e.target.files);
      const incomingPreviews = incomingFiles.map(file => URL.createObjectURL(file));

      setProofFiles(prev => {
        const existingFiles = prev[orderId] || [];
        return { ...prev, [orderId]: [...existingFiles, ...incomingFiles] };
      });
      
      setProofPreviews(prev => {
        const existingPreviews = prev[orderId] || [];
        return { ...prev, [orderId]: [...existingPreviews, ...incomingPreviews] };
      });
    }
    e.target.value = '';
  };

  const removeProofImage = (orderId: string, indexToRemove: number) => {
    setProofFiles(prev => {
      const updated = [...(prev[orderId] || [])];
      updated.splice(indexToRemove, 1);
      return { ...prev, [orderId]: updated };
    });
    setProofPreviews(prev => {
      const updated = [...(prev[orderId] || [])];
      updated.splice(indexToRemove, 1);
      return { ...prev, [orderId]: updated };
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-"; 
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const formatWa = (num: string) => {
    let clean = num.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.substring(1);
    return clean;
  };

  const getGoogleMapsLink = (address: string) => {
    if (!address) return "#";
    if (address.startsWith("http")) return address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // ========================================================
  // INVOICE GENERATOR (REVISI HD NATIVE PRINT + LAYOUT BARU)
  // ========================================================
  const handleGenerateInvoice = async (order: any, sendWa: boolean) => {
    if (!settings) { alert("Sedang memuat pengaturan. Mohon tunggu."); return; }
    
    const currentShoppingInput = Number(shoppingInputs[order.id]) || 0;
    if (order.category?.includes('Belanja') && currentShoppingInput === 0) {
       alert("Peringatan: Untuk pesanan Belanja, Anda wajib mengisi Nominal Uang Struk/Talangan terlebih dahulu!"); return;
    }
    
    setGeneratingPDFs(prev => ({...prev, [order.id]: true}));

    try {
      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      const companyInfo = settings.companyInfo || {};
      
      const qty = Number(order.quantity) || 1;
      const numTalangan = currentShoppingInput; // Ambil nilai state terbaru
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
      // FORMAT WHATSAPP (SEIRAMA DENGAN PDF)
      // ==========================================
      if (sendWa) {
        const waNum = formatWa(order.customerPhone);
        
        let rincian = "";
        if (totalOngkir > 0) rincian += `• Ongkos Kirim (${qty} ${order.unit || 'KM'}): Rp ${formatCurrency(totalOngkir)}\n`;
        if (totalJasa > 0) rincian += `• Tarif Jasa (${order.serviceName}): Rp ${formatCurrency(totalJasa)}\n`;
        if (numTalangan > 0) rincian += `• Barang Belanjaan (Talangan): Rp ${formatCurrency(numTalangan)}\n`;
        if (urgentFee > 0) rincian += `• Biaya Urgent/Prioritas: Rp ${formatCurrency(urgentFee)}\n`;

        let bankInfo = "";
        if (config.showBank && payInfo.banks && Array.isArray(payInfo.banks)) {
           bankInfo = "\n*💳 Informasi Pembayaran:*\n" + payInfo.banks.map((b:any) => `${b.bankName} - ${b.accountNumber} (a/n ${b.accountName})`).join('\n');
        }

        const pesan = `*INVOICE TAGIHAN MTM* 📄\n\n*No. Invoice:* ${order.invoice}\n*Tanggal:* ${displayDate}\n\n*👤 Ditagihkan Kepada:*\nNama: ${order.customerName}\nNo. WA: ${order.customerPhone}\nAlamat: ${order.customerAddress || "-"}\n\n*🛵 Identitas Driver:*\nNama: ${driverName}\nKendaraan: ${driverVehicle}\n\n*📋 RINCIAN TAGIHAN:*\n${rincian}\n----------------------------------\n*TOTAL TAGIHAN: Rp ${formatCurrency(currentTotal)}* \n${bankInfo}\n\n_${config.footerNote || 'Terima kasih telah mempercayakan layanan Anda kepada MTM. Harap simpan nota ini sebagai bukti pembayaran yang sah.'}_`;
        
        window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(pesan)}`, '_blank');
        setGeneratingPDFs(prev => ({...prev, [order.id]: false}));
        return;
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
            
            /* IDENTITY SECTIONS (Req 3 Layout) */
            .info-wrapper { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .col-left { width: 48%; }
            .col-right { width: 48%; }
            
            .info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .info-table td { padding: 4px 0; vertical-align: top; }
            .info-table .label { width: 100px; color: #334155; font-weight: 700; }
            .info-table .colon { width: 15px; font-weight: 700; }
            .info-table .val { font-weight: 700; color: #000; }
            
            .section-header { font-weight: 800; font-size: 14px; color: #000; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
            
            /* ITEM TABLE (Req 1 & 6) */
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
            
            /* ABSOLUTE BOTTOM FOOTER (Req 4) */
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
                <tr><td class="label">Nama</td><td class="colon">:</td><td class="val">${driverName}</td></tr>
                <tr><td class="label">No. WhatsApp</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${driverPhone}</td></tr>
                <tr><td class="label">No. Polisi</td><td class="colon">:</td><td class="val" style="font-weight: 500;">${driverVehicle}</td></tr>
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
      setGeneratingPDFs(prev => ({...prev, [order.id]: false})); 
    }
  };

  const handleOrderStatus = async (order: any, newStatus: string) => {
    const currentShoppingInput = Number(shoppingInputs[order.id]) || 0;
    const currentProofFiles = proofFiles[order.id] || [];

    if (newStatus === 'completed' && currentProofFiles.length === 0) return alert("Harap unggah minimal 1 foto bukti!");
    const isBelanja = order.category?.includes('Belanja');
    if (newStatus === 'completed' && isBelanja && currentShoppingInput === 0) return alert("Wajib isi Nominal Uang Talangan Belanja!");

    setProcessingOrders(prev => ({...prev, [order.id]: true}));
    
    let uploadedProofUrls: string[] = [];

    try {
      // MULTI UPLOAD LOOPING
      if (newStatus === 'completed' && currentProofFiles.length > 0) {
        const uploadPromises = currentProofFiles.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", "mtm-mlg");

          const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/dwprlhbzb/image/upload`, { method: "POST", body: formData });
          const cloudinaryData = await cloudinaryRes.json();
          return cloudinaryData.secure_url;
        });

        const results = await Promise.all(uploadPromises);
        uploadedProofUrls = results.filter(url => url !== undefined);
      }

      const subtotalJasa = getSubtotalJasa(order);
      const urgentFee = order.urgentFee || 0;
      const newTotalPrice = subtotalJasa + currentShoppingInput + urgentFee;

      const orderRef = doc(db, "orders", order.id);
      const updateData: any = { status: newStatus, driverCode: driverCode };
      
      if (newStatus === 'completed') {
         updateData.proofUrls = uploadedProofUrls;
         if (uploadedProofUrls.length > 0) {
           updateData.proofUrl = uploadedProofUrls[0]; 
         }
         updateData.shoppingCost = currentShoppingInput;
         updateData.totalPrice = newTotalPrice;
         
         try {
           const driverQuery = query(collection(db, "drivers"), where("code", "==", driverCode));
           const driverSnap = await getDocs(driverQuery);
           if (!driverSnap.empty) {
              const driverDocId = driverSnap.docs[0].id;
              await updateDoc(doc(db, "drivers", driverDocId), { isOnline: false });
           }
         } catch (driverUpdateError) {
           console.error("Gagal mengupdate status online driver:", driverUpdateError);
         }
         
         setIsOnline(false);
         localStorage.setItem(`mtm_online_${driverCode}`, "false");
      }

      await updateDoc(orderRef, updateData);
      
      if (newStatus === 'active') alert("Berhasil Diklaim! Hati-hati di jalan.");
      else if (newStatus === 'completed') {
        alert(`Tugas Selesai! Tagihan ke pelanggan: Rp ${formatCurrency(newTotalPrice)}`);
        setProofFiles(prev => { const n = {...prev}; delete n[order.id]; return n; });
        setProofPreviews(prev => { const n = {...prev}; delete n[order.id]; return n; });
      }
      fetchActiveOrders(); 
      
    } catch (error) { alert("Terjadi kesalahan jaringan."); } finally { setProcessingOrders(prev => ({...prev, [order.id]: false})); }
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-500 pb-10">
      
      <button 
        onClick={() => window.open(`https://wa.me/6285746137180?text=${encodeURIComponent(`🚨 *SOS DARURAT* 🚨\n\nNama: ${driverName}\nKode: ${driverCode}\n\nSaya membutuhkan bantuan operasional/darurat segera di lokasi saya saat ini!`)}`, '_blank')}
        className="fixed bottom-24 right-4 md:bottom-10 md:right-10 bg-rose-600 text-white w-14 h-14 rounded-full shadow-[0_0_20px_rgba(225,29,72,0.5)] flex items-center justify-center hover:scale-110 hover:bg-rose-700 transition-all z-[100] group"
      >
        <Siren size={28} className="animate-pulse" />
        <span className="absolute right-16 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Bantuan Darurat
        </span>
      </button>

      <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className={`absolute -top-24 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10 transition-colors duration-700 pointer-events-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>

        <div className="flex items-center gap-4 relative z-10">
          
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg md:text-xl shrink-0 uppercase overflow-hidden">
            {driverProfileUrl ? (
              <img src={driverProfileUrl} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              driverCode.substring(0, 2)
            )}
          </div>

          <div>
            <h2 className="font-bold text-slate-800 text-lg md:text-xl leading-tight capitalize">{driverName || `Driver ${driverCode}`}</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Kode: <span className="uppercase text-blue-600 font-semibold">{driverCode}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 relative z-10 w-full md:w-auto">
          <div className={`flex-1 md:flex-none py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs md:text-sm font-semibold transition-colors ${
            isOnline ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-500 border border-slate-200"
          }`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></div>
            {isOnline ? "ONLINE AKTIF" : "SEDANG OFFLINE"}
          </div>

          <button onClick={toggleOnline} className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 shrink-0 ${isOnline ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-800 hover:bg-slate-900 text-white"}`}>
            <Power size={20} strokeWidth={2.5} />
          </button>
          <button onClick={handleLogout} className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 shrink-0 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200">
            <LogOut size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 space-y-6">
          <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px] transition-colors ${dailyRevenue < 0 ? 'bg-rose-900 border border-rose-800' : 'bg-slate-900 border border-slate-800'}`}>
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl ${dailyRevenue < 0 ? 'bg-rose-500/30' : 'bg-blue-500/20'}`}></div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Wallet size={14} /> 
                {dailyRevenue < 0 ? 'Saldo Minus (Hutang Kas)' : 'Pendapatan Hari Ini'}
              </p>
              <h1 className={`text-3xl md:text-4xl font-bold tracking-tight mb-2 ${dailyRevenue < 0 ? 'text-rose-400' : 'text-white'}`}>
                {dailyRevenue < 0 && <span className="mr-1">-</span>}
                Rp {formatCurrency(Math.abs(dailyRevenue))}
              </h1>
              
              {totalReimburse > 0 && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 mt-3 inline-block w-full max-w-[250px]">
                  <p className="text-[10px] text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><ShoppingCart size={12}/> Uang Talangan Belanja</p>
                  <p className="text-lg font-bold text-rose-100">Rp {formatCurrency(totalReimburse)}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-5 border-t border-slate-700/50 pt-4 mt-4 relative z-10">
              <div><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Tugas Selesai</p><p className="text-base font-semibold flex items-center gap-1.5"><ShieldCheck size={14} className="text-blue-400"/> {completedCount}</p></div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div><p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Status</p><p className="text-base font-semibold text-emerald-400">Aktif</p></div>
            </div>
          </div>
          
          {isOnline && (
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-left-4">
              <div className="bg-white p-2.5 rounded-xl shadow-sm flex items-center justify-center min-w-[44px] min-h-[44px]">
                {weatherLoading ? <RefreshCw size={24} className="text-sky-500 animate-spin" /> : 
                 weatherData?.desc === "Hujan" || weatherData?.desc === "Badai Petir" ? <CloudRain className="text-sky-500" size={24} /> :
                 weatherData?.desc === "Berawan" || weatherData?.desc === "Berkabut" ? <Cloud className="text-sky-500" size={24} /> :
                 <Sun className="text-amber-500" size={24} />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                  Cuaca Lokal {weatherData ? `(${weatherData.temp}°C)` : ""}
                </h4>
                <p className="text-[10px] text-sky-600/80 mt-0.5 leading-relaxed font-medium">
                  {weatherLoading ? "Mendeteksi cuaca di lokasi Anda..." :
                   weatherData?.desc === "Hujan" || weatherData?.desc === "Badai Petir" ? "Area Anda sedang turun hujan. Siapkan jas hujan dan jaga selalu jarak aman berkendara!" :
                   weatherData?.desc === "Berawan" || weatherData?.desc === "Berkabut" ? "Cuaca berawan/berkabut. Kondisi jalanan aman, tetap hati-hati dalam bekerja." :
                   "Cuaca saat ini sangat cerah! Waktu yang sempurna untuk menyelesaikan banyak pesanan."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm md:text-base font-bold text-slate-800 uppercase tracking-wider">Radar Pesanan</h3>
            {isOnline && (
              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5"><RefreshCw size={10} className="animate-spin"/> Refresh Otomatis</span>
            )}
          </div>
          
          {isOnline && (
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-blue-500 transition-all duration-100 ease-linear" style={{ width: `${refreshProgress}%` }}></div>
            </div>
          )}
          
          {!isOnline && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[250px]">
              <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-slate-100"><Power size={32} className="text-slate-300" /></div>
              <h4 className="font-bold text-slate-600 text-base mb-1">Status Offline</h4>
              <p className="text-xs text-slate-500 font-medium">Nyalakan tombol Power di atas untuk mulai bekerja.</p>
            </div>
          )}

          {isOnline && isLoadingOrder && availableOrders.length === 0 && (
             <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[250px]">
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                  <div className="bg-white p-3 rounded-full shadow-sm border border-blue-100 relative z-10"><RefreshCw size={28} className="text-blue-500 animate-spin" /></div>
                </div>
                <h4 className="font-semibold text-blue-800 text-sm">Menyinkronkan Radar...</h4>
             </div>
          )}

          {isOnline && !isLoadingOrder && availableOrders.length === 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[250px]">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                <div className="bg-white p-3 rounded-full shadow-sm border border-blue-100 relative z-10"><Navigation size={28} className="text-blue-500" /></div>
              </div>
              <h4 className="font-semibold text-blue-800 text-base mb-1">Mencari Pesanan...</h4>
              <p className="text-xs text-blue-600/80 font-medium max-w-xs mx-auto">Mencari tugas sesuai preferensi kategori yang Anda pilih di menu Profil.</p>
            </div>
          )}

          {isOnline && availableOrders.length > 0 && (
            <div className="space-y-5">
              {availableOrders.map((order) => {
                const currentShoppingInput = Number(shoppingInputs[order.id]) || 0;
                const isProc = processingOrders[order.id] || false;
                const isGenPDF = generatingPDFs[order.id] || false;
                const currentProofFiles = proofFiles[order.id] || [];
                const currentPreviews = proofPreviews[order.id] || [];

                return (
                  <div key={order.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300 ${order.status === 'pending' ? 'border-amber-300' : 'border-emerald-400'}`}>
                    <div className={`${order.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-500 text-white'} text-xs font-bold p-3 text-center uppercase tracking-wider flex items-center justify-center gap-2`}>
                      {order.status === 'pending' ? <><AlertCircle size={16} /> Pesanan Baru Masuk!</> : <><Navigation size={16} /> Sedang Berjalan</>}
                    </div>
                    
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-5 border-b border-slate-100 pb-5">
                        <div className="flex-1 w-full pr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">{order.invoice}</span>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase border border-slate-200">{order.category}</span>
                          </div>
                          <h4 className="font-bold text-lg text-slate-800 leading-snug">{order.serviceName}</h4>
                          
                          {/* JIKA PELANGGAN MENGIRIM BANYAK GAMBAR LAMPIRAN (MULTI-UPLOAD) DARI ADMIN */}
                          {order.jobImageUrls && order.jobImageUrls.length > 0 && (
                            <div className="mt-3 mb-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <ImageIcon size={12} className="text-blue-500" /> Lampiran ({order.jobImageUrls.length})
                              </span>
                              <div className="flex overflow-x-auto gap-2 pb-2 snap-x hide-scrollbar">
                                {order.jobImageUrls.map((imgUrl: string, idx: number) => (
                                  <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-32 h-32 relative rounded-xl overflow-hidden border border-slate-200 shadow-sm snap-start hover:opacity-80 transition-opacity">
                                    <img src={imgUrl} alt={`Lampiran ${idx+1}`} className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* FALLBACK KOMPATIBILITAS (JIKA PESANAN LAMA HANYA ADA 1 FOTO) */}
                          {!order.jobImageUrls && order.jobImageUrl && (
                            <div className="mt-3 mb-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <ImageIcon size={12} className="text-blue-500"/> Lampiran (1)
                              </span>
                              <a href={order.jobImageUrl} target="_blank" rel="noopener noreferrer" className="block relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:opacity-80 transition-opacity">
                                <img src={order.jobImageUrl} alt="Lampiran Pekerjaan" className="w-full h-full object-cover" />
                              </a>
                            </div>
                          )}

                          {order.serviceDetails && (
                            <div className="mt-2 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed whitespace-pre-wrap shadow-sm">
                              <span className="font-bold text-amber-900 block mb-0.5 border-b border-amber-200/50 pb-0.5">Catatan/Detail:</span>
                              {order.serviceDetails}
                            </div>
                          )}

                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-slate-600 flex items-center gap-2">
                              <User size={14} className="text-slate-400"/> {order.customerName}
                            </p>
                            <p className="text-xs font-medium text-slate-600 flex items-center gap-2 group w-max">
                              <MessageCircle size={14} className="text-emerald-500"/> 
                              <a href={`https://wa.me/${formatWa(order.customerPhone)}?text=${encodeURIComponent(`Halo ${order.customerName}, saya Driver MTM yang akan memproses pesanan Anda (${order.invoice}). Mohon ditunggu ya! 🙏`)}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 hover:underline font-bold transition-colors">
                                {order.customerPhone}
                              </a>
                            </p>

                            <div className="text-xs font-medium text-slate-600 space-y-1.5 mt-3 pt-3 border-t border-slate-100">
                              
                              {order.origin && (
                                <div className="flex items-start gap-2.5">
                                  <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg mt-0.5 shrink-0"><MapPin size={14} /></div>
                                  <div className="w-full">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Dari (Penjemputan)</p>
                                    <a href={getGoogleMapsLink(order.origin)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline transition-colors break-words font-semibold text-slate-700 block">
                                      {order.origin}
                                    </a>
                                  </div>
                                </div>
                              )}

                              {order.destination && (
                                <div className="flex items-start gap-2.5 relative">
                                  {order.origin && <div className="absolute left-[13px] -top-3 bottom-5 w-px border-l-2 border-dashed border-slate-300"></div>}
                                  <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg mt-0.5 shrink-0 z-10"><Map size={14} /></div>
                                  <div className="w-full">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ke (Tujuan)</p>
                                    <a href={getGoogleMapsLink(order.destination)} target="_blank" rel="noopener noreferrer" className="hover:text-rose-600 hover:underline transition-colors break-words font-semibold text-slate-700 block">
                                      {order.destination}
                                    </a>
                                  </div>
                                </div>
                              )}

                              {(!order.origin && !order.destination) && order.customerAddress && (
                                <div className="flex items-start gap-2.5">
                                  <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg mt-0.5 shrink-0"><MapPin size={14} /></div>
                                  <div className="w-full">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Alamat Pelanggan</p>
                                    <a href={getGoogleMapsLink(order.customerAddress)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline transition-colors break-words font-semibold text-slate-700 block">
                                      {order.customerAddress}
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                        
                        <div className="sm:text-right bg-slate-50 p-4 rounded-xl border border-slate-200 sm:min-w-[180px] shrink-0 mt-4 sm:mt-0 h-max">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pendapatan Driver (Bersih)</p>
                          <h3 className="text-2xl font-black text-blue-600 mt-0.5">Rp {formatCurrency(getDriverNetIncome(order, settings))}</h3>
                          
                          <div className="mt-2.5 pt-2 border-t border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase">Tagihan Pelanggan:</p>
                            <p className="text-sm font-bold text-slate-800">Rp {formatCurrency(getSubtotalJasa(order) + currentShoppingInput + (order.urgentFee || 0))}</p>
                          </div>

                          <span className="inline-block mt-2.5 text-[9px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 uppercase w-full text-center">Via: {order.paymentMethod}</span>
                        </div>
                      </div>

                      {order.status === 'active' && order.category?.includes('Belanja') && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5">
                          <h4 className="text-rose-700 font-semibold text-sm mb-2.5 flex items-center gap-1.5"><ShoppingCart size={14} /> Total Uang Belanja (Struk)</h4>
                          <div className="flex items-center w-full px-3 py-2 bg-white border border-rose-200 rounded-lg focus-within:border-rose-400 transition-colors">
                            <span className="text-rose-400 font-semibold text-sm mr-2 pr-2 border-r border-rose-100">Rp</span>
                            <input type="number" value={shoppingInputs[order.id] || ""} onChange={(e) => setShoppingInputs(prev => ({...prev, [order.id]: Number(e.target.value) || ""}))} placeholder="Harga barang..." className="flex-1 w-full bg-transparent border-0 outline-none text-rose-700 font-bold text-sm" />
                          </div>
                        </div>
                      )}

                      {order.status === 'active' && (
                        <div className="grid grid-cols-2 gap-2.5 mb-5">
                          <button onClick={() => handleGenerateInvoice(order, false)} disabled={isGenPDF} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 font-semibold py-2.5 rounded-lg flex justify-center items-center gap-1.5 text-xs transition-all active:scale-95"><FileDown size={14} /> {isGenPDF ? "Memproses..." : "Lihat / Simpan Struk"}</button>
                          <button onClick={() => handleGenerateInvoice(order, true)} disabled={isGenPDF} className="bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 font-semibold py-2.5 rounded-lg flex justify-center items-center gap-1.5 text-xs transition-all active:scale-95"><Send size={14} /> Kirim WA ke Pelanggan</button>
                        </div>
                      )}

                      {/* BLOK UPLOAD BUKTI FOTO (MULTI UPLOAD) */}
                      {order.status === 'active' && (
                        <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                          <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                             <h4 className="text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5"><Camera size={14} /> Foto Bukti Selesai</h4>
                             {currentPreviews.length > 0 && <span className="text-[10px] text-slate-500 font-medium bg-slate-200 px-2 py-0.5 rounded-full">{currentPreviews.length} Foto</span>}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                             {/* FOTO-FOTO YANG SUDAH DIPILIH */}
                             {currentPreviews.map((prev, idx) => (
                                <div key={idx} className="relative aspect-square">
                                  <img src={prev} alt="Bukti" className="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm" />
                                  <button onClick={() => removeProofImage(order.id, idx)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1.5 shadow-md hover:bg-rose-600 transition-all active:scale-95">
                                    <X size={12} strokeWidth={3} />
                                  </button>
                                </div>
                             ))}

                             {/* TOMBOL TAMBAH FOTO (SELALU MUNCUL) */}
                             <label className="cursor-pointer bg-white border-2 border-slate-300 border-dashed hover:border-blue-400 hover:bg-blue-50/50 text-slate-500 font-medium rounded-xl flex flex-col items-center justify-center shadow-sm text-xs transition-colors aspect-square group">
                                <div className="bg-slate-50 p-2 rounded-full shadow-sm border border-slate-200 mb-1 group-hover:scale-110 transition-transform">
                                  <Plus size={20} className="text-blue-500" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 mt-1">Tambah Foto</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoChange(order.id, e)} />
                             </label>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        {order.status === 'pending' ? (
                          <button onClick={() => handleOrderStatus(order, 'active')} disabled={isProc} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
                            {isProc ? <Clock className="animate-spin" size={16} /> : "Terima & Klaim Pesanan"} <ArrowRight size={16} />
                          </button>
                        ) : (
                          <button onClick={() => handleOrderStatus(order, 'completed')} disabled={isProc || currentProofFiles.length === 0 || (order.category?.includes('Belanja') && currentShoppingInput === 0)} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
                            {isProc ? <><RefreshCw className="animate-spin" size={16} /> Mengunggah...</> : <><CheckCircle2 size={16} /> Selesaikan Pekerjaan</>}
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}