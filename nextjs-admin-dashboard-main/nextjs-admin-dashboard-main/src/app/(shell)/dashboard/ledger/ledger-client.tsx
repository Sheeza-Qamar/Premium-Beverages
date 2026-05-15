"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerSummary = {
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

type LedgerClientInfo = {
  id: number;
  name: string;
};

type LedgerEntry = {
  id: string;
  clientId: number;
  clientName: string;
  entryDate: string;
  referenceType: "order" | "payment";
  referenceId: number;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  debit: number;
  credit: number;
  balance: number;
  notes: string | null;
};

export function LedgerClient() {
  const [summary, setSummary] = useState<LedgerSummary>({
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
  });
  const [clients, setClients] = useState<LedgerClientInfo[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [ledgerEntrySearch, setLedgerEntrySearch] = useState("");

  const loadData = async () => {
    const response = await fetch("/api/ledger", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load ledger.");
    }
    const payload = (await response.json()) as {
      summary: LedgerSummary;
      clients: LedgerClientInfo[];
      entries: LedgerEntry[];
    };
    setSummary(payload.summary);
    setClients(payload.clients);
    setEntries(payload.entries);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await loadData();
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load ledger.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredEntries = useMemo(() => {
    if (selectedClientId === "all") {
      return entries;
    }
    const clientId = Number(selectedClientId);
    if (!Number.isInteger(clientId) || clientId < 1) {
      return entries;
    }
    return entries.filter((entry) => entry.clientId === clientId);
  }, [entries, selectedClientId]);

  const filteredSummary = useMemo(() => {
    const totals = filteredEntries.reduce(
      (acc, entry) => {
        acc.totalDebit += entry.debit;
        acc.totalCredit += entry.credit;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 },
    );
    return {
      ...totals,
      closingBalance: totals.totalDebit - totals.totalCredit,
    };
  }, [filteredEntries]);

  const displayLedgerEntries = useMemo(() => {
    const q = ledgerEntrySearch.trim().toLowerCase();
    if (!q) return filteredEntries;
    return filteredEntries.filter((entry) => {
      const blob = [
        entry.entryDate,
        entry.clientName,
        entry.referenceType,
        String(entry.referenceId),
        entry.invoiceNumber ?? "",
        entry.paymentMethod ?? "",
        entry.debit > 0 ? entry.debit.toFixed(2) : "",
        entry.credit > 0 ? entry.credit.toFixed(2) : "",
        entry.balance.toFixed(2),
        entry.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [filteredEntries, ledgerEntrySearch]);

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">Client-wise ledger</h2>
            <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
              Debit = orders, credit = payments, with running balance per client.
            </p>
          </div>

          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-2 dark:border-dark-3 dark:bg-dark-2"
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
          >
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Total debit (orders)</p>
          <p className="mt-2 text-2xl font-semibold text-dark dark:text-white">
            {filteredSummary.totalDebit.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Total credit (payments)</p>
          <p className="mt-2 text-2xl font-semibold text-green-600 dark:text-green-400">
            {filteredSummary.totalCredit.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Closing balance</p>
          <p className="mt-2 text-2xl font-semibold text-primary">
            {filteredSummary.closingBalance.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Ledger entries</h2>
        <label htmlFor="ledger-entries-search" className="sr-only">
          Search ledger entries
        </label>
        <input
          id="ledger-entries-search"
          type="search"
          value={ledgerEntrySearch}
          onChange={(event) => setLedgerEntrySearch(event.target.value)}
          placeholder="Search date, client, invoice, reference, amounts, notes…"
          className="mt-3 w-full max-w-md rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Debit</th>
                <th className="px-3 py-2">Credit</th>
                <th className="px-3 py-2">Running Balance</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {displayLedgerEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{entry.entryDate}</td>
                  <td className="px-3 py-3">{entry.clientName}</td>
                  <td className="px-3 py-3 capitalize">
                    {entry.referenceType} #{entry.referenceId}
                    {entry.paymentMethod ? ` (${entry.paymentMethod})` : ""}
                  </td>
                  <td className="px-3 py-3">{entry.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-dark">{entry.debit > 0 ? entry.debit.toFixed(2) : "—"}</td>
                  <td className="px-3 py-3 text-green-600 dark:text-green-400">
                    {entry.credit > 0 ? entry.credit.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-3 font-medium text-primary">{entry.balance.toFixed(2)}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">{entry.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No ledger entries found.</p>
          ) : displayLedgerEntries.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No rows match your search.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-xs text-dark-5 dark:text-dark-6">
          Global totals: Debit {summary.totalDebit.toFixed(2)} | Credit {summary.totalCredit.toFixed(2)} | Closing{" "}
          {summary.closingBalance.toFixed(2)}
        </p>
      </section>
    </div>
  );
}
