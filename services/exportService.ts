import { AppState, FamilyLabels, Expense, Family } from "../types";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
const formatCNY = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(val);
const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

// --- Markdown Export ---
export const exportToMarkdown = (state: AppState) => {
  const totalIDR = state.expenses.reduce((sum, e) => sum + e.amountIDR, 0);
  const totalCNY = totalIDR / state.exchangeRate;

  let md = `# ${state.ledgerName} - 账单明细\n\n`;
  md += `**导出时间**: ${new Date().toLocaleString()}\n`;
  md += `**汇率**: 1 CNY = ${state.exchangeRate} IDR\n`;
  md += `**参与家庭**: ${FamilyLabels[Family.F1]} (${state.family1Count}人), ${FamilyLabels[Family.F2]} (${state.family2Count}人)\n\n`;
  
  md += `## 概览\n`;
  md += `- 总支出: ${formatIDR(totalIDR)} (≈ ${formatCNY(totalCNY)})\n\n`;

  md += `## 账单列表\n\n`;
  md += `| 日期 | 描述 | 类别 | 付款人 | 金额 (IDR) | 金额 (CNY 约) |\n`;
  md += `|---|---|---|---|---|---|\n`;

  // Sort expenses by date ascending (early to late)
  const sorted = [...state.expenses].sort((a, b) => a.date - b.date);

  sorted.forEach(e => {
    const cny = e.amountIDR / state.exchangeRate;
    const payerName = e.payer === Family.F1 ? FamilyLabels[Family.F1] : FamilyLabels[Family.F2];
    md += `| ${formatDate(e.date)} | ${e.description} | ${e.category} | ${payerName} | ${formatIDR(e.amountIDR)} | ${formatCNY(cny)} |\n`;
  });

  // Create Blob and Download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.ledgerName}_export.md`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- PDF Export (Capture HTML) ---
export const exportToPDF = async (elementIdToCapture: string, fileName: string) => {
    const element = document.getElementById(elementIdToCapture);
    if (!element) return;

    try {
        // Use html2canvas to take a screenshot of the DOM
        const canvas = await html2canvas(element, {
            scale: 2, // Higher scale for better resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Multi-page logic
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`${fileName}.pdf`);
    } catch (e) {
        console.error("PDF Export failed", e);
        alert("PDF 导出失败，请重试");
    }
};