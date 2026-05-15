"use client";

import { useEffect, useMemo, useState } from "react";

type Summary = {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  thisMonthNet: number;
};

type MonthlyExpenseReportRow = {
  monthKey: string;
  monthLabel: string;
  expenseAmount: number;
};

type MonthlyIncomeVsExpensesRow = {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
};

type ExpenseRecord = {
  id: number;
  title: string;
  amount: number;
  expenseDate: string;
  description: string | null;
  category: string | null;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
};

export function ExpensesClient() {
  const [summary, setSummary] = useState<Summary>({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    thisMonthIncome: 0,
    thisMonthExpense: 0,
    thisMonthNet: 0,
  });
  const [monthlyExpenseReport, setMonthlyExpenseReport] = useState<MonthlyExpenseReportRow[]>([]);
  const [monthlyIncomeVsExpenses, setMonthlyIncomeVsExpenses] = useState<MonthlyIncomeVsExpensesRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    category: "",
    description: "",
  });
  const [expenseListSearch, setExpenseListSearch] = useState("");

  const loadData = async () => {
    const response = await fetch("/api/expenses", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load expenses.");
    }
    const payload = (await response.json()) as {
      summary: Summary;
      monthlyExpenseReport: MonthlyExpenseReportRow[];
      monthlyIncomeVsExpenses: MonthlyIncomeVsExpensesRow[];
      expenses: ExpenseRecord[];
    };
    setSummary(payload.summary);
    setMonthlyExpenseReport(payload.monthlyExpenseReport);
    setMonthlyIncomeVsExpenses(payload.monthlyIncomeVsExpenses);
    setExpenses(payload.expenses);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await loadData();
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load expenses.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredExpenses = useMemo(() => {
    const q = expenseListSearch.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((ex) => {
      const blob = [
        ex.title,
        ex.expenseDate,
        ex.category ?? "",
        ex.description ?? "",
        ex.createdByName ?? "",
        ex.amount.toFixed(2),
        String(ex.id),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [expenses, expenseListSearch]);

  const submitExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Expense amount must be greater than zero.");
      }

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amount,
          expenseDate: form.expenseDate,
          category: form.category || null,
          description: form.description || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to record expense.");
      }

      const payload = (await response.json()) as { message: string };
      setSuccessMessage(payload.message);
      setForm((previous) => ({
        ...previous,
        title: "",
        amount: "",
        category: "",
        description: "",
      }));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record expense.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading expense management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Total income</p>
          <p className="mt-2 text-2xl font-semibold text-green-600 dark:text-green-400">
            {summary.totalIncome.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Total expenses</p>
          <p className="mt-2 text-2xl font-semibold text-red">{summary.totalExpenses.toFixed(2)}</p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Net balance</p>
          <p className={`mt-2 text-2xl font-semibold ${summary.netBalance >= 0 ? "text-primary" : "text-red"}`}>
            {summary.netBalance.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Record expense</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Add operational expenses with date, category and description.
        </p>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        {successMessage ? (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        ) : null}

        <form onSubmit={submitExpense} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Expense title"
            value={form.title}
            onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            required
          />
          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            required
          />
          <input
            type="date"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={form.expenseDate}
            onChange={(event) => setForm((previous) => ({ ...previous, expenseDate: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Category (optional)"
            value={form.category}
            onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Record expense"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Monthly expense report</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Total expense</th>
              </tr>
            </thead>
            <tbody>
              {monthlyExpenseReport.map((row) => (
                <tr key={row.monthKey} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3">{row.monthLabel}</td>
                  <td className="px-3 py-3 font-medium">{row.expenseAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthlyExpenseReport.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No monthly expenses yet.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Income vs expenses</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          This month: income {summary.thisMonthIncome.toFixed(2)} | expenses {summary.thisMonthExpense.toFixed(2)} | net{" "}
          {summary.thisMonthNet.toFixed(2)}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Income</th>
                <th className="px-3 py-2">Expenses</th>
                <th className="px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyIncomeVsExpenses.map((row) => (
                <tr key={row.monthKey} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3">{row.monthLabel}</td>
                  <td className="px-3 py-3 text-green-600 dark:text-green-400">{row.income.toFixed(2)}</td>
                  <td className="px-3 py-3 text-red">{row.expense.toFixed(2)}</td>
                  <td className={`px-3 py-3 font-medium ${row.net >= 0 ? "text-primary" : "text-red"}`}>
                    {row.net.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthlyIncomeVsExpenses.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No income/expense activity yet.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Expense records</h2>
        <label htmlFor="expense-records-search" className="sr-only">
          Search expense records
        </label>
        <input
          id="expense-records-search"
          type="search"
          value={expenseListSearch}
          onChange={(e) => setExpenseListSearch(e.target.value)}
          placeholder="Search title, date, category, description, amount…"
          className="mt-3 w-full max-w-md rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Recorded by</th>
                <th className="px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{expense.expenseDate}</td>
                  <td className="px-3 py-3">{expense.title}</td>
                  <td className="px-3 py-3">{expense.category ?? "—"}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">{expense.description ?? "—"}</td>
                  <td className="px-3 py-3">{expense.createdByName ?? "System"}</td>
                  <td className="px-3 py-3 font-medium text-red">{expense.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No expenses recorded yet.</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No rows match your search.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
