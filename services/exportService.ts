import { AppState } from "../types";
import { computeLedgerSettlement, formatPaidByCurrency, normalizeExpense } from './settlementService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const formatCurrency = (val: number, currency: string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);
const formatSettlementCurrency = (val: number, currency: string) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(val);
const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

// --- Markdown Export ---
export const exportToMarkdown = (state: AppState) => {
  const { expenses, families, ledgerName, destination, baseCurrency, exchangeRate, currencyCode } = state;
  const { settlementCurrency, totals, perFamily, transfers } = computeLedgerSettlement(state);

  const settlementCurrencyLabel = settlementCurrency || baseCurrency || 'CNY';
  const normalizedExpenses = expenses.map(expense => normalizeExpense(expense, state));
  const paidTotalText = formatPaidByCurrency(totals.totalPaymentByCurrency) || `${settlementCurrencyLabel} 0`;

  let md = `# ${ledgerName} - 账单明细\n\n`;
  md += `**导出时间**: ${new Date().toLocaleString()}\n`;
  md += `**目的地**: ${destination}\n`;
  md += `**结算币种**: ${settlementCurrencyLabel}\n`;
  md += `**账本默认汇率**: 1 ${baseCurrency} = ${exchangeRate} ${currencyCode} (仅用于旧账单回退)\n`;

  const familyStr = families.map(f => `${f.name} (${f.count}人)`).join(', ');
  md += `**参与家庭**: ${familyStr}\n\n`;

  md += `## 概览\n`;
  md += `- 总支出(付款币种): ${paidTotalText}\n`;
  md += `- 总支出(结算币种): ${formatSettlementCurrency(totals.totalSettlement, settlementCurrencyLabel)}\n\n`;

  md += `### 各家庭收支\n`;
  perFamily.forEach(stat => {
    const family = families.find(f => f.id === stat.familyId);
    if (!family) return;
    const status = stat.netSettlement >= 0
      ? `多付 ${formatSettlementCurrency(stat.netSettlement, settlementCurrencyLabel)}`
      : `少付 ${formatSettlementCurrency(Math.abs(stat.netSettlement), settlementCurrencyLabel)}`;
    const paidText = formatPaidByCurrency(stat.paidByCurrency) || `${settlementCurrencyLabel} 0`;
    md += `- **${family.name}**: 已付 ${paidText} | 应付 ${formatSettlementCurrency(stat.consumedSettlement, settlementCurrencyLabel)} | ${status}\n`;
  });
  md += `\n`;

  md += `## 最终结算方案\n`;

  if (transfers.length > 0) {
    transfers.forEach(s => {
      const fromFamily = families.find(f => f.id === s.fromFamilyId);
      const toFamily = families.find(f => f.id === s.toFamilyId);
      if (!fromFamily || !toFamily) return;
      md += `- **${fromFamily.name}** 支付给 **${toFamily.name}**: ${formatSettlementCurrency(s.amountSettlement, settlementCurrencyLabel)}\n`;
    });
  } else {
    md += `账目已平，无需转账。\n`;
  }
  md += `\n`;

  md += `## 账单列表\n\n`;
  md += `| 日期 | 描述 | 类别 | 付款人 | 支付金额 | 结算金额 (${settlementCurrencyLabel}) |\n`;
  md += `|---|---|---|---|---|---|\n`;

  const sorted = [...normalizedExpenses].sort((a, b) => a.date - b.date);

  sorted.forEach(e => {
    const family = families.find(f => f.id === e.payerId);
    const payerName = family ? family.name : '未知';

    md += `| ${formatDate(e.date)} | ${e.description} | ${e.category} | ${payerName} | ${formatCurrency(e.amountPayment, e.paymentCurrency)} | ${formatSettlementCurrency(e.amountSettlement, settlementCurrencyLabel)} |\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ledgerName}_export.md`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- PDF Export (Capture HTML) ---
export const exportToPDF = async (elementIdToCapture: string, fileName: string) => {
    const element = document.getElementById(elementIdToCapture);
    if (!element) {
      console.error(`Element with id ${elementIdToCapture} not found`);
      return;
    }

    try {
        // Use html2canvas to take a screenshot of the DOM
        const canvas = await html2canvas(element, {
            scale: 2, // Higher scale for better resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1200 // Force width to ensure layout is desktop-like
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
