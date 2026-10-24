"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, XCircle, RefreshCw } from "lucide-react";

import { generateChildInsight } from "@/lib/actions/ai";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AiInsightCard({ childId }: { childId: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      const result = await generateChildInsight(childId);
      if (result.success) {
        setInsight(result.text);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Insight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!insight && !isPending && (
          <p className="text-sm text-muted-foreground">
            AI akan menganalisis 5 log harian terakhir dan memberikan ringkasan
            kondisi anak beserta saran intervensi untuk pengasuh.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Analisis Gagal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {insight && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {insight}
            </p>
            <p className="mt-3 border-t border-primary/10 pt-2 text-xs text-muted-foreground">
              ⚠️ Hasil AI hanya alat bantu, bukan diagnosis. Keputusan tetap di
              tangan pengasuh & pekerja sosial.
            </p>
          </div>
        )}

        <Button
          onClick={handleAnalyze}
          disabled={isPending}
          className="h-11 w-full md:w-auto"
          variant={insight ? "outline" : "default"}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menganalisis...
            </>
          ) : insight ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Analisis Ulang
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analisis Kondisi Anak Ini
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
