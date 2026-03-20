import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Site, type AgencyEntry, type AgencyContact } from './storage/db';
import { dataService, type ImportResult } from './storage/dataService';
import { normalizeUrl, formatCurrency, parseNumeric, type Currency } from './utils/helpers';
import { 
  Plus, 
  Upload, 
  Download, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  MoreVertical, 
  X, 
  Trash2, 
  Copy, 
  FileJson,
  TrendingUp,
  Globe,
  Tag,
  ExternalLink,
  Zap,
  CreditCard,
  Link2,
  Settings,
  Moon,
  Sun,
  Menu,
  ArrowUp,
  Contact,
  Edit2,
  Save
} from 'lucide-react';
import Papa from 'papaparse';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_CURRENCY_RATES } from './utils/helpers';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rates, setRates] = useState<Record<Currency, number>>(() => {
    const saved = localStorage.getItem('currency_rates');
    return saved ? JSON.parse(saved) : DEFAULT_CURRENCY_RATES;
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    minTraffic: 0,
    minDA: 0,
    minDR: 0,
    category: '',
    agency: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Site | 'agenciesCount'; direction: 'asc' | 'desc' } | null>(null);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [editedSite, setEditedSite] = useState<Site | null>(null);

  const handleEditChange = (field: keyof Site, value: any) => {
    if (!editedSite) return;
    setEditedSite({ ...editedSite, [field]: value });
  };

  const handleAgencyEditChange = (index: number, field: keyof AgencyEntry, value: any) => {
    if (!editedSite) return;
    const newAgencies = [...editedSite.agencies];
    newAgencies[index] = { ...newAgencies[index], [field]: value };
    setEditedSite({ ...editedSite, agencies: newAgencies });
  };

  const handleSaveSite = async () => {
    if (!editedSite) return;
    await db.sites.update(editedSite.url, {
      ...editedSite,
      updatedAt: Date.now()
    });
    setSelectedSite(editedSite);
    setIsEditingSite(false);
  };

  const [isAgencyDropdownOpen, setIsAgencyDropdownOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAgencyContactModalOpen, setIsAgencyContactModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [bulkPriceAmount, setBulkPriceAmount] = useState(0);
  const [bulkTrafficPercent, setBulkTrafficPercent] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sites = useLiveQuery(() => db.sites.toArray());
  const agencyContacts = useLiveQuery(() => db.agencyContacts.toArray());

  const agencies = useMemo(() => {
    if (!sites) return [];
    const names = new Set(sites.flatMap(s => s.agencies.map(a => a.agencyName)));
    return Array.from(names).sort();
  }, [sites]);

  const agencyContactsMap = useMemo(() => {
    const map: Record<string, string> = {};
    agencyContacts?.forEach(c => {
      map[c.agencyName] = c.contactInfo;
    });
    return map;
  }, [agencyContacts]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const pageSize = 50;

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    
    return sites.filter(site => {
      const matchesSearch = site.url.includes(searchTerm.toLowerCase()) || 
                           site.category1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           site.category2?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           site.agencies.some(a => a.agencyName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesTraffic = (site.traffic || 0) >= filters.minTraffic;
      const matchesDA = (site.da || 0) >= filters.minDA;
      const matchesDR = (site.dr || 0) >= filters.minDR;
      const matchesCategory = !filters.category || 
                             site.category1 === filters.category || 
                             site.category2 === filters.category;
      const matchesAgency = !filters.agency || 
                           site.agencies.some(a => a.agencyName === filters.agency);
      
      const matchesMissing = !showOnlyMissing || !site.da || !site.dr || !site.traffic;
      
      return matchesSearch && matchesTraffic && matchesDA && matchesDR && matchesCategory && matchesAgency && matchesMissing;
    }).sort((a, b) => {
      if (!sortConfig) return 0;
      
      let aValue: any;
      let bValue: any;
      
      if (sortConfig.key === 'agenciesCount') {
        aValue = a.agencies.length;
        bValue = b.agencies.length;
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }
      
      if (aValue === bValue) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [sites, searchTerm, filters, sortConfig, showOnlyMissing]);

  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSites.slice(start, start + pageSize);
  }, [filteredSites, currentPage]);

  const totalPages = Math.ceil(filteredSites.length / pageSize);

  const handleSort = (key: keyof Site | 'agenciesCount') => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const summary = await dataService.bulkImport(results.data);
        setImportSummary(summary);
        setIsImporting(false);
        e.target.value = ''; // Reset input
      },
      error: (error) => {
        console.error('Import error:', error);
        setIsImporting(false);
      }
    });
  };

  const handleExport = () => {
    const csv = Papa.unparse(filteredSites.map(s => ({
      URL: s.url,
      Traffic: s.traffic,
      DA: s.da,
      DR: s.dr,
      Payment: s.paymentType,
      'Category 1': s.category1,
      'Category 2': s.category2,
      Agencies: s.agencies.map(a => `${a.agencyName} (${a.sellingPrice})`).join('; ')
    })));
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'backlink_inventory_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTSV = () => {
    const sitesToCopy = selectedSites.size > 0 
      ? filteredSites.filter(s => selectedSites.has(s.url))
      : filteredSites;

    if (sitesToCopy.length === 0) {
      alert('No sites to copy');
      return;
    }

    const headers = ['URL', 'Traffic', 'DA', 'DR', 'Payment', 'Price'];
    const rows = sitesToCopy.map(s => {
      const maxPrice = s.agencies.length > 0 
        ? Math.max(...s.agencies.map(a => a.sellingPrice))
        : 0;
      
      return [
        s.url,
        s.traffic || '',
        s.da || '',
        s.dr || '',
        s.paymentType || '',
        maxPrice > 0 ? formatCurrency(maxPrice, currency, rates) : '-'
      ];
    });
    
    const tsv = [headers, ...rows].map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    alert(`Copied ${sitesToCopy.length} sites to clipboard as Tab Separated Values`);
  };

  const handleBackupExport = async () => {
    const json = await dataService.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await dataService.importBackup(event.target?.result as string);
        alert('Backup restored successfully');
      } catch (error) {
        alert('Error restoring backup: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkPriceAdjustment = async () => {
    if (selectedSites.size === 0) return;
    if (bulkPriceAmount === 0) {
      alert('Please enter a non-zero amount to adjust.');
      return;
    }
    
    await dataService.bulkAdjustPrices(Array.from(selectedSites), bulkPriceAmount);
    setSelectedSites(new Set());
    setBulkPriceAmount(0);
    alert(`Adjusted selling price by $${bulkPriceAmount} for ${selectedSites.size} sites.`);
  };

  const handleBulkTrafficAdjustment = async () => {
    if (selectedSites.size === 0) return;
    if (bulkTrafficPercent === 0) {
      alert('Please enter a non-zero percentage to adjust.');
      return;
    }
    
    await dataService.bulkAdjustTraffic(Array.from(selectedSites), bulkTrafficPercent);
    setSelectedSites(new Set());
    setBulkTrafficPercent(0);
    alert(`Adjusted traffic by ${bulkTrafficPercent}% for ${selectedSites.size} sites.`);
  };

  const handleBulkDelete = async () => {
    if (selectedSites.size === 0) return;
    // Removed confirm for iframe compatibility
    await dataService.bulkDeleteSites(Array.from(selectedSites));
    setSelectedSites(new Set());
  };

  const toggleSiteSelection = (url: string) => {
    const newSelection = new Set(selectedSites);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedSites(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedSites.size === paginatedSites.length && paginatedSites.length > 0) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(paginatedSites.map(s => s.url)));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Link Treasure</h1>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {(['USD', 'GBP', 'PKR'] as Currency[]).map((cur) => (
                <button
                  key={cur}
                  onClick={() => setCurrency(cur)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    currency === cur 
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  )}
                >
                  {cur}
                </button>
              ))}
            </div>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button 
                onClick={() => setIsAgencyDropdownOpen(!isAgencyDropdownOpen)}
                className={cn(
                  "p-2 rounded-lg transition-all flex items-center gap-2",
                  isAgencyDropdownOpen 
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                    : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title="Agency Contacts"
              >
                <Contact className="w-5 h-5" />
                {agencies.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {agencies.length}
                  </span>
                )}
              </button>

              {isAgencyDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsAgencyDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <h3 className="text-sm font-bold dark:text-slate-100">Agency Contacts</h3>
                      <button onClick={() => setIsAgencyDropdownOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2 space-y-1">
                      {agencies.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                          No agencies found in data.
                        </div>
                      ) : (
                        agencies.map(agency => (
                          <div key={agency} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{agency}</label>
                            <input
                              type="text"
                              placeholder="Add contact info..."
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100 transition-all"
                              value={agencyContactsMap[agency] || ''}
                              onChange={async (e) => {
                                await dataService.upsertAgencyContact(agency, e.target.value);
                              }}
                            />
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <button 
                        onClick={() => {
                          setIsAgencyDropdownOpen(false);
                          setIsAgencyContactModalOpen(true);
                        }}
                        className="w-full py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-all"
                      >
                        Manage All Contacts
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title="Currency Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            
            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Import CSV</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
            
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Site</span>
            </button>
            
            <div className="relative group">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button onClick={handleExport} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                  <button onClick={handleBackupExport} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                    <FileJson className="w-4 h-4" /> Backup JSON
                  </button>
                  <label className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" /> Restore JSON
                    <input type="file" accept=".json" className="hidden" onChange={handleBackupImport} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex lg:hidden items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4 shadow-lg">
            <div className="flex flex-wrap gap-2">
              {(['USD', 'GBP', 'PKR'] as Currency[]).map((cur) => (
                <button
                  key={cur}
                  onClick={() => {
                    setCurrency(cur);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all border",
                    currency === cur 
                      ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" 
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {cur}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              
              <button 
                onClick={() => {
                  setIsAddModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Site</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setIsAgencyContactModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Contact className="w-4 h-4" />
                <span>Agencies</span>
              </button>
              <button 
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button 
                onClick={handleExport}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8 transition-colors">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search URL, categories, or agencies..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-100 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowOnlyMissing(!showOnlyMissing)}
                className={cn(
                  "w-full md:w-auto px-4 py-2.5 text-sm font-medium border rounded-xl transition-all flex items-center justify-center gap-2",
                  showOnlyMissing 
                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Zap className={cn("w-4 h-4", showOnlyMissing && "fill-current")} />
                <span>{showOnlyMissing ? "Showing Missing" : "Show Missing"}</span>
              </button>
              <button 
                onClick={handleCopyTSV}
                className="w-full md:w-auto px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy TSV</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min Traffic</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-100"
                value={filters.minTraffic}
                onChange={(e) => setFilters(f => ({ ...f, minTraffic: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min DA</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-100"
                value={filters.minDA}
                onChange={(e) => setFilters(f => ({ ...f, minDA: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min DR</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-100"
                value={filters.minDR}
                onChange={(e) => setFilters(f => ({ ...f, minDR: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-100"
                value={filters.category}
                onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">All Categories</option>
                {Array.from(new Set(sites?.flatMap(s => [s.category1, s.category2]).filter(Boolean))).sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agency</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-slate-100"
                value={filters.agency}
                onChange={(e) => setFilters(f => ({ ...f, agency: e.target.value }))}
              >
                <option value="">All Agencies</option>
                {Array.from(new Set(sites?.flatMap(s => s.agencies.map(a => a.agencyName)).filter(Boolean))).sort().map(agency => (
                  <option key={agency} value={agency}>{agency}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedSites.size > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-2xl mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{selectedSites.size} sites selected</span>
                <button 
                  onClick={() => setSelectedSites(new Set())}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear selection
                </button>
              </div>
              <button
                onClick={handleBulkDelete}
                className="w-full sm:w-auto text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center justify-center gap-1.5 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg px-3 py-1.5 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Price Adjustment ($)</span>
                <input
                  type="number"
                  placeholder="+/-"
                  className="w-16 text-sm font-bold focus:outline-none dark:bg-transparent dark:text-slate-100"
                  value={bulkPriceAmount || ''}
                  onChange={(e) => setBulkPriceAmount(Number(e.target.value))}
                />
                <button
                  onClick={handleBulkPriceAdjustment}
                  disabled={!bulkPriceAmount}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                >
                  Apply
                </button>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg px-3 py-1.5 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Traffic Adjustment (%)</span>
                <input
                  type="number"
                  placeholder="+/-"
                  className="w-16 text-sm font-bold focus:outline-none dark:bg-transparent dark:text-slate-100"
                  value={bulkTrafficPercent || ''}
                  onChange={(e) => setBulkTrafficPercent(Number(e.target.value))}
                />
                <button
                  onClick={handleBulkTrafficAdjustment}
                  disabled={!bulkTrafficPercent}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedSites.size === paginatedSites.length && paginatedSites.length > 0}
                      onChange={toggleAllSelection}
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('url')}>
                    <div className="flex items-center gap-1">
                      URL {sortConfig?.key === 'url' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('traffic')}>
                    <div className="flex items-center gap-1">
                      Traffic {sortConfig?.key === 'traffic' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('da')}>
                    <div className="flex items-center gap-1">
                      DA {sortConfig?.key === 'da' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('dr')}>
                    <div className="flex items-center gap-1">
                      DR {sortConfig?.key === 'dr' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('paymentType')}>
                    <div className="flex items-center gap-1">
                      Payment {sortConfig?.key === 'paymentType' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categories</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => handleSort('agenciesCount')}>
                    <div className="flex items-center gap-1">
                      Agencies {sortConfig?.key === 'agenciesCount' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedSites.map((site) => (
                    <tr 
                      key={site.url} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedSite(site);
                        setEditedSite(site);
                        setIsEditingSite(false);
                      }}
                    >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedSites.has(site.url)}
                        onChange={() => toggleSiteSelection(site.url)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{site.url}</span>
                        <a 
                          href={`https://${site.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-sm">
                      {site.traffic?.toLocaleString() || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                        {site.da || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
                        {site.dr || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                        site.paymentType === 'Upfront' 
                          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/50" 
                          : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50"
                      )}>
                        {site.paymentType || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {site.category1 && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider rounded">
                            {site.category1}
                          </span>
                        )}
                        {site.category2 && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider rounded">
                            {site.category2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{site.agencies.length}</span>
                        <div className="flex -space-x-2 overflow-hidden">
                          {site.agencies.slice(0, 3).map((a, i) => (
                            <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[8px] font-bold text-indigo-600 dark:text-indigo-300 uppercase">
                              {a.agencyName.charAt(0)}
                            </div>
                          ))}
                          {site.agencies.length > 3 && (
                            <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-400">
                              +{site.agencies.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedSites.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 opacity-20" />
                        <p>No sites found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Showing {Math.min(filteredSites.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filteredSites.length, currentPage * pageSize)} of {filteredSites.length} sites
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-50 transition-all"
                >
                  <ChevronUp className="w-4 h-4 -rotate-90 text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = currentPage;
                    if (totalPages > 5) {
                      if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                    } else {
                      pageNum = i + 1;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 text-sm font-medium rounded-lg transition-all",
                          currentPage === pageNum 
                            ? "bg-indigo-600 text-white" 
                            : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-50 transition-all"
                >
                  <ChevronUp className="w-4 h-4 rotate-90 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Site Detail Modal */}
      {selectedSite && editedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold truncate dark:text-slate-100">{selectedSite.url}</h2>
              </div>
              <button onClick={() => setSelectedSite(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5 dark:text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Traffic</span>
                  {isEditingSite ? (
                    <input 
                      type="number"
                      value={editedSite.traffic || ''}
                      onChange={(e) => handleEditChange('traffic', parseInt(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold"
                    />
                  ) : (
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedSite.traffic?.toLocaleString() || '-'}</span>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">DA</span>
                  {isEditingSite ? (
                    <input 
                      type="number"
                      value={editedSite.da || ''}
                      onChange={(e) => handleEditChange('da', parseInt(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold"
                    />
                  ) : (
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedSite.da || '-'}</span>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">DR</span>
                  {isEditingSite ? (
                    <input 
                      type="number"
                      value={editedSite.dr || ''}
                      onChange={(e) => handleEditChange('dr', parseInt(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold"
                    />
                  ) : (
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedSite.dr || '-'}</span>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Categories
                </h3>
                {isEditingSite ? (
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text"
                      placeholder="Category 1"
                      value={editedSite.category1 || ''}
                      onChange={(e) => handleEditChange('category1', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <input 
                      type="text"
                      placeholder="Category 2"
                      value={editedSite.category2 || ''}
                      onChange={(e) => handleEditChange('category2', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {[selectedSite.category1, selectedSite.category2].filter(Boolean).map((cat, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full border border-indigo-100 dark:border-indigo-900/50">
                        {cat}
                      </span>
                    ))}
                    {!selectedSite.category1 && !selectedSite.category2 && <span className="text-sm text-slate-400 dark:text-slate-500 italic">No categories assigned</span>}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Agencies & Pricing
                  </h3>
                  {isEditingSite && (
                    <button 
                      onClick={() => {
                        const newAgency: AgencyEntry = {
                          agencyName: '',
                          costPrice: 0,
                          sellingPrice: 0,
                          paymentType: 'Upfront',
                          linkCount: 1,
                          linkType: 'DoFollow',
                          traffic: 0
                        };
                        setEditedSite({ ...editedSite, agencies: [...editedSite.agencies, newAgency] });
                      }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Agency
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {(isEditingSite ? editedSite.agencies : selectedSite.agencies).map((agency, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group">
                      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex-1 mr-4">
                          {isEditingSite ? (
                            <input 
                              type="text"
                              value={agency.agencyName}
                              onChange={(e) => handleAgencyEditChange(i, 'agencyName', e.target.value)}
                              placeholder="Agency Name"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold"
                            />
                          ) : (
                            <>
                              <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{agency.agencyName}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">Cost: {formatCurrency(agency.costPrice, currency, rates)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {isEditingSite ? (
                            <div className="flex gap-2">
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-400 uppercase">Cost</label>
                                <input 
                                  type="number"
                                  value={agency.costPrice}
                                  onChange={(e) => handleAgencyEditChange(i, 'costPrice', parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-bold text-slate-400 uppercase">Sell</label>
                                <input 
                                  type="number"
                                  value={agency.sellingPrice}
                                  onChange={(e) => handleAgencyEditChange(i, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                  className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className="block text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(agency.sellingPrice, currency, rates)}</span>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                Profit: {formatCurrency(agency.sellingPrice - agency.costPrice, currency, rates)}
                              </span>
                            </div>
                          )}
                          <button 
                            onClick={async () => {
                              if (isEditingSite) {
                                const newAgencies = editedSite.agencies.filter((_, idx) => idx !== i);
                                setEditedSite({ ...editedSite, agencies: newAgencies });
                              } else {
                                const updatedAgencies = selectedSite.agencies.filter((_, idx) => idx !== i);
                                await db.sites.update(selectedSite.url, { agencies: updatedAgencies, updatedAt: Date.now() });
                                setSelectedSite({ ...selectedSite, agencies: updatedAgencies });
                                setEditedSite({ ...selectedSite, agencies: updatedAgencies });
                              }
                            }}
                            className={cn(
                              "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all",
                              !isEditingSite && "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="px-4 py-3 bg-white/50 dark:bg-slate-900/50 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <TrendingUp className="w-3 h-3" /> Traffic
                          </span>
                          {isEditingSite ? (
                            <input 
                              type="number"
                              value={agency.traffic || ''}
                              onChange={(e) => handleAgencyEditChange(i, 'traffic', parseInt(e.target.value) || 0)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{agency.traffic?.toLocaleString() || '-'}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <CreditCard className="w-3 h-3" /> Payment
                          </span>
                          {isEditingSite ? (
                            <select 
                              value={agency.paymentType}
                              onChange={(e) => handleAgencyEditChange(i, 'paymentType', e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                            >
                              <option value="Upfront">Upfront</option>
                              <option value="After">After</option>
                            </select>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{agency.paymentType || '-'}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            <Link2 className="w-3 h-3" /> Links
                          </span>
                          {isEditingSite ? (
                            <div className="flex gap-1">
                              <input 
                                type="number"
                                value={agency.linkCount}
                                onChange={(e) => handleAgencyEditChange(i, 'linkCount', parseInt(e.target.value) || 1)}
                                className="w-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-1 text-xs"
                              />
                              <input 
                                type="text"
                                value={agency.linkType || ''}
                                onChange={(e) => handleAgencyEditChange(i, 'linkType', e.target.value)}
                                placeholder="Type"
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-1 text-xs"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {agency.linkCount || '-'} {agency.linkType ? `(${agency.linkType})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(isEditingSite ? editedSite.agencies : selectedSite.agencies).length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500">
                      No agencies listed for this site.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button 
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this site?')) {
                    await dataService.deleteSite(selectedSite.url);
                    setSelectedSite(null);
                  }
                }}
                className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Site
              </button>
              <div className="flex gap-3">
                {isEditingSite ? (
                  <>
                    <button 
                      onClick={() => {
                        setIsEditingSite(false);
                        setEditedSite(selectedSite);
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveSite}
                      className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsEditingSite(true)}
                      className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Details
                    </button>
                    <button 
                      onClick={() => setSelectedSite(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Site Modal */}
      {isAddModalOpen && (
        <AddSiteModal 
          onClose={() => setIsAddModalOpen(false)} 
          onAdd={async (data) => {
            if (data.isBulk) {
              const urls = data.urls.split('\n').map((u: string) => normalizeUrl(u.trim())).filter(Boolean);
              for (const url of urls) {
                const agency: AgencyEntry | undefined = data.agencyName ? {
                  agencyName: data.agencyName,
                  costPrice: 0,
                  sellingPrice: 0,
                  paymentType: 'After',
                  linkCount: 1,
                  linkType: 'DoFollow',
                  traffic: 0
                } : undefined;
                
                await dataService.upsertSite({ url }, agency);
              }
            } else {
              const url = normalizeUrl(data.url);
              const agency: AgencyEntry | undefined = data.agencyName ? {
                agencyName: data.agencyName,
                costPrice: parseNumeric(data.costPrice) || 0,
                sellingPrice: parseNumeric(data.sellingPrice) || 0,
                traffic: parseNumeric(data.traffic),
                paymentType: data.paymentType,
                linkCount: parseNumeric(data.linkCount),
                linkType: data.linkType,
              } : undefined;
              
              await dataService.upsertSite({
                url,
                traffic: parseNumeric(data.traffic),
                da: parseNumeric(data.da),
                dr: parseNumeric(data.dr),
                category1: data.category1 || undefined,
                category2: data.category2 || undefined,
              }, agency);
            }
            
            setIsAddModalOpen(false);
          }}
        />
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal 
          rates={rates}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={(newRates) => {
            setRates(newRates);
            localStorage.setItem('currency_rates', JSON.stringify(newRates));
            setIsSettingsModalOpen(false);
          }}
        />
      )}

      {/* Agency Contact Modal */}
      {isAgencyContactModalOpen && (
        <AgencyContactModal 
          onClose={() => setIsAgencyContactModalOpen(false)}
          sites={sites || []}
        />
      )}

      {/* Import Summary Toast */}
      {importSummary && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-800 max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" /> Import Complete
              </h3>
              <button onClick={() => setImportSummary(null)} className="p-1 hover:bg-slate-800 dark:hover:bg-slate-900 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">New sites:</span>
                <span className="font-bold text-emerald-400">{importSummary.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sites updated:</span>
                <span className="font-bold text-indigo-400">{importSummary.updated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duplicates skipped:</span>
                <span className="font-bold text-slate-400">{importSummary.skipped}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-slate-900 dark:text-slate-100">Processing CSV Data...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">This may take a moment for large files.</p>
          </div>
        </div>
      )}

      {/* Back to Top Button (Mobile) */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="lg:hidden fixed bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
          aria-label="Back to top"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

function AddSiteModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: any) => void }) {
  const [isBulk, setIsBulk] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    urls: '',
    traffic: '',
    da: '',
    dr: '',
    category1: '',
    category2: '',
    agencyName: '',
    costPrice: '',
    sellingPrice: '',
    paymentType: 'After',
    linkCount: '1',
    linkType: 'DoFollow',
  });

  const [customCategory1, setCustomCategory1] = useState(false);
  const [customCategory2, setCustomCategory2] = useState(false);

  const categories = [
    "Tech", "Business", "Health", "Finance", "Travel", "Fashion", "Food", "Education", "Real Estate", "Automotive", "Entertainment", "Sports", "Lifestyle", "General"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold dark:text-slate-100">Add New Site</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>
        
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button 
            type="button"
            onClick={() => setIsBulk(false)}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-all",
              !isBulk ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            Single Site
          </button>
          <button 
            type="button"
            onClick={() => setIsBulk(true)}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-all",
              isBulk ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            Bulk Add
          </button>
        </div>
        
        <form 
          className="flex-1 overflow-y-auto p-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (isBulk) {
              if (!formData.urls) return alert('URLs are required');
              onAdd({ ...formData, isBulk: true });
            } else {
              if (!formData.url) return alert('URL is required');
              
              // Validation
              const da = parseNumeric(formData.da) || 0;
              const dr = parseNumeric(formData.dr) || 0;
              if (da < 0 || da > 100) return alert('DA must be between 0 and 100');
              if (dr < 0 || dr > 100) return alert('DR must be between 0 and 100');
              if ((parseNumeric(formData.traffic) || 0) < 0) return alert('Traffic cannot be negative');
              if ((parseNumeric(formData.costPrice) || 0) < 0) return alert('Cost Price cannot be negative');
              if ((parseNumeric(formData.sellingPrice) || 0) < 0) return alert('Selling Price cannot be negative');

              onAdd({ ...formData, isBulk: false });
            }
          }}
        >
          {isBulk ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URLs (one per line) *</label>
                <textarea
                  required
                  rows={8}
                  placeholder="example1.com&#10;example2.com&#10;example3.com"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100 font-mono text-sm"
                  value={formData.urls}
                  onChange={(e) => setFormData(d => ({ ...d, urls: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agency Name (for all sites)</label>
                <input
                  type="text"
                  placeholder="Agency Name"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                  value={formData.agencyName}
                  onChange={(e) => setFormData(d => ({ ...d, agencyName: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Site Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL *</label>
                    <input
                      required
                      type="text"
                      placeholder="example.com"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                      value={formData.url}
                      onChange={(e) => setFormData(d => ({ ...d, url: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Traffic</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.traffic}
                        onChange={(e) => setFormData(d => ({ ...d, traffic: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">DA</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.da}
                        onChange={(e) => setFormData(d => ({ ...d, da: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">DR</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.dr}
                        onChange={(e) => setFormData(d => ({ ...d, dr: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category 1</label>
                      {!customCategory1 ? (
                        <select
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                          value={formData.category1}
                          onChange={(e) => {
                            if (e.target.value === 'Manual') {
                              setCustomCategory1(true);
                              setFormData(d => ({ ...d, category1: '' }));
                            } else {
                              setFormData(d => ({ ...d, category1: e.target.value }));
                            }
                          }}
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Manual">Manual Entry</option>
                        </select>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Enter category"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pr-10 dark:text-slate-100"
                            value={formData.category1}
                            onChange={(e) => setFormData(d => ({ ...d, category1: e.target.value }))}
                          />
                          <button 
                            type="button"
                            onClick={() => setCustomCategory1(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category 2</label>
                      {!customCategory2 ? (
                        <select
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                          value={formData.category2}
                          onChange={(e) => {
                            if (e.target.value === 'Manual') {
                              setCustomCategory2(true);
                              setFormData(d => ({ ...d, category2: '' }));
                            } else {
                              setFormData(d => ({ ...d, category2: e.target.value }));
                            }
                          }}
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Manual">Manual Entry</option>
                        </select>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Enter category"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pr-10 dark:text-slate-100"
                            value={formData.category2}
                            onChange={(e) => setFormData(d => ({ ...d, category2: e.target.value }))}
                          />
                          <button 
                            type="button"
                            onClick={() => setCustomCategory2(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Initial Agency Entry (Optional)</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agency Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                      value={formData.agencyName}
                      onChange={(e) => setFormData(d => ({ ...d, agencyName: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cost Price (USD)</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.costPrice}
                        onChange={(e) => setFormData(d => ({ ...d, costPrice: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Selling Price (USD)</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData(d => ({ ...d, sellingPrice: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment</label>
                      <select
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.paymentType}
                        onChange={(e) => setFormData(d => ({ ...d, paymentType: e.target.value as any }))}
                      >
                        <option value="Upfront">Upfront</option>
                        <option value="After">After</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link Count</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.linkCount}
                        onChange={(e) => setFormData(d => ({ ...d, linkCount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link Type</label>
                      <select
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                        value={formData.linkType}
                        onChange={(e) => setFormData(d => ({ ...d, linkType: e.target.value as any }))}
                      >
                        <option value="DoFollow">DoFollow</option>
                        <option value="NoFollow">NoFollow</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 transition-colors"
            >
              {isBulk ? 'Add Sites Bulk' : 'Save Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgencyContactModal({ onClose, sites }: { onClose: () => void; sites: Site[] }) {
  const agencies = useMemo(() => {
    const names = new Set(sites.flatMap(s => s.agencies.map(a => a.agencyName)));
    return Array.from(names).sort();
  }, [sites]);

  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContacts = async () => {
      const all = await dataService.getAllAgencyContacts();
      const map: Record<string, string> = {};
      all.forEach(c => {
        map[c.agencyName] = c.contactInfo;
      });
      setContacts(map);
      setLoading(false);
    };
    loadContacts();
  }, []);

  const handleSave = async (agencyName: string, info: string) => {
    await dataService.upsertAgencyContact(agencyName, info);
    setContacts(prev => ({ ...prev, [agencyName]: info }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <Contact className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold dark:text-slate-100">Agency Contacts</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agencies.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No agencies found in your data. Import a CSV first.
            </div>
          ) : (
            <div className="space-y-4">
              {agencies.map(agency => (
                <div key={agency} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{agency}</label>
                      <input
                        type="text"
                        placeholder="Enter contact info (email, phone, etc.)"
                        className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm dark:text-slate-100"
                        value={contacts[agency] || ''}
                        onChange={(e) => setContacts(prev => ({ ...prev, [agency]: e.target.value }))}
                        onBlur={(e) => handleSave(agency, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ rates, onClose, onSave }: { 
  rates: Record<Currency, number>; 
  onClose: () => void; 
  onSave: (rates: Record<Currency, number>) => void 
}) {
  const [localRates, setLocalRates] = useState(rates);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold dark:text-slate-100">Currency Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Update the exchange rates relative to 1 USD.
          </p>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GBP (£) Rate</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                value={localRates.GBP}
                onChange={(e) => setLocalRates(r => ({ ...r, GBP: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PKR (Rs) Rate</label>
              <input
                type="number"
                step="1"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-slate-100"
                value={localRates.PKR}
                onChange={(e) => setLocalRates(r => ({ ...r, PKR: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localRates)}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20 transition-colors"
          >
            Save Rates
          </button>
        </div>
      </div>
    </div>
  );
}
