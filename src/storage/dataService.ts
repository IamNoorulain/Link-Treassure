import { db, type Site, type AgencyEntry, type AgencyContact } from './db';
import { normalizeUrl, parseNumeric } from '../utils/helpers';

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
}

export const dataService = {
  async upsertSite(siteData: Partial<Site>, agency?: AgencyEntry): Promise<void> {
    if (!siteData.url) return;
    const url = normalizeUrl(siteData.url);
    
    const existingSite = await db.sites.get(url);
    
    if (existingSite) {
      const updatedAgencies = [...existingSite.agencies];
      
      if (agency) {
        const agencyIndex = updatedAgencies.findIndex(a => a.agencyName.toLowerCase() === agency.agencyName.toLowerCase());
        if (agencyIndex > -1) {
          // Smart update: only overwrite if new value exists
          const existingAgency = updatedAgencies[agencyIndex];
          updatedAgencies[agencyIndex] = {
            ...existingAgency,
            ...Object.fromEntries(Object.entries(agency).filter(([_, v]) => v !== undefined && v !== null && v !== ''))
          };
        } else {
          updatedAgencies.push(agency);
        }
      }
      
      // Recalculate aggregated metrics
      const maxTraffic = Math.max(...updatedAgencies.map(a => a.traffic || 0), siteData.traffic || 0);
      const commonPayment = updatedAgencies.find(a => a.paymentType)?.paymentType || siteData.paymentType;

      await db.sites.update(url, {
        ...siteData,
        url,
        agencies: updatedAgencies,
        updatedAt: Date.now(),
        traffic: maxTraffic > 0 ? maxTraffic : existingSite.traffic,
        da: siteData.da ?? existingSite.da,
        dr: siteData.dr ?? existingSite.dr,
        paymentType: commonPayment || existingSite.paymentType,
        category1: siteData.category1 ?? existingSite.category1,
        category2: siteData.category2 ?? existingSite.category2,
        notes: siteData.notes ?? existingSite.notes,
      });
    } else {
      await db.sites.add({
        url,
        traffic: agency?.traffic || siteData.traffic,
        da: siteData.da,
        dr: siteData.dr,
        paymentType: agency?.paymentType || siteData.paymentType,
        category1: siteData.category1,
        category2: siteData.category2,
        notes: siteData.notes,
        agencies: agency ? [agency] : [],
        updatedAt: Date.now(),
      });
    }
  },

  async bulkImport(rows: any[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    await db.transaction('rw', db.sites, async () => {
      for (const row of rows) {
        if (!row.URL) continue;
        const url = normalizeUrl(row.URL);
        const agencyName = row.Agency || row.agency;
        
        if (!agencyName) {
          skipped++;
          console.warn(`Skipped row: Missing agency for ${url}`);
          continue;
        }

        const agencyData: AgencyEntry = {
          agencyName,
          costPrice: parseNumeric(row['Agency Price'] || row.Cost) || 0,
          sellingPrice: parseNumeric(row['My Price'] || row.Price) || 0,
          traffic: parseNumeric(row.Traffic),
          paymentType: row['Payment Type'] || row.Payment || undefined,
          linkCount: parseNumeric(row['Link Count'] || row.Links),
          linkType: row['Link Type'] || undefined,
        };

        const siteData: Partial<Site> = {
          url,
          da: parseNumeric(row.DA),
          dr: parseNumeric(row.DR),
          category1: row['Category 1'] || undefined,
          category2: row['Category 2'] || undefined,
          paymentType: agencyData.paymentType,
        };
        
        const existingSite = await db.sites.get(url);
        
        if (existingSite) {
          const agencyIndex = existingSite.agencies.findIndex(a => a.agencyName.toLowerCase() === agencyName.toLowerCase());
          
          if (agencyIndex > -1) {
            // Check if anything actually changed
            const existingAgency = existingSite.agencies[agencyIndex];
            const hasChanges = Object.entries(agencyData).some(([key, value]) => {
              if (value === undefined || value === null || value === '') return false;
              return existingAgency[key as keyof AgencyEntry] !== value;
            });

            if (!hasChanges) {
              skipped++;
              console.log(`Duplicate skipped: ${url} Agency ${agencyName}`);
              continue;
            }

            // Update existing agency
            const updatedAgencies = [...existingSite.agencies];
            updatedAgencies[agencyIndex] = {
              ...existingAgency,
              ...Object.fromEntries(Object.entries(agencyData).filter(([_, v]) => v !== undefined && v !== null && v !== ''))
            };

            const maxTraffic = Math.max(...updatedAgencies.map(a => a.traffic || 0));
            const commonPayment = updatedAgencies.find(a => a.paymentType)?.paymentType;

            await db.sites.update(url, {
              ...Object.fromEntries(Object.entries(siteData).filter(([_, v]) => v !== undefined && v !== null && v !== '')),
              agencies: updatedAgencies,
              traffic: maxTraffic > 0 ? maxTraffic : existingSite.traffic,
              paymentType: commonPayment || existingSite.paymentType,
              updatedAt: Date.now(),
            });
            updated++;
          } else {
            // Add new agency to existing site
            const updatedAgencies = [...existingSite.agencies, agencyData];
            const maxTraffic = Math.max(...updatedAgencies.map(a => a.traffic || 0));
            const commonPayment = updatedAgencies.find(a => a.paymentType)?.paymentType;

            await db.sites.update(url, {
              ...Object.fromEntries(Object.entries(siteData).filter(([_, v]) => v !== undefined && v !== null && v !== '')),
              agencies: updatedAgencies,
              traffic: maxTraffic > 0 ? maxTraffic : existingSite.traffic,
              paymentType: commonPayment || existingSite.paymentType,
              updatedAt: Date.now(),
            });
            updated++;
          }
        } else {
          // New site
          await db.sites.add({
            url,
            da: siteData.da,
            dr: siteData.dr,
            traffic: agencyData.traffic,
            paymentType: agencyData.paymentType,
            category1: siteData.category1,
            category2: siteData.category2,
            agencies: [agencyData],
            updatedAt: Date.now(),
          });
          imported++;
        }
      }
    });
    
    return { imported, updated, skipped };
  },

  async getAgencyContact(agencyName: string): Promise<string> {
    const contact = await db.agencyContacts.get(agencyName);
    return contact?.contactInfo || '';
  },

  async upsertAgencyContact(agencyName: string, contactInfo: string): Promise<void> {
    await db.agencyContacts.put({ agencyName, contactInfo });
  },

  async getAllAgencyContacts(): Promise<AgencyContact[]> {
    return db.agencyContacts.toArray();
  },

  async bulkAdjustPrices(urls: string[], amount: number): Promise<void> {
    await db.transaction('rw', db.sites, async () => {
      for (const url of urls) {
        const site = await db.sites.get(url);
        if (site) {
          const updatedAgencies = site.agencies.map(a => ({
            ...a,
            sellingPrice: a.sellingPrice + amount
          }));
          await db.sites.update(url, { agencies: updatedAgencies, updatedAt: Date.now() });
        }
      }
    });
  },

  async bulkAdjustTraffic(urls: string[], percent: number): Promise<void> {
    await db.transaction('rw', db.sites, async () => {
      for (const url of urls) {
        const site = await db.sites.get(url);
        if (site) {
          let siteChanged = false;
          const updatedAgencies = site.agencies.map(a => {
            if (a.traffic) {
              siteChanged = true;
              return { ...a, traffic: Math.round(a.traffic * (1 + percent / 100)) };
            }
            return a;
          });
          
          if (siteChanged) {
            const maxTraffic = Math.max(...updatedAgencies.map(a => a.traffic || 0));
            await db.sites.update(url, { 
              agencies: updatedAgencies, 
              traffic: maxTraffic,
              updatedAt: Date.now() 
            });
          }
        }
      }
    });
  },

  async bulkDeleteSites(urls: string[]): Promise<void> {
    await db.sites.bulkDelete(urls);
  },

  async deleteSite(url: string): Promise<void> {
    await db.sites.delete(url);
  },

  async exportBackup(): Promise<string> {
    const allSites = await db.sites.toArray();
    return JSON.stringify(allSites, null, 2);
  },

  async importBackup(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) throw new Error('Invalid backup format');
    
    await db.transaction('rw', db.sites, async () => {
      await db.sites.clear();
      await db.sites.bulkAdd(data);
    });
  }
};
