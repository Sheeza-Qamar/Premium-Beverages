import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import { parseNonNegativeNumber, toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import { NextResponse } from "next/server";

type ExpenseRow = DbRow & {
  id: number;
  title: string;
  amount: string;
  expense_date: string;
  description: string | null;
  category: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
};

type MonthlyExpenseRow = DbRow & {
  month_key: string;
  expense_amount: string;
};

type MonthlyIncomeRow = DbRow & {
  month_key: string;
  income_amount: string;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  if (!year || !month) {
    return monthKey;
  }
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const [expenses] = await dbQuery<ExpenseRow[]>(
    `SELECT
       e.id,
       e.title,
       e.amount,
       e.expense_date,
       e.description,
       e.category,
       e.created_by,
       a.name AS created_by_name,
       e.created_at
     FROM expenses e
     LEFT JOIN admins a ON a.id = e.created_by
     ORDER BY e.expense_date DESC, e.id DESC
     LIMIT 300`,
  );

  const [expenseMonthly] = await dbQuery<MonthlyExpenseRow[]>(
    `SELECT
       DATE_FORMAT(expense_date, '%Y-%m') AS month_key,
       SUM(amount) AS expense_amount
     FROM expenses
     GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
     ORDER BY month_key DESC
     LIMIT 24`,
  );

  const [incomeMonthly] = await dbQuery<MonthlyIncomeRow[]>(
    `SELECT
       DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
       SUM(amount_paid) AS income_amount
     FROM payments
     GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
     ORDER BY month_key DESC
     LIMIT 24`,
  );

  const expenseMap = new Map(expenseMonthly.map((row) => [row.month_key, Number(row.expense_amount)]));
  const incomeMap = new Map(incomeMonthly.map((row) => [row.month_key, Number(row.income_amount)]));
  const monthSet = new Set<string>([...expenseMap.keys(), ...incomeMap.keys()]);
  const monthlyIncomeVsExpenses = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((monthKey) => {
      const income = incomeMap.get(monthKey) ?? 0;
      const expense = expenseMap.get(monthKey) ?? 0;
      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        income,
        expense,
        net: income - expense,
      };
    });

  const thisMonth = currentMonthKey();
  const thisMonthIncome = incomeMap.get(thisMonth) ?? 0;
  const thisMonthExpense = expenseMap.get(thisMonth) ?? 0;
  const totalIncome = incomeMonthly.reduce((sum, row) => sum + Number(row.income_amount), 0);
  const totalExpenses = expenseMonthly.reduce((sum, row) => sum + Number(row.expense_amount), 0);

  return NextResponse.json({
    summary: {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      thisMonthIncome,
      thisMonthExpense,
      thisMonthNet: thisMonthIncome - thisMonthExpense,
    },
    monthlyExpenseReport: expenseMonthly.map((row) => ({
      monthKey: row.month_key,
      monthLabel: formatMonthLabel(row.month_key),
      expenseAmount: Number(row.expense_amount),
    })),
    monthlyIncomeVsExpenses,
    expenses: expenses.map((row) => ({
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      expenseDate: row.expense_date,
      description: row.description,
      category: row.category,
      createdById: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const title = toTrimmedString(body?.title);
  const amount = parseNonNegativeNumber(body?.amount);
  const expenseDate = toTrimmedString(body?.expenseDate);
  const category = toOptionalTrimmedString(body?.category);
  const description = toOptionalTrimmedString(body?.description);

  if (!title) {
    return NextResponse.json({ message: "Expense title is required." }, { status: 400 });
  }
  if (amount === null || amount <= 0) {
    return NextResponse.json({ message: "Expense amount must be greater than zero." }, { status: 400 });
  }
  if (!expenseDate || !isValidDate(expenseDate)) {
    return NextResponse.json(
      { message: "Expense date is required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const [result] = await dbExecute(
    `INSERT INTO expenses
     (title, amount, expense_date, description, category, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [title, amount, expenseDate, description, category, auth.user.id],
  );

  return NextResponse.json(
    { message: "Expense recorded successfully.", id: result.insertId },
    { status: 201 },
  );
}
