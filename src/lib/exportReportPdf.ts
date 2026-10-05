import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/logo-team-taekwondo.png';
import { robotoRegular, robotoBold } from './fonts';

export interface ReportPdfInput {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename?: string;
}

export async function downloadReportPdf(data: ReportPdfInput) {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    
    // Roboto fontu yerine standart Helvetica'yı kullanalım ama karakter hatasını gidermek için 
    // jsPDF'in kendi içinde sunduğu ve karakter dönüşümü yapan bir yaklaşım sergileyelim.
    // Eğer Roboto'nun kendisi tarayıcıda hata veriyorsa, en azından PDF'in oluşması için Helvetica'ya dönelim.
    
    doc.setFont('helvetica', 'normal');
    // doc.addFileToVFS, addFont vb. işlemler PDF'i ağırlaştırıyor ve bazen JS stack overflow'a neden oluyor.
    // Karakter sorunu için veriyi PDF'e basmadan önce latin-1'e normalize etme çözümüne geri dönüyoruz.

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    try {
      const img = new Image();
      img.src = logoUrl;
      doc.addImage(img, 'PNG', pageWidth / 2 - 20, 10, 40, 15);
    } catch (e) { console.warn('Logo yüklenemedi', e); }

    // ── Header ──
    const normalize = (str: string) => {
      const map: Record<string, string> = {
        'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
      };
      return str.split('').map(char => map[char] || char).join('');
    };
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(178, 31, 36);
    doc.text(normalize(data.title), pageWidth / 2, 32, { align: 'center' });

    if (data.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 107, 125);
      doc.text(normalize(data.subtitle), pageWidth / 2, 40, { align: 'center' });
    }

    autoTable(doc, {
      startY: data.subtitle ? 45 : 38,
      head: [data.columns.map(c => normalize(c))],
      body: data.rows.map(row => row.map(cell => normalize(String(cell)))),
      theme: 'striped',
      headStyles: { fillColor: [178, 31, 36], textColor: [255, 255, 255], font: 'helvetica', fontStyle: 'bold', fontSize: 10, halign: 'left' },
      bodyStyles: { fontSize: 10, textColor: [44, 44, 52], font: 'helvetica' },
      alternateRowStyles: { fillColor: [248, 250, 253] },
      margin: { left: margin, right: margin },
      showHead: 'everyPage',
      didDrawPage: (hookData: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(138, 157, 176);
        doc.text(`Sayfa ${hookData.pageNumber} / ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      },
    });

    const safeName = (data.filename ?? data.title).trim().replace(/\s+/g, '-').toLowerCase() || 'rapor';
    doc.save(`${safeName}.pdf`);
  } catch (err) {
    console.error('PDF indirme hatası:', err);
    alert('PDF oluşturulurken bir hata meydana geldi.');
  }
}
