"use client";
import { useState, useEffect } from "react";
import { 
  Save, Clock, Info, Weight, 
  QrCode, CreditCard, Building, FileText, 
  ToggleRight, ToggleLeft, Eye, Receipt, ShoppingBag,
  UserCheck, Phone
} from "lucide-react";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. STATE TIER KOMISI GLOBAL
  const [commissionTiers, setCommissionTiers] = useState({
    ringan: 70, 
    sedang: 80, 
    berat: 90,  
  });

  // 2. STATE PENGATURAN PEMBAYARAN
  const [paymentInfo, setPaymentInfo] = useState({
    qrisUrl: "https://qris.id/dummy-link-anda",
    bankName: "BCA",
    accountNumber: "1234567890",
    accountName: "Ahmad Albert",
  });

  // 3. STATE PENGATURAN TAMPILAN NOTA
  const [invoiceConfig, setInvoiceConfig] = useState({
    showLogo: true,
    showQris: true,
    showBank: true,
    footerNote: "Terima kasih telah mempercayakan layanan Anda kepada MTM App. Harap simpan nota ini sebagai bukti pembayaran yang sah.",
  });

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleUpdateTier = (tier: 'ringan'|'sedang'|'berat', value: string) => {
    setCommissionTiers({ ...commissionTiers, [tier]: parseInt(value) || 0 });
  };

  const handlePaymentInfo = (field: string, value: string) => {
    setPaymentInfo({ ...paymentInfo, [field]: value });
  };

  const handleToggleInvoice = (field: keyof typeof invoiceConfig) => {
    if (field === 'footerNote') return;
    setInvoiceConfig({ ...invoiceConfig, [field]: !invoiceConfig[field] });
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert("Pengaturan Sistem, Pembayaran, dan Nota berhasil disimpan!");
    }, 1500);
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-5 mt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Sistem</h2>
          <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
            <Info size={16} className="text-blue-500" /> Kelola komisi, metode pembayaran, dan tampilan nota pelanggan.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
            isSaving ? "bg-slate-400 text-white cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>

      {/* ========================================================= */}
      {/* BAGIAN 1: PENGATURAN TIER KOMISI GLOBAL */}
      {/* ========================================================= */}
      <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200 mb-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
           Kriteria Beban Komisi (Jatah Driver)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Weight size={16} /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Beban Ringan</h4>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver</p>
                <div className="flex items-center gap-1 text-emerald-600 font-black text-lg">
                  <input type="number" value={commissionTiers.ringan} onChange={(e) => handleUpdateTier('ringan', e.target.value)} className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right" /> %
                </div>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner</p>
                <span className="font-black text-lg text-slate-700">{100 - commissionTiers.ringan}%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Weight size={16} /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Beban Sedang</h4>
            </div>
            <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver</p>
                <div className="flex items-center gap-1 text-blue-600 font-black text-lg">
                  <input type="number" value={commissionTiers.sedang} onChange={(e) => handleUpdateTier('sedang', e.target.value)} className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right" /> %
                </div>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner</p>
                <span className="font-black text-lg text-slate-700">{100 - commissionTiers.sedang}%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><Weight size={16} /></div>
              <h4 className="font-extrabold text-slate-800 text-sm">Beban Berat</h4>
            </div>
            <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver</p>
                <div className="flex items-center gap-1 text-rose-600 font-black text-lg">
                  <input type="number" value={commissionTiers.berat} onChange={(e) => handleUpdateTier('berat', e.target.value)} className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right" /> %
                </div>
              </div>
              <div className="w-px h-8 bg-slate-100"></div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner</p>
                <span className="font-black text-lg text-slate-700">{100 - commissionTiers.berat}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="text-blue-600" size={20} /> Rekening & QRIS
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1.5"><QrCode size={14}/> Link / ID QRIS Dinamis</label>
                <input type="text" value={paymentInfo.qrisUrl} onChange={(e) => handlePaymentInfo('qrisUrl', e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm font-medium transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1.5"><Building size={14}/> Nama Bank</label>
                  <input type="text" value={paymentInfo.bankName} onChange={(e) => handlePaymentInfo('bankName', e.target.value)} placeholder="BCA / Mandiri" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm font-bold uppercase transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 text-sm">Nomor Rekening</label>
                  <input type="text" value={paymentInfo.accountNumber} onChange={(e) => handlePaymentInfo('accountNumber', e.target.value)} placeholder="1234..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm font-black tracking-widest transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Atas Nama (A/N)</label>
                <input type="text" value={paymentInfo.accountName} onChange={(e) => handlePaymentInfo('accountName', e.target.value)} placeholder="Nama Pemilik" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm font-bold transition-all" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="text-indigo-600" size={20} /> Konfigurasi Tampilan Nota
            </h3>
            <div className="space-y-2">
              {[
                { id: 'showLogo', label: 'Tampilkan Logo & Header', desc: 'Logo MTM App di bagian atas.' },
                { id: 'showQris', label: 'Tampilkan Barcode QRIS', desc: 'QRIS dinamis untuk scan bayar.' },
                { id: 'showBank', label: 'Tampilkan Info Rekening', desc: 'Rekening transfer manual.' },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className={`text-sm font-bold ${invoiceConfig[item.id as keyof typeof invoiceConfig] ? 'text-slate-800' : 'text-slate-500'}`}>{item.label}</h4>
                    <p className="text-[11px] font-medium text-slate-400">{item.desc}</p>
                  </div>
                  <button onClick={() => handleToggleInvoice(item.id as keyof typeof invoiceConfig)}>
                    {invoiceConfig[item.id as keyof typeof invoiceConfig] ? <ToggleRight size={36} className="text-indigo-600" /> : <ToggleLeft size={36} className="text-slate-300" />}
                  </button>
                </div>
              ))}
              <div className="pt-3 px-2">
                <label className="text-xs font-bold text-slate-700 block mb-2">Catatan Kaki (Footer)</label>
                <textarea value={invoiceConfig.footerNote} onChange={(e) => setInvoiceConfig({...invoiceConfig, footerNote: e.target.value})} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-xs font-medium text-slate-600 resize-none"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 relative">
          <div className="sticky top-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Eye size={16} /> Live Preview Nota
            </h3>
            
            <div className="bg-white rounded-t-3xl rounded-b-lg shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden relative max-w-sm mx-auto">
              <div className="h-4 w-full bg-slate-100 border-b border-dashed border-slate-300 flex space-x-2 px-4 pt-1">
                <div className="w-2 h-2 rounded-full bg-slate-200"></div><div className="w-2 h-2 rounded-full bg-slate-200"></div><div className="w-2 h-2 rounded-full bg-slate-200"></div>
              </div>

              <div className="p-6 md:p-8">
                {invoiceConfig.showLogo && (
                  <div className="text-center mb-5 animate-in fade-in zoom-in duration-300">
                    <div className="w-12 h-12 mx-auto bg-blue-600 rounded-xl flex items-center justify-center mb-2 shadow-md">
                      <Receipt className="text-white" size={24} />
                    </div>
                    <h2 className="font-black text-slate-800 text-lg">MTM App</h2>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Tagihan Layanan</p>
                  </div>
                )}

                <div className="space-y-1.5 mb-5 border-b border-dashed border-slate-200 pb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">No. Invoice</span>
                    <span className="font-bold text-slate-700">INV-00123</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Pelanggan</span>
                    <span className="font-bold text-slate-700">Budi Santoso</span>
                  </div>
                </div>

                {/* PREVIEW: INFORMASI DRIVER (BARU) */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 mb-5 space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1 flex items-center gap-1.5">
                    <UserCheck size={11} className="text-blue-500" /> Informasi Driver
                  </h4>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Nama Driver</span>
                    <span className="font-bold text-slate-800 tracking-tight">Ahmad Riyadi</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">No. Telepon</span>
                    <span className="font-bold text-blue-600 flex items-center gap-1">
                      <Phone size={10} /> 0812-3456-xxxx
                    </span>
                  </div>
                </div>

                <div className="mb-6 border-b border-dashed border-slate-200 pb-5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <ShoppingBag size={12} /> Data Pemesanan
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <p className="font-bold text-slate-800">Antar Jemput (Motor)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">18 KM x Rp 2.500</p>
                      </div>
                      <span className="font-black text-slate-900">Rp 45.000</span>
                    </div>
                    <div className="flex justify-between items-start text-xs">
                      <p className="font-bold text-rose-600">Biaya Urgent</p>
                      <span className="font-black text-rose-600">Rp 15.000</span>
                    </div>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tagihan</p>
                  <h1 className="text-3xl font-black text-slate-900">Rp 60.000</h1>
                </div>

                {invoiceConfig.showQris && (
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-center mb-4">
                    <p className="text-[10px] font-bold text-blue-600 mb-2 uppercase tracking-widest">Scan QRIS (Otomatis)</p>
                    <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                      <QrCode size={80} className="text-slate-800" strokeWidth={1} />
                    </div>
                  </div>
                )}

                {invoiceConfig.showBank && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 text-center">
                    <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">Atau Transfer Manual</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{paymentInfo.bankName}</p>
                    <p className="text-lg font-bold text-blue-600 tracking-wider my-0.5">{paymentInfo.accountNumber || "---"}</p>
                    <p className="text-[11px] font-semibold text-slate-500 italic">a/n {paymentInfo.accountName || "---"}</p>
                  </div>
                )}

                <div className="text-center mt-6">
                  <p className="text-[9px] text-slate-400 leading-relaxed font-medium italic">"{invoiceConfig.footerNote}"</p>
                </div>
              </div>

              <div className="h-4 w-full bg-slate-100 flex space-x-2 px-4 overflow-hidden border-t border-dashed border-slate-300">
                <div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div><div className="w-4 h-4 rounded-full bg-white -mt-2 shadow-inner"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}