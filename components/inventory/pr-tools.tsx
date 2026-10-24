"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Check, X, Truck, PackageCheck } from "lucide-react";

import {
  createPurchaseRequest,
  decidePurchaseRequest,
  markPurchaseRequestOrdered,
  markPurchaseRequestReceived,
} from "@/lib/actions/purchaseRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItemOption = {
  id: string;
  itemName: string;
  unit: string;
  quantity: number;
  minStock: number;
};

// ---------- Buat PR ----------

export function NewPRDialog({ items }: { items: ItemOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inventoryId, setInventoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const selected = items.find((item) => item.id === inventoryId);

  function handleSubmit() {
    startTransition(async () => {
      const result = await createPurchaseRequest({
        inventoryId,
        quantity: Number(quantity),
        notes,
      });
      if (result.success) {
        toast.success("Purchase request dibuat");
        setOpen(false);
        setInventoryId("");
        setQuantity("");
        setNotes("");
        if (result.id) {
          router.push(`/dashboard/inventory/purchase-requests/${result.id}`);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Buat Purchase Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Purchase Request</DialogTitle>
          <DialogDescription>
            Ajukan pembelian barang. Butuh persetujuan Super Admin sebelum
            dipesan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Barang</Label>
            <Select value={inventoryId} onValueChange={setInventoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih barang" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemName} (stok {item.quantity} {item.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && selected.quantity < selected.minStock && (
              <p className="text-xs text-destructive">
                ⚠️ Stok barang ini di bawah minimum ({selected.minStock}{" "}
                {selected.unit})
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pr-qty">
              Jumlah{selected ? ` (${selected.unit})` : ""}
            </Label>
            <Input
              id="pr-qty"
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pr-notes">
              Catatan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Textarea
              id="pr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Merek/spesifikasi tertentu, urgensi, dll..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !inventoryId || Number(quantity) < 1}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengajukan...
              </>
            ) : (
              "Ajukan PR"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Workflow aksi di halaman detail ----------

export function PRWorkflowActions({
  prId,
  status,
  isSuperAdmin,
}: {
  prId: string;
  status: string;
  isSuperAdmin: boolean;
}) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDecision(value: "APPROVED" | "REJECTED") {
    setDecision(value);
    setDecisionOpen(true);
  }

  function handleDecide() {
    startTransition(async () => {
      const result = await decidePurchaseRequest({
        prId,
        decision,
        decisionNotes,
      });
      if (result.success) {
        toast.success(
          decision === "APPROVED" ? "PR disetujui" : "PR ditolak"
        );
        setDecisionOpen(false);
        setDecisionNotes("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleOrdered() {
    startTransition(async () => {
      const result = await markPurchaseRequestOrdered(prId);
      if (result.success) toast.success("PR ditandai sudah dipesan");
      else toast.error(result.error);
    });
  }

  function handleReceived() {
    startTransition(async () => {
      const result = await markPurchaseRequestReceived(prId);
      if (result.success) {
        toast.success("Barang diterima — stok inventory bertambah otomatis");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {status === "PENDING" && isSuperAdmin && (
        <>
          <Button
            onClick={() => openDecision("APPROVED")}
            disabled={isPending}
            className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
          >
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => openDecision("REJECTED")}
            disabled={isPending}
            className="w-full text-destructive hover:text-destructive sm:w-auto"
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </>
      )}
      {status === "PENDING" && !isSuperAdmin && (
        <p className="text-sm text-muted-foreground">
          Menunggu persetujuan Super Admin.
        </p>
      )}

      {status === "APPROVED" && (
        <Button
          onClick={handleOrdered}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
          Tandai Sudah Dipesan
        </Button>
      )}

      {status === "ORDERED" && (
        <Button
          onClick={handleReceived}
          disabled={isPending}
          className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PackageCheck className="h-4 w-4" />
          )}
          Barang Diterima (+ Stok)
        </Button>
      )}

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {decision === "APPROVED" ? "Setujui PR?" : "Tolak PR?"}
            </DialogTitle>
            <DialogDescription>
              {decision === "APPROVED"
                ? "PR yang disetujui bisa dilanjutkan ke pemesanan."
                : "PR yang ditolak tidak bisa diproses lagi."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decision-notes">
              Catatan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Textarea
              id="decision-notes"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDecisionOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              variant={decision === "APPROVED" ? "default" : "destructive"}
              onClick={handleDecide}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : decision === "APPROVED" ? (
                "Ya, Setujui"
              ) : (
                "Ya, Tolak"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
