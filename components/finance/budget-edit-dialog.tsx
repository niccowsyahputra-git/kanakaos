"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { updateBudget } from "@/lib/actions/finance";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";


export function BudgetEditDialog({
  categoryId,
  categoryName,
  currentBudget,
}: {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
}) {
  const { tr, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState(String(currentBudget));
  const [isPending, startTransition] = useTransition();

  const budgetNumber = Number(budget) || 0;

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateBudget({
        categoryId,
        monthlyBudget: budgetNumber,
      });
      if (result.success) {
        toast.success(tr("Budget {0} diperbarui", { "0": categoryName }));
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <Pencil className="h-3.5 w-3.5" />
          {tr("Edit")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("Edit Budget: ")}{categoryName}</DialogTitle>
          <DialogDescription>
            {tr("Budget bulanan saat ini: ")}{formatRupiah(currentBudget, locale)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="budget-amount">{tr("Budget Bulanan Baru (Rp)")}</Label>
          <Input
            id="budget-amount"
            type="number"
            min={0}
            step={100000}
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          {budgetNumber > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatRupiah(budgetNumber, locale)}{tr("/bulan")}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tr("Batal")}</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Menyimpan...")}</>
            ) : (
              tr("Simpan Budget")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
