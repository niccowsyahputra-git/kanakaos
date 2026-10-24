import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFinanceSession } from "@/lib/auth-guard";
import { formatRupiah, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BudgetEditDialog } from "@/components/finance/budget-edit-dialog";

export const dynamic = "force-dynamic";

function UsageBar({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            percentage > 100
              ? "bg-red-500"
              : percentage > 80
                ? "bg-amber-500"
                : "bg-green-500"
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs font-medium",
          percentage > 100
            ? "text-red-600"
            : percentage > 80
              ? "text-amber-600"
              : "text-green-700"
        )}
      >
        {percentage.toFixed(0)}% terpakai
        {percentage > 100 && " — melebihi budget!"}
      </p>
    </div>
  );
}

export default async function BudgetPage() {
  const session = await requireFinanceSession();
  if (!session) redirect("/dashboard");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(now);

  // Kategori pengeluaran (Donasi = kategori pemasukan, tidak punya budget)
  const categories = await prisma.financeCategory.findMany({
    where: { NOT: { name: "Donasi" } },
    include: {
      transactions: {
        where: { type: "CREDIT", date: { gte: monthStart } },
        select: { amount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = categories.map((category) => {
    const budget = Number(category.monthlyBudget);
    const realized = category.transactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0
    );
    const remaining = budget - realized;
    const percentage = budget > 0 ? (realized / budget) * 100 : 0;
    return {
      id: category.id,
      name: category.name,
      budget,
      realized,
      remaining,
      percentage,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      budget: acc.budget + row.budget,
      realized: acc.realized + row.realized,
    }),
    { budget: 0, realized: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Budget Bulanan</h2>
        <p className="text-sm text-muted-foreground">
          Realisasi pengeluaran {monthName}:{" "}
          <span className="font-semibold text-foreground">
            {formatRupiah(totals.realized)}
          </span>{" "}
          dari budget {formatRupiah(totals.budget)}.
        </p>
      </div>

      {/* Mobile: card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{row.name}</p>
                <BudgetEditDialog
                  categoryId={row.id}
                  categoryName={row.name}
                  currentBudget={row.budget}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Budget</p>
                  <p className="font-medium">{formatRupiah(row.budget)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Realisasi</p>
                  <p className="font-medium">{formatRupiah(row.realized)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sisa</p>
                  <p
                    className={cn(
                      "font-medium",
                      row.remaining < 0 && "text-destructive"
                    )}
                  >
                    {formatRupiah(row.remaining)}
                  </p>
                </div>
              </div>
              <UsageBar percentage={row.percentage} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Budget Bulanan</TableHead>
              <TableHead className="text-right">
                Realisasi Bulan Ini
              </TableHead>
              <TableHead className="text-right">Sisa</TableHead>
              <TableHead className="w-56">Persentase Terpakai</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right">
                  {formatRupiah(row.budget)}
                </TableCell>
                <TableCell className="text-right">
                  {formatRupiah(row.realized)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    row.remaining < 0 && "text-destructive"
                  )}
                >
                  {formatRupiah(row.remaining)}
                </TableCell>
                <TableCell>
                  <UsageBar percentage={row.percentage} />
                </TableCell>
                <TableCell className="text-right">
                  <BudgetEditDialog
                    categoryId={row.id}
                    categoryName={row.name}
                    currentBudget={row.budget}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
