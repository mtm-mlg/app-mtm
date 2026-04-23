"use client";
import { useState, useEffect } from "react";
import { 
  Save, Clock, Info, Weight, 
  QrCode, CreditCard, Building, FileText, 
  ToggleRight, ToggleLeft, Eye, Upload, Image as ImageIcon
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [companyInfo, setCompanyInfo] = useState({ name: "MTM APP", logoUrl: "" });
  const [commissionTiers, setCommissionTiers] = useState({ ringan: 70, sedang: 80, berat: 90 });
  const [paymentInfo, setPaymentInfo] = useState({ qrisUrl: "", bankName: "BCA", accountNumber: "", accountName: "" });
  const [invoiceConfig, setInvoiceConfig] = useState({
    showLogo: true, showQris: true, showBank: true,
    footerNote: "Terima kasih telah mempercayakan layanan Anda kepada MTM App. Harap simpan nota ini sebagai bukti pembayaran yang sah.",
  });

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.companyInfo) setCompanyInfo(data.companyInfo);
        if (data.commissionTiers) setCommissionTiers(data.commissionTiers);
        if (data.paymentInfo) setPaymentInfo(data.paymentInfo);
        if (data.invoiceConfig) setInvoiceConfig(data.invoiceConfig);
      }
    } catch (error) {
      console.error("Gagal memuat pengaturan:", error);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    fetchSettings(); 
  }, []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "mtm-mlg"); 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/dwprlhbzb/image/upload`, {
        method: "POST", body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setCompanyInfo({ ...companyInfo, logoUrl: data.secure_url });
        alert("Logo berhasil diupload! Klik SIMPAN PERUBAHAN untuk mengunci data.");
      }
    } catch (error) {
      alert("Gagal upload logo.");
    } finally {
      setIsUploading(false);
    }
  };

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "settings", "global");
      await setDoc(docRef, {
        companyInfo, commissionTiers, paymentInfo, invoiceConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true }); 
      alert("Seluruh pengaturan berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`max-w-[1400px] mx-auto pb-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-5 mt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Sistem</h2>
          <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
            <Info size={16} className="text-blue-500" /> Identitas perusahaan, komisi, dan metode pembayaran.
          </p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${isSaving ? "bg-slate-400 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
          {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-7 space-y-6">
          
          {/* KOMISI */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200 mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
               Kriteria Beban Komisi (Jatah Driver)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {['ringan', 'sedang', 'berat'].map((tier) => (
                <div key={tier} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${tier==='ringan'?'bg-emerald-100 text-emerald-600':tier==='sedang'?'bg-blue-100 text-blue-600':'bg-rose-100 text-rose-600'}`}><Weight size={16} /></div>
                    <h4 className="font-extrabold text-slate-800 text-sm capitalize">Beban {tier}</h4>
                  </div>
                  <div className={`bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between ${tier==='ringan'?'border-emerald-100':tier==='sedang'?'border-blue-100':'border-rose-100'}`}>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Driver</p>
                      <div className={`flex items-center gap-1 font-black text-lg ${tier==='ringan'?'text-emerald-600':tier==='sedang'?'text-blue-600':'text-rose-600'}`}>
                        <input type="number" value={commissionTiers[tier as keyof typeof commissionTiers]} onChange={(e) => handleUpdateTier(tier as 'ringan'|'sedang'|'berat', e.target.value)} className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right" /> %
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner</p>
                      <span className="font-black text-lg text-slate-700">{100 - commissionTiers[tier as keyof typeof commissionTiers]}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PERUSAHAAN */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="text-blue-600" size={20} /> Profil Perusahaan
            </h3>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Perusahaan (Muncul di Invoice)</label>
                <input type="text" value={companyInfo.name} onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})} placeholder="PT. MTM Sukses Makmur" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-sm font-bold transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 block">Logo Perusahaan</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                    {companyInfo.logoUrl ? <img src={companyInfo.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={24} />}
                  </div>
                  <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-2">
                    {isUploading ? <Clock className="animate-spin" size={14} /> : <Upload size={14} />}
                    {isUploading ? "Mengupload..." : "Ganti Logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* PEMBAYARAN */}
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

          {/* TAMPILAN NOTA */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="text-indigo-600" size={20} /> Konfigurasi Tampilan Nota
            </h3>
            <div className="space-y-2">
              {[
                { id: 'showLogo', label: 'Tampilkan Header', desc: 'Logo dan Nama Perusahaan.' },
                { id: 'showQris', label: 'Tampilkan QRIS', desc: 'Barcode / Link pembayaran QRIS.' },
                { id: 'showBank', label: 'Tampilkan Rekening', desc: 'Info transfer manual.' },
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

        {/* KOLOM KANAN: LIVE PREVIEW INVOICE A4 (DIPERBAIKI UNTUK RESPONSIVITAS) */}
        <div className="xl:col-span-5 relative">
          <div className="sticky top-8">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Eye size={16} /> Live Preview Invoice
            </h3>
            
            {/* WRAPPER RESPONSIVE SCROLL */}
            <div className="w-full overflow-x-auto pb-4 rounded-xl hide-scrollbar bg-slate-100/50 p-2 md:p-4 border border-slate-200 shadow-inner">
              <div className="bg-white p-6 rounded-lg shadow-md text-[10px] md:text-xs text-slate-800 min-w-[400px] mx-auto" style={{ fontFamily: "Arial, sans-serif" }}>
                
                {/* HEADER INVOICE */}
                {invoiceConfig.showLogo && (
                  <div className="flex flex-col items-center justify-center border-b-2 border-slate-100 pb-4 mb-4">
                    {companyInfo.logoUrl ? (
                      <img src={companyInfo.logoUrl} className="h-12 object-contain mb-2" alt="Logo" />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 rounded-lg border flex items-center justify-center mb-2">
                        <ImageIcon size={16} className="text-slate-400"/>
                      </div>
                    )}
                    <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight m-0">{companyInfo.name || "MTM APP"}</h1>
                    <p className="text-[8px] text-slate-500 tracking-[0.2em] uppercase mt-1">Invoice Tagihan Layanan</p>
                  </div>
                )}

                {/* DATA CUSTOMER & INVOICE */}
                <div className="flex justify-between mb-4">
                  <div>
                    <p className="text-slate-500 text-[8px] mb-0.5 uppercase tracking-wider m-0">Ditagihkan Kepada:</p>
                    <h2 className="font-bold text-sm text-slate-800 m-0">Budi Santoso</h2>
                    <p className="text-slate-600 mt-0.5 m-0 text-[10px]">0812-3456-7890</p>
                    <p className="text-slate-600 mt-0.5 max-w-[140px] leading-snug m-0 text-[10px]">Perum. Indah Blok A1, Surabaya</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-[8px] mb-0.5 uppercase tracking-wider m-0">Nomor Invoice:</p>
                    <h2 className="font-black text-sm text-blue-600 m-0">INV-202604001</h2>
                    <p className="text-slate-600 mt-0.5 m-0 text-[10px]">Tanggal: 24 Apr 2026</p>
                  </div>
                </div>

                {/* INFO DRIVER */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-4">
                  <h3 className="font-bold text-[9px] text-slate-800 border-b border-slate-200 pb-1 mb-2 mt-0">IDENTITAS DRIVER / ARMADA</h3>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <div><span className="text-slate-400">Nama:</span> <span className="font-bold text-slate-800">Ahmad Riyadi</span></div>
                    <div><span className="text-slate-400">Kontak:</span> <span className="font-bold text-slate-800">0812-xxxx</span></div>
                    <div><span className="text-slate-400">Plat:</span> <span className="font-bold text-slate-800">N 1234 ABC</span></div>
                  </div>
                </div>

                {/* TABEL PEMESANAN */}
                <table className="w-full text-left border-collapse mb-4 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-200 text-[8px] text-slate-500 uppercase">
                      <th className="p-2 font-bold">Deskripsi Jasa</th>
                      <th className="p-2 text-right font-bold">Qty</th>
                      <th className="p-2 text-right font-bold">Tarif</th>
                      <th className="p-2 text-right font-bold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-2">
                        <div className="font-bold text-slate-800">Antar Jemput (Motor)</div>
                      </td>
                      <td className="p-2 text-right text-slate-600">18 KM</td>
                      <td className="p-2 text-right text-slate-600">Rp 2.500</td>
                      <td className="p-2 text-right font-bold text-slate-800">Rp 45.000</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-2 font-bold text-rose-600">Biaya Urgent</td>
                      <td className="p-2 text-right text-slate-600">1 Lumpsum</td>
                      <td className="p-2 text-right text-slate-600">Rp 15.000</td>
                      <td className="p-2 text-right font-bold text-rose-600">Rp 15.000</td>
                    </tr>
                  </tbody>
                </table>

                {/* TOTAL TAGIHAN */}
                <div className="flex justify-end mb-6">
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 w-2/3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Tagihan</span>
                    <span className="text-base font-black text-slate-900">Rp 60.000</span>
                  </div>
                </div>

                {/* PEMBAYARAN & TANDA TANGAN */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 pr-4 flex gap-3">
                    {invoiceConfig.showBank && (
                      <div className="flex-1">
                        <h4 className="font-bold text-[9px] text-slate-800 border-b border-slate-200 pb-1 mb-1.5 mt-0">TRANSFER BANK</h4>
                        <p className="text-[11px] font-black text-blue-600 m-0">{paymentInfo.bankName || "BCA"} - {paymentInfo.accountNumber || "123456789"}</p>
                        <p className="text-[9px] text-slate-600 font-medium m-0">A/N: {paymentInfo.accountName || "Nama Pemilik"}</p>
                      </div>
                    )}
                    {invoiceConfig.showQris && (
                      <div className="text-center">
                        <h4 className="font-bold text-[9px] text-slate-800 border-b border-slate-200 pb-1 mb-1.5 mt-0">SCAN QRIS</h4>
                        {paymentInfo.qrisUrl ? (
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(paymentInfo.qrisUrl)}`} alt="QRIS" className="w-12 h-12 mx-auto border border-slate-200 p-0.5 rounded bg-white" />
                        ) : (
                          <div className="w-12 h-12 mx-auto border border-dashed border-slate-300 text-[8px] text-slate-400 flex items-center justify-center rounded">Kosong</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="w-24 text-center pt-1">
                    <p className="text-[9px] text-slate-800 mb-8 m-0">Salam Hormat,</p>
                    <p className="text-[10px] font-black text-slate-800 border-b border-slate-800 inline-block pb-0.5 m-0">Direktur Utama</p>
                    <p className="text-[8px] text-slate-500 mt-1 m-0">Manajemen MTM</p>
                  </div>
                </div>

                {/* FOOTER NOTA */}
                <div className="text-center border-t border-slate-200 pt-3">
                  <p className="text-[8px] text-slate-400 italic m-0">"{invoiceConfig.footerNote}"</p>
                </div>

              </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              .hide-scrollbar::-webkit-scrollbar { display: none; }
              .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />

          </div>
        </div>

      </div>
    </div>
  );
}