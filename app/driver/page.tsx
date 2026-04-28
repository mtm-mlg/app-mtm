"use client";
import { useState, useEffect } from "react";
import { 
  Power, MapPin, Navigation, Clock, ShieldCheck, 
  ArrowRight, Phone, AlertCircle, Wallet, CheckCircle2, User, Camera, 
  UploadCloud, RefreshCw, LogOut, ShoppingCart, FileDown, Send, 
  ExternalLink, MessageCircle, Siren, CloudRain, TrendingUp, Map,
  Sun, Cloud
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore"; 

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  
  const [driverName, setDriverName] = useState<string>("");
  const [driverVehicle, setDriverVehicle] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [driverProfileUrl, setDriverProfileUrl] = useState<string>(""); 
  
  // STATE KEUANGAN YANG SUDAH DISTANDARDISASI
  const [completedCount, setCompletedCount] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState(0); // Murni Jasa & Urgent (Bersih)
  const [totalReimburse, setTotalReimburse] = useState(0); // Murni Uang Talangan
  
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

  const toggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (driverCode) {
      localStorage.setItem(`mtm_online_${driverCode}`, newStatus.toString());
    }
  };

  const handleLogout = () => {
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
      } catch (error) {
        console.error("Gagal menarik cuaca live:", error);
      } finally {
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
  // FUNGSI PERHITUNGAN MATEMATIKA YANG SUDAH DISTANDARDISASI
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

  const getUnitPrice = (order: any) => {
    if (order.basePrice) return Number(order.basePrice);
    const sub = getSubtotalJasa(order);
    const qty = Number(order.quantity) || 1;
    return sub / qty;
  };

  const getDriverNetIncome = (order: any) => {
    const baseJasa = getSubtotalJasa(order);
    const tier = order.commissionTier || 'sedang';
    let driverPct = 0.80; 
    if (tier === 'ringan') driverPct = 0.70; 
    if (tier === 'sedang') driverPct = 0.80; 
    if (tier === 'berat') driverPct = 0.90;  
    
    const urgentFee = Number(order.urgentFee) || 0;
    return (baseJasa * driverPct) + urgentFee;
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
          setDriverName(myProfile.name);
          setDriverVehicle(myProfile.vehicle || "-");
          setDriverPhone(myProfile.phone || "-");
          setDriverProfileUrl(myProfile.profileUrl || ""); 
          if (myProfile.preferences) { myPrefs = { ...myPrefs, ...myProfile.preferences }; }
        }
      }

      if (resultOrder.success) {
        const allOrders = resultOrder.data;
        
        // 1. HITUNG SALDO BERDASARKAN SELURUH DATA ORDER SELESAI (SINGLE SOURCE OF TRUTH)
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

        // 2. AMBIL DATA ORDER YANG SEDANG BERJALAN/RADAR
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
    } catch (error) {
      console.error("Gagal mengambil data:", error);
    } finally {
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
      
      const unitPrice = getUnitPrice(order);
      const subtotalJasa = getSubtotalJasa(order);
      const urgentFee = Number(order.urgentFee) || 0;
      const currentTotal = subtotalJasa + currentShoppingInput + urgentFee;

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
            <p style="font-size: 14px; margin: 5px 0 0 0;">Tanggal: ${formatDateTime(order.createdAt)}</p>
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
            ${currentShoppingInput > 0 ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 15px 10px; font-size: 15px; font-weight: bold; color: #e11d48;">Harga Barang Belanjaan (Talangan)</td>
              <td style="padding: 15px 10px; text-align: right;">1 Lumpsum</td>
              <td style="padding: 15px 10px; text-align: right;">Rp ${currentShoppingInput.toLocaleString('id-ID')}</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #e11d48;">Rp ${currentShoppingInput.toLocaleString('id-ID')}</td>
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
      pdf.save(`Invoice_${order.invoice}.pdf`);

      if (sendWa) {
        const waNum = formatWa(order.customerPhone);
        let rincian = `*Ongkir/Jasa:* Rp ${subtotalJasa.toLocaleString('id-ID')}`;
        if (currentShoppingInput > 0) rincian += `\n*Talangan:* Rp ${currentShoppingInput.toLocaleString('id-ID')}`;
        if (urgentFee > 0) rincian += `\n*Urgent:* Rp ${urgentFee.toLocaleString('id-ID')}`;

        const pesan = `*INVOICE TAGIHAN MTM*\nYth. ${order.customerName},\n\n*Invoice:* ${order.invoice}\n*Layanan:* ${order.serviceName}\n*Driver:* ${driverName}\n\n${rincian}\n------------------------\n*TOTAL TAGIHAN:* Rp ${currentTotal.toLocaleString('id-ID')}\n\nTerima kasih! 🙏`;
        window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(pesan)}`, '_blank');
      }

    } catch (error) { alert("Gagal memproses PDF."); } finally { setGeneratingPDFs(prev => ({...prev, [order.id]: false})); }
  };

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

      const orderRef = doc(db, "orders", order.id);
      const updateData: any = { status: newStatus, driverCode: driverCode };
      if (newStatus === 'completed') {
         updateData.proofUrl = uploadedProofUrl;
         updateData.shoppingCost = currentShoppingInput;
         updateData.totalPrice = newTotalPrice;
      }

      await updateDoc(orderRef, updateData);
      
      if (newStatus === 'active') alert("Berhasil Diklaim! Hati-hati di jalan.");
      else if (newStatus === 'completed') {
        alert(`Tugas Selesai! Tagihan ke pelanggan: Rp ${newTotalPrice.toLocaleString('id-ID')}`);
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
          
          {/* KARTU PENDAPATAN YANG SUDAH DIPERBAIKI */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
            
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Wallet size={14} /> Saldo Jasa (Bersih)
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Rp {dailyRevenue.toLocaleString('id-ID')}</h1>
              
              {/* INFO TAMBAHAN: UANG TALANGAN */}
              {totalReimburse > 0 && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 mt-3 inline-block w-full max-w-[250px]">
                  <p className="text-[10px] text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><ShoppingCart size={12}/> Uang Talangan Belanja</p>
                  <p className="text-lg font-bold text-rose-100">Rp {totalReimburse.toLocaleString('id-ID')}</p>
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
                          <h3 className="text-2xl font-black text-blue-600 mt-0.5">Rp {getDriverNetIncome(order).toLocaleString('id-ID')}</h3>
                          
                          <div className="mt-2.5 pt-2 border-t border-slate-200">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase">Tagihan Pelanggan:</p>
                            <p className="text-sm font-bold text-slate-800">Rp {(getSubtotalJasa(order) + currentShoppingInput + (order.urgentFee || 0)).toLocaleString('id-ID')}</p>
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