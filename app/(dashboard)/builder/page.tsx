"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────── Types ─────── */

interface Feature {
  name: string;
  sport: string;
  source?: string;
  pit?: string;
  units?: string;
}
interface Target {
  market: string;
  label: string;
  kind: string;
  sample_target_variable: string;
}

interface ModelClass {
  id: string;
  label: string;
  kinds: string[];
  default_hyperparameters: Record<string, unknown>;
  notes: string;
}

interface ModelSpec {
  spec_id: number;
  name: string;
  fingerprint: string;
  sport: string;
  market: string;
  target_variable: string;
  features: string[];
  model_class: string;
  status: string;
  status_detail?: string;
  created_at: string;
  updated_at: string;
  last_trained_at?: string;
  promoted_strategy?: string;
  train_metrics?: {
    n_train?: number;
    n_test?: number;
    brier?: number;
    naive_brier?: number;
    brier_skill_vs_naive?: number;
    accuracy_at_50?: number;
    calibration_gap?: number;
    features_used?: string[];
    features_dropped?: string[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  queued: "bg-amber-700 text-amber-100",
  training: "bg-amber-500 text-white",
  trained: "bg-blue-700 text-blue-100",
  promoted: "bg-emerald-600 text-white",
  failed: "bg-red-700 text-white",
  rejected: "bg-red-900 text-red-200",
  archived: "bg-zinc-800 text-zinc-500",
};

/* ─────── Page ─────── */

export default function ModelBuilderPage() {
  // Catalogs
  const [sports, setSports] = useState<string[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [modelClasses, setModelClasses] = useState<ModelClass[]>([]);

  // Form state
  const [sport, setSport] = useState<string>("mlb");
  const [market, setMarket] = useState<string>("");
  const [targetVariable, setTargetVariable] = useState<string>("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [modelClass, setModelClass] = useState<string>("xgb");
  const [name, setName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // List + actions
  const [specs, setSpecs] = useState<ModelSpec[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [busySpec, setBusySpec] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Load catalogs once
  useEffect(() => {
    (async () => {
      const sRes = await fetch("/api/target_catalog");
      const sBody = await sRes.json();
      setSports(sBody.sports || []);
      const mRes = await fetch("/api/model_classes");
      try {
        const mBody = await fetch(
          // model_classes endpoint via the same backend path; fall back to
          // hardcoded if no proxy route
          (process.env.NEXT_PUBLIC_PIPELINE_URL
            ? `${process.env.NEXT_PUBLIC_PIPELINE_URL}/api/model_classes`
            : "/api/model_classes")
        );
        if (mBody.ok) {
          const j = await mBody.json();
          setModelClasses(j.models || []);
        }
      } catch {
        // Fall back: hardcode the three known classes
        setModelClasses([
          { id: "logistic", label: "Logistic Regression", kinds: ["binary"], default_hyperparameters: {}, notes: "" },
          { id: "xgb", label: "XGBoost", kinds: ["binary", "regression"], default_hyperparameters: {}, notes: "" },
          { id: "lightgbm", label: "LightGBM", kinds: ["binary", "regression"], default_hyperparameters: {}, notes: "" },
        ]);
      }
      void mRes;
    })();
    loadSpecs();
  }, []);

  // Reload features + targets when sport changes
  useEffect(() => {
    if (!sport) return;
    (async () => {
      const fRes = await fetch(`/api/feature_catalog?sport=${sport}`);
      const fBody = await fRes.json();
      setFeatures(fBody.features || []);
      const tRes = await fetch(`/api/target_catalog?sport=${sport}`);
      const tBody = await tRes.json();
      setTargets(tBody.targets || []);
      // Reset market + target_variable to first available
      if (tBody.targets && tBody.targets.length > 0) {
        setMarket(tBody.targets[0].market);
        setTargetVariable(tBody.targets[0].sample_target_variable);
      }
    })();
  }, [sport]);

  // When market changes, populate sample target_variable
  useEffect(() => {
    const t = targets.find((x) => x.market === market);
    if (t) setTargetVariable(t.sample_target_variable);
  }, [market, targets]);

  async function loadSpecs() {
    const res = await fetch("/api/model_specs");
    const body = await res.json();
    setSpecs(body.specs || []);
  }

  function toggleFeature(name: string) {
    setSelectedFeatures((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]
    );
  }

  async function submitSpec() {
    setError(null);
    setInfo(null);
    if (!name.trim()) return setError("Spec name is required");
    if (selectedFeatures.length === 0)
      return setError("Pick at least one feature");
    setSubmitting(true);
    try {
      const res = await fetch("/api/model_specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sport,
          market,
          target_variable: targetVariable,
          features: selectedFeatures,
          model_class: modelClass,
          notes,
          status: "queued",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Save failed (HTTP ${res.status})`);
        return;
      }
      setInfo(`Saved spec '${body.name}' (id ${body.spec_id})`);
      setName("");
      setSelectedFeatures([]);
      setNotes("");
      loadSpecs();
    } catch (e) {
      setError(`Network error: ${e}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function trainSpec(specName: string, force: boolean = false) {
    setError(null);
    setInfo(null);
    setBusySpec(specName);
    try {
      const res = await fetch(
        `/api/model_specs/${encodeURIComponent(specName)}/train`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(`Training failed: ${body.error}`);
      } else {
        const m = body.metrics || {};
        setInfo(
          `Trained ${specName}: BSS ${(m.brier_skill_vs_naive ?? 0).toFixed(3)}, ` +
            `acc ${((m.accuracy_at_50 ?? 0) * 100).toFixed(1)}% on n=${m.n_test}`
        );
      }
      loadSpecs();
    } catch (e) {
      setError(`Network error: ${e}`);
    } finally {
      setBusySpec(null);
    }
  }

  async function promoteSpec(specName: string) {
    setError(null);
    setInfo(null);
    setBusySpec(specName);
    try {
      const res = await fetch(
        `/api/model_specs/${encodeURIComponent(specName)}/promote`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(`Promote failed: ${body.error}`);
      } else {
        setInfo(
          `${specName}: ${body.decision.toUpperCase()} — ${body.reason}`
        );
      }
      loadSpecs();
    } catch (e) {
      setError(`Network error: ${e}`);
    } finally {
      setBusySpec(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Wrench className="h-6 w-6 text-amber-500" />
          Model Builder
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Define new models without writing code. Pick a sport, target, feature
          set, and model class — the pipeline trains and promotes via the same
          calibration gates that audit the in-house strategies.
        </p>
      </div>

      {(error || info) && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm flex items-start gap-2",
            error
              ? "bg-red-950 border-red-900 text-red-200"
              : "bg-emerald-950 border-emerald-900 text-emerald-200"
          )}
        >
          {error ? (
            <AlertTriangle className="h-4 w-4 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
          )}
          <span>{error || info}</span>
        </div>
      )}

      {/* Spec form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Define a new model spec</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select value={sport} onValueChange={(v) => v && setSport(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sports.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Market</Label>
              <Select value={market} onValueChange={(v) => v && setMarket(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="select market" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.market} value={t.market}>
                      {t.label} ({t.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Model class</Label>
              <Select
                value={modelClass}
                onValueChange={(v) => v && setModelClass(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelClasses.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Target variable</Label>
              <Input
                value={targetVariable}
                onChange={(e) => setTargetVariable(e.target.value)}
                placeholder="e.g. home_win"
              />
              <p className="text-xs text-zinc-500">
                Sample for this market populated automatically — tweak the
                threshold (e.g. <code>total_over_8.5</code>) to change the
                line being modeled.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Spec name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. nba_h1_total_v1"
              />
              <p className="text-xs text-zinc-500">
                Becomes the strategy slug if promoted. Alphanumeric + underscore.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>
              Features ({selectedFeatures.length} of {features.length} selected)
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-48 overflow-y-auto rounded-md border border-zinc-800 p-2 bg-zinc-950">
              {features.map((f) => (
                <label
                  key={f.name}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-900 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(f.name)}
                    onChange={() => toggleFeature(f.name)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-zinc-300">{f.name}</span>
                  {f.units && (
                    <span className="text-xs text-zinc-600">{f.units}</span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Trainer MVP supports: home_elo, away_elo, elo_diff,
              home_rest_days, away_rest_days. Other features will be
              dropped with a warning.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to remember about this spec"
            />
          </div>

          <Button onClick={submitSpec} disabled={submitting} className="w-full md:w-auto">
            {submitting ? "Saving..." : "Save & queue for training"}
          </Button>
        </CardContent>
      </Card>

      {/* Spec list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Spec registry</span>
            <span className="text-xs font-normal text-zinc-500">
              {specs.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {specs.length === 0 ? (
            <div className="text-sm text-zinc-500">
              No specs yet — define one above.
            </div>
          ) : (
            <div className="space-y-3">
              {specs.map((s) => (
                <SpecRow
                  key={s.spec_id}
                  spec={s}
                  busy={busySpec === s.name}
                  onTrain={(force) => trainSpec(s.name, force)}
                  onPromote={() => promoteSpec(s.name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpecRow({
  spec,
  busy,
  onTrain,
  onPromote,
}: {
  spec: ModelSpec;
  busy: boolean;
  onTrain: (force: boolean) => void;
  onPromote: () => void;
}) {
  const m = spec.train_metrics;
  return (
    <div className="border border-zinc-800 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className={cn("text-xs", STATUS_COLORS[spec.status] ?? STATUS_COLORS.draft)}>
            {spec.status}
          </Badge>
          <span className="font-mono text-sm">{spec.name}</span>
          <span className="text-xs text-zinc-500">
            {spec.sport.toUpperCase()}/{spec.market} · {spec.model_class}
          </span>
          <span className="text-xs text-zinc-600">{spec.features.length} feats</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTrain(spec.status === "trained" || spec.status === "promoted")}
            disabled={busy}
          >
            {busy ? "..." : spec.status === "trained" || spec.status === "promoted" ? "Re-train" : "Train"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onPromote}
            disabled={busy || spec.status !== "trained"}
            title={spec.status !== "trained" ? "Spec must be TRAINED to promote" : ""}
          >
            Promote
          </Button>
        </div>
      </div>

      {spec.status_detail && (
        <p className="text-xs text-zinc-500">{spec.status_detail}</p>
      )}

      {m && (
        <div className="text-xs text-zinc-400 grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <span className="text-zinc-600">n_train</span>: {m.n_train}
          </div>
          <div>
            <span className="text-zinc-600">n_test</span>: {m.n_test}
          </div>
          <div>
            <span className="text-zinc-600">Brier</span>:{" "}
            {m.brier?.toFixed(4)}
          </div>
          <div>
            <span className="text-zinc-600">BSS</span>:{" "}
            <span
              className={cn(
                (m.brier_skill_vs_naive ?? 0) > 0
                  ? "text-emerald-400"
                  : "text-red-400"
              )}
            >
              {(m.brier_skill_vs_naive ?? 0).toFixed(3)}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">acc</span>:{" "}
            {((m.accuracy_at_50 ?? 0) * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {spec.target_variable && (
        <p className="text-xs text-zinc-500 font-mono">
          target: {spec.target_variable}
        </p>
      )}
    </div>
  );
}
