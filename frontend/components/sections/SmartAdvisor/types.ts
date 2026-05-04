import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import type { CatalogProduct } from '../../../data/types/product';

export interface WizardAnswers {
  roomType?: string;
  area?: string;
  orientation?: string;
  usage?: string;
  priorities?: string[];
  budget?: string;
  floor?: string;
  buildingType?: string;
  name?: string;
  phone?: string;
}

export interface StepOption {
  value: string;
  label: string;
  sublabel?: string;
  Icon: ComponentType<LucideProps>;
}

export interface OptionStepDef {
  type: 'single' | 'multi';
  key: keyof WizardAnswers;
  question: string;
  subtitle: string;
  options: StepOption[];
  maxSelect?: number;
  group?: string;
  hint?: string;
}

export interface ContactStepDef {
  type: 'contact';
  question: string;
  subtitle: string;
}

export type StepDef = OptionStepDef | ContactStepDef;

export interface ScoredProduct {
  product: CatalogProduct;
  score: number;
  matchReasons: string[];
  installCost: number;
  annualSavings: number;
}

export interface ResultTier {
  tierLabel: string;
  tierBadge: string;
  highlighted: boolean;
  scored: ScoredProduct;
}
