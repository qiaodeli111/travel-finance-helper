import React from 'react';
import { AppState, Family } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SummaryProps {
  state: AppState;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4567'];

export const Summary: React.FC<SummaryProps> = ({ state }) => {
  const { expenses, families, exchangeRate, currencyCode } = state;

  // 1. Calculate Totals
  const totalAmount = expenses.reduce((sum, e) => {
    const amt = e.amount !== undefined ? e.amount : (e as any).amountIDR;
    return sum + amt;
  }, 0);
  const totalCNY = totalAmount / exchangeRate;

  // 2. Calculate Family Stats
  const totalPeople = families.reduce((sum, f) => sum + f.count, 0);
  
  const familyStats = families.map(f => {
    // Paid
    const paid = expenses
      .filter(e => {
        if (e.payerId) return e.payerId === f.id;
        // Legacy check
        return (e as any).payer === (f.id === 'f1' ? 'Family 1' : 'Family 2');
      })
      .reduce((sum, e) => sum + (e.amount || (e as any).amountIDR), 0);

    // Share
    const ratio = totalPeople > 0 ? f.count / totalPeople : 0;
    const share = totalAmount * ratio;
    
    // Balance (Positive = Paid more than share = Should Receive)
    const balance = paid - share;

    return { ...f, paid, share, balance };
  });

  // 3. Settlement Logic
  interface Settlement {
    from: string;
    to: string;
    amount: number;
  }

  const settlements: Settlement[] = [];
  // Clone to modify balances during calculation
  const workingBalances = familyStats.map(f => ({ ...f }));
  
  const debtors = workingBalances.filter(b => b.balance < -0.01);
  const creditors = workingBalances.filter(b => b.balance > 0.01);
  
  let dIndex = 0;
  let cIndex = 0;
  
  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];
    
    // Amount to settle is min of what debtor owes and what creditor is owed
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
    
    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: amount
    });
    
    debtor.balance += amount;
    creditor.balance -= amount;
    
    if (Math.abs(debtor.balance) < 0.01) dIndex++;
    if (creditor.balance < 0.01) cIndex++;
  }

  // Chart Data
  const dataByCategory = expenses.reduce((acc, curr) => {
    const amt = curr.amount || (curr as any).amountIDR;
    const found = acc.find(item => item.name === curr.category);
    if (found) {
      found.value += amt;
    } else {
      acc.push({ name: curr.category, value: amt });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(val);
  const formatCNY = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white shadow-lg col-span-1 md:col-span-2 lg:col-span-1">
          <h3 className="text-teal-100 text-sm font-medium uppercase tracking-wider">总支出</h3>
          <div className="mt-2 text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          <div className="text-teal-100 text-sm">≈ {formatCNY(totalCNY)}</div>
        </div>
        
        {familyStats.map((f, index) => (
          <div key={f.id} className={`bg-white rounded-xl p-5 shadow-md border-l-4 ${index % 2 === 0 ? 'border-blue-500' : 'border-orange-500'}`}>
            <h3 className="text-gray-500 text-sm font-medium">{f.name} ({f.count}人)</h3>
            <div className="mt-1 text-xl font-bold text-gray-800">{formatCurrency(f.paid)}</div>
            <p className="text-xs text-gray-400 mt-1">应付份额: {formatCurrency(f.share)}</p>
            <p className={`text-xs mt-1 font-bold ${f.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {f.balance >= 0 ? `多付 ${formatCurrency(f.balance)}` : `少付 ${formatCurrency(Math.abs(f.balance))}`}
            </p>
          </div>
        ))}
      </div>

      {/* Settlement Section */}
      {settlements.length > 0 ? (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-indigo-900 font-semibold text-lg mb-4 text-center">最终结算方案</h2>
          <div className="space-y-3">
            {settlements.map((s, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">{s.from}</span>
                  <span className="text-gray-400 text-sm">支付给</span>
                  <span className="font-bold text-gray-800">{s.to}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-indigo-600">{formatCurrency(s.amount)}</span>
                  <span className="text-sm text-gray-500">(≈ {formatCNY(s.amount / exchangeRate)})</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-indigo-400 mt-4">
            * 结算逻辑：按照家庭列表顺序，前序家庭优先结清。
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center text-green-700 font-medium">
          账目已平，无需转账。
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
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
