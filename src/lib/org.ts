import type { Accent } from "@/lib/theme";

export type Role = "landlord" | "caretaker" | "tenant";
export type UnitType = "Bedsitter" | "Studio" | "1-Bedroom" | "2-Bedroom" | "3-Bedroom" | "4-Bedroom";
export type UnitStatus = "Vacant" | "Occupied" | "Maintenance";
export type UtilityMode = "included" | "self-paid";

export interface OrgUnit {
  id: string;
  houseNumber: string;
  type: UnitType;
  size: string;
  monthlyRent: number;
  securityDeposit: number;
  bookingDeposit: number;
  utilities: { water: UtilityMode; electricity: UtilityMode };
  status: UnitStatus;
  tenantId?: string;
  moveInDate?: string;
}

export interface OrgResident {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  tempPassword: string;
  passwordTemporary: boolean;
  unitId?: string;
  joinedAt: string;
}

export interface Org {
  id: string;
  propertyName: string;
  location: string;
  brand: Accent;
  admin: { name: string; phone: string; email: string };
  units: OrgUnit[];
  residents: OrgResident[];
  onboardingComplete: boolean;
  createdAt: string;
}

export interface UnitDraft {
  houseNumber: string;
  type: UnitType;
  size: string;
  monthlyRent: number;
  securityDeposit: number;
  bookingDeposit: number;
  water: UtilityMode;
  electricity: UtilityMode;
}

export interface OnboardingInput {
  propertyName: string;
  location: string;
  brand: Accent;
  admin: { name: string; phone: string; email: string };
  units: UnitDraft[];
}

export interface RegisterResidentInput {
  name: string;
  phone: string;
  email: string;
  username: string;
  unitId: string;
}
