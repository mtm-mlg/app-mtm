"use client";
import { useState, useEffect } from "react";
import { 
  Save, Clock, Info, Weight, 
  QrCode, CreditCard, Building, FileText, 
  ToggleRight, ToggleLeft, Eye, Upload, Image as ImageIcon,
  Plus, Trash2, PenTool, Phone, MapPin, Briefcase, HelpCircle,
  Percent
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // INFO PERUSAHAAN
  const [companyInfo, setCompanyInfo] = useState({ 
    name: "Just Call Me - Mas Tulung Mas Kota Malang", 
    phone: "085746137180", 
    address: "Kota Malang",
    logoUrl: "" 
  });
  
  // KOMISI DRIVER SEBAGAI ACUAN UTAMA
  const [commissions, setCommissions] = useState({ ringan: 84, sedang: 85, berat: 87 });
  
  const [paymentInfo, setPaymentInfo] = useState({ 
    qrisUrl: "", 
    banks: [{ bankName: "DANA/GOPAY", accountNumber: "085746137180", accountName: "MUHAMMAD KHOIRUL SYAFIQ" }] 
  });
  
  const [invoiceConfig, setInvoiceConfig] = useState({
    showLogo: true, showQris: true, showBank: true,
    footerNote: "Terima kasih telah mempercayakan layanan Anda kepada Just Call Me. Harap simpan nota ini sebagai bukti pembayaran yang sah.",
    signatureName: "M. Rowi Bagus Wicaksono",
    signatureRole: "Manajemen Just Call Me"
  });

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.companyInfo) setCompanyInfo({ ...companyInfo, ...data.companyInfo });
        if (data.commissions) setCommissions(data.commissions);
        else if (data.commissionTiers) setCommissions(data.commissionTiers); 
        if (data.invoiceConfig) setInvoiceConfig({ ...invoiceConfig, ...data.invoiceConfig });
        if (data.paymentInfo) setPaymentInfo(data.paymentInfo);
      }
    } catch (error) { console.error("Gagal memuat pengaturan:", error); }
  };

  useEffect(() => { setIsLoaded(true); fetchSettings(); }, []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "mtm-mlg"); 
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/dwprlhbzb/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setCompanyInfo({ ...companyInfo, logoUrl: data.secure_url });
        alert("Logo berhasil diupload!");
      }
    } catch (error) { alert("Gagal upload logo."); } finally { setIsUploading(false); }
  };

  const handleUpdateTier = (tier: 'ringan'|'sedang'|'berat', value: string) => {
    let val = parseInt(value);
    if (isNaN(val)) val = 0;
    if (val > 100) val = 100;
    if (val < 0) val = 0;
    setCommissions({ ...commissions, [tier]: val });
  };
  
  const handleQrisChange = (value: string) => {
    setPaymentInfo({ ...paymentInfo, qrisUrl: value });
  };

  const handleAddBank = () => {
    setPaymentInfo({
      ...paymentInfo,
      banks: [...paymentInfo.banks, { bankName: "", accountNumber: "", accountName: "" }]
    });
  };

  const handleRemoveBank = (index: number) => {
    const newBanks = [...paymentInfo.banks];
    newBanks.splice(index, 1);
    setPaymentInfo({ ...paymentInfo, banks: newBanks });
  };

  const handleBankChange = (index: number, field: string, value: string) => {
    const newBanks = [...paymentInfo.banks];
    newBanks[index] = { ...newBanks[index], [field]: value };
    setPaymentInfo({ ...paymentInfo, banks: newBanks });
  };

  const handleToggleInvoice = (field: keyof typeof invoiceConfig) => {
    if (field === 'footerNote' || field === 'signatureName' || field === 'signatureRole') return;
    setInvoiceConfig({ ...invoiceConfig, [field]: !invoiceConfig[field as keyof typeof invoiceConfig] });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "settings", "global");
      await setDoc(docRef, { companyInfo, commissions, paymentInfo, invoiceConfig, updatedAt: new Date().toISOString() }, { merge: true }); 
      alert("Pengaturan Berhasil Disimpan!");
    } catch (error) { alert("Gagal menyimpan."); } finally { setIsSaving(false); }
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-[1400px] mx-auto pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-5 mt-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Sistem</h2>
          <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
            <Info size={16} className="text-blue-500" /> Identitas perusahaan, komisi driver/owner, dan desain nota.
          </p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${isSaving ? "bg-slate-400 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
          {isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />} Simpan Perubahan
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-6 space-y-6">
          
          {/* KRITERIA BEBAN KOMISI (VERTIKAL) */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200 relative">
            <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">
               Kriteria Beban Komisi (Jatah Driver)
            </h3>

            <div className="flex flex-col gap-4">
              
              {/* BEBAN RINGAN */}
              <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.05)] flex items-center justify-between transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4 w-1/3">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600"><Briefcase size={20} /></div>
                  <h4 className="font-bold text-slate-800 text-base">Beban Ringan</h4>
                </div>
                
                <div className="flex items-center gap-6 w-2/3 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Owner</p>
                    <div className="font-black text-emerald-600 text-2xl tracking-tight">
                      <span>{100 - commissions.ringan}</span><span className="text-sm ml-0.5">%</span>
                    </div>
                  </div>
                  
                  <div className="w-px h-10 bg-slate-200"></div>
                  
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Driver</p>
                    <div className="flex items-baseline justify-end font-black text-slate-800 text-2xl tracking-tight relative group">
                      <input 
                        type="number" 
                        value={commissions.ringan} 
                        onChange={(e) => handleUpdateTier('ringan', e.target.value)} 
                        className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right appearance-none" 
                        style={{ MozAppearance: 'textfield' }}
                      />
                      <span className="text-sm ml-0.5">%</span>
                      <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity rounded"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BEBAN SEDANG */}
              <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-[0_2px_10px_rgba(37,99,235,0.05)] flex items-center justify-between transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4 w-1/3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-600"><Briefcase size={20} /></div>
                  <h4 className="font-bold text-slate-800 text-base">Beban Sedang</h4>
                </div>
                
                <div className="flex items-center gap-6 w-2/3 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Owner</p>
                    <div className="font-black text-blue-600 text-2xl tracking-tight">
                      <span>{100 - commissions.sedang}</span><span className="text-sm ml-0.5">%</span>
                    </div>
                  </div>
                  
                  <div className="w-px h-10 bg-slate-200"></div>
                  
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Driver</p>
                    <div className="flex items-baseline justify-end font-black text-slate-800 text-2xl tracking-tight relative group">
                      <input 
                        type="number" 
                        value={commissions.sedang} 
                        onChange={(e) => handleUpdateTier('sedang', e.target.value)} 
                        className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right appearance-none" 
                        style={{ MozAppearance: 'textfield' }}
                      />
                      <span className="text-sm ml-0.5">%</span>
                      <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity rounded"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BEBAN BERAT */}
              <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-[0_2px_10px_rgba(225,29,72,0.05)] flex items-center justify-between transition-shadow hover:shadow-md">
                <div className="flex items-center gap-4 w-1/3">
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600"><Briefcase size={20} /></div>
                  <h4 className="font-bold text-slate-800 text-base">Beban Berat</h4>
                </div>
                
                <div className="flex items-center gap-6 w-2/3 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Owner</p>
                    <div className="font-black text-rose-600 text-2xl tracking-tight">
                      <span>{100 - commissions.berat}</span><span className="text-sm ml-0.5">%</span>
                    </div>
                  </div>
                  
                  <div className="w-px h-10 bg-slate-200"></div>
                  
                  <div className="text-right min-w-[70px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Driver</p>
                    <div className="flex items-baseline justify-end font-black text-slate-800 text-2xl tracking-tight relative group">
                      <input 
                        type="number" 
                        value={commissions.berat} 
                        onChange={(e) => handleUpdateTier('berat', e.target.value)} 
                        className="w-10 bg-transparent border-none outline-none p-0 focus:ring-0 text-right appearance-none" 
                        style={{ MozAppearance: 'textfield' }}
                      />
                      <span className="text-sm ml-0.5">%</span>
                      <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity rounded"></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="text-indigo-600" size={20} /> Identitas Kop Surat (Invoice)
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1">Nama Perusahaan / Organisasi</label>
                <input type="text" value={companyInfo.name} onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1"><Phone size={12}/> Nomor Telp</label>
                  <input type="text" value={companyInfo.phone} onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-medium transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1"><MapPin size={12}/> Alamat</label>
                  <input type="text" value={companyInfo.address} onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:bg-white text-sm font-medium transition-all" />
                </div>
              </div>
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 ml-1 block">Logo Perusahaan</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                    {companyInfo.logoUrl ? <img src={companyInfo.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={24} />}
                  </div>
                  <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-2">
                    {isUploading ? <Clock className="animate-spin" size={14} /> : <Upload size={14} />} Ganti Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="text-amber-600" size={20} /> Visibilitas & Tanda Tangan
            </h3>
            
            <div className="space-y-2 mb-6">
              {[
                { id: 'showLogo', label: 'Tampilkan Header Kop Surat', desc: 'Logo, Nama, Telp Perusahaan.' },
                { id: 'showQris', label: 'Tampilkan Barcode QRIS', desc: 'Kotak gambar QRIS di bawah tabel.' },
                { id: 'showBank', label: 'Tampilkan Rincian Rekening', desc: 'Daftar bank tujuan di bawah tabel.' },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div>
                    <h4 className={`text-sm font-bold ${invoiceConfig[item.id as keyof typeof invoiceConfig] ? 'text-slate-800' : 'text-slate-500'}`}>{item.label}</h4>
                    <p className="text-[11px] font-medium text-slate-400">{item.desc}</p>
                  </div>
                  <button onClick={() => handleToggleInvoice(item.id as keyof typeof invoiceConfig)}>
                    {invoiceConfig[item.id as keyof typeof invoiceConfig] ? <ToggleRight size={36} className="text-amber-500" /> : <ToggleLeft size={36} className="text-slate-300" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-4 mb-4">
              <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                <PenTool size={14} /> Tanda Tangan Penutup
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Tanda Tangan</label>
                  <input type="text" value={invoiceConfig.signatureName} onChange={(e) => setInvoiceConfig({...invoiceConfig, signatureName: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 text-sm font-bold transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Jabatan / Departemen</label>
                  <input type="text" value={invoiceConfig.signatureRole} onChange={(e) => setInvoiceConfig({...invoiceConfig, signatureRole: e.target.value})} className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 text-sm font-medium transition-all" />
                </div>
              </div>
            </div>

            <div className="px-2 pt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 ml-1">Catatan Kaki (Footer)</label>
              <textarea value={invoiceConfig.footerNote} onChange={(e) => setInvoiceConfig({...invoiceConfig, footerNote: e.target.value})} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-amber-500 text-xs font-medium text-slate-600 resize-none"></textarea>
            </div>
          </div>

        </div>

        <div className="xl:col-span-6 relative flex flex-col gap-6">
          
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="text-rose-600" size={20} /> Rekening Pembayaran
              </h3>
            </div>
            
            <div className="space-y-6">
              
              <div className="space-y-2 bg-blue-50/50 p-4 border border-blue-100 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-blue-800 flex items-center gap-1.5"><QrCode size={14}/> String QRIS Merchant (Dinamic QR)</label>
                </div>
                <textarea 
                  value={paymentInfo.qrisUrl} 
                  onChange={(e) => handleQrisChange(e.target.value)} 
                  placeholder="Paste String Text hasil scan barcode QRIS Merchant Anda di sini (Diawali dengan '000201...')"
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl outline-none focus:border-blue-500 text-xs font-mono break-all transition-all shadow-inner resize-none" 
                />
                <p className="text-[10px] text-blue-600 font-medium leading-relaxed mt-1 flex gap-1.5">
                  <HelpCircle size={12} className="shrink-0 mt-0.5" /> 
                  Untuk fitur Nominal Otomatis, ketik/paste kode mentah (NMID String) dari QRIS Anda. Jangan masukkan link gambar (.jpg). Sistem akan otomatis memasukkan nilai Rupiah tagihan ke dalam Barcode ini saat Struk PDF dicetak.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="text-xs font-bold text-slate-700 ml-1 flex items-center gap-1.5 mb-3"><Building size={14}/> Daftar Rekening Bank Tujuan</label>
                <div className="space-y-4">
                  {paymentInfo.banks.map((bank, index) => (
                    <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative transition-all group">
                      {paymentInfo.banks.length > 1 && (
                        <button type="button" onClick={() => handleRemoveBank(index)} className="absolute -top-3 -right-3 bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white p-1.5 rounded-lg transition-colors shadow-sm" title="Hapus Rekening Ini"><Trash2 size={14} /></button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Bank</label>
                          <input type="text" value={bank.bankName} onChange={(e) => handleBankChange(index, 'bankName', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-rose-500 text-sm font-bold uppercase transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">No Rekening / HP</label>
                          <input type="text" value={bank.accountNumber} onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-rose-500 text-sm font-black tracking-widest transition-all" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Atas Nama (A/N)</label>
                        <input type="text" value={bank.accountName} onChange={(e) => handleBankChange(index, 'accountName', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-rose-500 text-sm font-bold transition-all" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddBank} className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 py-3 rounded-xl w-full flex justify-center items-center gap-1.5 transition-colors shadow-sm">
                    <Plus size={16} strokeWidth={3} /> Tambah Rekening Lain
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 rounded-[1.5rem] p-4 shadow-inner border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 text-center"><Eye size={16} className="inline mr-2" /> Live Preview Invoice</h3>
            
            <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
              <div className="bg-white p-8 md:p-10 rounded-lg shadow-md text-[11px] text-black min-w-[650px] max-w-[700px] mx-auto" style={{ fontFamily: '"Bookman Old Style", Georgia, serif' }}>
                
                {invoiceConfig.showLogo && (
                  <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-3">
                    <div className="flex-1 pr-4">
                      <h1 className="text-[32px] font-black tracking-tighter m-0 mb-1">INVOICE</h1>
                      <h2 className="text-[14px] font-bold m-0 leading-snug">{companyInfo.name || "Nama Perusahaan"}</h2>
                      {companyInfo.address && <p className="m-0 text-[11px] mt-0.5 leading-tight">{companyInfo.address}</p>}
                      {companyInfo.phone && <p className="m-0 text-[11px] mt-0.5 leading-tight">No. Telp : {companyInfo.phone}</p>}
                    </div>
                    {companyInfo.logoUrl ? (
                      <img src={companyInfo.logoUrl} className="h-20 w-auto object-contain" style={{ marginTop: '-8px', marginBottom: '-10px' }} alt="Logo" />
                    ) : (
                      <div className="h-16 w-16 bg-slate-50 border border-slate-200 flex items-center justify-center"><ImageIcon size={20} className="text-slate-300"/></div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-start mb-8 text-[11px]">
                  <div className="w-[48%]">
                    <p className="font-bold text-[12px] mb-2">Ditagihkan Kepada :</p>
                    <table className="w-full border-none">
                      <tbody>
                        <tr><td className="w-20 align-top py-0.5">Nama</td><td className="w-2 align-top py-0.5">:</td><td className="font-semibold align-top py-0.5">Budi Santoso</td></tr>
                        <tr><td className="align-top py-0.5">No. WhatsApp</td><td className="align-top py-0.5">:</td><td className="align-top py-0.5">0812-3456-7890</td></tr>
                        <tr><td className="align-top py-0.5">Alamat</td><td className="align-top py-0.5">:</td><td className="align-top py-0.5 leading-tight">Perum. Indah Blok A1, Surabaya</td></tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="w-[48%]">
                    <table className="w-full border-none mb-3">
                      <tbody>
                        <tr><td className="w-24 align-top font-bold py-0.5">Nomor Invoice</td><td className="w-2 align-top py-0.5">:</td><td className="font-bold text-blue-700 align-top py-0.5">INV-202604001</td></tr>
                        <tr><td className="align-top font-bold py-0.5">Tanggal</td><td className="align-top py-0.5">:</td><td className="align-top py-0.5">24 Apr 2026</td></tr>
                      </tbody>
                    </table>
                    <p className="font-bold text-[12px] mb-1.5 mt-2">Identitas Driver :</p>
                    <table className="w-full border-none">
                      <tbody>
                        <tr><td className="w-24 align-top py-0.5">Nama</td><td className="w-2 align-top py-0.5">:</td><td className="align-top font-semibold py-0.5">Ahmad Riyadi</td></tr>
                        <tr><td className="align-top py-0.5">No. WhatsApp</td><td className="align-top py-0.5">:</td><td className="align-top py-0.5">0812-xxxx</td></tr>
                        <tr><td className="align-top py-0.5">No. Polisi</td><td className="align-top py-0.5">:</td><td className="align-top py-0.5">N 1234 ABC</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <table className="w-full text-left border-collapse mb-8 text-[11px] border-y-2 border-black">
                  <thead>
                    <tr className="border-b-2 border-black">
                      <th className="py-2.5 px-2 font-bold w-[45%] border-r border-slate-300 text-center">Deskripsi Jasa</th>
                      <th className="py-2.5 px-2 text-center font-bold w-[15%] border-r border-slate-300">QTY</th>
                      <th className="py-2.5 px-2 text-center font-bold w-[20%] border-r border-slate-300">Tarif</th>
                      <th className="py-2.5 px-2 text-center font-bold w-[20%]">Sub-Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black/20">
                      <td className="py-3 px-2 align-top border-r border-slate-300">Ongkos Kirim</td>
                      <td className="py-3 px-2 text-center align-top border-r border-slate-300">18 KM</td>
                      <td className="py-3 px-2 text-right align-top border-r border-slate-300">Rp 2.500</td>
                      <td className="py-3 px-2 text-right align-top">Rp 45.000</td>
                    </tr>
                    <tr className="border-b border-black/20">
                      <td className="py-3 px-2 align-top border-r border-slate-300">"Nama Jasa"</td>
                      <td className="py-3 px-2 text-center align-top border-r border-slate-300">1 Ls</td>
                      <td className="py-3 px-2 text-right align-top border-r border-slate-300">Rp 15.000</td>
                      <td className="py-3 px-2 text-right align-top">Rp 15.000</td>
                    </tr>
                    <tr className="border-b border-black/20">
                      <td className="py-3 px-2 align-top border-r border-slate-300">"Nama Barang"</td>
                      <td className="py-3 px-2 text-center align-top border-r border-slate-300">1 Ls</td>
                      <td className="py-3 px-2 text-right align-top border-r border-slate-300">Rp 50.000</td>
                      <td className="py-3 px-2 text-right align-top">Rp 50.000</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="py-3 px-2 align-top border-r border-slate-300">Biaya Urgent</td>
                      <td className="py-3 px-2 text-center align-top border-r border-slate-300">1 Ls</td>
                      <td className="py-3 px-2 text-right align-top border-r border-slate-300">Rp 10.000</td>
                      <td className="py-3 px-2 text-right align-top">Rp 10.000</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-4 px-2 text-right font-bold text-[12px] border-r border-slate-300">TOTAL TAGIHAN</td>
                      <td className="py-4 px-2 text-right font-black text-[13px]">Rp 120.000</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between items-start mt-8 pt-2">
                  
                  <div className="w-[50%]">
                    {invoiceConfig.showBank && (
                      <div>
                        <p className="font-bold text-[12px] mb-3">Pembayaran :</p>
                        {paymentInfo.banks.map((bank, idx) => (
                          <table key={idx} className="mb-4 text-[11px] w-full border-none">
                            <tbody>
                              <tr><td className="w-20 align-top py-0.5">Nama Bank</td><td className="w-2 align-top py-0.5">:</td><td className="font-bold align-top py-0.5">{bank.bankName || "BANK"}</td></tr>
                              <tr><td className="align-top py-0.5">No. Rekening</td><td className="align-top py-0.5">:</td><td className="font-bold align-top py-0.5">{bank.accountNumber || "12345"}</td></tr>
                              <tr><td className="align-top py-0.5">Atas Nama</td><td className="align-top py-0.5">:</td><td className="font-bold align-top py-0.5">{bank.accountName || "Pemilik"}</td></tr>
                            </tbody>
                          </table>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="w-[45%] flex flex-col items-center">
                    {invoiceConfig.showQris && (
                      <div className="text-center mb-6">
                        <p className="font-bold text-[11px] mb-2 text-blue-700">Scan QRIS (Auto Nominal)</p>
                        {paymentInfo.qrisUrl ? (
                           <div className="border border-black p-1 bg-white inline-block">
                             {/* PREVIEW: KITA ANGGAP INI BERISI TOTAL 120.000 */}
                             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://qris.example')}`} alt="QRIS" className="w-28 h-28 blur-[2px]" title="Barcode Asli Akan Dicetak di PDF" />
                           </div>
                        ) : (
                           <div className="w-28 h-28 border border-black flex flex-col items-center justify-center text-[10px] text-slate-400 bg-white">
                             (jika ada)
                           </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-center w-full mt-2">
                      <p className="text-[11px] mb-16 m-0">Hormat Saya,</p>
                      <div className="border-b border-black inline-block min-w-[150px] pb-1 mx-auto">
                        <p className="text-[12px] font-bold m-0 leading-none">
                          {invoiceConfig.signatureName || "Nama Manajer"}
                        </p>
                      </div>
                      <p className="text-[10px] mt-1 m-0 text-slate-800">
                        {invoiceConfig.signatureRole || "Manajemen MTM"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-12 text-[10px] italic px-6">
                  "{invoiceConfig.footerNote}"
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}