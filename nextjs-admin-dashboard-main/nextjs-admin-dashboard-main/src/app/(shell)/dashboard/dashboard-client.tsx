"use client";

import { useEffect, useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

type AdminDashboard = {
  totalStock: number;
  totalProduction: number;
  totalSales: number;
  totalReceivables: number;
};

type ClientOption = { id: number; name: string };

type ClientOrder = {
  id: number;
  invoiceNumber: string | null;
  orderDate: string;
  totalAmount: number;
  status: "pending" | "completed" | "cancelled";
  paymentType: "credit" | "cash";
  recoveredAmount: number;
  pendingAmount: number;
};

type ClientDashboard = {
  clientId: number;
  clientName: string;
  totalPayable: number;
  totalPaid: number;
  remainingBalance: number;
  orderHistory: ClientOrder[];
} | null;

type DashboardPayload = {
  adminDashboard: AdminDashboard;
  clients: ClientOption[];
  selectedClientId: number | null;
  clientDashboard: ClientDashboard;
  charts: {
    monthlyFinancials: Array<{
      monthKey: string;
      monthLabel: string;
      sales: number;
      recovered: number;
      expenses: number;
    }>;
    monthlyProduction: Array<{
      monthKey: string;
      monthLabel: string;
      mix: number;
      pure: number;
    }>;
    receivablesByClient: Array<{
      clientName: string;
      pendingAmount: number;
    }>;
  };
};

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "danger"
        ? "text-red"
        : "text-dark dark:text-white";

  return (
    <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
      <p className="text-sm text-dark-5 dark:text-dark-6">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value.toFixed(2)}</p>
    </div>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardPayload>({
    adminDashboard: {
      totalStock: 0,
      totalProduction: 0,
      totalSales: 0,
      totalReceivables: 0,
    },
    clients: [],
    selectedClientId: null,
    clientDashboard: null,
    charts: {
      monthlyFinancials: [],
      monthlyProduction: [],
      receivablesByClient: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderHistorySearch, setOrderHistorySearch] = useState("");

  const loadDashboard = async (clientId?: number) => {
    const query = clientId ? `?clientId=${clientId}` : "";
    const response = await fetch(`/api/dashboard${query}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load dashboard.");
    }
    const payload = (await response.json()) as DashboardPayload;
    setData(payload);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await loadDashboard();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleClientChange = async (value: string) => {
    const selected = Number(value);
    if (!Number.isInteger(selected) || selected < 1) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loadDashboard(selected);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load client dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOrderHistorySearch("");
  }, [data.selectedClientId, data.clientDashboard?.clientId]);

  const filteredClientOrderHistory = useMemo(() => {
    const orders = data.clientDashboard?.orderHistory ?? [];
    const q = orderHistorySearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const blob = [
        order.orderDate,
        order.invoiceNumber ?? "",
        `order #${order.id}`,
        String(order.id),
        order.totalAmount.toFixed(2),
        order.recoveredAmount.toFixed(2),
        order.pendingAmount.toFixed(2),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [data.clientDashboard, orderHistorySearch]);

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red">{error}</p> : null}

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Admin Dashboard</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total stock" value={data.adminDashboard.totalStock} />
          <StatCard label="Total production" value={data.adminDashboard.totalProduction} />
          <StatCard label="Total sales" value={data.adminDashboard.totalSales} />
          <StatCard
            label="Total receivables"
            value={data.adminDashboard.totalReceivables}
            tone="danger"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Sales, Recovery & Expenses</h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">Last 6 months financial trend</p>
          <div className="mt-4">
            <Chart
              type="line"
              height={300}
              options={{
                chart: { toolbar: { show: false }, fontFamily: "inherit" },
                stroke: { curve: "smooth", width: 3 },
                colors: [BRAND.primaryHex, "#22AD5C", "#F23030"],
                xaxis: {
                  categories: data.charts.monthlyFinancials.map((m) => m.monthLabel),
                },
                dataLabels: { enabled: false },
                legend: { position: "top", horizontalAlign: "left" },
                grid: { strokeDashArray: 4 },
              } satisfies ApexOptions}
              series={[
                { name: "Sales", data: data.charts.monthlyFinancials.map((m) => m.sales) },
                { name: "Recovered", data: data.charts.monthlyFinancials.map((m) => m.recovered) },
                { name: "Expenses", data: data.charts.monthlyFinancials.map((m) => m.expenses) },
              ]}
            />
          </div>
        </div>

        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Production by Bottle Type</h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">Last 6 months production volume</p>
          <div className="mt-4">
            <Chart
              type="bar"
              height={300}
              options={{
                chart: { stacked: true, toolbar: { show: false }, fontFamily: "inherit" },
                colors: [BRAND.primaryHex, "#4db8d4"],
                xaxis: {
                  categories: data.charts.monthlyProduction.map((m) => m.monthLabel),
                },
                plotOptions: { bar: { borderRadius: 4, columnWidth: "42%" } },
                dataLabels: { enabled: false },
                legend: { position: "top", horizontalAlign: "left" },
                grid: { strokeDashArray: 4 },
              } satisfies ApexOptions}
              series={[
                { name: "Mix", data: data.charts.monthlyProduction.map((m) => m.mix) },
                { name: "Pure", data: data.charts.monthlyProduction.map((m) => m.pure) },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Top Receivables by Client</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">Clients with highest pending balances</p>
        <div className="mt-4">
          <Chart
            type="bar"
            height={320}
            options={{
              chart: { toolbar: { show: false }, fontFamily: "inherit" },
              plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
              colors: [BRAND.primaryHex],
              xaxis: { categories: data.charts.receivablesByClient.map((r) => r.clientName) },
              dataLabels: { enabled: false },
              grid: { strokeDashArray: 4 },
            } satisfies ApexOptions}
            series={[
              {
                name: "Pending",
                data: data.charts.receivablesByClient.map((r) => r.pendingAmount),
              },
            ]}
          />
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-dark dark:text-white">Client Dashboard</h2>
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-2 dark:border-dark-3 dark:bg-dark-2"
            value={data.selectedClientId ?? ""}
            onChange={(event) => void handleClientChange(event.target.value)}
          >
            {data.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {data.clientDashboard ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <StatCard label="Total payable" value={data.clientDashboard.totalPayable} />
              <StatCard label="Total paid" value={data.clientDashboard.totalPaid} tone="success" />
              <StatCard
                label="Remaining balance"
                value={data.clientDashboard.remainingBalance}
                tone="danger"
              />
            </div>

            <label htmlFor="dashboard-order-history-search" className="sr-only">
              Search order history
            </label>
            <input
              id="dashboard-order-history-search"
              type="search"
              value={orderHistorySearch}
              onChange={(event) => setOrderHistorySearch(event.target.value)}
              placeholder="Search date, invoice, amounts…"
              className="mt-4 w-full max-w-md rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stroke text-left dark:border-dark-3">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientOrderHistory.map((order) => (
                    <tr key={order.id} className="border-b border-stroke dark:border-dark-3">
                      <td className="px-3 py-3 whitespace-nowrap">{order.orderDate}</td>
                      <td className="px-3 py-3">{order.invoiceNumber ?? `Order #${order.id}`}</td>
                      <td className="px-3 py-3">{order.totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-green-600 dark:text-green-400">
                        {order.recoveredAmount.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 font-medium text-red">{order.pendingAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.clientDashboard.orderHistory.length === 0 ? (
                <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No order history for this client.</p>
              ) : filteredClientOrderHistory.length === 0 ? (
                <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No orders match your search.</p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No client data available yet.</p>
        )}
      </section>
    </div>
  );
}
