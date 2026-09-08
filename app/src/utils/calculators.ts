/**
 * Pure financial calculator math shared by the /calculators section.
 * No React, no Firebase — see docs/architecture.md module boundaries.
 */

import {
  calculateSIPGrowth,
  projectMaturityValue,
  projectRecurringDepositValue,
} from "./calculations";

const r2 = (v: number) => Math.round(v * 100) / 100;
const r0 = (v: number) => Math.round(v);

/** Coerce anything non-finite (NaN from a blank input, Infinity) to 0. */
const n = (v: number | undefined | null): number =>
  Number.isFinite(v) ? (v as number) : 0;

const clampPos = (v: number | undefined | null): number => Math.max(0, n(v));

// ---------------------------------------------------------------------------
// Statutory constants (FY 2025-26)
// ---------------------------------------------------------------------------

export const PPF_RATE = 7.1;
export const PPF_MIN_DEPOSIT = 500;
export const PPF_MAX_DEPOSIT = 150_000;
export const PPF_TENURE_YEARS = 15;

export const EPF_RATE = 8.25;
export const EPF_EMPLOYEE_PCT = 12;
/** Employer's 12% splits 8.33% to EPS (pension) and 3.67% to EPF. */
export const EPF_EMPLOYER_EPF_PCT = 3.67;
export const EPF_EMPLOYER_EPS_PCT = 8.33;
export const EPF_WAGE_CEILING = 15_000;

export const GRATUITY_CAP = 2_000_000;
export const NPS_MIN_ANNUITY_PCT = 40;

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface GrowthYear {
  year: number;
  invested: number;
  value: number;
  returns: number;
}

// ---------------------------------------------------------------------------
// SIP
// ---------------------------------------------------------------------------

export interface SipInput {
  monthlyAmount: number;
  annualRatePct: number;
  years: number;
  /** Annual step-up applied to the contribution at each anniversary. */
  stepUpPct?: number;
}

export interface SipResult {
  totalInvested: number;
  maturityValue: number;
  totalReturns: number;
  absoluteReturnPct: number;
  schedule: GrowthYear[];
}

/**
 * Monthly SIP with contributions at the start of each month (annuity-due),
 * matching `calculateSIPGrowth`, plus an optional annual step-up.
 */
export function calculateSip(input: SipInput): SipResult {
  const monthlyAmount = clampPos(input.monthlyAmount);
  const annualRatePct = n(input.annualRatePct);
  const years = Math.floor(clampPos(input.years));
  const stepUpPct = clampPos(input.stepUpPct);

  const monthlyRate = annualRatePct / 12 / 100;
  const schedule: GrowthYear[] = [
    { year: 0, invested: 0, value: 0, returns: 0 },
  ];

  let value = 0;
  let invested = 0;
  let contribution = monthlyAmount;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + contribution) * (1 + monthlyRate);
      invested += contribution;
    }
    schedule.push({
      year: y,
      invested: r0(invested),
      value: r0(value),
      returns: r0(value - invested),
    });
    contribution *= 1 + stepUpPct / 100;
  }

  return {
    totalInvested: r2(invested),
    maturityValue: r2(value),
    totalReturns: r2(value - invested),
    absoluteReturnPct: invested > 0 ? r2(((value - invested) / invested) * 100) : 0,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Lumpsum
// ---------------------------------------------------------------------------

export interface LumpsumResult {
  totalInvested: number;
  maturityValue: number;
  totalReturns: number;
  absoluteReturnPct: number;
  schedule: GrowthYear[];
}

export function calculateLumpsum(input: {
  principal: number;
  annualRatePct: number;
  years: number;
}): LumpsumResult {
  const principal = clampPos(input.principal);
  const rate = n(input.annualRatePct) / 100;
  const years = Math.floor(clampPos(input.years));

  const schedule: GrowthYear[] = [];
  for (let y = 0; y <= years; y++) {
    const value = principal * Math.pow(1 + rate, y);
    schedule.push({
      year: y,
      invested: r0(principal),
      value: r0(value),
      returns: r0(value - principal),
    });
  }

  const maturityValue = principal * Math.pow(1 + rate, years);
  return {
    totalInvested: r2(principal),
    maturityValue: r2(maturityValue),
    totalReturns: r2(maturityValue - principal),
    absoluteReturnPct:
      principal > 0 ? r2(((maturityValue - principal) / principal) * 100) : 0,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// SWP
// ---------------------------------------------------------------------------

export interface SwpYear {
  year: number;
  withdrawn: number;
  balance: number;
}

export interface SwpResult {
  totalWithdrawn: number;
  remainingCorpus: number;
  totalGrowth: number;
  /** 1-based month the balance hit zero, or null if the corpus survived. */
  corpusExhaustedMonth: number | null;
  schedule: SwpYear[];
}

/**
 * Monthly withdrawal taken at the end of each month, after that month's growth.
 */
export function calculateSwp(input: {
  corpus: number;
  monthlyWithdrawal: number;
  annualRatePct: number;
  years: number;
  withdrawalStepUpPct?: number;
}): SwpResult {
  const corpus = clampPos(input.corpus);
  const annualRatePct = n(input.annualRatePct);
  const years = Math.floor(clampPos(input.years));
  const stepUpPct = clampPos(input.withdrawalStepUpPct);

  const monthlyRate = annualRatePct / 12 / 100;
  const schedule: SwpYear[] = [{ year: 0, withdrawn: 0, balance: r0(corpus) }];

  let balance = corpus;
  let withdrawal = clampPos(input.monthlyWithdrawal);
  let totalWithdrawn = 0;
  let totalGrowth = 0;
  let corpusExhaustedMonth: number | null = null;

  for (let y = 1; y <= years; y++) {
    let withdrawnThisYear = 0;
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const growth = balance * monthlyRate;
      balance += growth;
      totalGrowth += growth;

      const taken = Math.min(withdrawal, balance);
      balance -= taken;
      totalWithdrawn += taken;
      withdrawnThisYear += taken;

      if (balance <= 0 && corpusExhaustedMonth === null) {
        balance = 0;
        corpusExhaustedMonth = (y - 1) * 12 + m + 1;
      }
    }
    schedule.push({
      year: y,
      withdrawn: r0(withdrawnThisYear),
      balance: r0(balance),
    });
    withdrawal *= 1 + stepUpPct / 100;
  }

  return {
    totalWithdrawn: r2(totalWithdrawn),
    remainingCorpus: r2(balance),
    totalGrowth: r2(totalGrowth),
    corpusExhaustedMonth,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// STP
// ---------------------------------------------------------------------------

export interface StpMonth {
  month: number;
  source: number;
  target: number;
  transferred: number;
}

export interface StpResult {
  sourceRemaining: number;
  targetValue: number;
  totalValue: number;
  totalTransferred: number;
  transfersCompleted: number;
  totalGains: number;
  schedule: StpMonth[];
}

/**
 * Periodic transfer from a low-risk source fund into a growth target fund.
 * Both legs compound monthly at their own rate.
 */
export function calculateStp(input: {
  sourceCorpus: number;
  monthlyTransfer: number;
  sourceRatePct: number;
  targetRatePct: number;
  months: number;
}): StpResult {
  const sourceCorpus = clampPos(input.sourceCorpus);
  const monthlyTransfer = clampPos(input.monthlyTransfer);
  const sourceRate = n(input.sourceRatePct) / 12 / 100;
  const targetRate = n(input.targetRatePct) / 12 / 100;
  const months = Math.floor(clampPos(input.months));

  let source = sourceCorpus;
  let target = 0;
  let totalTransferred = 0;
  let transfersCompleted = 0;
  const schedule: StpMonth[] = [
    { month: 0, source: r0(source), target: 0, transferred: 0 },
  ];

  for (let m = 1; m <= months; m++) {
    source *= 1 + sourceRate;
    target *= 1 + targetRate;

    const transferred = Math.min(monthlyTransfer, source);
    if (transferred > 0) {
      source -= transferred;
      target += transferred;
      totalTransferred += transferred;
      transfersCompleted++;
    }

    schedule.push({
      month: m,
      source: r0(source),
      target: r0(target),
      transferred: r0(transferred),
    });
  }

  const totalValue = source + target;
  return {
    sourceRemaining: r2(source),
    targetValue: r2(target),
    totalValue: r2(totalValue),
    totalTransferred: r2(totalTransferred),
    transfersCompleted,
    totalGains: r2(totalValue - sourceCorpus),
    schedule,
  };
}

// ---------------------------------------------------------------------------
// EMI
// ---------------------------------------------------------------------------

export interface AmortisationRow {
  month: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface AmortisationYear {
  year: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  principal: number;
  interestSharePct: number;
  schedule: AmortisationRow[];
  yearlySchedule: AmortisationYear[];
}

export function calculateEmi(input: {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
}): EmiResult {
  const principal = clampPos(input.principal);
  const annualRatePct = clampPos(input.annualRatePct);
  const tenureMonths = Math.floor(clampPos(input.tenureMonths));

  if (principal === 0 || tenureMonths === 0) {
    return {
      emi: 0,
      totalInterest: 0,
      totalPayment: 0,
      principal: r2(principal),
      interestSharePct: 0,
      schedule: [],
      yearlySchedule: [],
    };
  }

  const monthlyRate = annualRatePct / 12 / 100;
  const emi =
    monthlyRate === 0
      ? principal / tenureMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  const schedule: AmortisationRow[] = [];
  const yearlySchedule: AmortisationYear[] = [];

  let balance = principal;
  let totalInterest = 0;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let m = 1; m <= tenureMonths; m++) {
    const interest = balance * monthlyRate;
    // Final instalment absorbs rounding drift so the balance closes at zero.
    const principalPaid = m === tenureMonths ? balance : emi - interest;
    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    yearPrincipal += principalPaid;
    yearInterest += interest;

    schedule.push({
      month: m,
      principal: r2(principalPaid),
      interest: r2(interest),
      balance: r2(balance),
    });

    if (m % 12 === 0 || m === tenureMonths) {
      yearlySchedule.push({
        year: Math.ceil(m / 12),
        principal: r0(yearPrincipal),
        interest: r0(yearInterest),
        balance: r0(balance),
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }

  const totalPayment = principal + totalInterest;
  return {
    emi: r2(emi),
    totalInterest: r2(totalInterest),
    totalPayment: r2(totalPayment),
    principal: r2(principal),
    interestSharePct: totalPayment > 0 ? r2((totalInterest / totalPayment) * 100) : 0,
    schedule,
    yearlySchedule,
  };
}

// ---------------------------------------------------------------------------
// Fixed deposit
// ---------------------------------------------------------------------------

export interface DepositResult {
  invested: number;
  maturityValue: number;
  interestEarned: number;
  schedule: GrowthYear[];
}

export function calculateFd(input: {
  principal: number;
  annualRatePct: number;
  years: number;
  compounding?: string;
}): DepositResult {
  const principal = clampPos(input.principal);
  const annualRatePct = clampPos(input.annualRatePct);
  const years = clampPos(input.years);
  const compounding = input.compounding || "quarterly";

  const maturityValue = projectMaturityValue(
    principal,
    annualRatePct,
    years,
    compounding
  );

  const schedule: GrowthYear[] = [];
  for (let y = 0; y <= Math.ceil(years); y++) {
    const at = Math.min(y, years);
    const value = projectMaturityValue(principal, annualRatePct, at, compounding);
    schedule.push({
      year: y,
      invested: r0(principal),
      value: r0(value),
      returns: r0(value - principal),
    });
  }

  return {
    invested: r2(principal),
    maturityValue: r2(maturityValue),
    interestEarned: r2(maturityValue - principal),
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Recurring deposit
// ---------------------------------------------------------------------------

export function calculateRd(input: {
  monthlyDeposit: number;
  annualRatePct: number;
  months: number;
}): DepositResult {
  const monthlyDeposit = clampPos(input.monthlyDeposit);
  const annualRatePct = clampPos(input.annualRatePct);
  const months = Math.floor(clampPos(input.months));

  const maturityValue = projectRecurringDepositValue(
    monthlyDeposit,
    annualRatePct,
    months
  );
  const invested = monthlyDeposit * months;

  const schedule: GrowthYear[] = [];
  for (let y = 0; y * 12 <= months; y++) {
    const m = Math.min(y * 12, months);
    const value = projectRecurringDepositValue(monthlyDeposit, annualRatePct, m);
    schedule.push({
      year: y,
      invested: r0(monthlyDeposit * m),
      value: r0(value),
      returns: r0(value - monthlyDeposit * m),
    });
  }

  return {
    invested: r2(invested),
    maturityValue: r2(maturityValue),
    interestEarned: r2(maturityValue - invested),
    schedule,
  };
}

// ---------------------------------------------------------------------------
// PPF
// ---------------------------------------------------------------------------

export interface PpfYear {
  year: number;
  deposit: number;
  interest: number;
  balance: number;
}

export interface PpfResult {
  totalInvested: number;
  maturityValue: number;
  totalInterest: number;
  schedule: PpfYear[];
  /** Deposit falls outside the ₹500–₹1.5L statutory band. */
  depositOutOfRange: boolean;
}

/** PPF credits interest annually; the deposit is assumed made at the start of the year. */
export function calculatePpf(input: {
  yearlyDeposit: number;
  annualRatePct?: number;
  years?: number;
}): PpfResult {
  const yearlyDeposit = clampPos(input.yearlyDeposit);
  const annualRatePct = input.annualRatePct == null ? PPF_RATE : n(input.annualRatePct);
  const years = Math.floor(clampPos(input.years ?? PPF_TENURE_YEARS));

  const schedule: PpfYear[] = [];
  let balance = 0;
  let totalInterest = 0;

  for (let y = 1; y <= years; y++) {
    const interest = (balance + yearlyDeposit) * (annualRatePct / 100);
    balance = balance + yearlyDeposit + interest;
    totalInterest += interest;
    schedule.push({
      year: y,
      deposit: r0(yearlyDeposit),
      interest: r0(interest),
      balance: r0(balance),
    });
  }

  return {
    totalInvested: r2(yearlyDeposit * years),
    maturityValue: r2(balance),
    totalInterest: r2(totalInterest),
    schedule,
    depositOutOfRange:
      yearlyDeposit > 0 &&
      (yearlyDeposit < PPF_MIN_DEPOSIT || yearlyDeposit > PPF_MAX_DEPOSIT),
  };
}

// ---------------------------------------------------------------------------
// NPS
// ---------------------------------------------------------------------------

export interface NpsResult {
  totalInvested: number;
  corpusAtRetirement: number;
  totalReturns: number;
  annuityCorpus: number;
  lumpSumWithdrawal: number;
  monthlyPension: number;
  yearsToRetirement: number;
  schedule: GrowthYear[];
}

export function calculateNps(input: {
  currentAge: number;
  retireAge: number;
  monthlyContribution: number;
  annualRatePct: number;
  annuityPortionPct?: number;
  annuityRatePct?: number;
}): NpsResult {
  const currentAge = clampPos(input.currentAge);
  const retireAge = clampPos(input.retireAge);
  const years = Math.max(0, Math.floor(retireAge - currentAge));
  const annuityPortionPct = Math.min(
    100,
    Math.max(NPS_MIN_ANNUITY_PCT, n(input.annuityPortionPct ?? NPS_MIN_ANNUITY_PCT))
  );
  const annuityRatePct = clampPos(input.annuityRatePct ?? 6);

  const growth = calculateSip({
    monthlyAmount: input.monthlyContribution,
    annualRatePct: input.annualRatePct,
    years,
  });

  const annuityCorpus = growth.maturityValue * (annuityPortionPct / 100);
  const lumpSumWithdrawal = growth.maturityValue - annuityCorpus;
  const monthlyPension = (annuityCorpus * (annuityRatePct / 100)) / 12;

  return {
    totalInvested: growth.totalInvested,
    corpusAtRetirement: growth.maturityValue,
    totalReturns: growth.totalReturns,
    annuityCorpus: r2(annuityCorpus),
    lumpSumWithdrawal: r2(lumpSumWithdrawal),
    monthlyPension: r2(monthlyPension),
    yearsToRetirement: years,
    schedule: growth.schedule,
  };
}

// ---------------------------------------------------------------------------
// EPF
// ---------------------------------------------------------------------------

export interface EpfYear {
  year: number;
  age: number;
  employee: number;
  employer: number;
  interest: number;
  balance: number;
}

export interface EpfResult {
  totalEmployee: number;
  totalEmployer: number;
  totalInterest: number;
  maturityValue: number;
  yearsToRetirement: number;
  schedule: EpfYear[];
}

/**
 * Employer's share splits into EPS (pension, excluded from the EPF corpus) and
 * EPF, with the EPS leg capped at the statutory wage ceiling.
 */
export function calculateEpf(input: {
  monthlyBasicDa: number;
  employeePct?: number;
  annualRatePct?: number;
  currentAge: number;
  retireAge: number;
  salaryGrowthPct?: number;
}): EpfResult {
  const employeePct = n(input.employeePct ?? EPF_EMPLOYEE_PCT);
  const annualRatePct = n(input.annualRatePct ?? EPF_RATE);
  const currentAge = clampPos(input.currentAge);
  const retireAge = clampPos(input.retireAge);
  const salaryGrowthPct = clampPos(input.salaryGrowthPct);
  const years = Math.max(0, Math.floor(retireAge - currentAge));

  let salary = clampPos(input.monthlyBasicDa);
  let balance = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalInterest = 0;
  const schedule: EpfYear[] = [];

  for (let y = 1; y <= years; y++) {
    const employee = salary * (employeePct / 100) * 12;
    const epsWage = Math.min(salary, EPF_WAGE_CEILING);
    const eps = epsWage * (EPF_EMPLOYER_EPS_PCT / 100) * 12;
    const employer = salary * (EPF_EMPLOYEE_PCT / 100) * 12 - eps;

    const contribution = employee + employer;
    // Interest accrues on the opening balance plus roughly half a year of contributions.
    const interest = (balance + contribution / 2) * (annualRatePct / 100);

    balance += contribution + interest;
    totalEmployee += employee;
    totalEmployer += employer;
    totalInterest += interest;

    schedule.push({
      year: y,
      age: currentAge + y,
      employee: r0(employee),
      employer: r0(employer),
      interest: r0(interest),
      balance: r0(balance),
    });

    salary *= 1 + salaryGrowthPct / 100;
  }

  return {
    totalEmployee: r2(totalEmployee),
    totalEmployer: r2(totalEmployer),
    totalInterest: r2(totalInterest),
    maturityValue: r2(balance),
    yearsToRetirement: years,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Goal planner
// ---------------------------------------------------------------------------

export interface GoalResult {
  targetToday: number;
  inflatedTarget: number;
  futureValueOfSavings: number;
  shortfall: number;
  requiredMonthlySip: number;
  requiredLumpsum: number;
  onTrack: boolean;
  schedule: GrowthYear[];
}

export function calculateGoal(input: {
  targetAmount: number;
  years: number;
  annualRatePct: number;
  currentSavings?: number;
  inflationPct?: number;
}): GoalResult {
  const targetAmount = clampPos(input.targetAmount);
  const years = clampPos(input.years);
  const annualRatePct = n(input.annualRatePct);
  const currentSavings = clampPos(input.currentSavings);
  const inflationPct = clampPos(input.inflationPct);

  const inflatedTarget = targetAmount * Math.pow(1 + inflationPct / 100, years);
  const monthlyRate = annualRatePct / 12 / 100;
  const months = Math.round(years * 12);

  const futureValueOfSavings =
    currentSavings * Math.pow(1 + annualRatePct / 100, years);
  const shortfall = Math.max(0, inflatedTarget - futureValueOfSavings);

  let requiredMonthlySip = 0;
  if (shortfall > 0 && months > 0) {
    requiredMonthlySip =
      monthlyRate === 0
        ? shortfall / months
        : shortfall /
          (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
            (1 + monthlyRate));
  }

  const requiredLumpsum =
    shortfall > 0 ? shortfall / Math.pow(1 + annualRatePct / 100, years) : 0;

  const growth = calculateSip({
    monthlyAmount: requiredMonthlySip,
    annualRatePct,
    years,
  });
  const schedule = growth.schedule.map((point) => ({
    ...point,
    value: r0(
      point.value + currentSavings * Math.pow(1 + annualRatePct / 100, point.year)
    ),
    invested: r0(point.invested + currentSavings),
  }));

  return {
    targetToday: r2(targetAmount),
    inflatedTarget: r2(inflatedTarget),
    futureValueOfSavings: r2(futureValueOfSavings),
    shortfall: r2(shortfall),
    requiredMonthlySip: r2(requiredMonthlySip),
    requiredLumpsum: r2(requiredLumpsum),
    onTrack: shortfall <= 0,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

export interface RetirementProjectionPoint {
  year: number;
  age: number;
  corpus: number;
}

export interface RetirementResult {
  corpusNeeded: number;
  projectedCorpus: number;
  gap: number;
  requiredSIP: number;
  futureMonthlyExpenses: number;
  yearsToRetire: number;
  yearsInRetirement: number;
  projection: RetirementProjectionPoint[];
}

export const RETIREMENT_LIFE_EXPECTANCY = 85;

/**
 * Corpus required is the present value at retirement of an inflation-adjusted
 * monthly expense annuity, discounted at the real (post-inflation) return.
 */
export function calculateRetirementPlan(params: {
  currentAge: number;
  retireAge: number;
  monthlyExpenses: number;
  inflationRate: number;
  returnRate: number;
  currentCorpus: number;
  monthlySIP: number;
  lifeExpectancy?: number;
}): RetirementResult | null {
  const currentAge = n(params.currentAge);
  const retireAge = n(params.retireAge);
  const monthlyExpenses = clampPos(params.monthlyExpenses);
  const inflationRate = n(params.inflationRate);
  const returnRate = n(params.returnRate);
  const currentCorpus = clampPos(params.currentCorpus);
  const monthlySIP = clampPos(params.monthlySIP);
  const lifeExpectancy = params.lifeExpectancy ?? RETIREMENT_LIFE_EXPECTANCY;

  const yearsToRetire = retireAge - currentAge;
  const yearsInRetirement = Math.max(0, lifeExpectancy - retireAge);

  if (yearsToRetire <= 0) return null;

  const futureMonthlyExpenses =
    monthlyExpenses * Math.pow(1 + inflationRate / 100, yearsToRetire);

  const monthlyRealReturn = (returnRate - inflationRate) / 100 / 12;
  const corpusNeeded =
    monthlyRealReturn <= 0
      ? futureMonthlyExpenses * 12 * yearsInRetirement
      : (futureMonthlyExpenses *
          (1 - Math.pow(1 + monthlyRealReturn, -yearsInRetirement * 12))) /
        monthlyRealReturn;

  const monthlyReturn = returnRate / 100 / 12;
  const months = yearsToRetire * 12;
  const compounded = Math.pow(1 + monthlyReturn, months);

  const corpusGrowth = currentCorpus * compounded;
  const sipGrowth =
    monthlyReturn === 0
      ? monthlySIP * months
      : monthlySIP * ((compounded - 1) / monthlyReturn);
  const projectedCorpus = corpusGrowth + sipGrowth;

  const gapToFund = corpusNeeded - corpusGrowth;
  const requiredSIP =
    gapToFund > 0 && monthlyReturn > 0
      ? (gapToFund * monthlyReturn) / (compounded - 1)
      : gapToFund > 0
        ? gapToFund / months
        : 0;

  const projection: RetirementProjectionPoint[] = [];
  let running = currentCorpus;
  for (let y = 0; y <= yearsToRetire; y++) {
    projection.push({
      year: new Date().getFullYear() + y,
      age: currentAge + y,
      corpus: r0(running),
    });
    running = running * (1 + returnRate / 100) + monthlySIP * 12;
  }

  return {
    corpusNeeded: r0(corpusNeeded),
    projectedCorpus: r0(projectedCorpus),
    gap: r0(Math.max(0, corpusNeeded - projectedCorpus)),
    requiredSIP: r0(requiredSIP),
    futureMonthlyExpenses: r0(futureMonthlyExpenses),
    yearsToRetire,
    yearsInRetirement,
    projection,
  };
}

// ---------------------------------------------------------------------------
// Gratuity
// ---------------------------------------------------------------------------

export interface GratuityResult {
  gratuity: number;
  uncappedGratuity: number;
  eligible: boolean;
  cappedAtLimit: boolean;
  roundedYears: number;
}

/**
 * Payment of Gratuity Act: last drawn basic+DA × 15/26 × years of service,
 * with service rounded to the nearest year and the payout capped at ₹20L.
 * Employers outside the Act use a 15/30 (half-month) basis.
 */
export function calculateGratuity(input: {
  lastDrawnBasicDa: number;
  yearsOfService: number;
  coveredByAct?: boolean;
}): GratuityResult {
  const salary = clampPos(input.lastDrawnBasicDa);
  const rawYears = clampPos(input.yearsOfService);
  const coveredByAct = input.coveredByAct ?? true;

  const eligible = rawYears >= 5;
  const roundedYears = coveredByAct ? Math.round(rawYears) : Math.floor(rawYears);
  const divisor = coveredByAct ? 26 : 30;

  const uncappedGratuity = eligible
    ? (salary * 15 * roundedYears) / divisor
    : 0;
  const gratuity = Math.min(uncappedGratuity, GRATUITY_CAP);

  return {
    gratuity: r2(gratuity),
    uncappedGratuity: r2(uncappedGratuity),
    eligible,
    cappedAtLimit: uncappedGratuity > GRATUITY_CAP,
    roundedYears,
  };
}

// ---------------------------------------------------------------------------
// HRA exemption
// ---------------------------------------------------------------------------

export interface HraResult {
  exempt: number;
  taxableHra: number;
  components: { a: number; b: number; c: number };
}

/**
 * Section 10(13A): exemption is the least of actual HRA, rent minus 10% of
 * basic, and 50% (metro) / 40% (non-metro) of basic. Inputs are monthly.
 */
export function calculateHraExemption(input: {
  basicSalary: number;
  hraReceived: number;
  rentPaid: number;
  isMetro: boolean;
}): HraResult | null {
  const basic = clampPos(input.basicSalary);
  const received = clampPos(input.hraReceived);
  const rent = clampPos(input.rentPaid);
  if (basic === 0 || rent === 0) return null;

  const annualBasic = basic * 12;
  const annualHra = received * 12;
  const annualRent = rent * 12;

  const a = annualHra;
  const b = annualRent - 0.1 * annualBasic;
  const c = (input.isMetro ? 0.5 : 0.4) * annualBasic;
  const exempt = Math.max(0, Math.min(a, b, c));

  return {
    exempt,
    taxableHra: Math.max(0, annualHra - exempt),
    components: { a, b: Math.max(0, b), c },
  };
}

// ---------------------------------------------------------------------------
// CAGR
// ---------------------------------------------------------------------------

export interface CagrResult {
  cagr: number;
  absoluteReturnPct: number;
  totalGain: number;
  schedule: GrowthYear[];
}

export function calculateCagr(input: {
  initialValue: number;
  finalValue: number;
  years: number;
}): CagrResult {
  const initialValue = clampPos(input.initialValue);
  const finalValue = clampPos(input.finalValue);
  const years = clampPos(input.years);

  if (initialValue === 0 || years === 0) {
    return { cagr: 0, absoluteReturnPct: 0, totalGain: 0, schedule: [] };
  }

  const cagr = (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  const schedule: GrowthYear[] = [];
  for (let y = 0; y <= Math.ceil(years); y++) {
    const at = Math.min(y, years);
    const value = initialValue * Math.pow(1 + cagr / 100, at);
    schedule.push({
      year: y,
      invested: r0(initialValue),
      value: r0(value),
      returns: r0(value - initialValue),
    });
  }

  return {
    cagr: r2(cagr),
    absoluteReturnPct: r2(((finalValue - initialValue) / initialValue) * 100),
    totalGain: r2(finalValue - initialValue),
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Inflation
// ---------------------------------------------------------------------------

export interface InflationYear {
  year: number;
  futureCost: number;
  purchasingPower: number;
}

export interface InflationResult {
  futureCost: number;
  increase: number;
  /** What today's amount will be worth in today's money after `years`. */
  purchasingPower: number;
  purchasingPowerLossPct: number;
  schedule: InflationYear[];
}

export function calculateInflationImpact(input: {
  currentCost: number;
  inflationPct: number;
  years: number;
}): InflationResult {
  const currentCost = clampPos(input.currentCost);
  const inflationPct = n(input.inflationPct);
  const years = Math.floor(clampPos(input.years));

  const factor = Math.pow(1 + inflationPct / 100, years);
  const futureCost = currentCost * factor;
  const purchasingPower = factor === 0 ? 0 : currentCost / factor;

  const schedule: InflationYear[] = [];
  for (let y = 0; y <= years; y++) {
    const f = Math.pow(1 + inflationPct / 100, y);
    schedule.push({
      year: y,
      futureCost: r0(currentCost * f),
      purchasingPower: r0(f === 0 ? 0 : currentCost / f),
    });
  }

  return {
    futureCost: r2(futureCost),
    increase: r2(futureCost - currentCost),
    purchasingPower: r2(purchasingPower),
    purchasingPowerLossPct:
      currentCost > 0 ? r2(((currentCost - purchasingPower) / currentCost) * 100) : 0,
    schedule,
  };
}

/** Re-exported so calculator pages have a single math import. */
export { calculateSIPGrowth, projectMaturityValue, projectRecurringDepositValue };
