import React, { useState } from 'react';
import { useApp } from './AppContext';
import { UserRole } from './types';
import {
  LayoutDashboard,
  TableProperties,
  CalendarDays,
  Flame,
  AlertOctagon,
  FileSpreadsheet,
  Download,
  Settings,
  ShieldCheck,
  Building2,
  Users,
  ChevronDown,
  Menu,
  X,
  Gauge,
  LogOut
} from 'lucide-react';
import { HourlyDashboard } from './HourlyDashboard';
import { DailyDashboard } from './DailyDashboard';
import { ProductionEntry } from './ProductionEntry';
import { RejectionManagement } from './RejectionManagement';
import { TemperatureMonitoring } from './TemperatureMonitoring';
import { ReportsExport } from './ReportsExport';
import { MasterSettings } from './MasterSettings';
import { AuditLogsView } from './AuditLogsView';
import { LoginPage } from './LoginPage';

type NavigationTab =
  | 'HOURLY_ENTRY'
  | 'CONTROL_TOWER'
  | 'HOURLY_DASHBOARD'
  | 'DAILY_DASHBOARD'
  | 'TEMPERATURE'
  | 'REJECTION'
  | 'REPORTS'
  | 'MASTERS'
  | 'AUDIT';

export default function App() {
  const { currentUser, switchRole, isLoadingMasters, isAuthenticated, logout } = useApp();
  const [activeTab, setActiveTab] = useState<NavigationTab>('HOURLY_ENTRY');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // If user is not authenticated, display the Admin Login Page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Role permissions filtering
  const canAccessMasters = currentUser.role === 'Admin' || currentUser.role === 'PPC';
  const canAccessAudit = currentUser.role === 'Admin' || currentUser.role === 'Management';
  const canAccessEntry = currentUser.role === 'Admin' || currentUser.role === 'PPC' || currentUser.role === 'Production Supervisor';

  const navItems = [
    { id: 'HOURLY_ENTRY', label: 'Hourly Production Entry', icon: TableProperties, allowed: canAccessEntry },
    { id: 'CONTROL_TOWER', label: 'Executive Control Tower', icon: Gauge, allowed: true },
    { id: 'HOURLY_DASHBOARD', label: 'Hourly MIS Dashboard', icon: LayoutDashboard, allowed: true },
    { id: 'DAILY_DASHBOARD', label: 'Daily & Shift Performance', icon: CalendarDays, allowed: true },
    { id: 'TEMPERATURE', label: 'Furnace F1 & F2 Thermal Log', icon: Flame, allowed: true },
    { id: 'REJECTION', label: 'Rejection & Pareto Quality', icon: AlertOctagon, allowed: true },
    { id: 'REPORTS', label: 'Reports & Export (PDF/XLS)', icon: Download, allowed: true },
    { id: 'MASTERS', label: 'Master Data & Benchmarks', icon: Settings, allowed: canAccessMasters },
    { id: 'AUDIT', label: 'Audit Trail Logs', icon: ShieldCheck, allowed: canAccessAudit },
  ].filter(item => item.allowed);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Professional Executive Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Facility Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-base shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-white">DSPL DIE CASTING</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                  8-GDC MIS
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Hourly Production Reporting & Control Tower
              </div>
            </div>
          </div>

          {/* User Profile & Quick Entry Action */}
          <div className="flex items-center gap-3">
            <button
              id="header-quick-entry-btn"
              type="button"
              onClick={() => setActiveTab('HOURLY_ENTRY')}
              className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                activeTab === 'HOURLY_ENTRY'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5 text-blue-300" />
              <span>Enter Production Data</span>
            </button>

            <div className="relative">
              <button
                id="role-dropdown-btn"
                type="button"
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700/80 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-white leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span>Role:</span>
                    <span className="font-semibold text-blue-400">{currentUser.role}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Role Switcher Menu */}
              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800">
                  <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-100">
                    Switch Active User Role
                  </div>
                  {(['Admin', 'PPC', 'Production Supervisor', 'Management', 'Viewer'] as UserRole[]).map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        switchRole(r);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        currentUser.role === r ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{r}</span>
                      {currentUser.role === r && <span className="text-[10px] font-bold text-blue-600">&bull; Active</span>}
                    </button>
                  ))}

                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      type="button"
                      id="dropdown-logout-btn"
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out / Lock Portal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Logout Header Button */}
            <button
              id="header-logout-btn"
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 hover:bg-rose-950/40 hover:border-rose-700/60 hover:text-rose-300 text-slate-300 text-xs font-bold transition-all shadow-xs"
              title="Sign Out to Admin Login Screen"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Quick Navigation Strip */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-2 overflow-x-auto scrollbar-none flex gap-2 shrink-0">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavigationTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Layout Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar (Desktop) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-1 sticky top-24">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Manufacturing Operations
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id.toLowerCase()}`}
                  onClick={() => setActiveTab(item.id as NavigationTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors text-left ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-100 px-3">
              <div className="text-[11px] font-semibold text-slate-500">Live Database Status</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Firestore Synced</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                8 GDC Normalized Architecture
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-72 bg-white h-full p-4 space-y-1 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-2">
                <span className="font-bold text-sm text-slate-900">DSPL Navigation</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as NavigationTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors text-left ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content View Container */}
        <main className="flex-1 min-w-0">
          {activeTab === 'CONTROL_TOWER' && <DailyDashboard />}
          {activeTab === 'HOURLY_ENTRY' && <ProductionEntry />}
          {activeTab === 'HOURLY_DASHBOARD' && <HourlyDashboard />}
          {activeTab === 'DAILY_DASHBOARD' && <DailyDashboard />}
          {activeTab === 'TEMPERATURE' && <TemperatureMonitoring />}
          {activeTab === 'REJECTION' && <RejectionManagement />}
          {activeTab === 'REPORTS' && <ReportsExport />}
          {activeTab === 'MASTERS' && <MasterSettings />}
          {activeTab === 'AUDIT' && <AuditLogsView />}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; DSPL 8-GDC Machine Hourly Production Reporting &amp; Manufacturing MIS Control Tower</span>
          <span className="font-mono text-[11px] text-slate-400">
            Normalized Schema &bull; 8 GDC Stations &bull; 11 Models &bull; Furnaces F-1 &amp; F-2
          </span>
        </div>
      </footer>
    </div>
  );
}
