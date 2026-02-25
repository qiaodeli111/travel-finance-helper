import React from 'react';
import { Expense, Family, FamilyLabels } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SummaryProps {
  expenses: Expense[];
  exchangeRate: number;
  family1Count: number;
  family2Count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4567'];

export const Summary: React.FC<SummaryProps> = ({ expenses, exchangeRate, family1Count, family2Count }) => {
  // 1. Calculate Totals
  const totalIDR = expenses.reduce((sum, e) => sum + e.amountIDR, 0);
  const totalCNY = totalIDR / exchangeRate;

  // 2. Calculate Payments by Family
  // Check mostly against the key start string to handle legacy data if any, or strictly matches
  const paidByF1 = expenses.filter(e => e.payer.includes('Family 1') || e.payer === Family.F1).reduce((sum, e) => sum + e.amountIDR, 0);
  const paidByF2 = expenses.filter(e => e.payer.includes('Family 2') || e.payer === Family.F2).reduce((sum, e) => sum + e.amountIDR, 0);

  // 3. Calculate Fair Share (Total Spend Split)
  const totalPeople = family1Count + family2Count;
  // Protect against divide by zero
  const f1Ratio = totalPeople > 0 ? family1Count / totalPeople : 0;
  const f2Ratio = totalPeople > 0 ? family2Count / totalPeople : 0;

  const shareF1 = totalIDR * f1Ratio;
  const shareF2 = totalIDR * f2Ratio;

  // 4. Calculate Balance
  // Balance = Paid - Share. Positive means they paid extra (owed money). Negative means they underpaid (owe money).
  const balanceF1 = paidByF1 - shareF1;
  const balanceF2 = paidByF2 - shareF2;

  // Settlement Logic
  let settlementMessage = "账目已平";
  let settlementAmountIDR = 0;
  let settlementAmountCNY = 0;
  let debtor = "";
  let creditor = "";

  if (balanceF1 > 100) { // Using a small threshold for floating point
    // F1 paid extra, F2 owes F1
    settlementAmountIDR = balanceF1;
    settlementAmountCNY = settlementAmountIDR / exchangeRate;
    debtor = FamilyLabels[Family.F2];
    creditor = FamilyLabels[Family.F1];
    settlementMessage = `${debtor} 应付给 ${creditor}`;
  } else if (balanceF2 > 100) {
    // F2 paid extra, F1 owes F2
    settlementAmountIDR = balanceF2;
    settlementAmountCNY = settlementAmountIDR / exchangeRate;
    debtor = FamilyLabels[Family.F1];
    creditor = FamilyLabels[Family.F2];
    settlementMessage = `${debtor} 应付给 ${creditor}`;
  }

  // Chart Data
  const dataByCategory = expenses.reduce((acc, curr) => {
    const found = acc.find(item => item.name === curr.category);
    if (found) {
      found.value += curr.amountIDR;
    } else {
      acc.push({ name: curr.category, value: curr.amountIDR });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  const formatCNY = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white shadow-lg">
          <h3 className="text-teal-100 text-sm font-medium uppercase tracking-wider">总支出</h3>
          <div className="mt-2 text-2xl font-bold">{formatIDR(totalIDR)}</div>
          <div className="text-teal-100 text-sm">≈ {formatCNY(totalCNY)}</div>
        </div>
        
        <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-medium">{FamilyLabels[Family.F1]} 已付 ({family1Count}人)</h3>
          <div className="mt-1 text-xl font-bold text-gray-800">{formatIDR(paidByF1)}</div>
          <p className="text-xs text-gray-400 mt-1">应付份额 ({family1Count}/{totalPeople}): {formatIDR(shareF1)}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border-l-4 border-orange-500">
          <h3 className="text-gray-500 text-sm font-medium">{FamilyLabels[Family.F2]} 已付 ({family2Count}人)</h3>
          <div className="mt-1 text-xl font-bold text-gray-800">{formatIDR(paidByF2)}</div>
           <p className="text-xs text-gray-400 mt-1">应付份额 ({family2Count}/{totalPeople}): {formatIDR(shareF2)}</p>
        </div>
      </div>

      {/* Settlement Section - The most important part */}
      {Math.abs(settlementAmountIDR) > 100 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center shadow-sm">
          <h2 className="text-indigo-900 font-semibold text-lg mb-2">最终结算</h2>
          <div className="flex flex-col items-center justify-center space-y-2">
            <span className="text-2xl font-bold text-indigo-600">{settlementMessage}</span>
            <div className="bg-white px-6 py-3 rounded-full shadow-sm border border-indigo-100">
              <span className="text-2xl font-bold text-gray-800">{formatIDR(settlementAmountIDR)}</span>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-xl font-medium text-gray-600">≈ {formatCNY(settlementAmountCNY)}</span>
            </div>
            <p className="text-sm text-indigo-400 max-w-md">
              根据 {family1Count}:{family2Count} 人数比例计算 (家庭1: {family1Count}人, 家庭2: {family2Count}人).
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="text-gray-700 font-semibold mb-4">消费类别统计</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {dataByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatIDR(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
