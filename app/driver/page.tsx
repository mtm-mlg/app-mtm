"use client";
import { useState, useEffect } from "react";
import { 
  Power, MapPin, Navigation, Clock, ShieldCheck, 
  ArrowRight, Phone, AlertCircle, Wallet, CheckCircle2, User, Camera, 
  UploadCloud, RefreshCw, LogOut, ShoppingCart, FileDown, Send, 
  ExternalLink, MessageCircle, Siren, CloudRain, TrendingUp, Map,
  Sun, Cloud, Image as ImageIcon
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});
  const [proofPreviews, setProofPreviews] = useState<Record<string, string | null>>({});
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

  const getSubtotalJasa = (order: any) => {
    const qty = Number(order.quantity) || 1;
    if (order.basePrice) return Number(order.basePrice) * qty; 
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

  const getOwnerCommission = (order: any) => {
    if (order.exactOwnerCommission !== undefined) return order.exactOwnerCommission;
    const base = getSubtotalJasa(order); 
    const tier = order.commissionTier?.toLowerCase() || 'sedang';
    
    let pct = 0.15; 
    if (settings && settings.commissions && settings.commissions[tier] !== undefined) {
       pct = (100 - Number(settings.commissions[tier])) / 100;
    } else {
       if (tier === 'ringan') pct = 0.16;
       else if (tier === 'sedang') pct = 0.15;
       else if (tier === 'berat') pct = 0.13;
    }
    return base * pct;
  };

  const getDriverNetIncome = (order: any) => {
    const baseJasa = getSubtotalJasa(order);
    const ownerComm = getOwnerCommission(order);
    const urgentFee = Number(order.urgentFee) || 0;
    return (baseJasa - ownerComm) + urgentFee;
  };

  const fetchActiveOrders = async () => {
    if (!isOnline || !driverCode) return;
    
    setIsLoadingOrder(true);
    setRefreshProgress(0); 
    try {
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
        
        const myCompletedOrders = allOrders.filter((o:any) => o.driverCode === driverCode && o.status === 'completed');
        
        let calcNetJasa = 0;
        let calcTalangan = 0;
        
        myCompletedOrders.forEach((o:any) => {
          calcNetJasa += getDriverNetIncome(o);
          calcTalangan += (Number(o.shoppingCost) || 0);
        });

        setDailyRevenue(calcNetJasa);
        setTotalReimburse(calcTalangan);
        setCompletedCount(myCompletedOrders.length);

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

  const handlePhotoChange = (orderId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFiles(prev => ({...prev, [orderId]: file}));
      setProofPreviews(prev => ({...prev, [orderId]: URL.createObjectURL(file)}));
    }
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

  // ============================================================================
  // FUNGSI INVOICE DENGAN PERBAIKAN BUG PDF KOSONG DAN QRIS DINAMIS
  // ============================================================================
  const handleGenerateInvoice = async (order: any, sendWa: boolean) => {
    if (!settings) { alert("Sedang memuat pengaturan. Mohon tunggu."); return; }
    
    const currentShoppingInput = Number(shoppingInputs[order.id]) || 0;
    if (order.category?.includes('Belanja') && currentShoppingInput === 0) {
       alert("Peringatan: Untuk pesanan Belanja, Anda wajib mengisi Nominal Uang Struk/Talangan terlebih dahulu!"); return;
    }
    
    setGeneratingPDFs(prev => ({...prev, [order.id]: true}));
    
    let invoiceElement: HTMLDivElement | null = null;

    try {
      const config = settings.invoiceConfig || {};
      const payInfo = settings.paymentInfo || {};
      const companyInfo = settings.companyInfo || {};
      
      const qty = Number(order.quantity) || 1;
      const subtotalJasa = getSubtotalJasa(order);
      const urgentFee = Number(order.urgentFee) || 0;
      
      // INI ADALAH TOTAL YANG AKAN DISISIPKAN KE QRIS
      const currentTotal = subtotalJasa + currentShoppingInput + urgentFee;

      const shippingFee = Number(order.shippingFee) || 0;
      const serviceFee = Number(order.serviceFee) || 0;
      const isSplitFormat = shippingFee > 0 || serviceFee > 0;

      // PROSES QRIS DINAMIS
      let finalQrisLink = "";
      if (config.showQris && payInfo.qrisUrl) {
         const theQrisPayload = generateDynamicQris(payInfo.qrisUrl, currentTotal);
         finalQrisLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(theQrisPayload)}`;
      }

      invoiceElement = document.createElement("div");
      
      // PERBAIKAN BUG: Gunakan Z-Index di belakang viewport ketimbang membuangnya ke koordinat -9999px
      // sehingga html2canvas di perangkat Mobile tetap bisa membacanya sebagai "elemen yang ada".
      invoiceElement.style.cssText = "position:fixed; top:0; left:0; width:800px; background:white; color:black; font-family:'Bookman Old Style', Georgia, serif; padding:40px; z-index:-1000; opacity: 1; overflow: hidden;";
      
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
                <tr><td style="vertical-align: top; font-weight: bold; padding: 2px 0;">Tanggal</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="vertical-align: top; padding: 2px 0;">${formatDateTime(order.createdAt)}</td></tr>
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
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">Ongkos Kirim</td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">${qty} ${order.unit || 'KM'}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(shippingFee)}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(shippingFee * qty)}</td>
              </tr>` : ''}

              ${serviceFee > 0 ? `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                  "${order.serviceName}"
                  ${order.serviceDetails ? `<div style="font-size: 9px; color: #475569; margin-top: 4px; white-space: pre-wrap; line-height: 1.3;">${order.serviceDetails}</div>` : ''}
                </td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">${qty} ${order.unit || 'Ls'}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(serviceFee)}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(serviceFee * qty)}</td>
              </tr>` : ''}
            ` : `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
                <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">
                  "${order.serviceName}"
                  ${order.serviceDetails ? `<div style="font-size: 9px; color: #475569; margin-top: 4px; white-space: pre-wrap; line-height: 1.3;">${order.serviceDetails}</div>` : ''}
                </td>
                <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">${qty} ${order.unit || 'Ls'}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(getUnitPrice(order))}</td>
                <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(subtotalJasa)}</td>
              </tr>
            `}

            ${currentShoppingInput > 0 ? `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.2);">
              <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">"Barang Belanjaan (Talangan)"</td>
              <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">1 Ls</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(currentShoppingInput)}</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(currentShoppingInput)}</td>
            </tr>` : ''}
            
            ${urgentFee > 0 ? `
            <tr style="border-bottom: 2px solid black;">
              <td style="padding: 12px 8px; vertical-align: top; border-right: 1px solid #cbd5e1;">Biaya Urgent</td>
              <td style="padding: 12px 8px; text-align: center; vertical-align: top; border-right: 1px solid #cbd5e1;">1 Ls</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top; border-right: 1px solid #cbd5e1;">Rp ${formatCurrency(urgentFee)}</td>
              <td style="padding: 12px 8px; text-align: right; vertical-align: top;">Rp ${formatCurrency(urgentFee)}</td>
            </tr>` : ''}

            <tr>
              <td colspan="3" style="padding: 16px 8px; text-align: right; font-weight: bold; font-size: 12px; border-right: 1px solid #cbd5e1;">TOTAL TAGIHAN</td>
              <td style="padding: 16px 8px; text-align: right; font-weight: 900; font-size: 13px;">Rp ${formatCurrency(currentTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 32px; padding-top: 8px;">
          
          <div style="width: 50%;">
            ${config.showBank ? `
              <div>
                <p style="font-weight: bold; font-size: 12px; margin: 0 0 12px 0;">Pembayaran :</p>
                ${payInfo.banks && Array.isArray(payInfo.banks) ? payInfo.banks.map((bank:any) => `
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
                    <tbody>
                      <tr><td style="width: 80px; vertical-align: top; padding: 2px 0;">Nama Bank</td><td style="width: 10px; vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.bankName || "BANK"}</td></tr>
                      <tr><td style="vertical-align: top; padding: 2px 0;">No. Rekening</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.accountNumber || "12345"}</td></tr>
                      <tr><td style="vertical-align: top; padding: 2px 0;">Atas Nama</td><td style="vertical-align: top; padding: 2px 0;">:</td><td style="font-weight: bold; vertical-align: top; padding: 2px 0;">${bank.accountName || "Pemilik"}</td></tr>
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

      document.body.appendChild(invoiceElement);

      const canvas = await html2canvas(invoiceElement, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      if (sendWa) {
        const waNum = formatWa(order.customerPhone);
        let rincian = "";
        
        if (isSplitFormat) {
           if (shippingFee > 0) rincian += `*Ongkir:* Rp ${formatCurrency(shippingFee * qty)}\n`;
           if (serviceFee > 0) rincian += `*Jasa Khusus:* Rp ${formatCurrency(serviceFee * qty)}`;
        } else {
           rincian = `*Ongkir/Jasa:* Rp ${formatCurrency(subtotalJasa)}`;
        }

        if (currentShoppingInput > 0) rincian += `\n*Talangan:* Rp ${formatCurrency(currentShoppingInput)}`;
        if (urgentFee > 0) rincian += `\n*Urgent:* Rp ${formatCurrency(urgentFee)}`;

        const pesan = `*INVOICE TAGIHAN MTM*\nYth. ${order.customerName},\n\n*Invoice:* ${order.invoice}\n*Layanan:* ${order.serviceName}\n*Driver:* ${driverName}\n\n${rincian}\n------------------------\n*TOTAL TAGIHAN:* Rp ${formatCurrency(currentTotal)}\n\nTerima kasih! 🙏`;
        window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(pesan)}`, '_blank');
      } else {
        pdf.save(`Invoice_${order.invoice}.pdf`);
      }

    } catch (error) { alert("Gagal memproses PDF Invoice. Pastikan sinyal internet stabil."); } finally { 
      if (invoiceElement && document.body.contains(invoiceElement)) {
        document.body.removeChild(invoiceElement);
      }
      setGeneratingPDFs(prev => ({...prev, [order.id]: false})); 
    }
  };

  // =====================================================================
  // FUNGSI SELESAIKAN PEKERJAAN (UPDATE STATUS DRIVER DI-PERBAIKI)
  // =====================================================================
  const handleOrderStatus = async (order: any, newStatus: string) => {
    const currentShoppingInput = Number(shoppingInputs[order.id]) || 0;
    const currentProofFile = proofFiles[order.id];

    if (newStatus === 'completed' && !currentProofFile) return alert("Harap unggah foto bukti!");
    const isBelanja = order.category?.includes('Belanja');
    if (newStatus === 'completed' && isBelanja && currentShoppingInput === 0) return alert("Wajib isi Nominal Uang Talangan Belanja!");

    setProcessingOrders(prev => ({...prev, [order.id]: true}));
    let uploadedProofUrl = null;

    try {
      if (newStatus === 'completed' && currentProofFile) {
        const formData = new FormData();
        formData.append("file", currentProofFile);
        formData.append("upload_preset", "mtm-mlg");

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/dwprlhbzb/image/upload`, { method: "POST", body: formData });
        const cloudinaryData = await cloudinaryRes.json();
        if (cloudinaryData.secure_url) uploadedProofUrl = cloudinaryData.secure_url;
      }

      const subtotalJasa = getSubtotalJasa(order);
      const urgentFee = order.urgentFee || 0;
      const newTotalPrice = subtotalJasa + currentShoppingInput + urgentFee;

      // 1. UPDATE PESANAN
      const orderRef = doc(db, "orders", order.id);
      const updateData: any = { status: newStatus, driverCode: driverCode };
      
      if (newStatus === 'completed') {
         updateData.proofUrl = uploadedProofUrl;
         updateData.shoppingCost = currentShoppingInput;
         updateData.totalPrice = newTotalPrice;
         
         // 2. PERBAIKAN: CARI DOKUMEN DRIVER BERDASARKAN FIELD 'code'
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
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Wallet size={14} /> Saldo Jasa (Bersih)
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Rp {formatCurrency(dailyRevenue)}</h1>
              
              {totalReimburse > 0 && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 mt-3 inline-block w-full max-w-[250px]">
                  <p className="text-[10px] text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><ShoppingCart size={12}/> Uang Talangan Belanja</p>
                  <p className="text-lg font-bold text-rose-100">Rp {formatCurrency(totalReimburse)}</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-5 border-t border-slate-700/50 pt-4 mt-4">
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
                const proofPrev = proofPreviews[order.id];
                const proofFl = proofFiles[order.id];

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
                          
                          {/* JIKA PELANGGAN MENGIRIM BANYAK GAMBAR LAMPIRAN (MULTI-UPLOAD) */}
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
                          <h3 className="text-2xl font-black text-blue-600 mt-0.5">Rp {formatCurrency(getDriverNetIncome(order))}</h3>
                          
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

                      {order.status === 'active' && (
                        <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                          <h4 className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center justify-center gap-1.5"><Camera size={14} /> Foto Bukti Selesai</h4>
                          {proofPrev ? (
                            <div className="relative inline-block">
                              <img src={proofPrev} alt="Bukti" className="h-32 object-contain rounded-lg border border-slate-300" />
                              <button onClick={() => { setProofFiles(prev => { const n = {...prev}; delete n[order.id]; return n; }); setProofPreviews(prev => { const n = {...prev}; delete n[order.id]; return n; }); }} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm"><AlertCircle size={14} /></button>
                            </div>
                          ) : (
                            <label className="cursor-pointer bg-white border border-slate-300 hover:border-blue-400 text-blue-600 font-medium py-3 px-4 rounded-lg flex flex-col items-center justify-center shadow-sm w-full text-xs transition-colors">
                              <UploadCloud size={20} className="mb-1" /> Buka Kamera
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoChange(order.id, e)} />
                            </label>
                          )}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        {order.status === 'pending' ? (
                          <button onClick={() => handleOrderStatus(order, 'active')} disabled={isProc} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
                            {isProc ? <Clock className="animate-spin" size={16} /> : "Terima & Klaim Pesanan"} <ArrowRight size={16} />
                          </button>
                        ) : (
                          <button onClick={() => handleOrderStatus(order, 'completed')} disabled={isProc || !proofFl || (order.category?.includes('Belanja') && currentShoppingInput === 0)} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-sm">
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