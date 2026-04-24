"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  User, MapPin, Package, Clock, Car, 
  ArrowRight, ShieldCheck, Phone, Map, 
  Hammer, Brain, Calculator, Info, Flame, Weight,
  ShoppingCart
} from "lucide-react";

export default function NewOrderPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  
  // STATE UNTUK DAFTAR DRIVER DINAMIS DARI DATABASE
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  useEffect(() => {
    setIsLoaded(true);
    // Tarik daftar driver saat halaman dimuat
    const fetchDrivers = async () => {
      try {
        const res = await fetch("/api/drivers");
        const result = await res.json();
        if (result.success) {
          setAvailableDrivers(result.data);
        }
      } catch (error) {
        console.error("Gagal menarik data driver:", error);
      }
    };
    fetchDrivers();
  }, []);

  // STATE INFO PELANGGAN
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState(""); 

  // ========================================================
  // STATE KATEGORI (SEKARANG ARRAY AGAR BISA PILIH LEBIH DARI 1)
  // ========================================================
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Jarak"]);
  
  // STATE CUSTOM INPUT JASA
  const [customServiceName, setCustomServiceName] = useState("");
  const [basePrice, setBasePrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [unit, setUnit] = useState("KM"); 
  
  // STATE LOKASI (MAPS API)
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [isCalculatingMap, setIsCalculatingMap] = useState(false);

  // STATE KRITERIA KOMISI (Ringan / Sedang / Berat)
  const [commissionTier, setCommissionTier] = useState("sedang");
  const [driverCommissionPct, setDriverCommissionPct] = useState<number | "">(80); 
  
  // STATE PENUGASAN & URGENT
  const [driverCode, setDriverCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("qris");
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentFee, setUrgentFee] = useState<number | "">(15000);

  // STATE SUBMIT FORM
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FUNGSI TOGGLE KATEGORI (BISA NYALA BANYAK SEKALIGUS)
  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      // Jangan izinkan kosong, minimal 1 kategori harus nyala
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter(cat => cat !== id));
      }
    } else {
      setSelectedCategories([...selectedCategories, id]);
    }
  };

  // HELPER GANTI SATUAN OTOMATIS SAAT KATEGORI BERUBAH
  useEffect(() => {
    if (selectedCategories.length > 1) {
      setUnit("Paket/Mix");
    } else {
      const cat = selectedCategories[0];
      if (cat === "Jarak") setUnit("KM");
      if (cat === "Tenaga") setUnit("Pekerja/Paket");
      if (cat === "Waktu") setUnit("Jam");
      if (cat === "Pikiran") setUnit("Project");
      if (cat === "Belanja") setUnit("Toko/Tempat");
    }
  }, [selectedCategories]);

  // HELPER GANTI PERSENTASE SAAT KRITERIA BERUBAH
  const handleTierChange = (tier: string) => {
    setCommissionTier(tier);
    if (tier === "ringan") setDriverCommissionPct(70);
    if (tier === "sedang") setDriverCommissionPct(80);
    if (tier === "berat") setDriverCommissionPct(90);
  };

  // FUNGSI HITUNG JARAK OTOMATIS (CALL BACKEND API)
  const handleHitungKM = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!origin || !destination) {
      alert("Harap masukkan titik jemput dan titik tujuan terlebih dahulu!");
      return;
    }
    setIsCalculatingMap(true);
    try {
      const res = await fetch(`/api/maps/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
      const data = await res.json();
      if (data.success) {
        setQuantity(data.distance.value); 
        alert(`Jarak ditemukan: ${data.distance.text}\nEstimasi Waktu: ${data.duration}`);
      } else {
        alert(`Gagal menghitung: ${data.error || "Lokasi tidak ditemukan."}`);
      }
    } catch (error) {
      alert("Terjadi kesalahan jaringan saat menghitung jarak.");
    } finally {
      setIsCalculatingMap(false);
    }
  };

  // ========================================================
  // KALKULATOR TOTAL
  // ========================================================
  const numBasePrice = Number(basePrice) || 0;
  const numQty = selectedCategories.includes("Waktu") && unit === "Borongan/Flat" ? 1 : (Number(quantity) || 1);
  const subtotalJasa = numBasePrice * numQty; // Ini yang kena komisi
  
  const numUrgentFee = isUrgent ? (Number(urgentFee) || 0) : 0;
  
  // Total harga di owner hanya menghitung Tarif Jasa + Urgent (Talangan belanja diset oleh driver nanti)
  const totalHarga = subtotalJasa + numUrgentFee;

  // ========================================================
  // FUNGSI SUBMIT KE FIREBASE BACKEND
  // ========================================================
  const submitOrder = async () => {
    if (!customerName || !customerPhone || !customerAddress || !customServiceName || !basePrice) {
      alert("Peringatan: Nama Pelanggan, No WA, Alamat, Nama Jasa, dan Tarif Dasar wajib diisi!");
      return;
    }

    setIsSubmitting(true);

    try {
      const ordersRes = await fetch("/api/orders");
      const ordersData = await ordersRes.json();
      
      let countThisMonth = 0;
      const now = new Date();
      const currentYear = now.getFullYear(); 
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

      if (ordersData.success) {
        const thisMonthOrders = ordersData.data.filter((o: any) => {
          if (!o.createdAt) return false;
          const d = new Date(o.createdAt);
          return d.getFullYear() === currentYear && String(d.getMonth() + 1).padStart(2, '0') === currentMonth;
        });
        countThisMonth = thisMonthOrders.length;
      }

      const sequenceNumber = String(countThisMonth + 1).padStart(3, '0'); 
      const generatedInvoice = `INV-${currentYear}${currentMonth}${sequenceNumber}`;

      const orderData = {
        invoice: generatedInvoice, 
        customerName,
        customerPhone,
        customerAddress, 
        category: selectedCategories.join(", "), 
        serviceName: customServiceName,
        basePrice: numBasePrice, 
        shoppingCost: 0, // <-- Di-set 0 dari sisi Owner. Driver yang akan update nilai ini di aplikasinya.
        unit,
        quantity: numQty,
        commissionTier,
        origin: selectedCategories.includes("Jarak") ? origin : null,
        destination: selectedCategories.includes("Jarak") ? destination : null,
        driverCode: driverCode || null,
        paymentMethod,
        isUrgent,
        urgentFee: numUrgentFee,
        totalPrice: totalHarga,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const response = await res.json();

      if (response.success) {
        alert(`Pesanan Berhasil Dibuat!\nNomor Invoice: ${generatedInvoice}`);
        router.push("/admin/orders");
      } else {
        alert(`Gagal membuat pesanan: ${response.error}`);
      }
    } catch (error) {
      alert("Terjadi kesalahan koneksi saat menyimpan pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: "Jarak", icon: MapPin, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { id: "Tenaga", icon: Hammer, color: "text-orange-600 bg-orange-50 border-orange-200" },
    { id: "Belanja", icon: ShoppingCart, color: "text-rose-600 bg-rose-50 border-rose-200" },
    { id: "Waktu", icon: Clock, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { id: "Pikiran", icon: Brain, color: "text-purple-600 bg-purple-50 border-purple-200" }
  ];

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER PAGE */}
      <div className="mb-8 border-b border-slate-200 pb-5 mt-2">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Buat Pesanan Custom</h2>
        <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
          <Info size={16} className="text-blue-500" /> Rincian jasa, tarif, dan beban kerja dapat disesuaikan manual.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ========================================================= */}
        {/* BAGIAN KIRI: FORM INPUT UTAMA */}
        {/* ========================================================= */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* KARTU 1: INFO PELANGGAN */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18} strokeWidth={2.5} /></div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Informasi Pelanggan</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Lengkap</label>
                <div className="flex items-center w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
                  <User size={16} className="text-slate-400 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso" 
                    className="flex-1 w-full bg-transparent border-0 outline-none focus:ring-0 p-0 text-slate-800 text-sm font-medium" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nomor WhatsApp</label>
                <div className="flex items-center w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
                  <Phone size={16} className="text-slate-400 mr-2 shrink-0" />
                  <input 
                    type="tel" 
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0812..." 
                    className="flex-1 w-full bg-transparent border-0 outline-none focus:ring-0 p-0 text-slate-800 text-sm font-medium" 
                  />
                </div>
              </div>

              {/* KOLOM ALAMAT/LINK LOKASI */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 ml-1">Alamat Lengkap / Link Maps Pelanggan</label>
                <div className="flex items-center w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
                  <MapPin size={16} className="text-slate-400 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Contoh: Perum. Indah Blok A1 atau Paste Link Gmaps..." 
                    className="flex-1 w-full bg-transparent border-0 outline-none focus:ring-0 p-0 text-slate-800 text-sm font-medium" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KARTU 2: PEMILIHAN KATEGORI & CUSTOM JASA */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Package size={18} strokeWidth={2.5} /></div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Detail Rincian Jasa (Custom)</h3>
            </div>
            
            <p className="text-xs text-slate-500 mb-3 font-medium">Bisa pilih lebih dari satu kategori (Multi-Jasa):</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 border-2 ${
                      isSelected 
                      ? `border-${cat.color.split(' ')[0].split('-')[1]}-500 ${cat.color} shadow-sm scale-105` 
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <cat.icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
                    <span className="text-[11px] font-bold">{cat.id}</span>
                  </button>
                );
              })}
            </div>

            {selectedCategories.includes("Jarak") && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                <label className="text-xs font-extrabold text-blue-800 ml-1 flex items-center gap-1.5 mb-3">
                  <Map size={14} /> Kalkulator Jarak Otomatis
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex items-center flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden">
                    <MapPin size={16} className="text-blue-500 mr-2 shrink-0" />
                    <input 
                      type="text" 
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="Lokasi Penjemputan..." 
                      className="flex-1 w-full bg-transparent border-0 outline-none p-0 text-slate-800 text-sm font-medium placeholder-slate-400" 
                    />
                  </div>
                  <div className="flex items-center flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden">
                    <Map size={16} className="text-rose-500 mr-2 shrink-0" />
                    <input 
                      type="text" 
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Lokasi Tujuan..." 
                      className="flex-1 w-full bg-transparent border-0 outline-none p-0 text-slate-800 text-sm font-medium placeholder-slate-400" 
                    />
                  </div>
                  <button 
                    onClick={handleHitungKM}
                    disabled={isCalculatingMap}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isCalculatingMap ? <Clock size={16} className="animate-spin" /> : <Calculator size={16} />}
                    {isCalculatingMap ? "Menghitung..." : "Hitung KM"}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Jasa / Rincian Pekerjaan</label>
                <input 
                  type="text" 
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder={`Contoh: ${selectedCategories.includes('Belanja') ? 'Beli Nasi Goreng & Antar ke Stasiun' : 'Antar Dokumen ke Stasiun'}`} 
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 text-sm font-bold" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-blue-700 ml-1">Tarif Dasar / Ongkir Jasa</label>
                  <div className="flex items-center w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
                    <span className="text-blue-400 font-bold mr-2 text-xs border-r border-blue-200 pr-2">Rp</span>
                    <input 
                      type="number" 
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value) || "")}
                      placeholder="0" 
                      className="flex-1 w-full bg-transparent border-0 outline-none p-0 text-blue-800 font-extrabold text-base" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">Satuan</label>
                  {selectedCategories.length === 1 && selectedCategories[0] === "Waktu" ? (
                    <select 
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 text-sm font-bold appearance-none cursor-pointer"
                    >
                      <option value="Jam">Per Jam</option>
                      <option value="Hari">Per Hari</option>
                      <option value="Borongan/Flat">Borongan (Flat/Tanpa Waktu)</option>
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Contoh: KM, Pcs, Orang" 
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 text-sm font-bold" 
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1">
                    Jumlah {unit !== "Borongan/Flat" ? unit : ""}
                  </label>
                  <input 
                    type="number" 
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || "")}
                    disabled={unit === "Borongan/Flat"}
                    placeholder="1" 
                    className={`w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-slate-800 font-extrabold text-base ${unit === 'Borongan/Flat' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'}`} 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1.5">
                    <Weight size={12} className="text-indigo-600" /> Kriteria Beban Jasa
                  </label>
                  <div className="bg-white p-1 rounded-xl flex border border-slate-300">
                    {[
                      { id: "ringan", label: "Ringan" },
                      { id: "sedang", label: "Sedang" },
                      { id: "berat", label: "Berat" }
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => handleTierChange(tier.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                          commissionTier === tier.id 
                          ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100" 
                          : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium ml-1 text-right">Potongan sistem otomatis aktif.</p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* BAGIAN KANAN: PENUGASAN, URGENT & NOTA PELANGGAN */}
        {/* ========================================================= */}
        <div className="xl:col-span-5 relative">
          
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200 sticky top-8">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="text-blue-600" size={20} /> Penugasan
            </h3>

            <div className="space-y-6">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Tugaskan ke Armada/Driver</label>
                <div className="flex items-center w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all overflow-hidden">
                  <Car size={18} className="text-slate-400 mr-2 shrink-0" />
                  <select 
                    value={driverCode}
                    onChange={(e) => setDriverCode(e.target.value)}
                    className="flex-1 w-full bg-transparent border-0 outline-none p-0 text-slate-800 text-sm font-bold appearance-none cursor-pointer"
                  >
                    <option value="">-- Lempar ke Semua (Tanpa Ditugaskan) --</option>
                    {availableDrivers.map(driver => (
                      <option key={driver.code} value={driver.code}>
                        {driver.name} ({driver.code}) - {driver.area}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Metode Pembayaran</label>
                <div className="bg-slate-100 p-1.5 rounded-xl flex border border-slate-200 gap-1">
                  {["QRIS", "Transfer", "Cash"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method.toLowerCase())}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                        paymentMethod === method.toLowerCase() ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl border-2 transition-all duration-300 overflow-hidden ${isUrgent ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                <label className="flex items-center justify-between p-4 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isUrgent ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Flame size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isUrgent ? 'text-rose-700' : 'text-slate-700'}`}>Tandai Urgent / Prioritas</h4>
                      <p className={`text-[11px] font-semibold ${isUrgent ? 'text-rose-500' : 'text-slate-400'}`}>Dikenakan biaya tambahan</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${isUrgent ? 'bg-rose-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isUrgent ? 'translate-x-5' : ''}`}></div>
                  </div>
                  <input type="checkbox" className="hidden" checked={isUrgent} onChange={() => setIsUrgent(!isUrgent)} />
                </label>

                {isUrgent && (
                  <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[11px] font-bold text-rose-700 ml-1 mb-1.5 block">Setel Biaya Tambahan</label>
                    <div className="flex items-center w-full px-3 py-2.5 bg-white border border-rose-200 rounded-lg focus-within:border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/10 transition-all">
                      <span className="text-rose-400 font-bold mr-2 text-xs">Rp</span>
                      <input 
                        type="number" 
                        value={urgentFee}
                        onChange={(e) => setUrgentFee(Number(e.target.value) || "")}
                        className="flex-1 w-full bg-transparent border-0 outline-none p-0 text-rose-700 text-sm font-bold" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-inner mt-6">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Calculator size={12} /> Ringkasan Tagihan Pelanggan</p>
                
                <div className="space-y-2.5 mb-4 border-b border-dashed border-slate-300 pb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500">Subtotal Jasa ({numQty} {unit})</span>
                    <span className="text-sm font-bold text-slate-700">Rp {subtotalJasa.toLocaleString('id-ID')}</span>
                  </div>
                  {isUrgent && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-amber-500 flex items-center gap-1"><Flame size={10} /> Biaya Urgent</span>
                      <span className="text-sm font-bold text-amber-600">Rp {numUrgentFee.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {selectedCategories.includes("Belanja") && (
                    <div className="mt-2 text-[10px] text-rose-500 italic bg-rose-50 p-2 rounded-lg border border-rose-100">
                      *Terdapat barang belanjaan yang estimasi harganya akan ditambahkan oleh driver saat pesanan dikerjakan.
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Total Bayar Sementara</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tighter">
                    <span className="text-sm text-slate-400 mr-1">Rp</span>{totalHarga.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* ================================================ */}
              {/* TOMBOL TERBITKAN INVOICE */}
              {/* ================================================ */}
              <div className="pt-2">
                <button 
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className={`w-full text-white text-base font-bold py-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 group ${
                    isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Clock size={18} className="animate-spin" /> Memproses Data...
                    </>
                  ) : (
                    <>
                      Terbitkan Invoice <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}