"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card } from "@/components/ui/shared";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

type TimeFrame = "daily" | "monthly" | "yearly";

export interface AdminAnalyticsData {
  daily: {
    income: { name: string; income: number }[];
    sellers: { name: string; sellers: number }[];
    products: { name: string; products: number }[];
  };
  monthly: {
    income: { name: string; income: number }[];
    sellers: { name: string; sellers: number }[];
    products: { name: string; products: number }[];
  };
  yearly: {
    income: { name: string; income: number }[];
    sellers: { name: string; sellers: number }[];
    products: { name: string; products: number }[];
  };
}

interface AdminAnalyticsChartsProps {
  data: AdminAnalyticsData;
}

export function AdminAnalyticsCharts({ data }: AdminAnalyticsChartsProps) {
  const [timeframe, setTimeframe] = useState<TimeFrame>("monthly");

  const currentIncomeData = data[timeframe].income;
  const currentSellersData = data[timeframe].sellers;
  const currentProductsData = data[timeframe].products;

  const exportToExcel = () => {
    // 1. Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // 2. Add Revenue sheet
    const revenueData = currentIncomeData.map(item => ({
      "Time Period": item.name,
      "Revenue (INR)": item.income
    }));
    const wsRevenue = XLSX.utils.json_to_sheet(revenueData);
    XLSX.utils.book_append_sheet(wb, wsRevenue, "Revenue");
    
    // 3. Add Sellers sheet
    const sellersData = currentSellersData.map(item => ({
      "Time Period": item.name,
      "Sellers Count": item.sellers
    }));
    const wsSellers = XLSX.utils.json_to_sheet(sellersData);
    XLSX.utils.book_append_sheet(wb, wsSellers, "Sellers");
    
    // 4. Add Products sheet
    const productsData = currentProductsData.map(item => ({
      "Time Period": item.name,
      "Products Count": item.products
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productsData);
    XLSX.utils.book_append_sheet(wb, wsProducts, "Products");
    
    // 5. Write and download native Excel workbook
    const fileName = `earthcentric_analytics_${timeframe}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const CustomTooltip = ({ active, payload, label, prefix, suffix }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#FFFDF8] border border-[#D0C6B8]/70 p-3 rounded-lg shadow-xl text-[#173528]">
          <p className="text-sm font-bold mb-1">{label}</p>
          <p className="text-sm font-semibold flex items-center gap-1" style={{ color: payload[0].stroke || payload[0].fill }}>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: payload[0].stroke || payload[0].fill }}
            />
            {prefix}{payload[0].value.toLocaleString()}{suffix}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6 border-border/40 bg-card/50 shadow-sm col-span-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Platform Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Global metrics for all sellers, products, and revenue over time.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex bg-muted/50 p-1 rounded-lg">
            {(["daily", "monthly", "yearly"] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeframe === tf
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center justify-center space-x-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Income Chart */}
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Total Revenue
            </h3>
            <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded font-semibold">
              Income
            </span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentIncomeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => `₹${value / 1000}k`}
                  dx={-10}
                  width={40}
                />
                <Tooltip content={<CustomTooltip prefix="₹" suffix="" />} cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIncome)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sellers Chart */}
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              All Sellers
            </h3>
            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded font-semibold">
              Onboarded
            </span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentSellersData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dx={-10}
                  width={30}
                />
                <Tooltip content={<CustomTooltip prefix="" suffix=" Sellers" />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                <Bar
                  dataKey="sellers"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={timeframe === "daily" ? 12 : timeframe === "monthly" ? 24 : 48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Products Chart */}
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              All Products
            </h3>
            <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded font-semibold">
              Listings
            </span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentProductsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  dx={-10}
                  width={30}
                />
                <Tooltip content={<CustomTooltip prefix="" suffix=" Products" />} cursor={{ fill: "var(--muted)", opacity: 0.2 }} />
                <Bar
                  dataKey="products"
                  fill="#a855f7"
                  radius={[4, 4, 0, 0]}
                  barSize={timeframe === "daily" ? 12 : timeframe === "monthly" ? 24 : 48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}
