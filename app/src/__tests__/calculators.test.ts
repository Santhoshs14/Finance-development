import { describe, it, expect } from "vitest";
import {
  calculateSip,
  calculateLumpsum,
  calculateSwp,
  calculateStp,
  calculateEmi,
  calculateFd,
  calculateRd,
  calculatePpf,
  calculateNps,
  calculateEpf,
  calculateGoal,
  calculateRetirementPlan,
  calculateGratuity,
  calculateHraExemption,
  calculateCagr,
  calculateInflationImpact,
  GRATUITY_CAP,
  PPF_RATE,
} from "@/utils/calculators";

describe("calculateSip", () => {
  it("matches the standard annuity-due maturity value", () => {
    const res = calculateSip({ monthlyAmount: 10000, annualRatePct: 12, years: 10 });
    expect(res.totalInvested).toBe(1200000);
    expect(res.maturityValue).toBeCloseTo(2323390.76, 0);
    expect(res.totalReturns).toBeCloseTo(1123390.76, 0);
    expect(res.absoluteReturnPct).toBeCloseTo(93.62, 1);
  });

  it("returns the invested amount when the rate is zero", () => {
    const res = calculateSip({ monthlyAmount: 5000, annualRatePct: 0, years: 3 });
    expect(res.maturityValue).toBe(180000);
    expect(res.totalReturns).toBe(0);
    expect(res.absoluteReturnPct).toBe(0);
  });

  it("grows contributions with an annual step-up", () => {
    const flat = calculateSip({ monthlyAmount: 10000, annualRatePct: 12, years: 5 });
    const stepped = calculateSip({
      monthlyAmount: 10000,
      annualRatePct: 12,
      years: 5,
      stepUpPct: 10,
    });
    expect(stepped.totalInvested).toBeGreaterThan(flat.totalInvested);
    expect(stepped.maturityValue).toBeGreaterThan(flat.maturityValue);
  });

  it("builds a schedule with a zero-th year and one point per year", () => {
    const res = calculateSip({ monthlyAmount: 1000, annualRatePct: 10, years: 4 });
    expect(res.schedule).toHaveLength(5);
    expect(res.schedule[0]).toEqual({ year: 0, invested: 0, value: 0, returns: 0 });
    expect(res.schedule[4].invested).toBe(48000);
  });

  it("coerces missing and non-finite inputs to zero", () => {
    const res = calculateSip({
      monthlyAmount: NaN,
      annualRatePct: NaN,
      years: -5,
    });
    expect(res.totalInvested).toBe(0);
    expect(res.maturityValue).toBe(0);
    expect(res.schedule).toHaveLength(1);
  });
});

describe("calculateLumpsum", () => {
  it("compounds annually", () => {
    const res = calculateLumpsum({ principal: 100000, annualRatePct: 12, years: 10 });
    expect(res.maturityValue).toBeCloseTo(310584.82, 0);
    expect(res.totalReturns).toBeCloseTo(210584.82, 0);
    expect(res.absoluteReturnPct).toBeCloseTo(210.58, 1);
  });

  it("returns the principal for a zero tenure", () => {
    const res = calculateLumpsum({ principal: 50000, annualRatePct: 9, years: 0 });
    expect(res.maturityValue).toBe(50000);
    expect(res.schedule).toHaveLength(1);
  });

  it("reports zero return percentage for a zero principal", () => {
    const res = calculateLumpsum({ principal: 0, annualRatePct: 9, years: 5 });
    expect(res.absoluteReturnPct).toBe(0);
  });
});

describe("calculateSwp", () => {
  it("leaves a surviving corpus when withdrawals are below growth", () => {
    const res = calculateSwp({
      corpus: 10000000,
      monthlyWithdrawal: 40000,
      annualRatePct: 10,
      years: 10,
    });
    expect(res.corpusExhaustedMonth).toBeNull();
    expect(res.remainingCorpus).toBeGreaterThan(0);
    expect(res.totalWithdrawn).toBeCloseTo(4800000, 0);
    expect(res.totalGrowth).toBeGreaterThan(0);
  });

  it("flags the month the corpus runs out", () => {
    const res = calculateSwp({
      corpus: 100000,
      monthlyWithdrawal: 50000,
      annualRatePct: 0,
      years: 5,
    });
    expect(res.corpusExhaustedMonth).toBe(2);
    expect(res.remainingCorpus).toBe(0);
    expect(res.totalWithdrawn).toBe(100000);
  });

  it("escalates withdrawals with a step-up", () => {
    const flat = calculateSwp({
      corpus: 5000000,
      monthlyWithdrawal: 20000,
      annualRatePct: 8,
      years: 10,
    });
    const stepped = calculateSwp({
      corpus: 5000000,
      monthlyWithdrawal: 20000,
      annualRatePct: 8,
      years: 10,
      withdrawalStepUpPct: 8,
    });
    expect(stepped.totalWithdrawn).toBeGreaterThan(flat.totalWithdrawn);
    expect(stepped.remainingCorpus).toBeLessThan(flat.remainingCorpus);
  });

  it("handles a zero corpus", () => {
    const res = calculateSwp({
      corpus: 0,
      monthlyWithdrawal: 1000,
      annualRatePct: 8,
      years: 2,
    });
    expect(res.totalWithdrawn).toBe(0);
    expect(res.schedule).toHaveLength(3);
  });
});

describe("calculateStp", () => {
  it("moves the source corpus into the target fund", () => {
    const res = calculateStp({
      sourceCorpus: 1200000,
      monthlyTransfer: 100000,
      sourceRatePct: 6,
      targetRatePct: 12,
      months: 12,
    });
    expect(res.transfersCompleted).toBe(12);
    expect(res.totalTransferred).toBeCloseTo(1200000, 0);
    expect(res.targetValue).toBeGreaterThan(res.totalTransferred);
    expect(res.totalGains).toBeGreaterThan(0);
    expect(res.schedule).toHaveLength(13);
  });

  it("stops transferring once the source is drained", () => {
    const res = calculateStp({
      sourceCorpus: 100000,
      monthlyTransfer: 60000,
      sourceRatePct: 0,
      targetRatePct: 0,
      months: 12,
    });
    expect(res.transfersCompleted).toBe(2);
    expect(res.sourceRemaining).toBe(0);
    expect(res.targetValue).toBe(100000);
  });

  it("handles a zero transfer amount", () => {
    const res = calculateStp({
      sourceCorpus: 100000,
      monthlyTransfer: 0,
      sourceRatePct: 6,
      targetRatePct: 12,
      months: 6,
    });
    expect(res.transfersCompleted).toBe(0);
    expect(res.targetValue).toBe(0);
  });
});

describe("calculateEmi", () => {
  it("matches the standard EMI formula", () => {
    const res = calculateEmi({
      principal: 1000000,
      annualRatePct: 9,
      tenureMonths: 60,
    });
    expect(res.emi).toBeCloseTo(20758.36, 1);
    expect(res.totalInterest).toBeCloseTo(245501.45, 0);
    expect(res.totalPayment).toBeCloseTo(1245501.45, 0);
    expect(res.interestSharePct).toBeCloseTo(19.71, 1);
  });

  it("closes the balance at zero on the final instalment", () => {
    const res = calculateEmi({
      principal: 500000,
      annualRatePct: 11,
      tenureMonths: 36,
    });
    expect(res.schedule).toHaveLength(36);
    expect(res.schedule[35].balance).toBe(0);
    const principalPaid = res.schedule.reduce((s, row) => s + row.principal, 0);
    expect(principalPaid).toBeCloseTo(500000, 0);
  });

  it("splits an interest-free loan evenly", () => {
    const res = calculateEmi({
      principal: 120000,
      annualRatePct: 0,
      tenureMonths: 12,
    });
    expect(res.emi).toBe(10000);
    expect(res.totalInterest).toBe(0);
    expect(res.interestSharePct).toBe(0);
  });

  it("groups the schedule into calendar years including a partial final year", () => {
    const res = calculateEmi({
      principal: 300000,
      annualRatePct: 10,
      tenureMonths: 30,
    });
    expect(res.yearlySchedule).toHaveLength(3);
    expect(res.yearlySchedule[2].year).toBe(3);
    expect(res.yearlySchedule[2].balance).toBe(0);
  });

  it("returns an empty result for a zero principal or tenure", () => {
    expect(
      calculateEmi({ principal: 0, annualRatePct: 9, tenureMonths: 60 }).emi
    ).toBe(0);
    const zeroTenure = calculateEmi({
      principal: 100000,
      annualRatePct: 9,
      tenureMonths: 0,
    });
    expect(zeroTenure.schedule).toHaveLength(0);
    expect(zeroTenure.yearlySchedule).toHaveLength(0);
  });
});

describe("calculateFd", () => {
  it("compounds quarterly by default", () => {
    const res = calculateFd({ principal: 100000, annualRatePct: 7, years: 5 });
    expect(res.maturityValue).toBeCloseTo(141478, -1);
    expect(res.interestEarned).toBeCloseTo(res.maturityValue - 100000, 2);
    expect(res.schedule[0].value).toBe(100000);
  });

  it("supports simple interest", () => {
    const res = calculateFd({
      principal: 100000,
      annualRatePct: 7,
      years: 5,
      compounding: "simple",
    });
    expect(res.maturityValue).toBe(135000);
  });

  it("handles a zero principal", () => {
    const res = calculateFd({ principal: 0, annualRatePct: 7, years: 5 });
    expect(res.maturityValue).toBe(0);
    expect(res.interestEarned).toBe(0);
  });
});

describe("calculateRd", () => {
  it("accrues monthly deposits", () => {
    const res = calculateRd({
      monthlyDeposit: 5000,
      annualRatePct: 7,
      months: 24,
    });
    expect(res.invested).toBe(120000);
    expect(res.maturityValue).toBeGreaterThan(120000);
    expect(res.interestEarned).toBeCloseTo(res.maturityValue - 120000, 2);
  });

  it("builds a yearly schedule up to the tenure", () => {
    const res = calculateRd({
      monthlyDeposit: 1000,
      annualRatePct: 6,
      months: 30,
    });
    expect(res.schedule).toHaveLength(3);
    expect(res.schedule[0].value).toBe(0);
  });

  it("handles a zero deposit", () => {
    const res = calculateRd({ monthlyDeposit: 0, annualRatePct: 6, months: 12 });
    expect(res.maturityValue).toBe(0);
  });
});

describe("calculatePpf", () => {
  it("credits interest annually on the running balance", () => {
    const res = calculatePpf({ yearlyDeposit: 150000 });
    expect(res.schedule).toHaveLength(15);
    expect(res.schedule[0].interest).toBe(Math.round(150000 * (PPF_RATE / 100)));
    expect(res.totalInvested).toBe(2250000);
    expect(res.maturityValue).toBeGreaterThan(res.totalInvested);
    expect(res.depositOutOfRange).toBe(false);
  });

  it("flags deposits outside the statutory band", () => {
    expect(calculatePpf({ yearlyDeposit: 200000 }).depositOutOfRange).toBe(true);
    expect(calculatePpf({ yearlyDeposit: 100 }).depositOutOfRange).toBe(true);
    expect(calculatePpf({ yearlyDeposit: 0 }).depositOutOfRange).toBe(false);
  });

  it("honours a custom rate and tenure", () => {
    const res = calculatePpf({ yearlyDeposit: 100000, annualRatePct: 8, years: 20 });
    expect(res.schedule).toHaveLength(20);
    expect(res.totalInvested).toBe(2000000);
  });
});

describe("calculateNps", () => {
  it("splits the corpus into an annuity and a lump sum", () => {
    const res = calculateNps({
      currentAge: 30,
      retireAge: 60,
      monthlyContribution: 10000,
      annualRatePct: 10,
      annuityPortionPct: 40,
      annuityRatePct: 6,
    });
    expect(res.yearsToRetirement).toBe(30);
    expect(res.totalInvested).toBe(3600000);
    expect(res.annuityCorpus + res.lumpSumWithdrawal).toBeCloseTo(
      res.corpusAtRetirement,
      0
    );
    expect(res.monthlyPension).toBeCloseTo((res.annuityCorpus * 0.06) / 12, 0);
  });

  it("enforces the 40% minimum annuity portion", () => {
    const res = calculateNps({
      currentAge: 30,
      retireAge: 60,
      monthlyContribution: 10000,
      annualRatePct: 10,
      annuityPortionPct: 10,
    });
    expect(res.annuityCorpus).toBeCloseTo(res.corpusAtRetirement * 0.4, 0);
  });

  it("returns zero when already past the retirement age", () => {
    const res = calculateNps({
      currentAge: 65,
      retireAge: 60,
      monthlyContribution: 10000,
      annualRatePct: 10,
    });
    expect(res.yearsToRetirement).toBe(0);
    expect(res.corpusAtRetirement).toBe(0);
    expect(res.monthlyPension).toBe(0);
  });
});

describe("calculateEpf", () => {
  it("accumulates employee and employer contributions with interest", () => {
    const res = calculateEpf({
      monthlyBasicDa: 50000,
      currentAge: 30,
      retireAge: 58,
    });
    expect(res.yearsToRetirement).toBe(28);
    expect(res.schedule).toHaveLength(28);
    expect(res.totalEmployee).toBeCloseTo(50000 * 0.12 * 12 * 28, 0);
    expect(res.totalInterest).toBeGreaterThan(0);
    expect(res.maturityValue).toBeCloseTo(
      res.totalEmployee + res.totalEmployer + res.totalInterest,
      0
    );
  });

  it("caps the EPS diversion at the wage ceiling", () => {
    const high = calculateEpf({
      monthlyBasicDa: 100000,
      currentAge: 30,
      retireAge: 31,
    });
    const eps = 15000 * 0.0833 * 12;
    expect(high.totalEmployer).toBeCloseTo(100000 * 0.12 * 12 - eps, 0);
  });

  it("grows the salary each year when a growth rate is given", () => {
    const flat = calculateEpf({
      monthlyBasicDa: 50000,
      currentAge: 30,
      retireAge: 40,
    });
    const growing = calculateEpf({
      monthlyBasicDa: 50000,
      currentAge: 30,
      retireAge: 40,
      salaryGrowthPct: 8,
    });
    expect(growing.maturityValue).toBeGreaterThan(flat.maturityValue);
  });

  it("returns zero when there are no years left", () => {
    const res = calculateEpf({
      monthlyBasicDa: 50000,
      currentAge: 58,
      retireAge: 58,
    });
    expect(res.maturityValue).toBe(0);
    expect(res.schedule).toHaveLength(0);
  });
});

describe("calculateGoal", () => {
  it("computes the SIP required to close an inflation-adjusted shortfall", () => {
    const res = calculateGoal({
      targetAmount: 5000000,
      years: 10,
      annualRatePct: 12,
      currentSavings: 500000,
      inflationPct: 6,
    });
    expect(res.inflatedTarget).toBeCloseTo(5000000 * Math.pow(1.06, 10), 0);
    expect(res.futureValueOfSavings).toBeCloseTo(500000 * Math.pow(1.12, 10), 0);
    expect(res.shortfall).toBeGreaterThan(0);
    expect(res.requiredMonthlySip).toBeGreaterThan(0);
    expect(res.onTrack).toBe(false);

    const achieved = calculateSip({
      monthlyAmount: res.requiredMonthlySip,
      annualRatePct: 12,
      years: 10,
    });
    expect(achieved.maturityValue).toBeCloseTo(res.shortfall, -1);
  });

  it("reports on-track when existing savings already cover the goal", () => {
    const res = calculateGoal({
      targetAmount: 100000,
      years: 10,
      annualRatePct: 12,
      currentSavings: 5000000,
    });
    expect(res.onTrack).toBe(true);
    expect(res.shortfall).toBe(0);
    expect(res.requiredMonthlySip).toBe(0);
    expect(res.requiredLumpsum).toBe(0);
  });

  it("divides the shortfall evenly when the return rate is zero", () => {
    const res = calculateGoal({
      targetAmount: 120000,
      years: 10,
      annualRatePct: 0,
    });
    expect(res.requiredMonthlySip).toBe(1000);
    expect(res.requiredLumpsum).toBe(120000);
  });

  it("handles a zero tenure", () => {
    const res = calculateGoal({
      targetAmount: 100000,
      years: 0,
      annualRatePct: 12,
    });
    expect(res.requiredMonthlySip).toBe(0);
  });
});

describe("calculateRetirementPlan", () => {
  const base = {
    currentAge: 30,
    retireAge: 55,
    monthlyExpenses: 50000,
    inflationRate: 6,
    returnRate: 12,
    currentCorpus: 500000,
    monthlySIP: 20000,
  };

  it("projects the corpus needed and the gap", () => {
    const res = calculateRetirementPlan(base)!;
    expect(res.yearsToRetire).toBe(25);
    expect(res.yearsInRetirement).toBe(30);
    expect(res.futureMonthlyExpenses).toBe(
      Math.round(50000 * Math.pow(1.06, 25))
    );
    expect(res.corpusNeeded).toBeGreaterThan(0);
    expect(res.projectedCorpus).toBeGreaterThan(0);
    expect(res.projection).toHaveLength(26);
    expect(res.projection[0].corpus).toBe(500000);
  });

  it("returns null when retirement is not in the future", () => {
    expect(
      calculateRetirementPlan({ ...base, currentAge: 60, retireAge: 55 })
    ).toBeNull();
  });

  it("falls back to a plain sum when the real return is not positive", () => {
    const res = calculateRetirementPlan({
      ...base,
      returnRate: 5,
      inflationRate: 6,
    })!;
    expect(res.corpusNeeded).toBeCloseTo(
      res.futureMonthlyExpenses * 12 * res.yearsInRetirement,
      -3
    );
  });

  it("handles a zero return rate", () => {
    const res = calculateRetirementPlan({ ...base, returnRate: 0 })!;
    expect(res.projectedCorpus).toBe(500000 + 20000 * 12 * 25);
    expect(res.requiredSIP).toBeGreaterThan(0);
  });

  it("reports no gap when the projection clears the target", () => {
    const res = calculateRetirementPlan({
      ...base,
      currentCorpus: 100000000,
      monthlySIP: 0,
    })!;
    expect(res.gap).toBe(0);
    expect(res.requiredSIP).toBe(0);
  });

  it("accepts a custom life expectancy", () => {
    const res = calculateRetirementPlan({ ...base, lifeExpectancy: 90 })!;
    expect(res.yearsInRetirement).toBe(35);
  });
});

describe("calculateGratuity", () => {
  it("applies the 15/26 formula", () => {
    const res = calculateGratuity({ lastDrawnBasicDa: 50000, yearsOfService: 10 });
    expect(res.gratuity).toBeCloseTo((50000 * 15 * 10) / 26, 2);
    expect(res.eligible).toBe(true);
    expect(res.cappedAtLimit).toBe(false);
  });

  it("rounds service to the nearest year under the Act", () => {
    expect(
      calculateGratuity({ lastDrawnBasicDa: 50000, yearsOfService: 10.6 })
        .roundedYears
    ).toBe(11);
    expect(
      calculateGratuity({
        lastDrawnBasicDa: 50000,
        yearsOfService: 10.6,
        coveredByAct: false,
      }).roundedYears
    ).toBe(10);
  });

  it("uses a 15/30 basis outside the Act", () => {
    const res = calculateGratuity({
      lastDrawnBasicDa: 60000,
      yearsOfService: 10,
      coveredByAct: false,
    });
    expect(res.gratuity).toBeCloseTo((60000 * 15 * 10) / 30, 2);
  });

  it("pays nothing below five years of service", () => {
    const res = calculateGratuity({ lastDrawnBasicDa: 50000, yearsOfService: 4 });
    expect(res.eligible).toBe(false);
    expect(res.gratuity).toBe(0);
  });

  it("caps the payout at the statutory limit", () => {
    const res = calculateGratuity({
      lastDrawnBasicDa: 500000,
      yearsOfService: 30,
    });
    expect(res.gratuity).toBe(GRATUITY_CAP);
    expect(res.cappedAtLimit).toBe(true);
    expect(res.uncappedGratuity).toBeGreaterThan(GRATUITY_CAP);
  });
});

describe("calculateHraExemption", () => {
  it("takes the least of the three statutory components", () => {
    const res = calculateHraExemption({
      basicSalary: 50000,
      hraReceived: 20000,
      rentPaid: 25000,
      isMetro: true,
    })!;
    expect(res.components).toEqual({ a: 240000, b: 240000, c: 300000 });
    expect(res.exempt).toBe(240000);
    expect(res.taxableHra).toBe(0);
  });

  it("uses 40% of basic for non-metro cities", () => {
    const res = calculateHraExemption({
      basicSalary: 50000,
      hraReceived: 30000,
      rentPaid: 40000,
      isMetro: false,
    })!;
    expect(res.components.c).toBe(240000);
    expect(res.exempt).toBe(240000);
    expect(res.taxableHra).toBe(120000);
  });

  it("floors a negative rent-minus-10%-of-basic component at zero", () => {
    const res = calculateHraExemption({
      basicSalary: 100000,
      hraReceived: 40000,
      rentPaid: 5000,
      isMetro: true,
    })!;
    expect(res.components.b).toBe(0);
    expect(res.exempt).toBe(0);
  });

  it("returns null without a basic salary or rent", () => {
    expect(
      calculateHraExemption({
        basicSalary: 0,
        hraReceived: 20000,
        rentPaid: 25000,
        isMetro: true,
      })
    ).toBeNull();
    expect(
      calculateHraExemption({
        basicSalary: 50000,
        hraReceived: 20000,
        rentPaid: 0,
        isMetro: true,
      })
    ).toBeNull();
  });
});

describe("calculateCagr", () => {
  it("annualises the growth rate", () => {
    const res = calculateCagr({
      initialValue: 100000,
      finalValue: 200000,
      years: 10,
    });
    expect(res.cagr).toBeCloseTo(7.18, 2);
    expect(res.absoluteReturnPct).toBe(100);
    expect(res.totalGain).toBe(100000);
    expect(res.schedule).toHaveLength(11);
  });

  it("reports a negative CAGR for a loss", () => {
    const res = calculateCagr({
      initialValue: 200000,
      finalValue: 100000,
      years: 5,
    });
    expect(res.cagr).toBeLessThan(0);
    expect(res.totalGain).toBe(-100000);
  });

  it("returns zeros for a zero initial value or tenure", () => {
    expect(calculateCagr({ initialValue: 0, finalValue: 100, years: 5 }).cagr).toBe(0);
    const zeroYears = calculateCagr({
      initialValue: 100,
      finalValue: 200,
      years: 0,
    });
    expect(zeroYears.cagr).toBe(0);
    expect(zeroYears.schedule).toHaveLength(0);
  });
});

describe("calculateInflationImpact", () => {
  it("inflates a cost and erodes purchasing power", () => {
    const res = calculateInflationImpact({
      currentCost: 100000,
      inflationPct: 6,
      years: 10,
    });
    expect(res.futureCost).toBeCloseTo(179084.77, 0);
    expect(res.increase).toBeCloseTo(79084.77, 0);
    expect(res.purchasingPower).toBeCloseTo(55839.48, 0);
    expect(res.purchasingPowerLossPct).toBeCloseTo(44.16, 1);
    expect(res.schedule).toHaveLength(11);
  });

  it("leaves the cost unchanged at zero inflation", () => {
    const res = calculateInflationImpact({
      currentCost: 100000,
      inflationPct: 0,
      years: 10,
    });
    expect(res.futureCost).toBe(100000);
    expect(res.purchasingPower).toBe(100000);
    expect(res.purchasingPowerLossPct).toBe(0);
  });

  it("handles a zero cost", () => {
    const res = calculateInflationImpact({
      currentCost: 0,
      inflationPct: 6,
      years: 10,
    });
    expect(res.futureCost).toBe(0);
    expect(res.purchasingPowerLossPct).toBe(0);
  });
});
