import Dexie, { type Table } from 'dexie';

export interface AgencyEntry {
  agencyName: string;
  costPrice: number; // USD
  sellingPrice: number; // USD
  traffic?: number;
  paymentType?: 'Upfront' | 'After';
  linkCount?: number;
  linkType?: 'DoFollow' | 'NoFollow';
}

export interface AgencyContact {
  agencyName: string; // Primary Key
  contactInfo: string;
}

export interface Site {
  url: string; // Primary Key (Normalized)
  traffic?: number; // Aggregated/Highest value for sorting/filtering
  da?: number;
  dr?: number;
  paymentType?: 'Upfront' | 'After'; // Common value
  category1?: string;
  category2?: string;
  notes?: string;
  agencies: AgencyEntry[];
  updatedAt: number;
}

export class BacklinkInventoryDB extends Dexie {
  sites!: Table<Site>;
  agencyContacts!: Table<AgencyContact>;

  constructor() {
    super('backlink_inventory_db');
    this.version(2).stores({
      sites: 'url, traffic, da, dr, category1, category2, *agencies.agencyName',
      agencyContacts: 'agencyName'
    });
  }
}

export const db = new BacklinkInventoryDB();
