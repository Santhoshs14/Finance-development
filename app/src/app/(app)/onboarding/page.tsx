"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { profileAPI } from "@/services/api";
import { accountsAPI } from "@/services/api";
import { motion, AnimatePresence } from "framer-motion";
import { User, DollarSign, Calendar, Landmark, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import toast from "react-hot-toast";

const STEPS = [
  { title: "What should we call you?", icon: User },
  { title: "What's your monthly income?", icon: DollarSign },
  { title: "When does your financial cycle start?", icon: Calendar },
  { title: "Add your first account", icon: Landmark },
];

const ACCOUNT_TYPES = [
  { value: "savings", label: "Bank Savings" },
  { value: "current", label: "Bank Current" },
  { value: "wallet", label: "Digital Wallet" },
  { value: "cash", label: "Cash" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Name
  const [displayName, setDisplayName] = useState("");
  // Step 2: Salary
  const [salary, setSalary] = useState("");
  // Step 3: Cycle day
  const [cycleDay, setCycleDay] = useState(25);
  // Step 4: Account
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("savings");
  const [accountBalance, setAccountBalance] = useState("");

  const canProceed = () => {
    switch (step) {
      case 0: return displayName.trim().length >= 2;
      case 1: return Number(salary) > 0;
      case 2: return cycleDay >= 1 && cycleDay <= 28;
      case 3: return accountName.trim().length >= 2;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      // Save profile
      await profileAPI.update({
        displayName: displayName.trim(),
        monthlySalary: Number(salary),
        cycleStartDay: cycleDay,
        onboardingComplete: true,
      });

      // Create first account
      if (accountName.trim()) {
        await accountsAPI.create({
          account_name: accountName.trim(),
          type: accountType,
          balance: Number(accountBalance) || 0,
        });
      }

      toast.success("Welcome to WealthFlow! 🎉");
      router.replace("/");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const StepIcon = STEPS[step].icon;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl brand-gradient shadow-lg premium-glow flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 512 512" fill="none">
              <path d="M128 160 L192 352 L256 220 L320 352 L384 160" stroke="white" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="256" cy="380" r="20" fill="#f59e0b" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold brand-gradient-text">
            WealthFlow
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Let&apos;s set up your financial OS</p>
        </div>

        {/* Progress */}
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= step ? "bg-brand" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <Card>
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Icon + Title */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                    <StepIcon className="w-5 h-5 text-brand" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{STEPS[step].title}</h2>
                </div>

                {/* Step Content */}
                {step === 0 && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">This is how we&apos;ll greet you in the app.</p>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <Input
                        type="number"
                        placeholder="50000"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        className="pl-7"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Used to calculate savings rate and budget recommendations.</p>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <button
                          key={day}
                          onClick={() => setCycleDay(day)}
                          className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                            cycleDay === day
                              ? "bg-brand text-white"
                              : "bg-muted text-foreground hover:bg-muted/80"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usually your salary credit date. Default is 25th.
                    </p>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    <Input
                      placeholder="Account name (e.g. HDFC Savings)"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {ACCOUNT_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setAccountType(t.value)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                            accountType === t.value
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border bg-muted text-foreground hover:bg-muted/80"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <Input
                        type="number"
                        placeholder="Current balance (optional)"
                        value={accountBalance}
                        onChange={(e) => setAccountBalance(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canProceed() || submitting}
                className="gap-1"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : step === STEPS.length - 1 ? (
                  <>
                    Complete
                    <Check className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Skip */}
        <p className="text-center text-xs text-muted-foreground">
          You can always change these in{" "}
          <button
            onClick={async () => {
              await profileAPI.update({ onboardingComplete: true });
              router.replace("/");
            }}
            className="text-brand underline underline-offset-2 hover:no-underline"
          >
            Settings
          </button>
        </p>
      </div>
    </div>
  );
}
