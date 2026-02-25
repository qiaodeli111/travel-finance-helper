import { AppState, Family } from "../types";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const formatCurrency = (val: number, currency: string) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);
const formatCNY = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(val);
const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

// --- Markdown Export ---
export const exportToMarkdown = (state: AppState) => {
  const { expenses, families, exchangeRate, currencyCode, ledgerName, destination } = state;

  const totalAmount = expenses.reduce((sum, e) => {
    const amt = e.amount !== undefined ? e.amount : (e as any).amountIDR;
    return sum + amt;
  }, 0);
  const totalCNY = totalAmount / exchangeRate;

  let md = `# ${ledgerName} - 账单明细\n\n`;
  md += `**导出时间**: ${new Date().toLocaleString()}\n`;
  md += `**目的地**: ${destination}\n`;
  md += `**汇率**: 1 CNY = ${exchangeRate} ${currencyCode}\n`;
  
  const familyStr = families.map(f => `${f.name} (${f.count}人)`).join(', ');
  md += `**参与家庭**: ${familyStr}\n\n`;
  
  md += `## 概览\n`;
  md += `- 总支出: ${formatCurrency(totalAmount, currencyCode)} (≈ ${formatCNY(totalCNY)})\n\n`;

  // Calculate Balances & Settlement for Markdown
  const totalPeople = families.reduce((sum, f) => sum + f.count, 0);
  const familyStats = families.map(f => {
    const paid = expenses
      .filter(e => {
        if (e.payerId) return e.payerId === f.id;
        return (e as any).payer === (f.id === 'f1' ? 'Family 1' : 'Family 2');
      })
      .reduce((sum, e) => sum + (e.amount || (e as any).amountIDR), 0);
    const ratio = totalPeople > 0 ? f.count / totalPeople : 0;
    const share = totalAmount * ratio;
    const balance = paid - share;
    return { ...f, paid, share, balance };
  });

  md += `### 各家庭收支\n`;
  familyStats.forEach(f => {
    const status = f.balance >= 0 ? `多付 ${formatCurrency(f.balance, currencyCode)}` : `少付 ${formatCurrency(Math.abs(f.balance), currencyCode)}`;
    md += `- **${f.name}**: 已付 ${formatCurrency(f.paid, currencyCode)} | 应付 ${formatCurrency(f.share, currencyCode)} | ${status}\n`;
  });
  md += `\n`;

  // Settlement Plan
  md += `## 最终结算方案\n`;
  const settlements: {from: string, to: string, amount: number}[] = [];
  const workingBalances = familyStats.map(f => ({ ...f }));
  const debtors = workingBalances.filter(b => b.balance < -0.01);
  const creditors = workingBalances.filter(b => b.balance > 0.01);
  
  let dIndex = 0;
  let cIndex = 0;
  
  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
    
    settlements.push({ from: debtor.name, to: creditor.name, amount });
    
    debtor.balance += amount;
    creditor.balance -= amount;
    
    if (Math.abs(debtor.balance) < 0.01) dIndex++;
    if (creditor.balance < 0.01) cIndex++;
  }

  if (settlements.length > 0) {
    settlements.forEach(s => {
      md += `- **${s.from}** 支付给 **${s.to}**: ${formatCurrency(s.amount, currencyCode)} (≈ ${formatCNY(s.amount / exchangeRate)})\n`;
    });
  } else {
    md += `账目已平，无需转账。\n`;
  }
  md += `\n`;

  md += `## 账单列表\n\n`;
  md += `| 日期 | 描述 | 类别 | 付款人 | 金额 (${currencyCode}) | 金额 (CNY 约) |\n`;
  md += `|---|---|---|---|---|---|\n`;

  // Sort expenses by date ascending
  const sorted = [...expenses].sort((a, b) => a.date - b.date);

  sorted.forEach(e => {
    const amt = e.amount !== undefined ? e.amount : (e as any).amountIDR;
    const cny = amt / exchangeRate;
    
    // Resolve Payer Name
    let pid = e.payerId;
    if (!pid && (e as any).payer) pid = (e as any).payer === 'Family 1' ? 'f1' : 'f2';
    const family = families.find(f => f.id === pid);
    const payerName = family ? family.name : '未知';

    md += `| ${formatDate(e.date)} | ${e.description} | ${e.category} | ${payerName} | ${formatCurrency(amt, currencyCode)} | ${formatCNY(cny)} |\n`;
  });

  // Create Blob and Download
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
